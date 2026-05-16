import { postChat, ChatError } from './api/chat';
import { createEchoClient, type EchoClient } from './api/echo';
import { clearTokenCache, getToken, TokenMintError } from './api/token';
import type {
  BroadcastMessage,
  ContentBlock,
  TextBlock,
  UiMessage,
  WidgetConfig,
} from './types';
import { WidgetUi } from './ui/widget';

/**
 * Entry point. Bootstraps once on script load, reads window.__MINDUM_WIDGET__,
 * mounts the UI, and wires:
 *   - Lazy WS subscribe on first panel open (saves the WS handshake on
 *     pages that never use chat)
 *   - Submit → POST /api/widget/chat → broadcast arrives over WS → render
 *   - HTTP fallback: if the WS is disconnected when the assistant message
 *     would have arrived, render from the POST response body instead.
 *
 * Why broadcasts drive rendering: 2D will stream tokens via the same channel,
 * so the same hook ships markdown today and per-token append tomorrow. The
 * HTTP response stays available as a defensive fallback, never the primary.
 */
function bootstrap(): void {
  const config = readConfig();
  if (!config) return;

  // sessionStorage persistence so refreshes keep the conversation.
  const persisted = sessionStorage.getItem('mindum.sessionId');
  if (persisted) {
    config.sessionId = persisted;
  } else if (config.sessionId) {
    sessionStorage.setItem('mindum.sessionId', config.sessionId);
  }

  const ui = new WidgetUi(config);
  const messages: UiMessage[] = [];
  const renderedMessageIds = new Set<number>();
  let echo: EchoClient | null = null;
  let teardownSubscribe: (() => void) | null = null;
  let pendingAssistantResolve: (() => void) | null = null;

  // Open the WS the first time the user actually opens the panel.
  ui.onPanelFirstOpen(async () => {
    try {
      const tok = await getToken({
        tokenEndpoint: config.tokenEndpoint,
        sessionId: config.sessionId,
        endUserId: config.endUserId,
      });
      echo = createEchoClient({ apiUrl: config.apiUrl, minted: tok });
      teardownSubscribe = echo.subscribe(config.sessionId, (msg) => {
        applyBroadcast(msg);
      });
    } catch (err) {
      // WS unavailable from the start — log to console; we'll fall back to
      // HTTP rendering at send time. The user sees no error yet because
      // there's nothing to react to until they send a message.
      // eslint-disable-next-line no-console
      console.warn('[mindum] could not open WS subscribe; HTTP fallback engaged.', err);
    }
  });

  ui.onClear(() => {
    // New session_id, new conversation. Re-mint on next message.
    const fresh = `sess-${crypto.randomUUID()}`;
    config.sessionId = fresh;
    sessionStorage.setItem('mindum.sessionId', fresh);
    messages.length = 0;
    renderedMessageIds.clear();
    clearTokenCache();
    if (teardownSubscribe) {
      teardownSubscribe();
      teardownSubscribe = null;
    }
    if (echo) {
      echo.disconnect();
      echo = null;
    }
    ui.renderMessages(messages);
  });

  ui.onSubmit(async (text) => {
    messages.push({ role: 'user', text });
    ui.renderMessages(messages);
    ui.setLoading(true);

    // Set up a deadline: if no assistant broadcast arrives within
    // FALLBACK_MS of the POST returning, render from the HTTP response.
    const FALLBACK_MS = 750;
    const assistantArrival = new Promise<void>((resolve) => {
      pendingAssistantResolve = resolve;
    });

    try {
      const tok = await getToken({
        tokenEndpoint: config.tokenEndpoint,
        sessionId: config.sessionId,
        endUserId: config.endUserId,
      });

      // Lazy-open WS if onPanelFirstOpen didn't fire (rare — usually it
      // already opened by the time the user types).
      if (!echo) {
        try {
          echo = createEchoClient({ apiUrl: config.apiUrl, minted: tok });
          teardownSubscribe = echo.subscribe(config.sessionId, applyBroadcast);
        } catch {
          // Subscribe failure is non-fatal — HTTP fallback takes over.
        }
      }

      const reply = await postChat({
        apiUrl: config.apiUrl,
        token: tok.token,
        message: text,
      });

      if (reply.error) {
        messages.push({ role: 'error', text: humanizeServerError(reply.error) });
        ui.renderMessages(messages);
        ui.setLoading(false);
        return;
      }

      // Race the WS broadcast against the fallback timer. If the broadcast
      // wins, applyBroadcast already pushed the assistant message and
      // resolved the promise. If the timer wins, fall back to the HTTP
      // response body so the user is never stuck on "Thinking…".
      const result = await Promise.race([
        assistantArrival.then(() => 'broadcast' as const),
        delay(FALLBACK_MS).then(() => 'fallback' as const),
      ]);

      if (result === 'fallback' && !echo?.isConnected()) {
        messages.push({ role: 'assistant', text: reply.response, markdown: true });
        ui.renderMessages(messages);
      }
    } catch (err) {
      messages.push({ role: 'error', text: humanizeClientError(err) });
      ui.renderMessages(messages);
    } finally {
      ui.setLoading(false);
      pendingAssistantResolve = null;
    }
  });

  /**
   * Apply an incoming `widget.message` broadcast. De-dupes by message id
   * so an HTTP fallback that races with a late broadcast doesn't render
   * the same assistant reply twice.
   */
  function applyBroadcast(msg: BroadcastMessage): void {
    if (renderedMessageIds.has(msg.id)) return;
    renderedMessageIds.add(msg.id);

    // User-role broadcasts echo the message we just typed — skip; we
    // already pushed an optimistic local user bubble at submit time.
    if (msg.role === 'user') return;

    const text = extractText(msg.content);
    if (text === '') return;

    messages.push({ role: 'assistant', text, markdown: true, messageId: msg.id });
    ui.renderMessages(messages);
    pendingAssistantResolve?.();
  }
}

