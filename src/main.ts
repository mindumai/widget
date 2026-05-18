import { postChat, ChatError } from './api/chat';
import { ConfirmError, postConfirm } from './api/confirm';
import { createEchoClient, type EchoClient } from './api/echo';
import { clearTokenCache, getToken, TokenMintError } from './api/token';
import type {
  BroadcastConfirmation,
  BroadcastMessage,
  BroadcastToken,
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
  // Confirmation card message_ids we've already pushed. The same card
  // can arrive twice (broadcast + late HTTP fallback) so we dedupe.
  const renderedConfirmationIds = new Set<number>();
  let echo: EchoClient | null = null;
  let teardownSubscribe: (() => void) | null = null;
  let pendingAssistantResolve: (() => void) | null = null;
  // The in-flight streaming assistant bubble (one at a time). When tokens
  // arrive we append into this; when the corresponding widget.message lands
  // we finalize it (clear flag, apply markdown).
  let streamingMessage: UiMessage | null = null;

  // Show the welcome + suggested-prompt chips if the conversation is empty.
  // Synthetic only — not persisted, not sent to Anthropic. Hides once the
  // user submits anything.
  const showWelcomeIfEmpty = (): void => {
    if (messages.length > 0) return;
    const hasMessage = config.welcome.message.trim() !== '';
    const hasPrompts = config.welcome.prompts.length > 0;
    if (!hasMessage && !hasPrompts) return;
    if (hasMessage) {
      messages.push({ role: 'assistant', text: config.welcome.message, markdown: false });
    }
    ui.renderMessages(messages);
    if (hasPrompts) ui.showSuggestedPrompts(config.welcome.prompts);
  };

  // Open the WS the first time the user actually opens the panel. Also
  // seed the welcome bubble + chips at the same moment.
  ui.onPanelFirstOpen(async () => {
    showWelcomeIfEmpty();
    try {
      const tok = await getToken({
        tokenEndpoint: config.tokenEndpoint,
        sessionId: config.sessionId,
        endUserId: config.endUserId,
      });
      echo = createEchoClient({ apiUrl: config.apiUrl, minted: tok });
      teardownSubscribe = echo.subscribe(config.sessionId, applyBroadcast, applyToken, applyConfirmation);
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
    renderedConfirmationIds.clear();
    streamingMessage = null;
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
    // Cleared mid-conversation — re-show welcome + chips for the fresh session.
    showWelcomeIfEmpty();
  });

  const submitText = async (text: string): Promise<void> => {
    // Any submit hides the suggested-prompt chips. They're a "starter"
    // affordance only — re-showing them mid-conversation would clutter.
    ui.hideSuggestedPrompts();
    messages.push({ role: 'user', text });
    streamingMessage = null;
    ui.renderMessages(messages);
    ui.setLoading(true);

    // Set up a deadline: if no assistant broadcast arrives within
    // FALLBACK_MS of the POST returning, render from the HTTP response.
    // With 2D streaming, the FIRST text_delta already counts as the
    // assistant arriving (we resolve the promise from applyToken).
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
          teardownSubscribe = echo.subscribe(config.sessionId, applyBroadcast, applyToken, applyConfirmation);
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
        streamingMessage = null;
        messages.push({ role: 'error', text: humanizeServerError(reply.error) });
        ui.renderMessages(messages);
        ui.setLoading(false);
        return;
      }

      // If the turn paused for confirmation, there's no assistant text
      // to wait for — the confirmation card will arrive over the WS (or
      // is already in the broadcast queue). Drop the typing indicator
      // immediately and let applyConfirmation handle the render.
      if (reply.stop_reason === 'awaiting_confirmation') {
        streamingMessage = null;
        ui.setLoading(false);
        pendingAssistantResolve = null;
        return;
      }

      // Race the WS broadcast against the fallback timer. If broadcasts
      // arrived (token deltas or the final message), pendingAssistantResolve
      // has already fired. If the timer wins, fall back to the HTTP
      // response body so the user is never stuck on the typing indicator.
      const result = await Promise.race([
        assistantArrival.then(() => 'broadcast' as const),
        delay(FALLBACK_MS).then(() => 'fallback' as const),
      ]);

      if (result === 'fallback' && !echo?.isConnected()) {
        streamingMessage = null;
        messages.push({ role: 'assistant', text: reply.response, markdown: true });
        ui.renderMessages(messages);
      }
    } catch (err) {
      streamingMessage = null;
      messages.push({ role: 'error', text: humanizeClientError(err) });
      ui.renderMessages(messages);
    } finally {
      ui.setLoading(false);
      pendingAssistantResolve = null;
    }
  };

  ui.onSubmit(submitText);

  // Clicking a suggested-prompt chip is a synthetic submit — same pipeline
  // as a typed message so all the broadcast/fallback/error handling applies.
  ui.onSuggestedPrompt((text) => {
    void submitText(text);
  });

  /**
   * Apply an incoming `widget.message` broadcast (persisted Message row).
   * Two behaviors depending on whether streaming was in flight:
   *  - If we have an open streamingMessage with the matching role, finalize
   *    it: drop the streaming flag, re-render so markdown applies. The
   *    text we accumulated from deltas should already equal extractText(msg.content).
   *  - Otherwise (e.g. user-role broadcast, or assistant arrived without
   *    any deltas — non-streaming fallback path), push a fresh message
   *    if needed and dedupe by id.
   */
  function applyBroadcast(msg: BroadcastMessage): void {
    if (renderedMessageIds.has(msg.id)) return;
    renderedMessageIds.add(msg.id);

    // User-role broadcasts echo the message we just typed — skip; we
    // already pushed an optimistic local user bubble at submit time.
    if (msg.role === 'user') return;

    if (streamingMessage) {
      // Finalize the in-flight bubble. Replace text with the persisted
      // version (handles edge cases where deltas dropped a token), drop
      // the streaming flag so markdown renders, lock in the id for dedup.
      streamingMessage.text = extractText(msg.content) || streamingMessage.text;
      streamingMessage.streaming = false;
      streamingMessage.messageId = msg.id;
      streamingMessage = null;
      ui.renderMessages(messages);
      pendingAssistantResolve?.();

      return;
    }

    const text = extractText(msg.content);
    if (text === '') return;

    messages.push({ role: 'assistant', text, markdown: true, messageId: msg.id });
    ui.renderMessages(messages);
    pendingAssistantResolve?.();
  }

  /**
   * Apply a `widget.confirmation` broadcast. Pushes a card UiMessage
   * into the list and re-renders. Dedupes by message_id so a late
   * broadcast after a fallback render doesn't double-card.
   */
  function applyConfirmation(payload: BroadcastConfirmation): void {
    if (renderedConfirmationIds.has(payload.id)) return;
    renderedConfirmationIds.add(payload.id);

    const block = payload.content[0];
    if (!block || block.type !== 'confirmation_request') return;

    messages.push({
      role: 'confirmation',
      text: '',
      messageId: payload.id,
      confirmation: {
        messageId: payload.id,
        conversationId: payload.conversation_id,
        toolUses: block.tool_uses,
        state: 'pending',
      },
    });
    // The HTTP /api/widget/chat call is already settled by the time the
    // pause arrives — but applyConfirmation can also fire from the WS
    // before the HTTP response lands. Drop the typing indicator either
    // way; the card is the visible signal that the agent is waiting.
    ui.setLoading(false);
    pendingAssistantResolve?.();
    ui.renderMessages(messages);
  }

  ui.onConfirm(async (messageId, decision) => {
    const target = messages.find(
      (m) => m.role === 'confirmation' && m.confirmation?.messageId === messageId,
    );
    if (!target || !target.confirmation) return;
    if (target.confirmation.state !== 'pending') return;

    target.confirmation.state = decision === 'approve' ? 'approving' : 'rejecting';
    ui.renderMessages(messages);
    ui.setLoading(true);

    const assistantArrival = new Promise<void>((resolve) => {
      pendingAssistantResolve = resolve;
    });

    try {
      const tok = await getToken({
        tokenEndpoint: config.tokenEndpoint,
        sessionId: config.sessionId,
        endUserId: config.endUserId,
      });
      await postConfirm({
        apiUrl: config.apiUrl,
        token: tok.token,
        conversationId: target.confirmation.conversationId,
        decision,
      });
      target.confirmation.state = decision === 'approve' ? 'approved' : 'rejected';
      ui.renderMessages(messages);

      // After approve/reject, Claude responds — wait for the first token
      // or the persisted message, falling back to leaving the indicator
      // off if neither arrives in time. The race + fallback shape mirrors
      // the chat-submit path.
      const result = await Promise.race([
        assistantArrival.then(() => 'broadcast' as const),
        delay(750).then(() => 'fallback' as const),
      ]);
      if (result === 'fallback') {
        // No broadcast came — typing indicator off; the user sees the
        // decided card without an assistant reply. Rare; mostly happens
        // when Reverb is down. The next chat message will work fine.
        ui.setLoading(false);
      }
    } catch (err) {
      target.confirmation.state = 'pending';
      ui.renderMessages(messages);
      messages.push({ role: 'error', text: humanizeConfirmError(err) });
      ui.renderMessages(messages);
    } finally {
      ui.setLoading(false);
      pendingAssistantResolve = null;
    }
  });

  /**
   * Apply a `widget.token` streaming delta. We only render text_delta
   * events in 2D; tool_use_* events are forwarded but currently ignored
   * (FR-057 tool-progress indicators are a future polish).
   */
  function applyToken(event: BroadcastToken): void {
    if (event.type !== 'text_delta') return;

    if (!streamingMessage) {
      streamingMessage = {
        role: 'assistant',
        text: event.text,
        markdown: true,
        streaming: true,
      };
      messages.push(streamingMessage);
      // First token = assistant has arrived. Hide the typing indicator,
      // resolve the race so the fallback timer stops competing.
      ui.setLoading(false);
      pendingAssistantResolve?.();
    } else {
      streamingMessage.text += event.text;
    }
    ui.renderMessages(messages);
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
  const rawWelcome = (raw as { welcome?: { message?: string; prompts?: string[] } }).welcome;
  return {
    sessionId: raw.sessionId ?? '',
    endUserId: raw.endUserId ?? null,
    tokenEndpoint: raw.tokenEndpoint ?? '/mindum/widget/token',
    apiUrl: raw.apiUrl ?? '',
    wsUrl: raw.wsUrl ?? '',
    theme: raw.theme ?? {},
    position: raw.position === 'bottom-left' ? 'bottom-left' : 'bottom-right',
    welcome: {
      message: typeof rawWelcome?.message === 'string' ? rawWelcome.message : 'Hi! How can I help you today?',
      prompts: Array.isArray(rawWelcome?.prompts) ? rawWelcome.prompts.filter((p) => typeof p === 'string' && p.trim() !== '') : [],
    },
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
  if (code === 'rate_limited') return 'The chat service is busy right now. Please wait a moment and try again.';
  if (code.startsWith('mcp_')) return "We're having trouble reaching the customer integration.";
  return 'Something went wrong on our end.';
}

function humanizeConfirmError(err: unknown): string {
  if (err instanceof ConfirmError) {
    if (err.status === 401) return 'Your chat session expired. Please retry to refresh it.';
    if (err.status === 404) return 'That action is no longer available — try sending a new message.';
    return `Could not complete the action (${err.status}). Please retry.`;
  }
  if (err instanceof TokenMintError) {
    return "We can't reach the chat service right now. Please try again in a moment.";
  }
  return 'Something went wrong. Please retry.';
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootstrap);
} else {
  bootstrap();
}
