import type { PendingToolUse, UiMessage, WidgetConfig } from '../types';
import { renderMarkdown } from './markdown';
import { buildStyles } from './styles';

/**
 * Vanilla DOM widget. No framework — each method updates the bits of the
 * DOM it owns. Small enough that this is fine.
 */
export class WidgetUi {
  private root: HTMLDivElement;

  private messagesEl: HTMLDivElement;

  private form: HTMLFormElement;

  private input: HTMLInputElement;

  private sendBtn: HTMLButtonElement;

  private onSend: (text: string) => void = () => {};

  private onClearConversation: () => void = () => {};

  private onFirstOpen: () => void = () => {};

  private onConfirmDecision: (messageId: number, decision: 'approve' | 'reject') => void = () => {};

  private onPromptClick: (text: string) => void = () => {};

  private firstOpenFired = false;

  private promptsEl: HTMLDivElement | null = null;

  private styleEl: HTMLStyleElement | null = null;

  constructor(private readonly config: WidgetConfig) {
    this.injectStyles();
    this.root = this.buildRoot();
    this.messagesEl = this.root.querySelector<HTMLDivElement>('.mindum-widget-messages')!;
    this.form = this.root.querySelector<HTMLFormElement>('.mindum-widget-form')!;
    this.input = this.root.querySelector<HTMLInputElement>('.mindum-widget-input')!;
    this.sendBtn = this.root.querySelector<HTMLButtonElement>('.mindum-widget-send')!;

    this.wireEvents();
    document.body.appendChild(this.root);
  }

  /** Caller wires up message submission via this. */
  onSubmit(handler: (text: string) => void): void {
    this.onSend = handler;
  }

  /** Fires once, the first time the panel opens. Used to open the WS subscribe lazily. */
  onPanelFirstOpen(handler: () => void): void {
    this.onFirstOpen = handler;
  }

  /** Fires when the user clicks the "clear conversation" button. */
  onClear(handler: () => void): void {
    this.onClearConversation = handler;
  }

  /** Fires when the user clicks Approve or Reject on a confirmation card. */
  onConfirm(handler: (messageId: number, decision: 'approve' | 'reject') => void): void {
    this.onConfirmDecision = handler;
  }

  /** Fires when the user clicks one of the welcome-screen suggested-prompt chips (FR-054). */
  onSuggestedPrompt(handler: (text: string) => void): void {
    this.onPromptClick = handler;
  }

  /**
   * Render a row of clickable starter chips below the welcome bubble.
   * Idempotent: replaces any existing chip row. Empty array hides them.
   */
  showSuggestedPrompts(prompts: string[]): void {
    this.hideSuggestedPrompts();
    if (prompts.length === 0) return;
    const wrap = document.createElement('div');
    wrap.className = 'mindum-widget-prompts';
    for (const p of prompts) {
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'mindum-widget-prompt-chip';
      chip.textContent = p;
      chip.addEventListener('click', () => {
        // Capture the text now — once hideSuggestedPrompts runs the button
        // is gone from the DOM but the click handler closure still holds it.
        this.onPromptClick(p);
      });
      wrap.appendChild(chip);
    }
    this.messagesEl.appendChild(wrap);
    this.promptsEl = wrap;
    this.messagesEl.scrollTop = this.messagesEl.scrollHeight;
  }

  /** Remove the chip row if present. Called on any first submit. */
  hideSuggestedPrompts(): void {
    if (this.promptsEl) {
      this.promptsEl.remove();
      this.promptsEl = null;
    }
  }

  renderMessages(messages: UiMessage[]): void {
    this.messagesEl.innerHTML = '';
    for (const m of messages) {
      if (m.role === 'confirmation' && m.confirmation) {
        this.messagesEl.appendChild(this.buildConfirmationCard(m));
        continue;
      }
      const wrapper = document.createElement('div');
      wrapper.className = 'mindum-widget-message';
      wrapper.dataset.role = m.role;
      if (m.streaming) {
        wrapper.dataset.streaming = 'true';
      }
      const bubble = document.createElement('div');
      bubble.className = 'mindum-widget-bubble-msg';
      if (m.markdown && m.role === 'assistant' && !m.streaming) {
        // Sanitized via DOMPurify in renderMarkdown — safe to set innerHTML.
        // User messages always go through textContent in the else branch,
        // so a user can't inject markup by typing it.
        // Streaming partial text stays as plain text until the assistant
        // bubble finalizes — partial markdown like "**foo" renders weirdly,
        // and the cost of re-running marked on every delta isn't worth it.
        bubble.innerHTML = renderMarkdown(m.text);
      } else {
        bubble.textContent = m.text;
      }
      wrapper.appendChild(bubble);
      this.messagesEl.appendChild(wrapper);
    }
    // Scroll to bottom so the latest message is visible.
    this.messagesEl.scrollTop = this.messagesEl.scrollHeight;
  }

