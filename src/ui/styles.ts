/**
 * All widget styles live as one template string injected into a <style>
 * element on bootstrap. Scoped to .mindum-widget-* class names so we don't
 * stomp the host page's CSS.
 *
 * 2C.2 may move to Shadow DOM for stricter isolation; for 2C.1 the class
 * prefix is enough.
 */
export function buildStyles(primary: string): string {
  return `
.mindum-widget-root {
  position: fixed;
  z-index: 2147483000;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
  color: #0f172a;
  line-height: 1.5;
}
.mindum-widget-root[data-position="bottom-right"] { right: 20px; bottom: 20px; }
.mindum-widget-root[data-position="bottom-left"]  { left:  20px; bottom: 20px; }

.mindum-widget-bubble {
  width: 56px;
  height: 56px;
  border-radius: 50%;
  background: ${primary};
  color: #fff;
  border: none;
  cursor: pointer;
  box-shadow: 0 4px 12px rgba(15,23,42,0.18);
  display: flex; align-items: center; justify-content: center;
  transition: transform 0.15s ease;
}
.mindum-widget-bubble:hover { transform: scale(1.05); }
.mindum-widget-bubble svg { width: 26px; height: 26px; }

.mindum-widget-panel {
  display: none;
  width: 360px;
  max-width: calc(100vw - 40px);
  height: 520px;
  max-height: calc(100vh - 80px);
  background: #fff;
  border-radius: 14px;
  box-shadow: 0 12px 40px rgba(15,23,42,0.22);
  overflow: hidden;
  flex-direction: column;
  margin-bottom: 12px;
}
.mindum-widget-root.is-open .mindum-widget-panel { display: flex; }
.mindum-widget-root.is-open .mindum-widget-bubble { display: none; }

.mindum-widget-header {
  background: ${primary};
  color: #fff;
  padding: 14px 16px;
  display: flex; justify-content: space-between; align-items: center;
  font-weight: 600;
}
.mindum-widget-header-actions {
  display: flex;
  gap: 6px;
  align-items: center;
}
.mindum-widget-close,
.mindum-widget-clear {
  background: none; border: none; color: #fff; cursor: pointer;
  padding: 4px 6px;
  display: flex; align-items: center; justify-content: center;
  border-radius: 4px;
}
.mindum-widget-close { font-size: 22px; line-height: 1; }
.mindum-widget-close:hover,
.mindum-widget-clear:hover { opacity: 0.8; background: rgba(255,255,255,0.12); }

.mindum-widget-messages {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
  background: #f8fafc;
}
.mindum-widget-message {
  margin-bottom: 10px;
  display: flex;
}
.mindum-widget-message[data-role="user"] { justify-content: flex-end; }
.mindum-widget-message[data-role="assistant"], .mindum-widget-message[data-role="error"] {
  justify-content: flex-start;
}
.mindum-widget-bubble-msg {
  max-width: 78%;
  padding: 10px 14px;
  border-radius: 14px;
  font-size: 14px;
  white-space: pre-wrap;
  word-wrap: break-word;
}
.mindum-widget-bubble-msg > *:first-child { margin-top: 0; }
.mindum-widget-bubble-msg > *:last-child { margin-bottom: 0; }
.mindum-widget-bubble-msg p { margin: 0.4em 0; }
.mindum-widget-bubble-msg ul, .mindum-widget-bubble-msg ol { margin: 0.4em 0; padding-left: 1.5em; }
.mindum-widget-bubble-msg li { margin: 0.2em 0; }
.mindum-widget-bubble-msg code {
  background: rgba(15,23,42,0.07);
  padding: 0.1em 0.35em;
  border-radius: 3px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 0.9em;
}
.mindum-widget-bubble-msg pre {
  background: rgba(15,23,42,0.07);
  padding: 8px 10px;
  border-radius: 6px;
  overflow-x: auto;
  margin: 0.5em 0;
}
.mindum-widget-bubble-msg pre code { background: transparent; padding: 0; }
.mindum-widget-bubble-msg a { color: inherit; text-decoration: underline; }
.mindum-widget-message[data-role="user"] .mindum-widget-bubble-msg code,
.mindum-widget-message[data-role="user"] .mindum-widget-bubble-msg pre {
  background: rgba(255,255,255,0.18);
}
.mindum-widget-message[data-role="user"] .mindum-widget-bubble-msg {
  background: ${primary};
  color: #fff;
  border-bottom-right-radius: 4px;
}
.mindum-widget-message[data-role="assistant"] .mindum-widget-bubble-msg {
  background: #fff;
  border: 1px solid #e2e8f0;
  color: #0f172a;
  border-bottom-left-radius: 4px;
}
.mindum-widget-message[data-role="error"] .mindum-widget-bubble-msg {
  background: #fef2f2;
  border: 1px solid #fecaca;
  color: #991b1b;
  border-bottom-left-radius: 4px;
}

.mindum-widget-typing {
  display: none;
  padding: 4px 16px 10px;
  align-items: center;
  gap: 4px;
}
.mindum-widget-root.is-loading .mindum-widget-typing { display: flex; }
.mindum-widget-typing-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #94a3b8;
  animation: mindum-typing-pulse 1.4s infinite ease-in-out both;
}
.mindum-widget-typing-dot:nth-child(2) { animation-delay: 0.2s; }
.mindum-widget-typing-dot:nth-child(3) { animation-delay: 0.4s; }
@keyframes mindum-typing-pulse {
  0%, 80%, 100% { opacity: 0.3; transform: scale(0.85); }
  40% { opacity: 1; transform: scale(1); }
}
.mindum-widget-message[data-streaming="true"] .mindum-widget-bubble-msg::after {
  content: '▋';
  display: inline-block;
  margin-left: 2px;
  animation: mindum-caret-blink 1s steps(2) infinite;
  color: #94a3b8;
}
@keyframes mindum-caret-blink {
  50% { opacity: 0; }
}

/* Tool-progress pill — shown between assistant bubbles while a
   tool_use is being executed (Phase 3D.3 / FR-049 / FR-057). The
   three pulsing dots reuse the typing-indicator animation. */
.mindum-widget-tool-progress {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin: 4px 0 10px 0;
  padding: 6px 10px;
  border-radius: 999px;
  background: rgba(15,23,42,0.05);
  color: #475569;
  font-size: 12.5px;
  line-height: 1.3;
  align-self: flex-start;
  max-width: fit-content;
}

.mindum-widget-prompts {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin: 4px 0 14px 0;
}
.mindum-widget-prompt-chip {
  background: #fff;
  border: 1px solid #cbd5e1;
  color: #334155;
  padding: 6px 12px;
  border-radius: 999px;
  font-size: 12.5px;
  font-family: inherit;
  cursor: pointer;
  line-height: 1.3;
  text-align: left;
  transition: background 0.12s ease, border-color 0.12s ease, color 0.12s ease;
}
.mindum-widget-prompt-chip:hover {
  background: ${primary};
  border-color: ${primary};
  color: #fff;
}

.mindum-widget-confirmation {
  margin-bottom: 10px;
  padding: 12px 14px;
  background: #fff;
  border: 1px solid #fcd34d;
  border-left: 4px solid #f59e0b;
  border-radius: 10px;
  font-size: 13px;
  color: #0f172a;
}
.mindum-widget-confirm-title {
  font-weight: 600;
  margin-bottom: 8px;
  color: #92400e;
}
.mindum-widget-confirm-list {
  margin: 0 0 10px 0;
  padding: 0;
  list-style: none;
}
.mindum-widget-confirm-row {
  padding: 4px 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.mindum-widget-confirm-name {
  font-weight: 500;
}
.mindum-widget-confirm-args {
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 11px;
  color: #475569;
  word-break: break-all;
}
.mindum-widget-confirm-actions {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
}
.mindum-widget-confirm-approve,
.mindum-widget-confirm-reject {
  padding: 6px 14px;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  border: 1px solid transparent;
}
.mindum-widget-confirm-approve {
  background: ${primary};
  color: #fff;
}
.mindum-widget-confirm-reject {
  background: #fff;
  color: #475569;
  border-color: #cbd5e1;
}
.mindum-widget-confirm-approve:hover:not(:disabled),
.mindum-widget-confirm-reject:hover:not(:disabled) {
  filter: brightness(0.95);
}
.mindum-widget-confirm-approve:disabled,
.mindum-widget-confirm-reject:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}
.mindum-widget-confirm-badge {
  text-align: right;
  font-size: 12px;
  font-weight: 600;
}
.mindum-widget-confirm-badge[data-decision="approved"] { color: #047857; }
.mindum-widget-confirm-badge[data-decision="rejected"] { color: #64748b; }
.mindum-widget-confirmation[data-state="approved"],
.mindum-widget-confirmation[data-state="rejected"] {
  opacity: 0.7;
  border-left-color: #cbd5e1;
  border-color: #e2e8f0;
}

.mindum-widget-form {
  display: flex;
  padding: 12px;
  border-top: 1px solid #e2e8f0;
  background: #fff;
  gap: 8px;
}
.mindum-widget-input {
  flex: 1;
  padding: 10px 12px;
  border: 1px solid #cbd5e1;
  border-radius: 8px;
  font-size: 14px;
  font-family: inherit;
  outline: none;
}
.mindum-widget-input:focus {
  border-color: ${primary};
  box-shadow: 0 0 0 3px rgba(15,23,42,0.08);
}
.mindum-widget-send {
  padding: 0 16px;
  background: ${primary};
  color: #fff;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  font-weight: 600;
}
.mindum-widget-send:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
`;
}
