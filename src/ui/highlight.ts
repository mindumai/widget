/**
 * Micro syntax highlighter (W2, W-L6). highlight.js cannot fit the bundle
 * budget, and a chat column doesn't need IDE-grade accuracy — four token
 * classes (comment / string / number / keyword) cover the "readable code"
 * bar for the PHP/JS/JSON snippets Claude actually emits.
 *
 * Escape-safe by construction: we tokenize the block's PLAIN TEXT
 * (textContent after DOMPurify already stripped any markup) and rebuild
 * innerHTML ourselves, escaping every slice. The only markup we emit is
 * <span class="mindum-widget-tok-*">.
 */

const KEYWORDS = new Set([
  'function', 'return', 'if', 'else', 'elseif', 'foreach', 'for', 'while',
  'switch', 'case', 'break', 'continue', 'class', 'interface', 'trait',
  'extends', 'implements', 'new', 'public', 'private', 'protected', 'static',
  'const', 'use', 'namespace', 'echo', 'print', 'true', 'false', 'null',
  'let', 'var', 'async', 'await', 'import', 'export', 'from', 'default',
  'try', 'catch', 'finally', 'throw', 'this', 'fn', 'match', 'require',
  'def', 'elif', 'None', 'True', 'False', 'and', 'or', 'not',
]);

// Alternation order matters: comments swallow string-ish content inside
// them, strings swallow comment markers inside them, and so on.
const TOKEN_RE =
  /(\/\/[^\n]*|\/\*[\s\S]*?\*\/|#[^\n]*)|("(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*'|`(?:[^`\\]|\\.)*`)|\b(\d+(?:\.\d+)?)\b|\b([A-Za-z_$][\w$]*)\b/g;

function esc(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));
}

/** Plain text in, escaped HTML with token spans out. */
export function highlight(src: string): string {
  let out = '';
  let last = 0;
  let m: RegExpExecArray | null;
  TOKEN_RE.lastIndex = 0;
  while ((m = TOKEN_RE.exec(src)) !== null) {
    out += esc(src.slice(last, m.index));
    if (m[1] !== undefined) out += `<span class="mindum-widget-tok-c">${esc(m[1])}</span>`;
    else if (m[2] !== undefined) out += `<span class="mindum-widget-tok-s">${esc(m[2])}</span>`;
    else if (m[3] !== undefined) out += `<span class="mindum-widget-tok-n">${esc(m[3])}</span>`;
    else if (m[4] !== undefined && KEYWORDS.has(m[4])) out += `<span class="mindum-widget-tok-k">${esc(m[4])}</span>`;
    else out += esc(m[0]);
    last = m.index + m[0].length;
  }
  return out + esc(src.slice(last));
}

/**
 * Post-process an assistant bubble after markdown render: wrap each
 * <pre> for positioning, colorize its code, and add a copy button.
 * Idempotent via the wrapper-class check (renderMessages re-renders).
 */
export function enhanceCodeBlocks(rootEl: HTMLElement): void {
  rootEl.querySelectorAll('pre').forEach((pre) => {
    if (pre.parentElement?.classList.contains('mindum-widget-pre')) return;
    const code = pre.querySelector('code');
    if (code) code.innerHTML = highlight(code.textContent ?? '');

    const wrap = document.createElement('div');
    wrap.className = 'mindum-widget-pre';
    pre.parentNode?.insertBefore(wrap, pre);
    wrap.appendChild(pre);

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'mindum-widget-copy';
    btn.textContent = 'Copy';
    btn.setAttribute('aria-label', 'Copy code');
    btn.addEventListener('click', () => {
      const text = code ? code.innerText : pre.innerText;
      const clip = navigator.clipboard;
      if (!clip) return; // http:// embeds have no async clipboard — quietly do nothing
      void clip.writeText(text).then(() => {
        btn.textContent = 'Copied';
        btn.classList.add('is-copied');
        setTimeout(() => {
          btn.textContent = 'Copy';
          btn.classList.remove('is-copied');
        }, 1400);
      }).catch(() => {});
    });
    wrap.appendChild(btn);
  });
}
