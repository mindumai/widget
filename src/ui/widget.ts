import type { UiMessage, WidgetConfig } from '../types';
import { buildStyles } from './styles';

/**
 * Vanilla DOM widget. No framework — each method updates the bits of the
 * DOM it owns. Small enough that this is fine; we'll revisit if/when
 * confirmation cards + streaming arrive in 2D/2E.
 */
export class WidgetUi {
  private root: HTMLDivElement;

  private messagesEl: HTMLDivElement;

  private form: HTMLFormElement;

  private input: HTMLInputElement;

  private sendBtn: HTMLButtonElement;

  private onSend: (text: string) => void = () => {};

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

  renderMessages(messages: UiMessage[]): void {
    this.messagesEl.innerHTML = '';
    for (const m of messages) {
      const wrapper = document.createElement('div');
      wrapper.className = 'mindum-widget-message';
      wrapper.dataset.role = m.role;
      const bubble = document.createElement('div');
      bubble.className = 'mindum-widget-bubble-msg';
      bubble.textContent = m.text;
      wrapper.appendChild(bubble);
      this.messagesEl.appendChild(wrapper);
    }
    // Scroll to bottom so the latest message is visible.
    this.messagesEl.scrollTop = this.messagesEl.scrollHeight;
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
    });
    this.root.querySelector<HTMLButtonElement>('.mindum-widget-close')!.addEventListener('click', () => {
      this.root.classList.remove('is-open');
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
          <button type="button" class="mindum-widget-close" aria-label="Close">&times;</button>
        </div>
        <div class="mindum-widget-messages"></div>
        <div class="mindum-widget-typing">Thinking…</div>
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

  private injectStyles(): void {
    if (document.getElementById('mindum-widget-styles')) return;
    const style = document.createElement('style');
    style.id = 'mindum-widget-styles';
    style.textContent = buildStyles(this.config.theme.primary ?? '#0F172A');
    document.head.appendChild(style);
  }
}
