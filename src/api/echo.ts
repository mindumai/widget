import Echo from 'laravel-echo';
import Pusher from 'pusher-js';
import type { BroadcastConfirmation, BroadcastMessage, BroadcastToken, MintedToken } from '../types';

/**
 * Lazy Echo client. We don't open a WS connection until the panel
 * first opens — keeps the host page snappy on pages that don't end
 * up using chat.
 *
 * Custom authorizer: Echo's default flow POSTs to /broadcasting/auth
 * with same-origin session cookies. Ours is cross-origin (browser → orchestrator)
 * and carries a JWT bearer, so we override `authorizer` to do the
 * exact fetch we need. Echo passes us the channel and gives us back a
 * callback to deliver the auth response (or an error).
 */
export interface EchoClient {
  /**
   * Subscribe to widget.{sessionId}.
   *   - onMessage fires for every `widget.message` broadcast (persisted Message row).
   *   - onToken fires for every `widget.token` streaming delta from 2D.
   *   - onConfirmation fires for every `widget.confirmation` broadcast from 2E.
   * Returns a teardown function.
   */
  subscribe(
    sessionId: string,
    onMessage: (msg: BroadcastMessage) => void,
    onToken?: (event: BroadcastToken) => void,
    onConfirmation?: (payload: BroadcastConfirmation) => void,
  ): () => void;
  /** Tear down the WS connection. */
  disconnect(): void;
  /** True once the underlying Pusher/Reverb connection has fired `connected`. */
  isConnected(): boolean;
}

export function createEchoClient(opts: {
  apiUrl: string;
  minted: MintedToken;
}): EchoClient {
  const { ws } = opts.minted;
  const forceTLS = ws.scheme === 'https';
  const authUrl = `${opts.apiUrl.replace(/\/+$/, '')}/api/widget/broadcasting/auth`;
  let bearer = opts.minted.token;

  // Pusher-js looks for a global by default. Echo's Reverb broadcaster
  // does the same.
  (window as unknown as { Pusher?: typeof Pusher }).Pusher = Pusher;

  const echo = new Echo({
    broadcaster: 'reverb',
    key: ws.key,
    wsHost: ws.host,
    wsPort: ws.port,
    wssPort: ws.port,
    forceTLS,
    enabledTransports: forceTLS ? ['wss'] : ['ws'],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    authorizer: (channel: any) => ({
      // Pusher's ChannelAuthorizationCallback is `(err, ChannelAuthorizationData | null) => void`.
      // The shape we POST to /api/widget/broadcasting/auth comes back as
      // `{ auth: "<key>:<signature>" }` — exactly ChannelAuthorizationData.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      authorize: (socketId: string, callback: (error: Error | null, data: any) => void) => {
        fetch(authUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            Authorization: `Bearer ${bearer}`,
          },
          body: JSON.stringify({
            socket_id: socketId,
            channel_name: channel.name,
          }),
          credentials: 'omit',
        })
          .then(async (res) => {
            if (!res.ok) {
              callback(new Error(`Channel auth failed (HTTP ${res.status})`), null);
              return;
            }
            callback(null, await res.json());
          })
          .catch((err) => {
            callback(err instanceof Error ? err : new Error('Channel auth network error'), null);
          });
      },
    }),
  });

  let connected = false;
  // Pusher emits 'state_change' on its `connection`. Track it for the
  // reconnect / fallback logic in main.ts.
  // The connector exposes the raw Pusher under `pusher`.
  const pusher = (echo.connector as unknown as { pusher: Pusher }).pusher;
  pusher.connection.bind('connected', () => {
    connected = true;
  });
  pusher.connection.bind('disconnected', () => {
    connected = false;
  });
  pusher.connection.bind('error', () => {
    connected = false;
  });

  return {
    subscribe(sessionId, onMessage, onToken, onConfirmation) {
      const channel = echo.private(`widget.${sessionId}`);
      // Note the leading dot: the orchestrator's broadcastAs() returns
      // 'widget.message' / 'widget.token' / 'widget.confirmation' —
      // without the leading dot Echo would auto-prefix with the
      // App\Events\... namespace and miss every event.
      channel.listen('.widget.message', (payload: BroadcastMessage) => {
        onMessage(payload);
      });
      if (onToken) {
        channel.listen('.widget.token', (payload: BroadcastToken) => {
          onToken(payload);
        });
      }
      if (onConfirmation) {
        channel.listen('.widget.confirmation', (payload: BroadcastConfirmation) => {
          onConfirmation(payload);
        });
      }
      return () => {
        echo.leave(`widget.${sessionId}`);
      };
    },
    disconnect() {
      echo.disconnect();
    },
    isConnected() {
      return connected;
    },
  };
}
