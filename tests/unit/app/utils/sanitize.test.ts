/**
 * Unit tests for app/utils/sanitize.ts — the DOMPurify wrapper that guards the
 * chat renderer against XSS.
 *
 * Under happy-dom `window` IS defined, so the DOMPurify branch runs for every
 * case below. The single SSR-escape suite temporarily stubs `window` to
 * undefined to exercise the manual entity-escaping fallback.
 *
 * The `uponSanitizeAttribute` / `afterSanitizeAttributes` hooks are registered
 * once on the DOMPurify singleton (guarded by the module-level `hookAdded`
 * flag). Vitest isolates modules per test file, so that flag is fresh here.
 */
import { describe, it, expect, afterEach, vi } from 'vitest'
import { sanitizeHTML } from '@/app/utils/sanitize'

// ---------------------------------------------------------------------------
// XSS stripping
// ---------------------------------------------------------------------------

describe('sanitizeHTML — XSS stripping', () => {
  it('removes <script> tags', () => {
    const out = sanitizeHTML('<script>alert(1)</script><p>ok</p>')
    expect(out).not.toContain('<script')
    expect(out).toContain('ok')
  })

  it('drops an onerror handler but keeps the (allowed) <img> tag', () => {
    const out = sanitizeHTML('<img src="x" onerror="alert(1)">')
    expect(out).not.toContain('onerror')
    expect(out).toContain('<img')
  })

  it('strips javascript: hrefs', () => {
    const out = sanitizeHTML('<a href="javascript:alert(1)">x</a>')
    expect(out).not.toContain('javascript:')
  })

  it('removes <iframe> entirely', () => {
    const out = sanitizeHTML('<iframe src="evil"></iframe><p>safe</p>')
    expect(out).not.toContain('<iframe')
    expect(out).toContain('safe')
  })

  it('strips inline event handlers (onclick)', () => {
    const out = sanitizeHTML('<p onclick="steal()">click</p>')
    expect(out).not.toContain('onclick')
    expect(out).toContain('click')
  })
})

// ---------------------------------------------------------------------------
// Dangerous style values (uponSanitizeAttribute hook)
// ---------------------------------------------------------------------------

describe('sanitizeHTML — dangerous style values', () => {
  it.each([
    ['url()', '<p style="background:url(http://evil)">x</p>'],
    ['expression()', '<p style="width:expression(alert(1))">x</p>'],
    ['javascript:', '<p style="background:javascript:alert(1)">x</p>'],
    ['position:fixed', '<div style="position:fixed">x</div>'],
    ['position:absolute', '<div style="position: absolute">x</div>'],
  ])('drops the style attribute containing %s', (_label, input) => {
    const out = sanitizeHTML(input)
    expect(out).not.toContain('style=')
    // Element content survives; only the attribute is removed.
    expect(out).toContain('x')
  })

  it('preserves a benign style value', () => {
    const out = sanitizeHTML('<p style="color:red">x</p>')
    expect(out).toContain('color:red')
  })
})

// ---------------------------------------------------------------------------
// KaTeX allowlist preserved
// ---------------------------------------------------------------------------

describe('sanitizeHTML — KaTeX allowlist', () => {
  it('keeps svg/path tags and viewBox/d/transform attributes', () => {
    const out = sanitizeHTML(
      '<svg viewBox="0 0 10 10"><path d="M0 0 L10 10" transform="scale(1)"></path></svg>',
    )
    expect(out).toContain('<svg')
    expect(out).toContain('<path')
    expect(out).toContain('viewBox="0 0 10 10"')
    expect(out).toContain('d="M0 0 L10 10"')
    expect(out).toContain('transform="scale(1)"')
  })

  // Characterization: despite mrow/mi/mo/mfrac appearing in ALLOWED_TAGS, the
  // MathML namespace root (`math`) is NOT allowlisted. DOMPurify strips orphaned
  // MathML elements along with their text content, so these entries are
  // effectively dead. (KaTeX renders visible math via HTML + the SVG path above;
  // MathML only appears inside the accessibility <math> layer, which is dropped.)
  it('strips MathML tags because the <math> root is not allowlisted', () => {
    expect(sanitizeHTML('<mfrac><mrow><mi>x</mi><mo>+</mo></mrow></mfrac>')).toBe('')
    expect(sanitizeHTML('<math><mfrac><mrow><mi>x</mi></mrow></mfrac></math>')).toBe('')
  })

  it('keeps a benign inline style on KaTeX markup', () => {
    const out = sanitizeHTML('<span style="top:0.5em">x</span>')
    expect(out).toContain('top:0.5em')
  })
})

