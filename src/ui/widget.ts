import type { PendingToolUse, UiMessage, WidgetConfig } from '../types';
import { enhanceCodeBlocks } from './highlight';
import { renderMarkdown } from './markdown';
import { buildStyles, type ThemeInput } from './styles';
import { createReadAloud, createSpeechInput, type ReadAloud, type SpeechInput } from './voice';

/**
 * Vanilla DOM widget. No framework — each method updates the bits of the
 * DOM it owns. Small enough that this is fine.
 *
 * W1 redesign (Widget_UI_Plan.md): launcher stays visible and morphs
 * chat↔close, panel floats above it with a spring transition, header
 * carries an avatar + live status, the composer is an auto-growing
 * textarea (Enter sends, Shift+Enter newlines), and the welcome message
 * renders as a serif heading block instead of an assistant bubble.
 *
 * W2 behaviors: smart autoscroll with a jump-to-latest pill (no more
 * yanking the scroll mid-read), end-user dark toggle persisted in
 * sessionStorage (W-L2), expand-to-fullscreen, drag-to-resize from the
 * top/side/corner, and code blocks get a copy button + micro-highlighter.
 *
 * W3 voice: mic dictation into the composer (SpeechRecognition, hidden
 * where unsupported) and a read-aloud toggle that speaks each finalized
 * assistant reply (speechSynthesis). Both in ui/voice.ts.
 *
 * W4 stop: while a turn is in flight the send button morphs into a stop
 * button (square icon, ink background). Clicking it fires onStop — the
 * bootstrap POSTs /api/widget/chat/stop and the orchestrator finalizes
 * the turn as 'cancelled'.
 *
 * W5 presets: updateTheme() applies the full dashboard theme block —
 * tone preset, primary/bg/radius/font overrides, customer logo in the
 * header and a custom launcher icon. Palette bundles live in styles.ts.
 */
export class WidgetUi {
  private root: HTMLDivElement;

  private panel: HTMLDivElement;

  private messagesEl: HTMLDivElement;

  private typingEl: HTMLDivElement;

  /** W6 — interval handle for the cycling status-ticker phrases. */
  private tickerTimer: number | null = null;

  private jumpEl: HTMLButtonElement;

  private form: HTMLFormElement;

  private composer: HTMLDivElement;

  private input: HTMLTextAreaElement;

  private sendBtn: HTMLButtonElement;

  private onSend: (text: string) => void = () => {};

  private onClearConversation: () => void = () => {};

  private onFirstOpen: () => void = () => {};

  private onConfirmDecision: (messageId: number, decision: 'approve' | 'reject') => void = () => {};

  private onPromptClick: (text: string) => void = () => {};

  private onStopRequest: () => void = () => {};

  private firstOpenFired = false;

  private loading = false;

  /** False once the user scrolls up; re-renders then show the jump pill instead of force-scrolling. */
  private stickToBottom = true;

  private expanded = false;

  private promptsEl: HTMLDivElement | null = null;

  private readAloud!: ReadAloud;

  private mic!: SpeechInput;

  /** Assistant bubbles already read aloud (or seen while the toggle was off). */
  private spoken = new WeakSet<UiMessage>();

  private styleEl: HTMLStyleElement | null = null;

  /** Merged theme across injectStyles + every updateTheme call (W5). */
  private appliedTheme: ThemeInput = {};

