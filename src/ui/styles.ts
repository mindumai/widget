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

/**
 * W6 frosted glass — a surface color at partial opacity so the host page
 * blurs through the panel. Non-hex palette values (or a customer bg we
 * can't parse) fall back to the solid color: glass is a default, never
 * a requirement.
 */
function glass(hex: string, alpha: number): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;

  return `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${alpha})`;
}

/** The theme fields the widget can apply (mint `theme` block ∪ SDK config). */
export interface ThemeInput {
  primary?: string | null;
  preset?: string | null;
  bg?: string | null;
  radius?: number | null;
  font?: string | null;
  /** W6.5 — 'pill' (default) | 'bubble'. Consumed by WidgetUi, not CSS. */
  launcher?: string | null;
}

interface Palette {
  cream: string;
  paper: string;
  paper2: string;
  ink: string;
  inkSoft: string;
  muted: string;
  accent: string;
  accentDeep: string;
  accentSoft: string;
  onAccent: string;
  line: string;
  line2: string;
  green: string;
}

/**
 * W5 tone presets (W-L3) — one light + one dark palette per tone, ported
 * from the four widget-mockups. `serifWelcome` keeps the serif heading a
 * warm-preset signature; the other tones use their body font for it.
 * Customer `primary` overrides the accent trio in both modes (W-L4).
 */
const PRESETS: Record<string, { light: Palette; dark: Palette; serifWelcome: boolean }> = {
  warm: {
    serifWelcome: true,
    light: {
      cream: '#FAF6EF', paper: '#FFFDF9', paper2: '#F4EEE3',
      ink: '#2A251E', inkSoft: '#5C544A', muted: '#9A9085',
      accent: '#D97706', accentDeep: '#B26205', accentSoft: '#FAEDDF', onAccent: '#FFF8EC',
      line: 'rgba(42,37,30,0.08)', line2: 'rgba(42,37,30,0.14)', green: '#4F8A5B',
    },
    dark: {
      cream: '#1A1714', paper: '#221E18', paper2: '#2B261E',
      ink: '#EDE7DB', inkSoft: '#B6AC9C', muted: '#857B6E',
      accent: '#E89A3C', accentDeep: '#D9821C', accentSoft: 'rgba(232,154,60,0.16)', onAccent: '#FFF8EC',
      line: 'rgba(255,255,255,0.07)', line2: 'rgba(255,255,255,0.13)', green: '#6BB47A',
    },
  },
  // Mindum house style — mirrors the marketing site: warm amber by day,
  // teal by night. Opt-in (customers still default to `warm`); used for
  // Mindum's own demo and any customer who wants the Mindum look.
  mindum: {
    serifWelcome: true,
    light: {
      cream: '#FDFCF9', paper: '#FFFFFF', paper2: '#F6EFE3',
      ink: '#1C1917', inkSoft: '#57534E', muted: '#8A837B',
      accent: '#D97706', accentDeep: '#C06605', accentSoft: '#FDF0DB', onAccent: '#FFFFFF',
      line: 'rgba(28,25,23,0.08)', line2: 'rgba(28,25,23,0.14)', green: '#65A30D',
    },
    dark: {
      cream: '#0B1A18', paper: '#12211F', paper2: '#0F211E',
      ink: '#EAFAF5', inkSoft: '#A7C2BC', muted: '#6F8D86',
      accent: '#2DD4BF', accentDeep: '#26B6A4', accentSoft: 'rgba(45,212,191,0.16)', onAccent: '#04231E',
      line: 'rgba(255,255,255,0.07)', line2: 'rgba(255,255,255,0.13)', green: '#34D399',
    },
  },
  coral: {
    serifWelcome: false,
    light: {
      cream: '#FFF8F2', paper: '#FFFFFF', paper2: '#FBEEE6',
      ink: '#3D2B22', inkSoft: '#7A5E50', muted: '#B39A8B',
      accent: '#EC6F4C', accentDeep: '#D2502C', accentSoft: '#FCE7DD', onAccent: '#FFF8F2',
      line: 'rgba(61,43,34,0.08)', line2: 'rgba(61,43,34,0.14)', green: '#5BA86B',
    },
    dark: {
      cream: '#211A16', paper: '#2A211B', paper2: '#332820',
      ink: '#F1E7DF', inkSoft: '#C2B2A6', muted: '#8E8073',
      accent: '#F2825F', accentDeep: '#E0613B', accentSoft: 'rgba(242,130,95,0.16)', onAccent: '#FFF8F2',
      line: 'rgba(255,255,255,0.07)', line2: 'rgba(255,255,255,0.13)', green: '#6BB47A',
    },
  },
  playful: {
    serifWelcome: false,
    light: {
      cream: '#FFFFFF', paper: '#FFFFFF', paper2: '#FFF0F2',
      ink: '#241E33', inkSoft: '#5C5470', muted: '#A39DB5',
      accent: '#FF4D79', accentDeep: '#E8265A', accentSoft: '#FFE3EA', onAccent: '#FFFFFF',
      line: 'rgba(36,30,51,0.08)', line2: 'rgba(36,30,51,0.13)', green: '#0CA694',
    },
    dark: {
      cream: '#1B1626', paper: '#241C30', paper2: '#2B2240',
      ink: '#F0ECF7', inkSoft: '#B6AECB', muted: '#7E7799',
      accent: '#FF5D86', accentDeep: '#F23A6A', accentSoft: 'rgba(255,93,134,0.16)', onAccent: '#FFFFFF',
      line: 'rgba(255,255,255,0.08)', line2: 'rgba(255,255,255,0.14)', green: '#14B3A1',
    },
  },
  minimal: {
    serifWelcome: false,
    light: {
      cream: '#FFFFFF', paper: '#F7F7F8', paper2: '#EFEFF1',
      ink: '#16161A', inkSoft: '#5A5A63', muted: '#9A9AA2',
      accent: '#3B6FE0', accentDeep: '#2D5BD0', accentSoft: '#E4EBFB', onAccent: '#FFFFFF',
      line: 'rgba(16,16,20,0.09)', line2: 'rgba(16,16,20,0.15)', green: '#3E9B63',
    },
    dark: {
      cream: '#161618', paper: '#1C1C1F', paper2: '#232327',
      ink: '#EDEDEF', inkSoft: '#A6A6AD', muted: '#6B6B73',
      accent: '#7EA6FF', accentDeep: '#5B86E8', accentSoft: 'rgba(126,166,255,0.14)', onAccent: '#161618',
      line: 'rgba(255,255,255,0.08)', line2: 'rgba(255,255,255,0.14)', green: '#5FD08A',
    },
  },
};