// ---------------------------------------------------------------------------
// Allowed markdown passes through
// ---------------------------------------------------------------------------

describe('sanitizeHTML — allowed markdown', () => {
  it('preserves tables', () => {
    const out = sanitizeHTML(
      '<table><thead><tr><th>H</th></tr></thead><tbody><tr><td>C</td></tr></tbody></table>',
    )
    expect(out).toContain('<table')
    expect(out).toContain('<th')
    expect(out).toContain('<td')
  })

  it('preserves code with a data-language attribute', () => {
    const out = sanitizeHTML('<code data-language="js">const a = 1</code>')
    expect(out).toContain('<code')
    expect(out).toContain('data-language="js"')
    expect(out).toContain('const a = 1')
  })

  it('preserves img with src and alt', () => {
    const out = sanitizeHTML('<img src="/pic.png" alt="pic">')
    expect(out).toContain('src="/pic.png"')
    expect(out).toContain('alt="pic"')
  })

  it('preserves headings and lists', () => {
    const out = sanitizeHTML('<h1>Title</h1><ul><li>one</li><li>two</li></ul>')
    expect(out).toContain('<h1>Title</h1>')
    expect(out).toContain('<li>one</li>')
    expect(out).toContain('<li>two</li>')
  })
})

// ---------------------------------------------------------------------------
// data-* attribute handling (ALLOW_DATA_ATTR:false + explicit ALLOWED_ATTR)
// ---------------------------------------------------------------------------

describe('sanitizeHTML — data-* attributes', () => {
  it('keeps allowlisted data attributes and strips arbitrary ones', () => {
    const out = sanitizeHTML(
      '<div data-language="js" data-chart-id="1" data-table-id="2" data-pivot-id="3" data-foo="bar">x</div>',
    )
    expect(out).toContain('data-language="js"')
    expect(out).toContain('data-chart-id="1"')
    expect(out).toContain('data-table-id="2"')
    expect(out).toContain('data-pivot-id="3"')
    expect(out).not.toContain('data-foo')
  })
})

// ---------------------------------------------------------------------------
// Link hardening (afterSanitizeAttributes hook)
// ---------------------------------------------------------------------------

describe('sanitizeHTML — link hardening', () => {
  it('adds target=_blank and rel=noopener noreferrer to links with href', () => {
    const out = sanitizeHTML('<a href="https://example.com">x</a>')
    expect(out).toContain('target="_blank"')
    expect(out).toContain('rel="noopener noreferrer"')
  })

  it('registers hooks once — a second call still yields exactly one rel', () => {
    // First call triggers hook registration; second must not double-register.
    sanitizeHTML('<a href="https://example.com">first</a>')
    const out = sanitizeHTML('<a href="https://example.com">second</a>')
    const relCount = (out.match(/rel=/g) ?? []).length
    expect(relCount).toBe(1)
    expect(out).toContain('second')
  })
})

// ---------------------------------------------------------------------------
// KEEP_CONTENT: text inside a disallowed tag survives
// ---------------------------------------------------------------------------

describe('sanitizeHTML — KEEP_CONTENT', () => {
  it('keeps the text content of a stripped tag', () => {
    const out = sanitizeHTML('<foobar>visible text</foobar>')
    expect(out).not.toContain('<foobar')
    expect(out).toContain('visible text')
  })
})

// ---------------------------------------------------------------------------
// SSR entity-escape branch (typeof window === 'undefined')
// ---------------------------------------------------------------------------

describe('sanitizeHTML — SSR escape branch', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('entity-escapes instead of running DOMPurify when window is undefined', () => {
    vi.stubGlobal('window', undefined)
    const out = sanitizeHTML(`<>&"'`)
    // & is escaped first, then <, >, ", ' — deterministic ordering.
    expect(out).toBe('&lt;&gt;&amp;&quot;&#x27;')
  })

  it('escapes a script payload to inert text', () => {
    vi.stubGlobal('window', undefined)
    const out = sanitizeHTML('<script>alert(1)</script>')
    expect(out).toBe('&lt;script&gt;alert(1)&lt;/script&gt;')
  })
})