  constructor(private readonly config: WidgetConfig) {
    this.injectStyles();
    this.root = this.buildRoot();
    this.panel = this.root.querySelector<HTMLDivElement>('.mindum-widget-panel')!;
    this.messagesEl = this.root.querySelector<HTMLDivElement>('.mindum-widget-messages')!;
    this.typingEl = this.root.querySelector<HTMLDivElement>('.mindum-widget-typing')!;
    this.jumpEl = this.root.querySelector<HTMLButtonElement>('.mindum-widget-jump')!;
    this.form = this.root.querySelector<HTMLFormElement>('.mindum-widget-form')!;
    this.composer = this.root.querySelector<HTMLDivElement>('.mindum-widget-composer')!;
    this.input = this.root.querySelector<HTMLTextAreaElement>('.mindum-widget-input')!;
    this.sendBtn = this.root.querySelector<HTMLButtonElement>('.mindum-widget-send')!;

    // Re-apply the visitor's dark choice from this tab's earlier page views (W-L2).
    if (safeSessionGet('mindum.dark') === '1') {
      this.root.dataset.mwDark = 'true';
      this.root.querySelector('.mindum-widget-dark')?.setAttribute('aria-label', 'Switch to light mode');
    }

    this.readAloud = createReadAloud(this.root.querySelector<HTMLButtonElement>('.mindum-widget-speak')!);
    this.mic = createSpeechInput({
      button: this.root.querySelector<HTMLButtonElement>('.mindum-widget-mic')!,
      input: this.input,
      onChanged: () => {
        this.autoGrow();
        this.refreshSend();
      },
    });

    this.wireEvents();
    this.wireResize();
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

  /** Fires when the user clicks the stop button mid-stream (W4). */
  onStop(handler: () => void): void {
    this.onStopRequest = handler;
  }

  /**
   * Render a column of clickable starter chips below the welcome block.
   * Idempotent: replaces any existing chip column. Empty array hides them.
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
      chip.innerHTML = SPARK_SVG;
      const label = document.createElement('span');
      label.textContent = p;
      chip.appendChild(label);
      chip.addEventListener('click', () => {
        // Capture the text now — once hideSuggestedPrompts runs the button
        // is gone from the DOM but the click handler closure still holds it.
        this.onPromptClick(p);
      });
      wrap.appendChild(chip);
    }
    this.messagesEl.appendChild(wrap);
    this.promptsEl = wrap;
    this.stickToBottom = true;
    this.messagesEl.scrollTop = this.messagesEl.scrollHeight;
  }

  /** Remove the chip column if present. Called on any first submit. */
  hideSuggestedPrompts(): void {
    if (this.promptsEl) {
      this.promptsEl.remove();
      this.promptsEl = null;
    }
  }

  renderMessages(messages: UiMessage[]): void {
    this.messagesEl.innerHTML = '';
    for (const m of messages) {
      if (m.welcome) {
        this.messagesEl.appendChild(this.buildWelcomeBlock(m));
        continue;
      }
      if (m.role === 'confirmation' && m.confirmation) {
        this.messagesEl.appendChild(this.buildConfirmationCard(m));
        continue;
      }
      if (m.role === 'tool_progress' && m.toolProgress) {
        this.messagesEl.appendChild(this.buildToolProgressPill(m));
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
        enhanceCodeBlocks(bubble);
      } else {
        bubble.textContent = m.text;
      }
      wrapper.appendChild(bubble);
      this.messagesEl.appendChild(wrapper);
    }
    this.speakNewAssistantReply(messages);
    // Smart autoscroll (W2): follow the conversation only while the user
    // is at the bottom; otherwise offer the jump pill and leave their
    // scroll position alone.
    this.scrollDown();
  }

  /**
   * The synthetic first-open welcome (FR-054) renders as a serif heading
   * block, not a chat bubble — the one deliberate serif moment in the
   * widget (W-L5). textContent, never HTML: the string is customer config.
   */
  private buildWelcomeBlock(m: UiMessage): HTMLDivElement {
    const wrap = document.createElement('div');
    wrap.className = 'mindum-widget-welcome';
    const h = document.createElement('h2');
    h.textContent = m.text;
    wrap.appendChild(h);
    return wrap;
  }

  /**
   * Read the newest finalized assistant bubble aloud (W3). Marked via a
   * WeakSet so per-token re-renders and history re-renders never repeat a
   * reply; messages rendered while the toggle is off are marked too, so
   * flipping it on only affects future replies. Streaming bubbles wait
   * for finalize (the persisted text is what gets spoken).
   */
  private speakNewAssistantReply(messages: UiMessage[]): void {
    for (let i = messages.length - 1; i >= 0; i--) {
      const m = messages[i];
      if (m.role !== 'assistant' || m.welcome) continue;
      if (m.streaming) return;
      if (!this.spoken.has(m)) {
        this.spoken.add(m);
        this.readAloud.speak(m.text);
      }
      return;
    }
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
    title.innerHTML = WARN_SVG;
    const titleText = document.createElement('span');
    titleText.textContent = c.toolUses.length === 1 ? 'Confirm action' : `Confirm ${c.toolUses.length} actions`;
    title.appendChild(titleText);
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

  /**
   * Inline pill rendered while a tool_use is being executed by the
   * orchestrator (Phase 3D.3 / FR-049 / FR-057). Removed when the next
   * text_delta arrives — timeline reads: text → [tool ran] → text.
   * Shares the W6 .mindum-widget-spin spinner with the status ticker.
   */
  private buildToolProgressPill(m: UiMessage): HTMLDivElement {
    // role="status" implies aria-live="polite", no need to set it explicitly.
    // textContent on the trailing span defends against tool names
    // containing HTML-ish characters.
    const w = document.createElement('div');
    w.className = 'mindum-widget-tool-progress';
    w.setAttribute('role', 'status');
    w.innerHTML = '<span class="mindum-widget-spin" aria-hidden="true"></span><span></span>';
    (w.lastElementChild as HTMLElement).textContent =
      `${humanizeToolNameProgressive(m.toolProgress!.toolName)}…`;
    return w;
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
    this.loading = loading;
    this.root.classList.toggle('is-loading', loading);
    this.input.disabled = loading;
    this.mic.setDisabled(loading);
    this.refreshSend();
    this.positionJump();
    if (loading) this.startTicker();
    else this.stopTicker();
    if (!loading) this.input.focus();
  }

  /**
   * W6 status ticker — cycles generic activity phrases while the turn is
   * in flight so the wait never reads as a stall. Real tool activity
   * renders its own pill (buildToolProgressPill) and main.ts drops the
   * loading state at that point, so the generic rotation only ever covers
   * the "nothing concrete to say yet" window.
   */
  private static readonly TICKER_PHRASES = [
    'Thinking…',
    'Exploring your data…',
    'Working on it…',
    'Still thinking…',
  ];

  private startTicker(): void {
    this.stopTicker();
    const text = this.root.querySelector<HTMLSpanElement>('.mindum-widget-ticker-text');
    if (!text) return;
    text.textContent = WidgetUi.TICKER_PHRASES[0];
    text.style.opacity = '1';
    let i = 1;
    this.tickerTimer = window.setInterval(() => {
      text.style.opacity = '0';
      window.setTimeout(() => {
        text.textContent = WidgetUi.TICKER_PHRASES[i % WidgetUi.TICKER_PHRASES.length];
        text.style.opacity = '1';
        i++;
      }, 220);
    }, 1600);
  }

  private stopTicker(): void {
    if (this.tickerTimer !== null) {
      window.clearInterval(this.tickerTimer);
      this.tickerTimer = null;
    }
  }

  /**
   * While idle: send is disabled when the textarea is empty. While a turn
   * is in flight the same button becomes the STOP control (W4) — enabled,
   * stop icon via the .is-loading CSS swap.
   */
  private refreshSend(): void {
    this.sendBtn.disabled = this.loading ? false : this.input.value.trim() === '';
    this.sendBtn.setAttribute('aria-label', this.loading ? 'Stop' : 'Send');
    this.sendBtn.title = this.loading ? 'Stop generating' : 'Send';
  }

  /** Auto-grow the textarea up to its CSS max-height. */
  private autoGrow(): void {
    this.input.style.height = 'auto';
    this.input.style.height = `${Math.min(this.input.scrollHeight, 120)}px`;
    this.positionJump();
  }

  private submit(): void {
    const text = this.input.value.trim();
    if (!text || this.loading) return;
    // Sending your own message always returns you to the live tail.
    this.stickToBottom = true;
    this.input.value = '';
    this.autoGrow();
    this.refreshSend();
    this.onSend(text);
  }

  /* ---------- W2: smart autoscroll ---------- */

  private nearBottom(): boolean {
    const el = this.messagesEl;
    return el.scrollHeight - el.scrollTop - el.clientHeight < 60;
  }

  /** Follow the tail when stuck to the bottom; otherwise surface the jump pill. */
  private scrollDown(force = false): void {
    if (force || this.stickToBottom) {
      this.messagesEl.scrollTop = this.messagesEl.scrollHeight;
      this.jumpEl.classList.remove('is-show');
      return;
    }
    this.positionJump();
    this.jumpEl.classList.add('is-show');
  }

  /** Keep the pill floating just above the (variable-height) composer + typing bubble. */
  private positionJump(): void {
    const typing = this.loading ? this.typingEl.offsetHeight + 8 : 0;
    this.jumpEl.style.bottom = `${this.form.offsetHeight + typing + 12}px`;
  }

  /* ---------- W2: dark mode / expand ---------- */

  private toggleDark(): void {
    const on = this.root.dataset.mwDark !== 'true';
    if (on) {
      this.root.dataset.mwDark = 'true';
    } else {
      delete this.root.dataset.mwDark;
    }
    safeSessionSet('mindum.dark', on ? '1' : '0');
    this.root.querySelector('.mindum-widget-dark')?.setAttribute(
      'aria-label',
      on ? 'Switch to light mode' : 'Switch to dark mode',
    );
  }

  private toggleExpand(): void {
    this.expanded = !this.expanded;
    this.root.classList.toggle('is-expanded', this.expanded);
    if (this.expanded) {
      // Inline drag-resize sizes would fight the fullscreen rules.
      this.panel.style.width = '';
      this.panel.style.height = '';
    }
    const btn = this.root.querySelector('.mindum-widget-expand');
    btn?.setAttribute('aria-label', this.expanded ? 'Exit full screen' : 'Expand');
    (btn as HTMLButtonElement | null)?.setAttribute('title', this.expanded ? 'Exit full screen' : 'Expand');
    if (this.stickToBottom) this.messagesEl.scrollTop = this.messagesEl.scrollHeight;
  }

  /* ---------- W2: drag-to-resize ---------- */

  private wireResize(): void {
    const handles = this.root.querySelectorAll<HTMLDivElement>('.mindum-widget-rz');
    const MINW = 300;
    const MINH = 400;
    let sx = 0;
    let sy = 0;
    let sw = 0;
    let sh = 0;
    let dir = '';
    let active = false;

    const down = (e: PointerEvent): void => {
      if (this.expanded || isNarrowViewport()) return;
      const el = e.currentTarget as HTMLDivElement;
      dir = el.dataset.rz ?? '';
      active = true;
      sx = e.clientX;
      sy = e.clientY;
      sw = this.panel.offsetWidth;
      sh = this.panel.offsetHeight;
      this.panel.classList.add('is-resizing');
      try {
        el.setPointerCapture(e.pointerId);
      } catch {
        /* pointer capture unsupported — drag still works while over the handle */
      }
      e.preventDefault();
    };
    const move = (e: PointerEvent): void => {
      if (!active) return;
      const maxW = window.innerWidth - 42;
      const maxH = window.innerHeight - 120;
      if (dir.includes('x')) {
        // Anchored corner flips the drag direction: bottom-right panels
        // grow leftward, bottom-left panels grow rightward.
        const delta = this.root.dataset.position === 'bottom-left' ? e.clientX - sx : sx - e.clientX;
        this.panel.style.width = `${Math.max(MINW, Math.min(sw + delta, maxW))}px`;
      }
      if (dir.includes('y')) {
        this.panel.style.height = `${Math.max(MINH, Math.min(sh + (sy - e.clientY), maxH))}px`;
      }
    };
    const end = (e: PointerEvent): void => {
      if (!active) return;
      active = false;
      this.panel.classList.remove('is-resizing');
      try {
        (e.currentTarget as HTMLDivElement).releasePointerCapture(e.pointerId);
      } catch {
        /* already released */
      }
    };

    handles.forEach((h) => {
      h.addEventListener('pointerdown', down);
      h.addEventListener('pointermove', move);
      h.addEventListener('pointerup', end);
      h.addEventListener('pointercancel', end);
      h.addEventListener('dblclick', () => {
        this.panel.style.width = '';
        this.panel.style.height = '';
      });
    });
  }

  private setOpen(open: boolean): void {
    this.root.classList.toggle('is-open', open);
    const bubble = this.root.querySelector<HTMLButtonElement>('.mindum-widget-bubble')!;
    bubble.setAttribute('aria-label', open ? 'Close chat' : 'Open chat');
    if (!open) {
      if (this.expanded) this.toggleExpand();
      return;
    }
    this.input.focus();
    if (!this.firstOpenFired) {
      this.firstOpenFired = true;
      this.onFirstOpen();
    }
  }

  private wireEvents(): void {
    this.root.querySelector<HTMLButtonElement>('.mindum-widget-bubble')!.addEventListener('click', () => {
      this.setOpen(!this.root.classList.contains('is-open'));
    });
    this.root.querySelector<HTMLButtonElement>('.mindum-widget-close')!.addEventListener('click', () => {
      this.setOpen(false);
    });
    this.root.querySelector<HTMLButtonElement>('.mindum-widget-clear')!.addEventListener('click', () => {
      this.onClearConversation();
    });
    this.root.querySelector<HTMLButtonElement>('.mindum-widget-dark')!.addEventListener('click', () => {
      this.toggleDark();
    });
    this.root.querySelector<HTMLButtonElement>('.mindum-widget-expand')!.addEventListener('click', () => {
      this.toggleExpand();
    });
    this.jumpEl.addEventListener('click', () => {
      this.stickToBottom = true;
      this.messagesEl.scrollTop = this.messagesEl.scrollHeight;
      this.jumpEl.classList.remove('is-show');
    });
    this.messagesEl.addEventListener('scroll', () => {
      this.stickToBottom = this.nearBottom();
      if (this.stickToBottom) this.jumpEl.classList.remove('is-show');
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.root.classList.contains('is-open')) this.setOpen(false);
    });
    this.input.addEventListener('input', () => {
      this.autoGrow();
      this.refreshSend();
    });
    this.input.addEventListener('focus', () => this.composer.classList.add('is-focus'));
    this.input.addEventListener('blur', () => this.composer.classList.remove('is-focus'));
    this.input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this.submit();
      }
    });
    this.form.addEventListener('submit', (e) => {
      e.preventDefault();
      if (this.loading) {
        // The send button is the stop button right now (W4).
        this.onStopRequest();
        return;
      }
      this.submit();
    });
  }

  private buildRoot(): HTMLDivElement {
    const root = document.createElement('div');
    root.className = 'mindum-widget-root';
    root.dataset.position = this.config.position;
    root.innerHTML = `
      <div class="mindum-widget-panel" role="dialog" aria-label="Mindum chat">
        <div class="mindum-widget-rz" data-rz="xy" aria-hidden="true"></div>
        <div class="mindum-widget-rz" data-rz="y" aria-hidden="true"></div>
        <div class="mindum-widget-rz" data-rz="x" aria-hidden="true"></div>
        <div class="mindum-widget-header">
          <div class="mindum-widget-head-avatar" aria-hidden="true">${SPARK_SVG}</div>
          <div class="mindum-widget-head-text">
            <div class="mindum-widget-head-title">Assistant</div>
            <div class="mindum-widget-head-status"><span class="mindum-widget-head-dot"></span>AI agent</div>
          </div>
          <div class="mindum-widget-header-actions">
            <button type="button" class="mindum-widget-dark" aria-label="Switch to dark mode" title="Dark / light">
              <svg class="mindum-widget-ic-moon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>
              <svg class="mindum-widget-ic-sun" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"></circle><line x1="12" y1="2" x2="12" y2="5"></line><line x1="12" y1="19" x2="12" y2="22"></line><line x1="2" y1="12" x2="5" y2="12"></line><line x1="19" y1="12" x2="22" y2="12"></line><line x1="4.9" y1="4.9" x2="6.8" y2="6.8"></line><line x1="17.2" y1="17.2" x2="19.1" y2="19.1"></line><line x1="4.9" y1="19.1" x2="6.8" y2="17.2"></line><line x1="17.2" y1="6.8" x2="19.1" y2="4.9"></line></svg>
            </button>
            <button type="button" class="mindum-widget-speak" aria-label="Read answers aloud" aria-pressed="false" title="Read answers aloud: off">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path><path d="M19.07 4.93a10 10 0 0 1 0 14.14"></path></svg>
            </button>
            <button type="button" class="mindum-widget-expand" aria-label="Expand" title="Expand">
              <svg class="mindum-widget-ic-expand" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 3 21 3 21 9"></polyline><polyline points="9 21 3 21 3 15"></polyline><line x1="21" y1="3" x2="14" y2="10"></line><line x1="3" y1="21" x2="10" y2="14"></line></svg>
              <svg class="mindum-widget-ic-contract" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="4 14 10 14 10 20"></polyline><polyline points="20 10 14 10 14 4"></polyline><line x1="14" y1="10" x2="21" y2="3"></line><line x1="3" y1="21" x2="10" y2="14"></line></svg>
            </button>
            <button type="button" class="mindum-widget-clear" aria-label="Clear conversation" title="Clear conversation">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M3 6h18"></path>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"></path>
                <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
              </svg>
            </button>
            <button type="button" class="mindum-widget-close" aria-label="Close" title="Close">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
            </button>
          </div>
        </div>
        <div class="mindum-widget-messages" role="log" aria-live="polite"></div>
        <button type="button" class="mindum-widget-jump" aria-label="Jump to latest">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
          New message
        </button>
        <div class="mindum-widget-typing" role="status" aria-label="Assistant is working">
          <span class="mindum-widget-spin" aria-hidden="true"></span>
          <span class="mindum-widget-ticker-text">Thinking…</span>
        </div>
        <form class="mindum-widget-form">
          <div class="mindum-widget-composer">
            <textarea class="mindum-widget-input" rows="1" placeholder="Ask anything…" aria-label="Message"></textarea>
            <button type="button" class="mindum-widget-mic" aria-label="Speak" title="Speak (voice input)">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path><path d="M19 10v2a7 7 0 0 1-14 0v-2"></path><line x1="12" y1="19" x2="12" y2="23"></line><line x1="8" y1="23" x2="16" y2="23"></line></svg>
            </button>
            <button type="submit" class="mindum-widget-send" aria-label="Send" disabled>
              <svg class="mindum-widget-ic-send" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
              <svg class="mindum-widget-ic-stop" viewBox="0 0 24 24" fill="currentColor"><rect x="7" y="7" width="10" height="10" rx="2"></rect></svg>
            </button>
          </div>
          <div class="mindum-widget-footnote"><b>Enter</b> to send · <b>Shift+Enter</b> for a new line</div>
        </form>
      </div>
      <button type="button" class="mindum-widget-bubble" aria-label="Open chat">
        <svg class="mindum-widget-ic-chat" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path class="mindum-widget-spk-big" d="M11 3c.4 3.6 1.8 6 6.6 6.6-4.8.6-6.2 3-6.6 6.6-.4-3.6-1.8-6-6.6-6.6C9.2 9 10.6 6.6 11 3z"></path>
          <path class="mindum-widget-spk-s1" d="M18.5 3.2c.15 1.4.65 2.3 2.5 2.5-1.85.2-2.35 1.1-2.5 2.5-.15-1.4-.65-2.3-2.5-2.5 1.85-.2 2.35-1.1 2.5-2.5z"></path>
          <path class="mindum-widget-spk-s2" d="M17 15c.15 1.3.6 2.1 2.3 2.3-1.7.2-2.15 1-2.3 2.3-.15-1.3-.6-2.1-2.3-2.3 1.7-.2 2.15-1 2.3-2.3z"></path>
        </svg>
        <svg class="mindum-widget-ic-close" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
      </button>
    `;
    return root;
  }

  /**
   * AG5 (Scoped Agents) — retitle the panel header with the resolved
   * agent's display name once the mint response lands. textContent only:
   * the name is customer-authored data, never markup.
   */
  setAgentTitle(name: string): void {
    const trimmed = name.trim();
    if (trimmed === '') return;
    const title = this.root.querySelector('.mindum-widget-head-title');
    if (title) title.textContent = trimmed;
    const panel = this.root.querySelector('.mindum-widget-panel');
    if (panel) panel.setAttribute('aria-label', `${trimmed} chat`);

    // W6 — monogram avatar for scoped agents: the agent's initial in the
    // accent circle makes "Refund Helper" feel like a distinct product
    // surface. A customer logo (W5 theme logo_url) always wins — never
    // overwrite an avatar that already carries an image.
    const avatar = this.root.querySelector<HTMLDivElement>('.mindum-widget-head-avatar');
    if (avatar && !avatar.classList.contains('has-img')) {
      avatar.classList.add('is-monogram');
      avatar.textContent = trimmed.charAt(0).toUpperCase();
    }
  }

  /**
   * Re-style the widget after construction (Phase 3C.4, extended by W5).
   * Lets the bootstrap apply the dashboard's full theme block once the
   * mint response lands, without re-rendering the whole tree. Null/
   * undefined fields mean "no override" — the merged appliedTheme keeps
   * whatever was set before (SDK config primary, earlier mint).
   */
  updateTheme(theme: {
    primary?: string | null;
    position?: 'bottom-right' | 'bottom-left' | null;
    preset?: string | null;
    bg?: string | null;
    radius?: number | null;
    font?: string | null;
    logo_url?: string | null;
    icon_url?: string | null;
  }): void {
    let restyle = false;
    if (theme.primary != null) {
      this.appliedTheme.primary = theme.primary;
      this.config.theme = { ...this.config.theme, primary: theme.primary };
      restyle = true;
    }
    if (theme.preset != null) {
      this.appliedTheme.preset = theme.preset;
      restyle = true;
    }
    if (theme.bg != null) {
      this.appliedTheme.bg = theme.bg;
      restyle = true;
    }
    if (theme.radius != null) {
      this.appliedTheme.radius = theme.radius;
      restyle = true;
    }
    if (theme.font != null) {
      this.appliedTheme.font = theme.font;
      restyle = true;
    }
    if (restyle && this.styleEl) {
      this.styleEl.textContent = buildStyles(this.appliedTheme);
    }
    if (theme.position) {
      this.config.position = theme.position;
      this.root.dataset.position = theme.position;
    }
    if (theme.logo_url) this.applyHeaderLogo(theme.logo_url);
    if (theme.icon_url) this.applyLauncherIcon(theme.icon_url);
  }

  /** Swap the sparkle avatar for the customer's logo (W5 / FR-062). */
  private applyHeaderLogo(url: string): void {
    const avatar = this.root.querySelector<HTMLDivElement>('.mindum-widget-head-avatar');
    if (!avatar) return;
    avatar.classList.add('has-img');
    avatar.innerHTML = '';
    const img = document.createElement('img');
    img.alt = '';
    img.src = url;
    avatar.appendChild(img);
  }

  /** Swap the launcher sparkle for the customer's bubble icon (W5 / FR-062). */
  private applyLauncherIcon(url: string): void {
    const bubble = this.root.querySelector<HTMLButtonElement>('.mindum-widget-bubble');
    const chatIcon = bubble?.querySelector<SVGElement>('.mindum-widget-ic-chat');
    if (!bubble || !chatIcon) return;
    const img = document.createElement('img');
    img.alt = '';
    img.className = 'mindum-widget-bubble-img';
    img.src = url;
    chatIcon.replaceWith(img);
  }

  private injectStyles(): void {
    const existing = document.getElementById('mindum-widget-styles');
    if (existing instanceof HTMLStyleElement) {
      this.styleEl = existing;
      return;
    }
    const style = document.createElement('style');
    style.id = 'mindum-widget-styles';
    // Fallback aligns with the dashboard's warm default (Phase 3A.2 /
    // FR-062 / W5). Customer SDKs that don't ship a custom primary, and
    // accounts that haven't touched the theming editor, both render the
    // warm preset with the brand-amber accent.
    this.appliedTheme = { primary: this.config.theme.primary ?? null };
    style.textContent = buildStyles(this.appliedTheme);
    document.head.appendChild(style);
    this.styleEl = style;
  }
}