  /**
   * Render a confirmation card for one or more deferred tool_use blocks.
   * Card states drive the button enabled state and the trailing badge:
   *   - pending: both buttons active
   *   - approving / rejecting: both buttons disabled, label shows "Working…"
   *   - approved / rejected: buttons removed, decided badge shown
   */
  private buildConfirmationCard(m: UiMessage): HTMLDivElement {
    const c = m.confirmation!;
    const wrapper = document.createElement('div');
    wrapper.className = 'mindum-widget-confirmation';
    wrapper.dataset.state = c.state;

    const title = document.createElement('div');
    title.className = 'mindum-widget-confirm-title';
    title.textContent = c.toolUses.length === 1 ? 'Confirm action' : `Confirm ${c.toolUses.length} actions`;
    wrapper.appendChild(title);

    const list = document.createElement('ul');
    list.className = 'mindum-widget-confirm-list';
    for (const tu of c.toolUses) {
      list.appendChild(this.buildToolUseRow(tu));
    }
    wrapper.appendChild(list);

    if (c.state === 'pending' || c.state === 'approving' || c.state === 'rejecting') {
      const actions = document.createElement('div');
      actions.className = 'mindum-widget-confirm-actions';

      const rejectBtn = document.createElement('button');
      rejectBtn.type = 'button';
      rejectBtn.className = 'mindum-widget-confirm-reject';
      rejectBtn.textContent = c.state === 'rejecting' ? 'Working…' : 'Reject';
      rejectBtn.disabled = c.state !== 'pending';
      rejectBtn.addEventListener('click', () => this.onConfirmDecision(c.messageId, 'reject'));

      const approveBtn = document.createElement('button');
      approveBtn.type = 'button';
      approveBtn.className = 'mindum-widget-confirm-approve';
      approveBtn.textContent = c.state === 'approving' ? 'Working…' : 'Approve';
      approveBtn.disabled = c.state !== 'pending';
      approveBtn.addEventListener('click', () => this.onConfirmDecision(c.messageId, 'approve'));

      actions.appendChild(rejectBtn);
      actions.appendChild(approveBtn);
      wrapper.appendChild(actions);
    } else {
      const badge = document.createElement('div');
      badge.className = 'mindum-widget-confirm-badge';
      badge.dataset.decision = c.state;
      badge.textContent = c.state === 'approved' ? 'Approved' : 'Rejected';
      wrapper.appendChild(badge);
    }

    return wrapper;
  }

  private buildToolUseRow(tu: PendingToolUse): HTMLLIElement {
    const li = document.createElement('li');
    li.className = 'mindum-widget-confirm-row';

    const name = document.createElement('span');
    name.className = 'mindum-widget-confirm-name';
    name.textContent = humanizeToolName(tu.name);
    li.appendChild(name);

    const summary = formatArgumentsSummary(tu.input);
    if (summary !== '') {
      const args = document.createElement('span');
      args.className = 'mindum-widget-confirm-args';
      args.textContent = summary;
      li.appendChild(args);
    }
    return li;
  }

  setLoading(loading: boolean): void {
    this.root.classList.toggle('is-loading', loading);
    this.sendBtn.disabled = loading;
    this.input.disabled = loading;
    if (!loading) this.input.focus();
  }

  private wireEvents(): void {
    this.root.querySelector<HTMLButtonElement>('.mindum-widget-bubble')!.addEventListener('click', () => {
      this.root.classList.add('is-open');
      this.input.focus();
      if (!this.firstOpenFired) {
        this.firstOpenFired = true;
        this.onFirstOpen();
      }
    });
    this.root.querySelector<HTMLButtonElement>('.mindum-widget-close')!.addEventListener('click', () => {
      this.root.classList.remove('is-open');
    });
    this.root.querySelector<HTMLButtonElement>('.mindum-widget-clear')!.addEventListener('click', () => {
      this.onClearConversation();
    });
    this.form.addEventListener('submit', (e) => {
      e.preventDefault();
      const text = this.input.value.trim();
      if (!text) return;
      this.input.value = '';
      this.onSend(text);
    });
  }

