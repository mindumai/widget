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
.mindum-widget-close {
  background: none; border: none; color: #fff; cursor: pointer;
  font-size: 22px; line-height: 1; padding: 0 4px;
}
.mindum-widget-close:hover { opacity: 0.8; }

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
  padding: 0 16px 8px;
  color: #64748b;
  font-size: 13px;
}
.mindum-widget-root.is-loading .mindum-widget-typing { display: block; }

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
