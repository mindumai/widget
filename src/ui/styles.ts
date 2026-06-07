/**
 * All widget styles live as one template string injected into a <style>
 * element on bootstrap. Scoped to .mindum-widget-* class names so we don't
 * stomp the host page's CSS.
 *
 * W1 redesign (Widget_UI_Plan.md): the "considered & warm" skin from
 * widget-mockups/mindum-widget-feel.html, expressed as --mw-* CSS
 * variables on the root so W5 presets become variable-bundle swaps.
 *
 * The customer's `theme.primary` feeds the accent variable; the deep
 * (gradient end) and soft (focus ring / hover tint) shades are derived
 * programmatically so a single hex from the dashboard still yields the
 * full design language. No web fonts (W-L5): the welcome heading uses a
 * system serif stack.
 */

const DEFAULT_PRIMARY = '#d97706';

/** Parse #rrggbb to [r,g,b]; null when malformed. */
function hexToRgb(hex: string): [number, number, number] | null {
  const m = /^#([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  // eslint-disable-next-line no-bitwise
  return [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff];
}

function rgbToHex([r, g, b]: [number, number, number]): string {
  // eslint-disable-next-line no-bitwise
  return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
}

/** Darken by factor k (0..1): channel * (1-k). */
function darken(rgb: [number, number, number], k: number): [number, number, number] {
  return [Math.round(rgb[0] * (1 - k)), Math.round(rgb[1] * (1 - k)), Math.round(rgb[2] * (1 - k))];
}

/** Mix toward white by factor k (0..1). */
function tint(rgb: [number, number, number], k: number): [number, number, number] {
  return [
    Math.round(rgb[0] + (255 - rgb[0]) * k),
    Math.round(rgb[1] + (255 - rgb[1]) * k),
    Math.round(rgb[2] + (255 - rgb[2]) * k),
  ];
}

