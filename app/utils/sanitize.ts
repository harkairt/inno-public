import DOMPurify, { type Config } from 'dompurify'

// Configure DOMPurify for chat messages
const config: Config = {
  ALLOWED_TAGS: [
    'p',
    'br',
    'strong',
    'em',
    'u',
    's',
    'code',
    'pre',
    'a',
    'ul',
    'ol',
    'li',
    'h1',
    'h2',
    'h3',
    'h4',
    'h5',
    'h6',
    'blockquote',
    'table',
    'thead',
    'tbody',
    'tr',
    'th',
    'td',
    'span',
    'div',
    'hr',
    'img',
    // KaTeX math rendering elements:
    'svg',
    'path',
    'line',
    'rect',
    'g',
    'use',
    'defs',
    'annotation',
    'semantics',
    'mrow',
    'mi',
    'mo',
    'mn',
    'mtext',
    'mfrac',
    'msup',
    'msub',
    'mover',
    'munder',
    'msqrt',
    'mroot',
  ],
  ALLOWED_ATTR: [
    'href',
    'src',
    'alt',
    'title',
    'class',
    'data-language',
    'data-chart-id',
    'data-echart-id',
    'data-table-id',
    'data-pivot-id',
    'data-md-table-id',
    'data-bar-race-id',
    'data-cytoscape-id',
    'data-map-id',
    'data-svg-id',
    // KaTeX attributes (SVG + inline styles for positioning):
    'viewBox',
    'width',
    'height',
    'd',
    'fill',
    'stroke',
    'xmlns',
    'preserveAspectRatio',
    'style',
    'transform',
    'x',
    'y',
    'stroke-width',
    'aria-hidden',
    'focusable',
  ],
  ALLOW_DATA_ATTR: false,
  KEEP_CONTENT: true,
  RETURN_TRUSTED_TYPE: false,
}

// Track if hook has been added to avoid duplicates
let hookAdded = false

/**
 * Sanitizes HTML content to prevent XSS attacks.
 * All external links are automatically given target="_blank" and rel="noopener noreferrer".
 */
export const sanitizeHTML = (dirty: string): string => {
  if (typeof window === 'undefined') {
    // Basic HTML entity escaping for SSR context where DOMPurify isn't available
    return dirty
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;')
  }

  // Add hooks only once
  if (!hookAdded) {
    // Filter dangerous CSS values from style attributes
    DOMPurify.addHook('uponSanitizeAttribute', (_node, data) => {
      if (data.attrName === 'style') {
        const dangerous = /url\s*\(|expression\s*\(|javascript:|position\s*:\s*(?:fixed|absolute)/i
        if (dangerous.test(data.attrValue)) {
          data.keepAttr = false
        }
      }
    })

    DOMPurify.addHook('afterSanitizeAttributes', (node) => {
      if (node.tagName === 'A' && node.hasAttribute('href')) {
        node.setAttribute('target', '_blank')
        node.setAttribute('rel', 'noopener noreferrer')
      }
    })
    hookAdded = true
  }

  return DOMPurify.sanitize(dirty, config) as string
}
