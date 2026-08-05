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
  /**
   * Scoped Agents — slug of the page's agent from <x-mindum::widget agent="…" />.
   * Sent with every mint; the orchestrator resolves it (or degrades to the
   * default widget on unknown/disabled slugs). Null = default widget.
   */
  agent: string | null;
  /** Same-origin URL the SDK exposes to mint short-lived JWTs. */
  tokenEndpoint: string;
  /** Orchestrator API base URL — chat POSTs go here. */
  apiUrl: string;
  /** Reverb WS URL — kept for back-compat / display, but the actual connection details come back in the mint response since 2C.2. */
  wsUrl: string;
  /** Visual theme overrides. */
  theme: { primary?: string; launcher?: 'pill' | 'bubble' };
  /** Floating bubble placement. */
  position: 'bottom-right' | 'bottom-left';
  /** First-open welcome content (FR-054). Synthetic — not persisted, not sent to Anthropic. */
  welcome: {
    /** Greeting message shown as the first assistant bubble when the panel opens with no history. Empty string disables. */
    message: string;
    /** Clickable starter prompts shown below the welcome message. Empty array = no chips. */
    prompts: string[];
  };
}

/** Reverb client connection info — returned with every mint so the widget never has to be pre-configured with our Reverb keys. */
export interface ReverbClientConfig {
  /** Reverb app key (public, like a Pusher app key). */
  key: string;
  /** Hostname the browser connects to (e.g. 'localhost' in dev, 'mindum.dev' in prod). */
  host: string;
  /** Port the browser connects to. */
  port: number;
  /** 'http' or 'https' — drives ws:// vs wss:// and Echo's forceTLS. */
  scheme: string;
}

/**
 * Per-account widget theme from the orchestrator's dashboard (Phase 3C.3).
 * Null when the customer hasn't used the look-and-feel editor — the widget
 * uses its built-in defaults. Individual keys may be null when unset.
 */
export interface MintedTheme {
  /** W5 tone preset baked into the widget: 'warm' | 'coral' | 'playful' | 'minimal'. */
  preset: string | null;
  primary: string | null;
  position: 'bottom-right' | 'bottom-left' | null;
  /** W6.5 launcher style: 'pill' (default — centered input bar) | 'bubble' (classic corner button). */
  launcher: 'pill' | 'bubble' | null;
  bg: string | null;
  radius: number | null;
  font: 'system' | 'serif' | 'mono' | null;
  logo_url: string | null;
  icon_url: string | null;
}

/**
 * Per-account welcome from the orchestrator's dashboard (Phase 3C.2).
 * Null when the customer hasn't used the welcome editor. Prompts is always
 * an array (possibly empty) when the block is present.
 */
export interface MintedWelcome {
  message: string | null;
  prompts: string[];
}

/** Scoped-agent identity for the panel header (AG5). Display fields only. */
export interface MintedAgent {
  name: string;
  slug: string;
}

/** Token response from POST {tokenEndpoint}. */
export interface MintedToken {
  token: string;
  expires_at: number;
  ws: ReverbClientConfig;
  /** Dashboard-set widget theme; null if the customer hasn't used the editor. */
  theme: MintedTheme | null;
  /** Dashboard-set welcome content; null if the customer hasn't used the editor. */
  welcome: MintedWelcome | null;
  /** Resolved scoped agent; null on the default widget or when the slug degraded. */
  agent: MintedAgent | null;
}

/** A single text content block as Anthropic returns it. */
export interface TextBlock {
  type: 'text';
  text: string;
}

/** Tool-use block — what Claude emits when it wants to call a tool. */
export interface ToolUseBlock {
  type: 'tool_use';
  id: string;
  name: string;
  input: Record<string, unknown>;
}

/** Tool-result block — what we feed back to Claude after running a tool. */
export interface ToolResultBlock {
  type: 'tool_result';
  tool_use_id: string;
  content: unknown;
  is_error?: boolean;
}

