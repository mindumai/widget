/**
 * Shape of window.__MINDUM_WIDGET__ — emitted by the SDK's
 * <x-mindum::widget /> Blade component and read on bootstrap.
 *
 * The SDK sets all of these from server config so the browser never holds
 * the customer's API key or MCP secret.
 */
export interface WidgetConfig {
  /** Per-browser-tab session identifier. Persists across refreshes via sessionStorage. */
  sessionId: string;
  /** Optional end-user identifier the customer's app resolved from its own auth layer. */
  endUserId: string | null;
  /** Same-origin URL the SDK exposes to mint short-lived JWTs. */
  tokenEndpoint: string;
  /** Orchestrator API base URL — chat POSTs go here. */
  apiUrl: string;
  /** Reverb WS URL — 2C.2 uses for real-time subscribe; 2C.1 ignores. */
  wsUrl: string;
  /** Visual theme overrides. */
  theme: { primary?: string };
  /** Floating bubble placement. */
  position: 'bottom-right' | 'bottom-left';
}

/** Token response from POST {tokenEndpoint}. */
export interface MintedToken {
  token: string;
  expires_at: number;
}

/** A single text content block as Anthropic returns it. */
export interface TextBlock {
  type: 'text';
  text: string;
}

/** Other content-block types pass through opaquely — 2C.1 only renders text. */
export type ContentBlock = TextBlock | { type: string; [k: string]: unknown };

/** Response shape from POST {apiUrl}/api/widget/chat. */
export interface ChatTurnResponse {
  conversation_id: number;
  response: string;
  tool_calls: number;
  iterations: number;
  stop_reason: string;
  elapsed_ms: number;
  stub: boolean;
  error: string | null;
}

/** What we keep in memory per chat session. */
export interface UiMessage {
  role: 'user' | 'assistant' | 'error';
  text: string;
}

declare global {
  interface Window {
    __MINDUM_WIDGET__?: WidgetConfig;
  }
}