  private buildRoot(): HTMLDivElement {
    const root = document.createElement('div');
    root.className = 'mindum-widget-root';
    root.dataset.position = this.config.position;
    root.innerHTML = `
      <div class="mindum-widget-panel" role="dialog" aria-label="Mindum chat">
        <div class="mindum-widget-header">
          <span>Chat</span>
          <div class="mindum-widget-header-actions">
            <button type="button" class="mindum-widget-clear" aria-label="Clear conversation" title="Clear conversation">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="16" height="16">
                <path d="M3 6h18"></path>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"></path>
                <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
              </svg>
            </button>
            <button type="button" class="mindum-widget-close" aria-label="Close">&times;</button>
          </div>
        </div>
        <div class="mindum-widget-messages"></div>
        <div class="mindum-widget-typing" aria-label="Assistant is typing">
          <span class="mindum-widget-typing-dot"></span>
          <span class="mindum-widget-typing-dot"></span>
          <span class="mindum-widget-typing-dot"></span>
        </div>
        <form class="mindum-widget-form">
          <input type="text" class="mindum-widget-input" placeholder="Type a message…" autocomplete="off" />
          <button type="submit" class="mindum-widget-send">Send</button>
        </form>
      </div>
      <button type="button" class="mindum-widget-bubble" aria-label="Open chat">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
        </svg>
      </button>
    `;
    return root;
  }

  /**
   * Re-style the widget after construction (Phase 3C.4). Lets the bootstrap
   * apply a dashboard-set primary color and/or position once the mint
   * response lands, without re-rendering the whole tree.
   */
  updateTheme(theme: { primary?: string | null; position?: 'bottom-right' | 'bottom-left' | null }): void {
    if (theme.primary && this.styleEl) {
      this.config.theme = { ...this.config.theme, primary: theme.primary };
      this.styleEl.textContent = buildStyles(theme.primary);
    }
    if (theme.position) {
      this.config.position = theme.position;
      this.root.dataset.position = theme.position;
    }
  }

  private injectStyles(): void {
    const existing = document.getElementById('mindum-widget-styles');
    if (existing instanceof HTMLStyleElement) {
      this.styleEl = existing;
      return;
    }
    const style = document.createElement('style');
    style.id = 'mindum-widget-styles';
    // Fallback aligns with the dashboard's warm-amber default (Phase 3A.2 /
    // FR-062). Customer SDKs that don't ship a custom primary color, and
    // accounts that haven't touched the theming editor, both render amber.
    style.textContent = buildStyles(this.config.theme.primary ?? '#d97706');
    document.head.appendChild(style);
    this.styleEl = style;
  }
}

/**
 * Turn `create_task` into "Create task", `delete_user` into "Delete user".
 * Keeps the card label readable without the customer needing to provide
 * humanized labels on the SDK side.
 */
function humanizeToolName(name: string): string {
  if (!name) return 'Action';
  const words = name.split('_').filter((w) => w.length > 0);
  if (words.length === 0) return name;
  return words.map((w, i) => (i === 0 ? w.charAt(0).toUpperCase() + w.slice(1).toLowerCase() : w.toLowerCase())).join(' ');
}

/**
 * Compact one-line summary of tool arguments for the card. We don't try
 * to be clever — just show key=value pairs separated by commas, truncated
 * to keep cards single-line on small screens. Boolean/null/number render
 * as-is; strings get quoted; objects/arrays collapse to "(complex)".
 */
function formatArgumentsSummary(input: Record<string, unknown>): string {
  const keys = Object.keys(input);
  if (keys.length === 0) return '';
  const pairs: string[] = [];
  for (const k of keys) {
    pairs.push(`${k}: ${formatArgValue(input[k])}`);
    if (pairs.join(', ').length > 80) break;
  }
  let out = pairs.join(', ');
  if (out.length > 90) out = `${out.slice(0, 87)}…`;
  return out;
}

function formatArgValue(v: unknown): string {
  if (v === null) return 'null';
  if (typeof v === 'string') return v.length > 40 ? `"${v.slice(0, 37)}…"` : `"${v}"`;
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  return '(complex)';
}