function extractText(blocks: ContentBlock[]): string {
  // For 2C.2 we only render text blocks. tool_use / tool_result blocks
  // exist on the wire (Phase 2D-and-later may render them inline) but
  // showing raw tool plumbing would confuse end users right now.
  return blocks
    .filter((b): b is TextBlock => b.type === 'text' && typeof (b as TextBlock).text === 'string')
    .map((b) => b.text)
    .join('\n')
    .trim();
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function readConfig(): WidgetConfig | null {
  const raw = window.__MINDUM_WIDGET__;
  if (!raw) return null;
  return {
    sessionId: raw.sessionId ?? '',
    endUserId: raw.endUserId ?? null,
    tokenEndpoint: raw.tokenEndpoint ?? '/mindum/widget/token',
    apiUrl: raw.apiUrl ?? '',
    wsUrl: raw.wsUrl ?? '',
    theme: raw.theme ?? {},
    position: raw.position === 'bottom-left' ? 'bottom-left' : 'bottom-right',
  };
}

function humanizeClientError(err: unknown): string {
  if (err instanceof TokenMintError) {
    if (err.status === 503) return "We can't reach the chat service right now. Please try again in a moment.";
    if (err.status === 502) return 'Chat service rejected the request. The integration may need attention.';
    return 'Could not start a chat session. Please retry.';
  }
  if (err instanceof ChatError) {
    if (err.status === 401) return 'Your chat session expired. Please retry to refresh it.';
    return `Chat request failed (${err.status}). Please retry.`;
  }
  return 'Something went wrong. Please retry.';
}

function humanizeServerError(code: string): string {
  if (code.startsWith('mcp_')) return "We're having trouble reaching the customer integration.";
  return 'Something went wrong on our end.';
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootstrap);
} else {
  bootstrap();
}
