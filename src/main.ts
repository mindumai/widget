import { postChat, ChatError } from './api/chat';
import { getToken, TokenMintError } from './api/token';
import type { UiMessage, WidgetConfig } from './types';
import { WidgetUi } from './ui/widget';

/**
 * Entry point. Bootstraps once on script load, reads window.__MINDUM_WIDGET__,
 * mounts the UI, and wires submit → mint token → POST chat → render reply.
 *
 * 2C.1 scope: HTTP only. No WS subscribe yet, no markdown yet — the response
 * is a single block of text. 2C.2 adds laravel-echo / pusher-js subscribe
 * and markdown rendering. 2D streams tokens.
 */
function bootstrap(): void {
  const config = readConfig();
  if (!config) return;

  // Cheap per-tab session persistence: if sessionStorage already has a
  // session_id, reuse it across page refreshes (chat history persists).
  // Otherwise stash the config value (it came from the Blade component).
  const persisted = sessionStorage.getItem('mindum.sessionId');
  if (persisted) {
    config.sessionId = persisted;
  } else if (config.sessionId) {
    sessionStorage.setItem('mindum.sessionId', config.sessionId);
  }

  const ui = new WidgetUi(config);
  const messages: UiMessage[] = [];

  ui.onSubmit(async (text) => {
    messages.push({ role: 'user', text });
    ui.renderMessages(messages);
    ui.setLoading(true);

    try {
      const tok = await getToken({
        tokenEndpoint: config.tokenEndpoint,
        sessionId: config.sessionId,
        endUserId: config.endUserId,
      });
      const reply = await postChat({
        apiUrl: config.apiUrl,
        token: tok.token,
        message: text,
      });
      if (reply.error) {
        messages.push({ role: 'error', text: humanizeServerError(reply.error) });
      } else {
        messages.push({ role: 'assistant', text: reply.response });
      }
    } catch (err) {
      messages.push({ role: 'error', text: humanizeClientError(err) });
    } finally {
      ui.renderMessages(messages);
      ui.setLoading(false);
    }
  });
}

function readConfig(): WidgetConfig | null {
  const raw = window.__MINDUM_WIDGET__;
  if (!raw) {
    // Bootstrap config wasn't emitted — likely an unfinished install.
    // Stay silent rather than crashing the host page.
    return null;
  }
  // Shallow normalization. Defensive against stale Blade templates.
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
  // The orchestrator's error codes are stable; map the ones a user can act on.
  if (code.startsWith('mcp_')) return "We're having trouble reaching the customer integration.";
  return 'Something went wrong on our end.';
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootstrap);
} else {
  bootstrap();
}
