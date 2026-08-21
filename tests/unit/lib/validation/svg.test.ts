import { describe, expect, it } from 'vitest'
import { parseSvgData } from '@/lib/validation/svg'

const VALID_SVG = `
<svg viewBox="0 0 640 360" role="img" aria-label="Quarterly sales">
  <title>Quarterly sales</title>
  <defs>
    <linearGradient id="barGradient" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#4f46e5" />
      <stop offset="100%" stop-color="#312e81" />
    </linearGradient>
    <marker id="arrow" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto">
      <path d="M0,0 L0,6 L9,3 z" fill="#334155" />
    </marker>
  </defs>
  <rect x="40" y="40" width="180" height="260" rx="12" fill="url(#barGradient)" />
  <text x="130" y="330" text-anchor="middle" font-family="Arial, sans-serif" font-size="18">
    Revenue
  </text>
  <line x1="250" y1="170" x2="520" y2="170" stroke="#334155" marker-end="url(#arrow)" />
</svg>
`

const reasonOf = (source: string): string | undefined => {
  const result = parseSvgData(source)
  return result.isErr() ? result.error.reason : undefined
}

describe('parseSvgData — valid SVG', () => {
  it('accepts and canonicalizes a useful illustration subset', () => {
    const result = parseSvgData(VALID_SVG)

    expect(result.isOk()).toBe(true)
    if (result.isErr()) return

    expect(result.value.markup).toContain('<svg xmlns="http://www.w3.org/2000/svg"')
    expect(result.value.markup).toContain('fill="url(#barGradient)"')
    expect(result.value.markup).toContain('marker-end="url(#arrow)"')
    expect(result.value.title).toBe('Quarterly sales')
  })

  it('accepts an XML declaration, comments, and standard entities without preserving markup noise', () => {
    const source = `<?xml version="1.0" encoding="UTF-8"?>
      <!-- generated illustration -->
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 50">
        <title>R&amp;D &lt;plan&gt;</title>
        <text x="5" y="25">R&amp;D</text>
      </svg>`
    const result = parseSvgData(source)

    expect(result.isOk()).toBe(true)
    if (result.isErr()) return

    expect(result.value.markup).not.toContain('<?xml')
    expect(result.value.markup).not.toContain('<!--')
    expect(result.value.markup).toContain('R&amp;D &lt;plan&gt;')
    expect(result.value.title).toBe('R&D <plan>')
  })

  it('allows internal symbol references but never preserves an external URL', () => {
    const result = parseSvgData(
      '<svg viewBox="0 0 20 20"><defs><symbol id="dot"><circle cx="5" cy="5" r="5" /></symbol></defs><use href="#dot" x="5" y="5" /></svg>',
    )

    expect(result.isOk()).toBe(true)
    if (result.isErr()) return
    expect(result.value.markup).toContain('href="#dot"')
  })
})

describe('parseSvgData — bounded input', () => {
  it('rejects input over 50,000 characters before parsing it', () => {
    expect(reasonOf('x'.repeat(50_001))).toBe('oversize')
  })

  it('rejects excessive nesting', () => {
    const nested = `<svg>${'<g>'.repeat(64)}${'</g>'.repeat(64)}</svg>`
    expect(reasonOf(nested)).toBe('too-complex')
  })
})

describe('parseSvgData — document structure', () => {
  it.each(['', '  ', '<rect width="10" height="10" />', 'plain text'])(
    'rejects a non-SVG root: %j',
    (source) => {
      expect(reasonOf(source)).toBe('not-svg')
    },
  )

  it.each([
    '<svg><g></svg>',
    '<svg viewBox="0 0 10 10></svg>',
    '<svg><rect width=10 /></svg>',
    '<svg><text>&unknown;</text></svg>',
    '<svg><text>&#1;</text></svg>',
    '<!DOCTYPE svg><svg />',
    '<svg /> <svg />',
    `<svg>bad${String.fromCharCode(1)}</svg>`,
  ])('rejects malformed XML', (source) => {
    expect(reasonOf(source)).toBe('unparseable')
  })

  it('rejects non-whitespace text outside text-bearing elements', () => {
    expect(reasonOf('<svg><g>unexpected text</g></svg>')).toBe('invalid-content')
  })
})

describe('parseSvgData — element and attribute allowlists', () => {
  it.each([
    '<svg><script>alert(1)</script></svg>',
    '<svg><foreignObject><div>HTML</div></foreignObject></svg>',
    '<svg><image href="#local" /></svg>',
    '<svg><animate attributeName="x" /></svg>',
  ])('rejects unsupported active or embedded elements', (source) => {
    expect(reasonOf(source)).toBe('unsupported-element')
  })

  it.each([
    '<svg onclick="alert(1)" />',
    '<svg style="background: red" />',
    '<svg><rect class="remote-style" width="10" height="10" /></svg>',
  ])('rejects unsupported attributes', (source) => {
    expect(reasonOf(source)).toBe('unsupported-attribute')
  })

  it.each([
    '<svg viewBox="0 0 0 10" />',
    '<svg width="-1" height="10" />',
    '<svg><path d="alert(1)" /></svg>',
    '<svg><g transform="translate(javascript:1)" /></svg>',
    '<svg><rect fill="not a color" width="10" height="10" /></svg>',
  ])('rejects invalid values on allowed attributes', (source) => {
    expect(reasonOf(source)).toBe('invalid-attribute')
  })
})

describe('parseSvgData — external references', () => {
  it.each([
    '<svg><use href="https://example.com/icons.svg#dot" /></svg>',
    '<svg><use href="data:image/svg+xml;base64,PHN2Zz4=" /></svg>',
    '<svg><use href="java&#x73;cript:alert(1)" /></svg>',
    '<svg><rect width="10" height="10" fill="url(https://example.com/a.svg#paint)" /></svg>',
    '<svg><path d="M0 0L1 1" marker-end="url(data:image/svg+xml,evil)" /></svg>',
  ])('rejects external and executable references', (source) => {
    expect(reasonOf(source)).toBe('external-reference')
  })
})