export type ContentBlock = TextBlock | ToolUseBlock | ToolResultBlock | { type: string; [k: string]: unknown };

/** Response shape from POST {apiUrl}/api/widget/chat (still useful as a fallback when WS is down). */
export interface ChatTurnResponse {
  conversation_id: number;
  response: string;
  tool_calls: number;
  iterations: number;
  stop_reason: string;
  elapsed_ms: number;
  stub: boolean;
  error: string | null;
  /** Anthropic Retry-After value, in seconds, when `error === 'rate_limited'`. */
  retry_after_seconds?: number | null;
}

/**
 * Payload of a `.widget.message` broadcast event. Mirrors the Anthropic
 * Message row on the server — the widget renders straight from this and
 * never re-fetches the message body via HTTP.
 */
export interface BroadcastMessage {
  id: number;
  role: 'user' | 'assistant';
  content: ContentBlock[];
  stop_reason: string | null;
  created_at: string | null;
}

/**
 * Payload of a `.widget.token` broadcast event. Per-token streaming
 * deltas while Claude is mid-response. The widget uses these to render
 * the assistant bubble progressively, then finalizes via the subsequent
 * `widget.message` broadcast (which carries the persisted Message row).
 *
 * Shapes match AnthropicChatClient::simplifyForCaller() on the API side.
 */
export type BroadcastToken =
  | { type: 'text_delta'; index: number; text: string }
  | { type: 'tool_use_start'; index: number; id: string; name: string }
  | { type: 'tool_use_input_delta'; index: number; partial_json: string }
  | { type: 'message_stop' };

/** A single deferred tool_use waiting for user approval. */
export interface PendingToolUse {
  id: string;
  name: string;
  input: Record<string, unknown>;
}

/**
 * Payload of a `.widget.confirmation` broadcast — see
 * WidgetConfirmationBroadcast.php on the API side. Fired when Claude
 * wants to call a confirmation-gated tool (FR-056); the widget renders
 * a card, user clicks Approve/Reject, widget POSTs /api/widget/confirm.
 */
export interface BroadcastConfirmation {
  id: number;
  conversation_id: number;
  role: 'confirmation';
  content: Array<{
    type: 'confirmation_request';
    assistant_message_id: number;
    tool_uses: PendingToolUse[];
    status: 'pending' | 'decided';
    decision?: 'approve' | 'reject';
  }>;
  created_at: string | null;
}

/** Per-card state machine the widget tracks while waiting on /api/widget/confirm. */
export type ConfirmationCardState =
  | 'pending'
  | 'approving'
  | 'rejecting'
  | 'approved'
  | 'rejected';

/** What we keep in memory per chat session for rendering. */
export interface UiMessage {
  role: 'user' | 'assistant' | 'error' | 'confirmation' | 'tool_progress';
  text: string;
  /** When the source was the WS broadcast, we hold the message id for de-dup against the HTTP fallback. */
  messageId?: number;
  /** Whether `text` should be rendered as markdown (true for assistant role). */
  markdown?: boolean;
  /** When tokens are still streaming in (2D). Suppresses markdown render + shows a caret in the bubble. */
  streaming?: boolean;
  /** Synthetic first-open welcome (FR-054). Renders as the serif heading block, not a chat bubble (W1). */
  welcome?: boolean;
  /** Confirmation-card payload; only present when role === 'confirmation'. */
  confirmation?: {
    messageId: number;
    conversationId: number;
    toolUses: PendingToolUse[];
    state: ConfirmationCardState;
  };
  /** Tool-progress pill payload (Phase 3D.3 / FR-049 / FR-057); only present when role === 'tool_progress'. */
  toolProgress?: {
    /** Raw tool_use name from the broadcast — e.g. `create_user`. We humanize at render time. */
    toolName: string;
  };
}

declare global {
  interface Window {
    __MINDUM_WIDGET__?: WidgetConfig;
  }
}
