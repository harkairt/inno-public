/**
 * Component tests for MarkdownContent — the chat message renderer.
 *
 * The XSS defense is two-layered: markdown-it runs with `html: false` (raw HTML
 * escaped) and the result is passed through `sanitizeHTML` (DOMPurify) in
 * app/utils/sanitize.ts. These tests assert the DOM the user actually sees for
 * the markdown path, plus a direct suite over `sanitizeHTML` proving exactly
 * what it strips when hostile HTML reaches it (script tags, event-handler
 * attributes, javascript: hrefs) and what it preserves (adds target/rel to
 * links).
 *
 * Shiki loads a WASM engine that can't run in happy-dom, so `shiki` is mocked
 * with a fake highlighter — MarkdownContent's onMounted calls loadHighlighter()
 * for content with code fences.
 */
import { describe, it, expect, vi } from 'vitest'
import { nextTick } from 'vue'
import type { Component } from 'vue'
import { renderWithProviders } from '@/tests/utils/render'
import { sanitizeHTML } from '@/app/utils/sanitize'

// Fake Shiki highlighter — avoids the real WASM load in happy-dom.
const codeToHtml = vi.fn(
  (code: string, opts: { lang: string }) => `<pre lang="${opts.lang}"><code>${code}</code></pre>`,
)
const getLoadedLanguages = vi.fn(() => ['javascript', 'typescript', 'text'])
vi.mock('shiki', () => ({
  createHighlighter: vi.fn(async () => ({ codeToHtml, getLoadedLanguages })),
}))

async function renderMarkdown(content: string | null) {
  const { default: MarkdownContent } = (await import('~/components/chat/MarkdownContent.vue')) as {
    default: Component
  }

  const utils = renderWithProviders(MarkdownContent, { props: { content } })
  // Let the immediate watch + any post-mount re-render settle.
  await nextTick()
  await nextTick()
  return utils
}

// ---------------------------------------------------------------------------
// Rendering — the DOM the user sees
// ---------------------------------------------------------------------------

describe('MarkdownContent — rendering', () => {
  it('renders nothing for empty content', async () => {
    const { container } = await renderMarkdown('')
    expect(container.querySelector('.markdown-content')).toBeNull()
  })

  it('renders nothing for null content', async () => {
    const { container } = await renderMarkdown(null)
    expect(container.querySelector('.markdown-content')).toBeNull()
  })

  it('renders markdown formatting to HTML', async () => {
    const { container } = await renderMarkdown('**bold** and *italic*')
    expect(container.querySelector('strong')?.textContent).toBe('bold')
    expect(container.querySelector('em')?.textContent).toBe('italic')
  })

  it('renders headings and lists', async () => {
    const { container } = await renderMarkdown('# Title\n\n- one\n- two')
    expect(container.querySelector('h1')?.textContent).toBe('Title')
    expect(container.querySelectorAll('li')).toHaveLength(2)
  })

  it('renders fenced code blocks as pre/code', async () => {
    const { container } = await renderMarkdown('```js\nconst a = 1\n```')
    const pre = container.querySelector('pre')
    expect(pre).not.toBeNull()
    expect(pre?.querySelector('code')).not.toBeNull()
    expect(pre?.textContent).toContain('const a = 1')
  })
})

// ---------------------------------------------------------------------------
// Links — target/rel injection and javascript: rejection
// ---------------------------------------------------------------------------

describe('MarkdownContent — links', () => {
  it('adds target=_blank and rel=noopener noreferrer to links', async () => {
    const { container } = await renderMarkdown('[Google](https://google.com)')
    const anchor = container.querySelector('a')
    expect(anchor).not.toBeNull()
    expect(anchor?.getAttribute('href')).toBe('https://google.com')
    expect(anchor?.getAttribute('target')).toBe('_blank')
    expect(anchor?.getAttribute('rel')).toBe('noopener noreferrer')
  })

  it('does not produce a clickable javascript: link', async () => {
    const { container } = await renderMarkdown('[click me](javascript:alert(1))')
    expect(container.querySelector('a[href^="javascript:"]')).toBeNull()
    expect(container.querySelector('a[href*="javascript"]')).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// XSS — raw HTML is neutralised in the rendered DOM
// ---------------------------------------------------------------------------

describe('MarkdownContent — XSS in rendered DOM', () => {
  it('does not create a <script> element from raw script markup', async () => {
    const { container } = await renderMarkdown('<script>alert(1)</script>Hello')
    expect(container.querySelector('script')).toBeNull()
    expect(container.innerHTML).not.toContain('<script')
    // Escaped text is shown to the user instead of executing.
    expect(container.textContent).toContain('alert(1)')
  })

  it('does not create any element carrying an onerror handler', async () => {
    const { container } = await renderMarkdown('<img src=x onerror="alert(1)">')
    // Raw HTML is escaped to text (html:false), so no img element and no live handler.
    expect(container.querySelector('img')).toBeNull()
    expect(container.querySelector('[onerror]')).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// sanitizeHTML — direct proof of what DOMPurify strips / preserves
// (defense-in-depth layer even if raw HTML ever reaches it directly)
// ---------------------------------------------------------------------------

describe('sanitizeHTML', () => {
  it('strips <script> tags but keeps surrounding content', () => {
    const out = sanitizeHTML('<script>alert(1)</script><p>ok</p>')
    expect(out).not.toContain('<script')
    expect(out).toContain('ok')
  })

  it('strips onerror (and other event-handler) attributes', () => {
    const out = sanitizeHTML('<img src="x" onerror="alert(1)">')
    expect(out).not.toContain('onerror')
    // img itself is an allowed tag, so it survives without the handler.
    expect(out).toContain('<img')
  })

  it('strips javascript: hrefs', () => {
    const out = sanitizeHTML('<a href="javascript:alert(1)">x</a>')
    expect(out).not.toContain('javascript:')
  })

  it('adds target and rel to sanitized links with a valid href', () => {
    const out = sanitizeHTML('<a href="https://example.com">x</a>')
    expect(out).toContain('target="_blank"')
    expect(out).toContain('rel="noopener noreferrer"')
  })

  it('preserves allowed formatting tags', () => {
    const out = sanitizeHTML('<strong>bold</strong> <code>x = 1</code>')
    expect(out).toContain('<strong>bold</strong>')
    expect(out).toContain('<code>x = 1</code>')
  })

  it('removes disallowed tags while keeping their text (KEEP_CONTENT)', () => {
    const out = sanitizeHTML('<iframe src="evil"></iframe><p>safe</p>')
    expect(out).not.toContain('<iframe')
    expect(out).toContain('safe')
  })
})
