import DOMPurify from 'dompurify';
import { marked } from 'marked';

/**
 * Render markdown text to sanitized HTML. Only used for assistant bubbles —
 * user input is always rendered as plain text via textContent.
 *
 * marked + DOMPurify is the standard pairing: marked produces HTML, DOMPurify
 * strips anything dangerous (script tags, on-* attributes, javascript: URLs,
 * data: URIs in img src, etc.). We restrict allowed tags to the markdown
 * subset so even an exotic prompt can't smuggle a form/iframe through.
 */
const ALLOWED_TAGS = [
  'p', 'br', 'strong', 'em', 'b', 'i', 'u', 's', 'code', 'pre',
  'ul', 'ol', 'li', 'blockquote', 'a', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'table', 'thead', 'tbody', 'tr', 'th', 'td', 'hr', 'span',
];

const ALLOWED_ATTR = ['href', 'title', 'class'];

// Configure marked once. `breaks: true` means single newlines render as <br>,
// which matches how chat clients usually feel.
marked.setOptions({ breaks: true, gfm: true });

export function renderMarkdown(input: string): string {
  const rawHtml = marked.parse(input, { async: false }) as string;
  return DOMPurify.sanitize(rawHtml, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    // Force every <a> to open in a new tab without a referer leak.
    ADD_ATTR: ['target', 'rel'],
  });
}

// Post-sanitize hook: ensure links don't leak the host page's referrer
// and always open in a new tab. Runs once per renderMarkdown call.
DOMPurify.addHook('afterSanitizeAttributes', (node) => {
  if (node.tagName === 'A') {
    (node as HTMLAnchorElement).setAttribute('target', '_blank');
    (node as HTMLAnchorElement).setAttribute('rel', 'noopener noreferrer');
  }
});