export function buildStyles(primary: string): string {
  const rgb = hexToRgb(primary) ?? hexToRgb(DEFAULT_PRIMARY)!;
  const accent = rgbToHex(rgb);
  const accentDeep = rgbToHex(darken(rgb, 0.18));
  const accentSoft = rgbToHex(tint(rgb, 0.87));
  const accentGlowA = `rgba(${rgb[0]},${rgb[1]},${rgb[2]},0.40)`;
  const accentGlowB = `rgba(${rgb[0]},${rgb[1]},${rgb[2]},0)`;

  return `
.mindum-widget-root {
  /* -- palette ("warm" default; W5 presets re-bundle these) -- */
  --mw-cream:   #FAF6EF;
  --mw-paper:   #FFFDF9;
  --mw-paper-2: #F4EEE3;
  --mw-ink:     #2A251E;
  --mw-ink-soft:#5C544A;
  --mw-muted:   #9A9085;
  --mw-accent:      ${accent};
  --mw-accent-deep: ${accentDeep};
  --mw-accent-soft: ${accentSoft};
  --mw-on-accent:   #FFF8EC;
  --mw-line:   rgba(42,37,30,0.08);
  --mw-line-2: rgba(42,37,30,0.14);
  --mw-green:  #4F8A5B;
  --mw-serif: Georgia, "Iowan Old Style", "Times New Roman", serif;
  --mw-mono: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  /* -- motion -- */
  --mw-spring: cubic-bezier(0.34, 1.56, 0.64, 1);
  --mw-out:    cubic-bezier(0.22, 1, 0.36, 1);
  --mw-inout:  cubic-bezier(0.65, 0, 0.35, 1);
  --mw-xs: 120ms; --mw-sm: 200ms; --mw-md: 320ms; --mw-lg: 460ms;
  --mw-shadow-bubble: 0 8px 24px rgba(42,37,30,0.18), 0 2px 6px rgba(42,37,30,0.10);
  --mw-shadow-panel:  0 24px 60px rgba(42,37,30,0.22), 0 6px 16px rgba(42,37,30,0.10);

  position: fixed;
  z-index: 2147483000;
  display: flex;
  flex-direction: column;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
  color: var(--mw-ink);
  line-height: 1.5;
  -webkit-font-smoothing: antialiased;
}
.mindum-widget-root[data-position="bottom-right"] { right: 22px; bottom: 22px; align-items: flex-end; }
.mindum-widget-root[data-position="bottom-left"]  { left:  22px; bottom: 22px; align-items: flex-start; }

/* ---------- Launcher ---------- */
.mindum-widget-bubble {
  position: relative;
  width: 60px; height: 60px; border-radius: 50%;
  border: none; cursor: pointer;
  background: linear-gradient(150deg, var(--mw-accent) 0%, var(--mw-accent-deep) 100%);
  color: var(--mw-on-accent);
  box-shadow: var(--mw-shadow-bubble);
  display: grid; place-items: center;
  transition: transform var(--mw-sm) var(--mw-spring), box-shadow var(--mw-sm) var(--mw-out);
}
.mindum-widget-bubble:hover { transform: scale(1.06) translateY(-1px); }
.mindum-widget-bubble:active { transform: scale(0.94); }
.mindum-widget-bubble svg { width: 26px; height: 26px; transition: transform var(--mw-md) var(--mw-spring), opacity var(--mw-sm) var(--mw-out); }
.mindum-widget-bubble .mindum-widget-ic-close { position: absolute; opacity: 0; transform: rotate(-90deg) scale(0.6); }
.mindum-widget-root.is-open .mindum-widget-bubble .mindum-widget-ic-chat  { opacity: 0; transform: rotate(90deg) scale(0.6); }
.mindum-widget-root.is-open .mindum-widget-bubble .mindum-widget-ic-close { opacity: 1; transform: rotate(0) scale(1); }
.mindum-widget-bubble::after {
  content: ""; position: absolute; inset: 0; border-radius: 50%;
  box-shadow: 0 0 0 0 ${accentGlowA};
  animation: mindum-pulse 2.6s var(--mw-out) 1.2s 2;
}
@keyframes mindum-pulse {
  0% { box-shadow: 0 0 0 0 ${accentGlowA}; }
  70% { box-shadow: 0 0 0 16px ${accentGlowB}; }
  100% { box-shadow: 0 0 0 0 ${accentGlowB}; }
}
.mindum-widget-bubble .mindum-widget-spk-big { animation: mindum-spk-a 3s ease-in-out infinite; }
.mindum-widget-bubble .mindum-widget-spk-s1 { animation: mindum-spk-b 2.2s ease-in-out infinite; }
.mindum-widget-bubble .mindum-widget-spk-s2 { animation: mindum-spk-c 2.6s ease-in-out infinite 0.3s; }
.mindum-widget-bubble .mindum-widget-spk-big,
.mindum-widget-bubble .mindum-widget-spk-s1,
.mindum-widget-bubble .mindum-widget-spk-s2 { transform-box: fill-box; transform-origin: center; }
@keyframes mindum-spk-a { 0%,100% { opacity: 0.9; } 50% { opacity: 1; } }
@keyframes mindum-spk-b { 0%,100% { opacity: 0.45; transform: scale(0.7); } 45% { opacity: 1; transform: scale(1); } }
@keyframes mindum-spk-c { 0%,100% { opacity: 0.4; transform: scale(0.6); } 60% { opacity: 0.95; transform: scale(1); } }

/* ---------- Panel ---------- */
.mindum-widget-panel {
  display: flex; flex-direction: column; overflow: hidden;
  width: 384px; height: 560px;
  max-width: calc(100vw - 32px); max-height: calc(100vh - 130px);
  margin-bottom: 14px;
  background: var(--mw-cream);
  border: 1px solid var(--mw-line-2);
  border-radius: 20px;
  box-shadow: var(--mw-shadow-panel);
  opacity: 0; transform: translateY(14px) scale(0.96);
  pointer-events: none;
  transition: opacity var(--mw-sm) var(--mw-out), transform var(--mw-md) var(--mw-spring);
}
.mindum-widget-root[data-position="bottom-right"] .mindum-widget-panel { transform-origin: bottom right; }
.mindum-widget-root[data-position="bottom-left"]  .mindum-widget-panel { transform-origin: bottom left; }
.mindum-widget-root.is-open .mindum-widget-panel { opacity: 1; transform: translateY(0) scale(1); pointer-events: auto; }

/* ---------- Header ---------- */
.mindum-widget-header {
  display: flex; align-items: center; gap: 10px;
  padding: 13px 14px;
  background: var(--mw-paper);
  border-bottom: 1px solid var(--mw-line);
}
.mindum-widget-head-avatar {
  width: 30px; height: 30px; border-radius: 9px; flex: none;
  background: linear-gradient(150deg, var(--mw-accent) 0%, var(--mw-accent-deep) 100%);
  display: grid; place-items: center; color: var(--mw-on-accent);
}
.mindum-widget-head-avatar svg { width: 16px; height: 16px; }
.mindum-widget-head-text { min-width: 0; }
.mindum-widget-head-title { font-weight: 600; font-size: 15px; line-height: 1.1; }
.mindum-widget-head-status {
  font-size: 11.5px; color: var(--mw-muted);
  display: flex; align-items: center; gap: 5px; margin-top: 2px;
}
.mindum-widget-head-dot {
  width: 6px; height: 6px; border-radius: 50%; background: var(--mw-green);
  animation: mindum-live 2.4s var(--mw-out) infinite;
}
@keyframes mindum-live {
  0% { box-shadow: 0 0 0 0 rgba(79,138,91,0.5); }
  70% { box-shadow: 0 0 0 6px rgba(79,138,91,0); }
  100% { box-shadow: 0 0 0 0 rgba(79,138,91,0); }
}
.mindum-widget-header-actions { display: flex; gap: 4px; align-items: center; margin-left: auto; }
.mindum-widget-close,
.mindum-widget-clear {
  border: none; background: transparent; cursor: pointer; color: var(--mw-ink-soft);
  width: 30px; height: 30px; border-radius: 8px;
  display: grid; place-items: center; padding: 0;
  transition: background var(--mw-xs) var(--mw-out), color var(--mw-xs) var(--mw-out), transform var(--mw-xs) var(--mw-out);
}
.mindum-widget-close:hover,
.mindum-widget-clear:hover { background: var(--mw-paper-2); color: var(--mw-ink); }
.mindum-widget-close:active,
.mindum-widget-clear:active { transform: scale(0.9); }
.mindum-widget-close svg,
.mindum-widget-clear svg { width: 16px; height: 16px; }

/* ---------- Messages ---------- */
.mindum-widget-messages {
  flex: 1; overflow-y: auto;
  padding: 16px 14px 8px;
  scroll-behavior: smooth;
}
.mindum-widget-messages::-webkit-scrollbar { width: 8px; }
.mindum-widget-messages::-webkit-scrollbar-thumb {
  background: var(--mw-line-2); border-radius: 8px; border: 2px solid var(--mw-cream);
}
.mindum-widget-message { margin-bottom: 11px; display: flex; }
.mindum-widget-message[data-role="user"] { justify-content: flex-end; }
.mindum-widget-message[data-role="assistant"],
.mindum-widget-message[data-role="error"] { justify-content: flex-start; }
.mindum-widget-message:last-child:not([data-streaming="true"]),
.mindum-widget-prompts,
.mindum-widget-welcome,
.mindum-widget-tool-progress,
.mindum-widget-confirmation { animation: mindum-in var(--mw-md) var(--mw-out) both; }
@keyframes mindum-in {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
}

.mindum-widget-bubble-msg {
  max-width: 85%;
  padding: 10px 13px;
  border-radius: 15px;
  font-size: 14px;
  line-height: 1.55;
  white-space: pre-wrap;
  word-wrap: break-word;
}
.mindum-widget-message[data-role="user"] .mindum-widget-bubble-msg {
  background: linear-gradient(150deg, var(--mw-accent) 0%, var(--mw-accent-deep) 100%);
  color: var(--mw-on-accent);
  border-bottom-right-radius: 5px;
}
.mindum-widget-message[data-role="assistant"] .mindum-widget-bubble-msg {
  background: var(--mw-paper);
  border: 1px solid var(--mw-line);
  color: var(--mw-ink);
  border-bottom-left-radius: 5px;
  box-shadow: 0 1px 2px rgba(42,37,30,0.04);
}
.mindum-widget-message[data-role="error"] .mindum-widget-bubble-msg {
  background: #FBEFEC;
  border: 1px solid #EFC7BC;
  color: #A03D28;
  border-bottom-left-radius: 5px;
}

/* markdown content */
.mindum-widget-bubble-msg > *:first-child { margin-top: 0; }
.mindum-widget-bubble-msg > *:last-child { margin-bottom: 0; }
.mindum-widget-bubble-msg p { margin: 0 0 0.55em; }
.mindum-widget-bubble-msg p:last-child { margin-bottom: 0; }
.mindum-widget-bubble-msg ul, .mindum-widget-bubble-msg ol { margin: 0.4em 0; padding-left: 1.35em; }
.mindum-widget-bubble-msg li { margin: 0.18em 0; }
.mindum-widget-bubble-msg strong { font-weight: 600; }
.mindum-widget-bubble-msg a { color: var(--mw-accent-deep); text-decoration: underline; text-underline-offset: 2px; }
.mindum-widget-message[data-role="user"] .mindum-widget-bubble-msg a { color: inherit; }
.mindum-widget-bubble-msg code {
  background: var(--mw-paper-2);
  padding: 0.1em 0.4em;
  border-radius: 5px;
  font-family: var(--mw-mono);
  font-size: 0.88em;
}
.mindum-widget-bubble-msg pre {
  background: #221E17;
  border-radius: 11px;
  padding: 11px 13px;
  overflow-x: auto;
  margin: 0.5em 0;
}
.mindum-widget-bubble-msg pre code {
  background: transparent; padding: 0;
  color: #E9E0CF; font-size: 12.5px; line-height: 1.6;
}
.mindum-widget-message[data-role="user"] .mindum-widget-bubble-msg code,
.mindum-widget-message[data-role="user"] .mindum-widget-bubble-msg pre {
  background: rgba(255,255,255,0.18); color: inherit;
}

/* streaming caret */
.mindum-widget-message[data-streaming="true"] .mindum-widget-bubble-msg::after {
  content: '▋';
  display: inline-block;
  margin-left: 2px;
  font-size: 0.9em;
  color: var(--mw-accent);
  animation: mindum-breathe 1.1s var(--mw-inout) infinite;
}
@keyframes mindum-breathe { 0%,100% { opacity: 0.25; } 50% { opacity: 1; } }

/* ---------- Typing indicator (assistant thinking) ---------- */
.mindum-widget-typing {
  display: none;
  align-items: center; gap: 5px;
  width: max-content;
  margin: 0 0 8px 14px;
  padding: 11px 13px;
  background: var(--mw-paper);
  border: 1px solid var(--mw-line);
  border-radius: 15px;
  border-bottom-left-radius: 5px;
}
.mindum-widget-root.is-loading .mindum-widget-typing { display: flex; }
.mindum-widget-typing-dot {
  width: 7px; height: 7px; border-radius: 50%;
  background: var(--mw-muted);
  animation: mindum-bounce 1.3s var(--mw-inout) infinite;
}
.mindum-widget-typing-dot:nth-child(2) { animation-delay: 0.18s; }
.mindum-widget-typing-dot:nth-child(3) { animation-delay: 0.36s; }
@keyframes mindum-bounce {
  0%,70%,100% { transform: translateY(0); opacity: 0.45; }
  35% { transform: translateY(-4px); opacity: 1; }
}

/* ---------- Tool-progress pill ---------- */
.mindum-widget-tool-progress {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin: 2px 0 11px 0;
  padding: 8px 12px;
  border-radius: 999px;
  background: var(--mw-paper);
  border: 1px solid var(--mw-line);
  color: var(--mw-ink-soft);
  font-size: 12.5px;
  line-height: 1.3;
  max-width: fit-content;
}
.mindum-widget-tool-progress .mindum-widget-typing-dot { width: 5px; height: 5px; }

/* ---------- Welcome ---------- */
.mindum-widget-welcome { padding: 4px 2px 2px; margin-bottom: 10px; }
.mindum-widget-welcome h2 {
  font-family: var(--mw-serif);
  font-weight: 500;
  font-size: 21px;
  letter-spacing: 0.2px;
  line-height: 1.3;
  margin: 4px 0 0;
  color: var(--mw-ink);
}
.mindum-widget-prompts {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin: 2px 0 14px 0;
}
.mindum-widget-prompt-chip {
  display: flex; align-items: center; gap: 9px;
  text-align: left;
  background: var(--mw-paper);
  border: 1px solid var(--mw-line-2);
  color: var(--mw-ink);
  padding: 11px 13px;
  border-radius: 12px;
  font-family: inherit;
  font-size: 13.5px;
  line-height: 1.35;
  cursor: pointer;
  transition: transform var(--mw-xs) var(--mw-out), border-color var(--mw-xs) var(--mw-out), background var(--mw-xs) var(--mw-out);
}
.mindum-widget-prompt-chip:hover {
  transform: translateX(3px);
  border-color: var(--mw-accent);
  background: var(--mw-accent-soft);
}
.mindum-widget-prompt-chip:active { transform: scale(0.98); }
.mindum-widget-prompt-chip svg { width: 14px; height: 14px; flex: none; color: var(--mw-accent-deep); }

/* ---------- Confirmation card ---------- */
/* Deliberately stays warm-amber even under custom primaries — it is the
   "write action, pay attention" affordance (Phase 2E decision). */
.mindum-widget-confirmation {
  margin-bottom: 11px;
  max-width: 92%;
  padding: 13px;
  background: linear-gradient(180deg, #FFFBF2 0%, #FDF3E0 100%);
  border: 1px solid #EBC68A;
  border-radius: 14px;
  box-shadow: 0 2px 8px rgba(181,102,13,0.10);
  font-size: 13px;
  color: var(--mw-ink);
}
.mindum-widget-confirm-title {
  display: flex; align-items: center; gap: 7px;
  font-weight: 600;
  margin-bottom: 9px;
  color: #8A5410;
}
.mindum-widget-confirm-title svg { width: 15px; height: 15px; flex: none; }
.mindum-widget-confirm-list { margin: 0 0 11px 0; padding: 0; list-style: none; }
.mindum-widget-confirm-row {
  display: flex; flex-direction: column; gap: 2px;
  background: rgba(255,255,255,0.6);
  border: 1px solid #F0D9AE;
  border-radius: 9px;
  padding: 8px 10px;
  margin-bottom: 6px;
}
.mindum-widget-confirm-row:last-child { margin-bottom: 0; }
.mindum-widget-confirm-name { font-weight: 600; color: #3A342B; }
.mindum-widget-confirm-args {
  font-family: var(--mw-mono);
  font-size: 11px;
  color: var(--mw-ink-soft);
  word-break: break-all;
}
.mindum-widget-confirm-actions { display: flex; gap: 8px; }
.mindum-widget-confirm-approve,
.mindum-widget-confirm-reject {
  flex: 1;
  border: 1px solid transparent;
  cursor: pointer;
  font-family: inherit;
  font-size: 13px;
  font-weight: 600;
  padding: 9px;
  border-radius: 10px;
  transition: transform var(--mw-xs) var(--mw-out), filter var(--mw-xs) var(--mw-out);
}
.mindum-widget-confirm-approve:active,
.mindum-widget-confirm-reject:active { transform: scale(0.96); }
.mindum-widget-confirm-approve {
  background: linear-gradient(150deg, var(--mw-accent), var(--mw-accent-deep));
  color: var(--mw-on-accent);
}
.mindum-widget-confirm-approve:hover:not(:disabled) { filter: brightness(1.06); }
.mindum-widget-confirm-reject {
  background: #FFF;
  color: #8A5410;
  border-color: #EBC68A;
}
.mindum-widget-confirm-reject:hover:not(:disabled) { filter: brightness(0.97); }
.mindum-widget-confirm-approve:disabled,
.mindum-widget-confirm-reject:disabled { opacity: 0.55; cursor: not-allowed; transform: none; }
.mindum-widget-confirm-badge {
  display: inline-flex; align-items: center; gap: 5px;
  font-size: 12px; font-weight: 600;
  padding: 6px 10px; border-radius: 9px;
}
.mindum-widget-confirm-badge[data-decision="approved"] { background: #E6F0E6; color: #3D6B47; }
.mindum-widget-confirm-badge[data-decision="rejected"] { background: #F1EBE0; color: #7E766A; }
.mindum-widget-confirmation[data-state="approved"],
.mindum-widget-confirmation[data-state="rejected"] {
  opacity: 0.75;
  border-color: var(--mw-line-2);
  box-shadow: none;
}

/* ---------- Composer ---------- */
.mindum-widget-form {
  padding: 10px 12px 11px;
  border-top: 1px solid var(--mw-line);
  background: var(--mw-paper);
  margin: 0;
}
.mindum-widget-composer {
  display: flex; align-items: flex-end; gap: 8px;
  background: var(--mw-cream);
  border: 1.5px solid var(--mw-line-2);
  border-radius: 16px;
  padding: 6px 6px 6px 13px;
  transition: border-color var(--mw-sm) var(--mw-out), box-shadow var(--mw-sm) var(--mw-out);
}
.mindum-widget-composer.is-focus {
  border-color: var(--mw-accent);
  box-shadow: 0 0 0 3px var(--mw-accent-soft);
}
.mindum-widget-input {
  flex: 1;
  border: none; background: transparent; outline: none; resize: none;
  font-family: inherit;
  font-size: 14px;
  line-height: 1.45;
  color: var(--mw-ink);
  padding: 6px 0;
  min-height: 22px;
  max-height: 120px;
}
.mindum-widget-input::placeholder { color: var(--mw-muted); }
.mindum-widget-input:disabled { opacity: 0.6; }
.mindum-widget-send {
  flex: none;
  width: 36px; height: 36px;
  border: none; border-radius: 12px; cursor: pointer;
  background: linear-gradient(150deg, var(--mw-accent), var(--mw-accent-deep));
  color: var(--mw-on-accent);
  display: grid; place-items: center;
  transition: transform var(--mw-xs) var(--mw-out), opacity var(--mw-sm) var(--mw-out);
}
.mindum-widget-send:hover:not(:disabled) { transform: scale(1.06); }
.mindum-widget-send:active:not(:disabled) { transform: scale(0.9); }
.mindum-widget-send:disabled { opacity: 0.4; cursor: default; }
.mindum-widget-send svg { width: 17px; height: 17px; }
.mindum-widget-footnote {
  text-align: center;
  font-size: 10.5px;
  color: var(--mw-muted);
  margin-top: 7px;
}
.mindum-widget-footnote b { color: var(--mw-ink-soft); font-weight: 500; }

@media (prefers-reduced-motion: reduce) {
  .mindum-widget-root *, .mindum-widget-root *::before, .mindum-widget-root *::after {
    animation-duration: 0.001ms !important;
    transition-duration: 0.05ms !important;
  }
}
`;
}
