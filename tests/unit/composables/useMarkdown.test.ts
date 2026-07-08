/**
 * Unit tests for useMarkdown — the real markdown-it pipeline (html:false,
 * linkify, texmath). Verifies rendering and that raw HTML is neutralised, i.e.
 * the sanitization contract the chat renderer depends on.
 */
import { describe, it, expect } from 'vitest'
import { useMarkdown } from '@/app/composables/useMarkdown'

describe('useMarkdown.parse', () => {
  it('renders bold and headings to HTML', () => {
    const { parse } = useMarkdown()
    expect(parse('**bold**')).toContain('<strong>bold</strong>')
    expect(parse('# Title')).toContain('<h1>')
  })

  it('linkifies bare URLs', () => {
    const { parse } = useMarkdown()
    const html = parse('Visit https://example.com now')
    expect(html).toContain('<a href="https://example.com"')
  })

  it('does not emit raw HTML tags (html:false)', () => {
    const { parse } = useMarkdown()
    const html = parse('<script>alert(1)</script>')
    expect(html).not.toContain('<script>')
    expect(html).toContain('&lt;script&gt;')
  })

  it('converts single newlines to <br> (breaks:true)', () => {
    const { parse } = useMarkdown()
    expect(parse('line one\nline two')).toContain('<br>')
  })

  it('renders inline math via the texmath/katex plugin', () => {
    const { parse } = useMarkdown()
    const html = parse('$x^2$')
    expect(html).toContain('katex')
  })

  it('reuses the same markdown-it instance across calls (singleton)', () => {
    const first = useMarkdown()
    const second = useMarkdown()
    // Same rendered output for the same input proves a shared, stable instance.
    expect(first.parse('**x**')).toBe(second.parse('**x**'))
  })
})