/** Four-point sparkle — the widget's "agent" mark (launcher + avatar + chips). */
const SPARK_SVG =
  '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M11 3c.4 3.6 1.8 6 6.6 6.6-4.8.6-6.2 3-6.6 6.6-.4-3.6-1.8-6-6.6-6.6C9.2 9 10.6 6.6 11 3z"></path></svg>';

/** Warning triangle for the confirmation-card title. */
const WARN_SVG =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>';

/** Narrow-viewport check — mirrors the CSS fullscreen breakpoint. */
function isNarrowViewport(): boolean {
  return window.matchMedia('(max-width: 480px)').matches;
}

function safeSessionGet(key: string): string | null {
  try {
    return sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSessionSet(key: string, value: string): void {
  try {
    sessionStorage.setItem(key, value);
  } catch {
    /* storage blocked (private mode / host CSP) — dark just won't persist */
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
 * Gerund version of the tool name for the in-progress pill — `create_user`
 * → "Creating user", `list_orders` → "Listing orders". Verbs we don't
 * recognize fall back to "Running X" so it reads as in-progress, not as
 * an imperative.
 */
const PROGRESSIVE_VERB: Record<string, string> = {
  create: 'Creating', update: 'Updating', delete: 'Deleting',
  remove: 'Removing', save: 'Saving', archive: 'Archiving',
  list: 'Listing', get: 'Looking up', find: 'Looking up',
};

function humanizeToolNameProgressive(name: string): string {
  const words = (name || '').split('_').filter(Boolean).map((w) => w.toLowerCase());
  if (words.length === 0) return 'Working';
  const gerund = PROGRESSIVE_VERB[words[0]];
  return gerund
    ? (words.length > 1 ? `${gerund} ${words.slice(1).join(' ')}` : gerund)
    : `Running ${words.join(' ')}`;
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