const SERIF_STACK = 'Georgia, "Iowan Old Style", "Times New Roman", serif';
const MONO_STACK = 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';
const SANS_STACK = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';

function fontStack(font: string | null | undefined): string {
  if (font === 'serif') return SERIF_STACK;
  if (font === 'mono') return MONO_STACK;
  return SANS_STACK;
}

export function buildStyles(theme: ThemeInput): string {
  const preset = PRESETS[theme.preset ?? ''] ?? PRESETS.warm;
  const light: Palette = { ...preset.light };
  const dark: Palette = { ...preset.dark };

  // Customer primary overrides the preset's accent trio in both modes
  // (W-L4 precedence). Derivations match the pre-W5 single-primary math.
  const rgb = theme.primary ? hexToRgb(theme.primary) : null;
  if (rgb) {
    light.accent = rgbToHex(rgb);
    light.accentDeep = rgbToHex(darken(rgb, 0.18));
    light.accentSoft = rgbToHex(tint(rgb, 0.87));
    const rgbBright = tint(rgb, 0.15);
    dark.accent = rgbToHex(rgbBright);
    dark.accentDeep = rgbToHex(rgb);
    dark.accentSoft = `rgba(${rgbBright[0]},${rgbBright[1]},${rgbBright[2]},0.16)`;
  }

  // Customer background override recolors the light panel surface only —
  // the dark bundle keeps the preset's own dark surface.
  if (theme.bg && hexToRgb(theme.bg)) {
    light.cream = theme.bg;
  }

  const glowRgb = hexToRgb(light.accent) ?? hexToRgb(DEFAULT_PRIMARY)!;
  const accentGlowA = `rgba(${glowRgb[0]},${glowRgb[1]},${glowRgb[2]},0.40)`;
  const accentGlowB = `rgba(${glowRgb[0]},${glowRgb[1]},${glowRgb[2]},0)`;

  const radius = Math.max(0, Math.min(24, theme.radius ?? 20));
  const bodyFont = fontStack(theme.font);
  const welcomeFont = preset.serifWelcome ? SERIF_STACK : bodyFont;

  return `
.mindum-widget-root {
  /* -- palette (preset light bundle + customer overrides, W5) -- */
  --mw-cream:   ${light.cream};
  --mw-paper:   ${light.paper};
  --mw-paper-2: ${light.paper2};
  --mw-ink:     ${light.ink};
  --mw-ink-soft:${light.inkSoft};
  --mw-muted:   ${light.muted};
  --mw-accent:      ${light.accent};
  --mw-accent-deep: ${light.accentDeep};
  --mw-accent-soft: ${light.accentSoft};
  --mw-on-accent:   ${light.onAccent};
  --mw-line:   ${light.line};
  --mw-line-2: ${light.line2};
  --mw-green:  ${light.green};
  /* W6 frosted glass (default look). W6.5 recipe: the SHELL is the
     dramatic glass (0.58); surfaces that carry text (composer/pill,
     header, ticker) stay near-solid (0.9) so readability never depends
     on what the host page puts underneath. */
  --mw-glass:       ${glass(light.cream, 0.58)};
  --mw-paper-glass: ${glass(light.paper, 0.9)};
  --mw-serif: ${welcomeFont};
  --mw-mono: ${MONO_STACK};
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
  font-family: ${bodyFont};
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

/* ---------- Pill launcher (W6.5, default) ----------
   The composer form relocates out of the panel and becomes a centered,
   always-visible input pill at the bottom of the viewport (Fin-style).
   The panel opens above it; the pill stays the one place you type. */
.mindum-widget-root.is-pill[data-position] {
  left: 50%; right: auto; bottom: 10px;
  transform: translateX(-50%);
  width: min(600px, calc(100vw - 32px));
  align-items: stretch;
}
.mindum-widget-root.is-pill .mindum-widget-bubble { display: none; }
.mindum-widget-root.is-pill .mindum-widget-rz { display: none; }
.mindum-widget-root.is-pill .mindum-widget-panel {
  width: 100%;
  height: min(560px, calc(100vh - 170px));
  margin-bottom: 10px;
}
.mindum-widget-root.is-pill .mindum-widget-pillbar {
  display: flex; flex-direction: column; gap: 5px;
}
.mindum-widget-root.is-pill .mindum-widget-form {
  margin: 0; padding: 0;
  background: transparent;
  border-top: none;
}
/* Fin-style compact-until-engaged: the closed pill sits at a modest
   width; focusing it (or opening the panel) expands to the full bar.
   max-width animates; width stays 100% so centering holds. */
.mindum-widget-root.is-pill .mindum-widget-composer {
  border-radius: 999px;
  padding: 5px 5px 5px 18px;
  box-shadow: 0 10px 32px rgba(0,0,0,0.14);
  width: 100%;
  max-width: 340px;
  margin: 0 auto;
  transition: max-width var(--mw-md) var(--mw-out), border-color var(--mw-sm) var(--mw-out), box-shadow var(--mw-sm) var(--mw-out);
}
.mindum-widget-root.is-pill .mindum-widget-composer.is-focus,
.mindum-widget-root.is-pill.is-open .mindum-widget-composer {
  max-width: 100%;
}
@supports ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))) {
  .mindum-widget-root.is-pill .mindum-widget-composer {
    -webkit-backdrop-filter: blur(18px) saturate(1.4);
    backdrop-filter: blur(18px) saturate(1.4);
  }
}
.mindum-widget-root.is-pill .mindum-widget-input { font-size: 15px; }
.mindum-widget-root.is-pill .mindum-widget-send { border-radius: 50%; }
/* W6.5 scope cut (2026-08-05): read-aloud and expand are parked — the
   buttons stay in the DOM (their modules keep working) but never render.
   Restore by deleting these two rules. */
.mindum-widget-root .mindum-widget-speak,
.mindum-widget-root .mindum-widget-expand { display: none; }

/* Brand line under the pill replaces the keyboard-hint footnote. Gets
   its own tiny glass chip so it stays legible over vivid host content. */
.mindum-widget-root.is-pill .mindum-widget-footnote {
  margin: 0 auto;
  width: max-content;
  padding: 2px 10px;
  border-radius: 999px;
  background: var(--mw-paper-glass, var(--mw-paper));
}
/* The panel stays display:flex but invisible when closed (existing
   opacity/transform transition) — the pillbar below it is always live. */

/* ---------- Panel ---------- */
.mindum-widget-panel {
  position: relative;
  display: flex; flex-direction: column; overflow: hidden;
  width: 384px; height: 560px;
  max-width: calc(100vw - 32px); max-height: calc(100vh - 130px);
  margin-bottom: 14px;
  background: var(--mw-cream);
  border: 1px solid var(--mw-line-2);
  border-radius: ${radius}px;
  box-shadow: var(--mw-shadow-panel);
  opacity: 0; transform: translateY(14px) scale(0.96);
  pointer-events: none;
  transition: opacity var(--mw-sm) var(--mw-out), transform var(--mw-md) var(--mw-spring);
}
/* W6 frosted glass (default look): the host page blurs through the
   panel. Gated behind @supports so unsupporting browsers keep the
   solid surface above — glass is an enhancement, never a dependency. */
@supports ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))) {
  .mindum-widget-panel {
    background: var(--mw-glass);
    -webkit-backdrop-filter: blur(16px) saturate(1.35);
    backdrop-filter: blur(16px) saturate(1.35);
  }
}
.mindum-widget-root[data-position="bottom-right"] .mindum-widget-panel { transform-origin: bottom right; }
.mindum-widget-root[data-position="bottom-left"]  .mindum-widget-panel { transform-origin: bottom left; }
.mindum-widget-root.is-open .mindum-widget-panel { opacity: 1; transform: translateY(0) scale(1); pointer-events: auto; }

/* ---------- Header ---------- */
.mindum-widget-header {
  display: flex; align-items: center; gap: 10px;
  padding: 13px 14px;
  background: var(--mw-paper-glass, var(--mw-paper));
  border-bottom: 1px solid var(--mw-line);
}
.mindum-widget-head-avatar {
  width: 30px; height: 30px; border-radius: 9px; flex: none;
  background: linear-gradient(150deg, var(--mw-accent) 0%, var(--mw-accent-deep) 100%);
  display: grid; place-items: center; color: var(--mw-on-accent);
}
/* W6 — agent monogram replaces the sparkle when a scoped agent is
   resolved (unless the customer's logo already owns the avatar). */
.mindum-widget-head-avatar.is-monogram {
  font-weight: 600; font-size: 14px; letter-spacing: 0.01em;
  border-radius: 50%;
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

/* markdown content (W7 hardening pass)
   The bubble's own pre-wrap is for plain text; rendered markdown flips
   to normal whitespace via .is-md — otherwise marked's inter-tag
   newlines paint as huge gaps around lists/paragraphs. Every allowed
   tag gets explicit margins + typography with !important on the
   host-bleed-prone properties, because these are bare ul/li/a/h* tags
   inside the customer's page and Tailwind preflight / theme CSS
   otherwise restyles them (the demo-app showed inflated list gaps and
   drifting fonts before this). */
.mindum-widget-bubble-msg.is-md { white-space: normal; }
.mindum-widget-bubble-msg > *:first-child { margin-top: 0 !important; }
.mindum-widget-bubble-msg > *:last-child { margin-bottom: 0 !important; }
.mindum-widget-bubble-msg p { margin: 0 0 0.55em; font: inherit; }
.mindum-widget-bubble-msg p:last-child { margin-bottom: 0; }
.mindum-widget-bubble-msg ul, .mindum-widget-bubble-msg ol {
  margin: 0.4em 0 !important;
  padding: 0 0 0 1.35em !important;
}
.mindum-widget-bubble-msg ul { list-style: disc outside; }
.mindum-widget-bubble-msg ol { list-style: decimal outside; }
.mindum-widget-bubble-msg li {
  margin: 0.18em 0 !important;
  padding: 0 !important;
  font: inherit;
  line-height: 1.55;
}
/* Loose lists (blank lines between items) render as <li><p>…</p></li>;
   the paragraph's own margin would double the gap. */
.mindum-widget-bubble-msg li > p { margin: 0 !important; }
.mindum-widget-bubble-msg h1, .mindum-widget-bubble-msg h2, .mindum-widget-bubble-msg h3,
.mindum-widget-bubble-msg h4, .mindum-widget-bubble-msg h5, .mindum-widget-bubble-msg h6 {
  margin: 0.7em 0 0.3em !important;
  font-family: inherit;
  font-weight: 600;
  line-height: 1.3;
  color: inherit;
}
.mindum-widget-bubble-msg h1 { font-size: 1.15em; }
.mindum-widget-bubble-msg h2 { font-size: 1.1em; }
.mindum-widget-bubble-msg h3, .mindum-widget-bubble-msg h4,
.mindum-widget-bubble-msg h5, .mindum-widget-bubble-msg h6 { font-size: 1.02em; }
.mindum-widget-bubble-msg blockquote {
  margin: 0.5em 0 !important;
  padding: 0.1em 0 0.1em 0.8em !important;
  border-left: 3px solid var(--mw-line-2);
  color: var(--mw-ink-soft);
}
.mindum-widget-bubble-msg table {
  border-collapse: collapse;
  margin: 0.5em 0 !important;
  font-size: 0.95em;
  display: block;
  overflow-x: auto;
  max-width: 100%;
}
.mindum-widget-bubble-msg th, .mindum-widget-bubble-msg td {
  border: 1px solid var(--mw-line-2);
  padding: 4px 9px !important;
  text-align: left;
  font: inherit;
}
.mindum-widget-bubble-msg th { font-weight: 600; background: var(--mw-paper-2); }
.mindum-widget-bubble-msg hr {
  border: none;
  border-top: 1px solid var(--mw-line-2);
  margin: 0.7em 0 !important;
}
.mindum-widget-bubble-msg strong, .mindum-widget-bubble-msg b { font-weight: 600; }
.mindum-widget-bubble-msg a {
  color: var(--mw-accent-deep) !important;
  text-decoration: underline;
  text-underline-offset: 2px;
  font: inherit;
}
.mindum-widget-message[data-role="user"] .mindum-widget-bubble-msg a { color: inherit !important; }
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

/* ---------- Status ticker (assistant thinking, W6) ----------
   Replaces the anonymous typing dots: a spinner + a phrase that cycles
   ("Thinking…" → "Exploring your data…") until real tool activity or
   the first streamed token takes over. */
.mindum-widget-typing {
  display: none;
  align-items: center; gap: 8px;
  width: max-content; max-width: calc(100% - 28px);
  margin: 0 0 8px 14px;
  padding: 10px 13px;
  background: var(--mw-paper-glass, var(--mw-paper));
  border: 1px solid var(--mw-line);
  border-radius: 15px;
  border-bottom-left-radius: 5px;
}
.mindum-widget-root.is-loading .mindum-widget-typing { display: flex; }
.mindum-widget-spin {
  width: 13px; height: 13px; flex: none;
  border-radius: 50%;
  border: 2px solid var(--mw-accent);
  border-top-color: transparent;
  animation: mindum-spin 0.85s linear infinite;
}
@keyframes mindum-spin { to { transform: rotate(360deg); } }
.mindum-widget-ticker-text {
  font-size: 12.5px; color: var(--mw-ink-soft); line-height: 1.3;
  transition: opacity 220ms var(--mw-out);
}
@media (prefers-reduced-motion: reduce) {
  .mindum-widget-spin { animation-duration: 2.4s; }
}

/* ---------- Tool-progress pill ---------- */
.mindum-widget-tool-progress {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  margin: 2px 0 11px 0;
  padding: 8px 12px;
  border-radius: 999px;
  background: var(--mw-paper-glass, var(--mw-paper));
  border: 1px solid var(--mw-line);
  color: var(--mw-ink-soft);
  font-size: 12.5px;
  line-height: 1.3;
  max-width: fit-content;
}
.mindum-widget-tool-progress .mindum-widget-spin { width: 11px; height: 11px; }

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
  background: var(--mw-paper-glass, var(--mw-cream));
  border: 1.5px solid var(--mw-line-2);
  border-radius: 18px;
  padding: 6px 6px 6px 13px;
  transition: border-color var(--mw-sm) var(--mw-out), box-shadow var(--mw-sm) var(--mw-out);
}
.mindum-widget-composer.is-focus {
  border-color: var(--mw-accent);
  box-shadow: 0 0 0 3px var(--mw-accent-soft);
}
/* Double-class selector + !important on the contested properties: host
   pages (e.g. Tailwind's forms plugin on Akaunting) style textarea:focus
   globally with a border + ring, which outranks a single class. The
   composer wrapper owns the focus affordance — the inner textarea must
   never paint its own. */
.mindum-widget-root .mindum-widget-input,
.mindum-widget-root .mindum-widget-input:focus,
.mindum-widget-root .mindum-widget-input:focus-visible {
  flex: 1;
  appearance: none;
  -webkit-appearance: none;
  border: none !important;
  outline: none !important;
  box-shadow: none !important;
  background: transparent;
  border-radius: 0;
  resize: none;
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
  border: none; border-radius: 50%; cursor: pointer;
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

/* ---------- Jump-to-latest pill (W2) ---------- */
.mindum-widget-jump {
  position: absolute;
  left: 50%;
  bottom: 96px;
  transform: translateX(-50%) translateY(8px);
  display: flex; align-items: center; gap: 6px;
  border: none; cursor: pointer;
  background: var(--mw-ink);
  color: var(--mw-cream);
  font-family: inherit; font-size: 12px; font-weight: 500;
  padding: 6px 12px; border-radius: 20px;
  box-shadow: 0 4px 14px rgba(42,37,30,0.25);
  opacity: 0; pointer-events: none;
  transition: opacity var(--mw-sm) var(--mw-out), transform var(--mw-sm) var(--mw-spring);
  z-index: 3;
}
.mindum-widget-jump.is-show { opacity: 1; pointer-events: auto; transform: translateX(-50%) translateY(0); }
.mindum-widget-jump svg { width: 13px; height: 13px; }

/* ---------- Header icon buttons: dark + expand (W2) ---------- */
.mindum-widget-dark,
.mindum-widget-expand {
  border: none; background: transparent; cursor: pointer; color: var(--mw-ink-soft);
  width: 30px; height: 30px; border-radius: 8px;
  display: grid; place-items: center; padding: 0;
  transition: background var(--mw-xs) var(--mw-out), color var(--mw-xs) var(--mw-out), transform var(--mw-xs) var(--mw-out);
}
.mindum-widget-dark:hover,
.mindum-widget-expand:hover { background: var(--mw-paper-2); color: var(--mw-ink); }
.mindum-widget-dark:active,
.mindum-widget-expand:active { transform: scale(0.9); }
.mindum-widget-dark svg,
.mindum-widget-expand svg { width: 16px; height: 16px; }
.mindum-widget-dark .mindum-widget-ic-sun { display: none; }
.mindum-widget-root[data-mw-dark="true"] .mindum-widget-dark .mindum-widget-ic-sun { display: block; }
.mindum-widget-root[data-mw-dark="true"] .mindum-widget-dark .mindum-widget-ic-moon { display: none; }
.mindum-widget-expand .mindum-widget-ic-contract { display: none; }
.mindum-widget-root.is-expanded .mindum-widget-expand .mindum-widget-ic-expand { display: none; }
.mindum-widget-root.is-expanded .mindum-widget-expand .mindum-widget-ic-contract { display: block; }

/* ---------- Expand / fullscreen (W2) ---------- */
.mindum-widget-root.is-expanded .mindum-widget-panel {
  position: fixed; inset: 0;
  width: auto; height: auto;
  max-width: none; max-height: none;
  border-radius: 0; margin: 0;
}
.mindum-widget-root.is-expanded .mindum-widget-messages {
  padding-left: max(14px, calc((100vw - 768px) / 2));
  padding-right: max(14px, calc((100vw - 768px) / 2));
}
.mindum-widget-root.is-expanded .mindum-widget-form {
  padding-left: max(12px, calc((100vw - 768px) / 2));
  padding-right: max(12px, calc((100vw - 768px) / 2));
}
.mindum-widget-root.is-expanded .mindum-widget-typing {
  margin-left: max(14px, calc((100vw - 768px) / 2));
}

/* ---------- Drag-to-resize (W2) ---------- */
.mindum-widget-rz {
  position: absolute; z-index: 4; touch-action: none;
  opacity: 0;
  transition: opacity var(--mw-sm) var(--mw-out), background var(--mw-sm) var(--mw-out);
}
.mindum-widget-rz[data-rz="y"] { top: 0; left: 20px; right: 20px; height: 6px; cursor: ns-resize; }
.mindum-widget-rz[data-rz="x"] { top: 20px; bottom: 0; width: 6px; }
.mindum-widget-root[data-position="bottom-right"] .mindum-widget-rz[data-rz="x"] { left: 0; cursor: ew-resize; }
.mindum-widget-root[data-position="bottom-left"]  .mindum-widget-rz[data-rz="x"] { right: 0; cursor: ew-resize; }
.mindum-widget-rz[data-rz="xy"] { width: 20px; height: 20px; top: 0; }
.mindum-widget-root[data-position="bottom-right"] .mindum-widget-rz[data-rz="xy"] { left: 0; cursor: nwse-resize; }
.mindum-widget-root[data-position="bottom-left"]  .mindum-widget-rz[data-rz="xy"] { right: 0; cursor: nesw-resize; }
.mindum-widget-rz[data-rz="xy"]::before {
  content: ""; position: absolute; top: 6px; width: 8px; height: 8px;
  border-top: 2px solid var(--mw-ink-soft);
}
.mindum-widget-root[data-position="bottom-right"] .mindum-widget-rz[data-rz="xy"]::before {
  left: 6px; border-left: 2px solid var(--mw-ink-soft); border-radius: 3px 0 0 0;
}
.mindum-widget-root[data-position="bottom-left"] .mindum-widget-rz[data-rz="xy"]::before {
  right: 6px; border-right: 2px solid var(--mw-ink-soft); border-radius: 0 3px 0 0;
}
.mindum-widget-panel:hover .mindum-widget-rz { opacity: 0.45; }
.mindum-widget-rz:hover { opacity: 0.95; }
.mindum-widget-panel.is-resizing .mindum-widget-rz[data-rz="y"],
.mindum-widget-panel.is-resizing .mindum-widget-rz[data-rz="x"] { opacity: 1; background: var(--mw-line-2); }
.mindum-widget-panel.is-resizing { user-select: none; }
.mindum-widget-root.is-expanded .mindum-widget-rz { display: none; }

/* ---------- Code copy button + micro-highlighter tokens (W2) ---------- */
.mindum-widget-pre { position: relative; margin: 0.5em 0 0.2em; }
.mindum-widget-pre pre { margin: 0; }
.mindum-widget-copy {
  position: absolute; top: 7px; right: 7px;
  border: none; cursor: pointer;
  background: rgba(255,247,234,0.10);
  color: #E9E0CF;
  font-family: inherit; font-size: 11px; font-weight: 500;
  padding: 4px 8px; border-radius: 7px;
  opacity: 0;
  transition: opacity var(--mw-xs) var(--mw-out), background var(--mw-xs) var(--mw-out);
}
.mindum-widget-pre:hover .mindum-widget-copy,
.mindum-widget-copy:focus-visible { opacity: 1; }
.mindum-widget-copy:hover { background: rgba(255,247,234,0.20); }
.mindum-widget-copy.is-copied { color: #9FD8A8; }
.mindum-widget-tok-k { color: #E0922F; }
.mindum-widget-tok-s { color: #9FD8A8; }
.mindum-widget-tok-n { color: #E8A87C; }
.mindum-widget-tok-c { color: #7C7567; font-style: italic; }

/* ---------- Dark mode (W2, W-L2: end-user toggle) ---------- */
.mindum-widget-root[data-mw-dark="true"] {
  --mw-cream:   ${dark.cream};
  --mw-paper:   ${dark.paper};
  --mw-paper-2: ${dark.paper2};
  --mw-ink:     ${dark.ink};
  --mw-ink-soft:${dark.inkSoft};
  --mw-muted:   ${dark.muted};
  --mw-accent:      ${dark.accent};
  --mw-accent-deep: ${dark.accentDeep};
  --mw-accent-soft: ${dark.accentSoft};
  --mw-on-accent:   ${dark.onAccent};
  --mw-line:   ${dark.line};
  --mw-line-2: ${dark.line2};
  --mw-green:  ${dark.green};
  --mw-glass:       ${glass(dark.cream, 0.68)};
  --mw-paper-glass: ${glass(dark.paper, 0.92)};
  --mw-shadow-bubble: 0 8px 24px rgba(0,0,0,0.5), 0 2px 6px rgba(0,0,0,0.4);
  --mw-shadow-panel:  0 24px 60px rgba(0,0,0,0.6), 0 6px 16px rgba(0,0,0,0.45);
}
.mindum-widget-root[data-mw-dark="true"] .mindum-widget-confirmation {
  background: linear-gradient(180deg, #2C2418 0%, #241D13 100%);
  border-color: rgba(232,154,60,0.4);
  box-shadow: none;
}
.mindum-widget-root[data-mw-dark="true"] .mindum-widget-confirm-title { color: var(--mw-accent); }
.mindum-widget-root[data-mw-dark="true"] .mindum-widget-confirm-row {
  background: rgba(255,255,255,0.04);
  border-color: rgba(255,255,255,0.10);
}
.mindum-widget-root[data-mw-dark="true"] .mindum-widget-confirm-name { color: var(--mw-ink); }
.mindum-widget-root[data-mw-dark="true"] .mindum-widget-confirm-reject {
  background: transparent;
  color: #E8C083;
  border-color: rgba(232,154,60,0.4);
}
.mindum-widget-root[data-mw-dark="true"] .mindum-widget-confirm-badge[data-decision="approved"] {
  background: rgba(107,180,122,0.18); color: #8FD3A0;
}
.mindum-widget-root[data-mw-dark="true"] .mindum-widget-confirm-badge[data-decision="rejected"] {
  background: rgba(255,255,255,0.06); color: var(--mw-muted);
}
.mindum-widget-root[data-mw-dark="true"] .mindum-widget-message[data-role="error"] .mindum-widget-bubble-msg {
  background: #32211C; border-color: #5C3328; color: #E8A18D;
}
.mindum-widget-root[data-mw-dark="true"] .mindum-widget-jump {
  background: var(--mw-paper-2); color: var(--mw-ink);
  box-shadow: 0 4px 14px rgba(0,0,0,0.45);
}

/* ---------- Narrow viewports: fullscreen panel (W2 / FR-060) ---------- */
@media (max-width: 480px) {
  .mindum-widget-panel {
    position: fixed; inset: 0;
    width: auto; height: auto;
    max-width: none; max-height: none;
    border-radius: 0; margin: 0;
  }
  .mindum-widget-expand, .mindum-widget-rz { display: none; }
  .mindum-widget-footnote { display: none; }
  .mindum-widget-pre .mindum-widget-copy { opacity: 0.75; }
}

/* ---------- Customer logo / launcher icon (W5, FR-062) ---------- */
.mindum-widget-head-avatar.has-img { background: var(--mw-paper-2); }
.mindum-widget-head-avatar img { width: 100%; height: 100%; object-fit: cover; border-radius: inherit; display: block; }
.mindum-widget-bubble-img {
  width: 30px; height: 30px; border-radius: 50%; object-fit: cover; display: block;
  transition: transform var(--mw-md) var(--mw-spring), opacity var(--mw-sm) var(--mw-out);
}
.mindum-widget-root.is-open .mindum-widget-bubble .mindum-widget-bubble-img { opacity: 0; transform: rotate(90deg) scale(0.6); }

/* ---------- Send → Stop morph (W4) ---------- */
.mindum-widget-send .mindum-widget-ic-stop { display: none; }
.mindum-widget-root.is-loading .mindum-widget-send { background: var(--mw-ink); opacity: 1; cursor: pointer; }
.mindum-widget-root.is-loading .mindum-widget-send .mindum-widget-ic-send { display: none; }
.mindum-widget-root.is-loading .mindum-widget-send .mindum-widget-ic-stop { display: block; }
.mindum-widget-root[data-mw-dark="true"].is-loading .mindum-widget-send { background: var(--mw-paper-2); color: var(--mw-ink); }

/* ---------- Voice (W3) ---------- */
.mindum-widget-speak {
  border: none; background: transparent; cursor: pointer; color: var(--mw-ink-soft);
  width: 30px; height: 30px; border-radius: 8px;
  display: grid; place-items: center; padding: 0;
  transition: background var(--mw-xs) var(--mw-out), color var(--mw-xs) var(--mw-out), transform var(--mw-xs) var(--mw-out);
}
.mindum-widget-speak:hover { background: var(--mw-paper-2); color: var(--mw-ink); }
.mindum-widget-speak:active { transform: scale(0.9); }
.mindum-widget-speak svg { width: 16px; height: 16px; }
.mindum-widget-speak.is-on { background: var(--mw-accent-soft); color: var(--mw-accent-deep); }
.mindum-widget-mic {
  flex: none;
  width: 36px; height: 36px;
  border: none; border-radius: 12px; cursor: pointer;
  background: transparent; color: var(--mw-ink-soft);
  display: grid; place-items: center;
  transition: background var(--mw-xs) var(--mw-out), color var(--mw-xs) var(--mw-out), transform var(--mw-xs) var(--mw-out);
}
.mindum-widget-mic:hover:not(:disabled) { background: var(--mw-paper-2); color: var(--mw-ink); }
.mindum-widget-mic:active:not(:disabled) { transform: scale(0.9); }
.mindum-widget-mic:disabled { opacity: 0.4; cursor: default; }
.mindum-widget-mic svg { width: 18px; height: 18px; }
.mindum-widget-mic.is-listening {
  background: var(--mw-accent);
  color: var(--mw-on-accent);
  animation: mindum-miclive 1.3s var(--mw-inout) infinite;
}
@keyframes mindum-miclive { 0%,100% { transform: scale(1); } 50% { transform: scale(1.1); } }
.mindum-widget-mic.is-blocked { color: #C25438; }

@media (prefers-reduced-motion: reduce) {
  .mindum-widget-root *, .mindum-widget-root *::before, .mindum-widget-root *::after {
    animation-duration: 0.001ms !important;
    transition-duration: 0.05ms !important;
  }
}
`;
}
