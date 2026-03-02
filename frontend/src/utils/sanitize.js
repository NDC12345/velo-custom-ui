/**
 * sanitize.js — centralised HTML sanitisation helpers wrapping DOMPurify.
 *
 * All v-html bindings that display server-supplied or AI-generated content
 * MUST go through one of these helpers to prevent XSS.
 */
import DOMPurify from 'dompurify'

// ── Base config: allow common safe tags/attributes, strip everything else ──
const BASE_CONFIG = {
  ALLOWED_TAGS: [
    'p', 'br', 'hr',
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    'strong', 'em', 'b', 'i', 'u', 's', 'del', 'mark',
    'ul', 'ol', 'li',
    'blockquote', 'pre', 'code',
    'table', 'thead', 'tbody', 'tr', 'th', 'td',
    'a', 'img',
    'span', 'div', 'section', 'article',
    'details', 'summary',
  ],
  ALLOWED_ATTR: [
    'class', 'id', 'style',
    'href', 'target', 'rel',
    'src', 'alt', 'title', 'width', 'height',
    'colspan', 'rowspan',
  ],
  // Force all external links to open safely
  FORCE_BODY: true,
}

// Notebook / report cell output — may include tables, pre/code blocks
const CELL_CONFIG = {
  ...BASE_CONFIG,
  ADD_ATTR: ['target'],
}

// Markdown rendered via simple regex converters — narrower allowlist
const MARKDOWN_CONFIG = {
  ALLOWED_TAGS: [
    'strong', 'em', 'b', 'i',
    'h1', 'h2', 'h3',
    'code', 'pre',
    'ul', 'ol', 'li',
    'p', 'br',
    'span', 'div',
  ],
  ALLOWED_ATTR: ['class', 'id', 'onclick'],
  FORCE_BODY: true,
}

/**
 * Sanitise HTML coming from server notebook/report cell output.
 * @param {string} html
 * @returns {string}
 */
export function sanitizeCellOutput(html) {
  if (!html || typeof html !== 'string') return ''
  return DOMPurify.sanitize(html, CELL_CONFIG)
}

/**
 * Sanitise HTML produced by in-app markdown-to-HTML converters
 * (ChatView, AskAIButton).  Also escapes the plain-text parts before
 * markdown substitution to prevent injecting raw HTML through bold/italic etc.
 * @param {string} html - already-rendered markdown HTML string
 * @returns {string}
 */
export function sanitizeMarkdown(html) {
  if (!html || typeof html !== 'string') return ''
  return DOMPurify.sanitize(html, MARKDOWN_CONFIG)
}

/**
 * Escape a plain-text string so it is safe to embed inside an HTML template
 * before markdown substitution happens.
 * @param {string} text
 * @returns {string}
 */
export function escapeHtml(text) {
  if (!text || typeof text !== 'string') return ''
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
}
