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
import { defineComponent, h, nextTick } from 'vue'
import type { Component, PropType } from 'vue'
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

let echartsImportCount = 0

vi.mock('echarts', () => {
  echartsImportCount++
  return {
    init: () => ({ setOption: vi.fn(), resize: vi.fn(), dispose: vi.fn(), on: vi.fn() }),
  }
})

vi.mock('~/components/chat/ChatEChart.vue', () => ({
  default: defineComponent({
    name: 'ChatEChart',
    props: {
      option: { type: Object, required: true },
      blockIndex: { type: Number, required: true },
      source: { type: String, required: true },
    },
    setup: (props) => () =>
      h('div', { class: 'echart-stub', 'data-block-index': String(props.blockIndex) }),
  }),
}))

vi.mock('~/components/chat/ChatTable.vue', () => ({
  default: defineComponent({
    name: 'ChatTable',
    props: { tableData: { type: Object as PropType<{ columns: unknown[] }>, required: true } },
    setup: (props) => () =>
      h('div', { class: 'table-stub', 'data-columns': String(props.tableData.columns.length) }),
  }),
}))

vi.mock('~/components/chat/ChatPivotTable.vue', () => ({
  default: defineComponent({
    name: 'ChatPivotTable',
    props: { data: { type: Array, required: true } },
    setup: (props) => () =>
      h('div', { class: 'pivot-stub', 'data-rows': String(props.data.length) }),
  }),
}))

vi.mock('~/components/chat/ChatChart.vue', () => ({
  default: defineComponent({
    name: 'ChatChart',
    props: { config: { type: Object, required: true } },
    setup: (props) => () =>
      h('div', { class: 'chart-stub', 'data-chart-type': String(props.config.type) }),
  }),
}))

vi.mock('leaflet', () => ({
  default: {
    map: () => ({
      setView: vi.fn().mockReturnThis(),
      fitBounds: vi.fn().mockReturnThis(),
      remove: vi.fn(),
      invalidateSize: vi.fn(),
    }),
    tileLayer: () => ({ addTo: vi.fn().mockReturnThis() }),
    marker: () => ({ addTo: vi.fn().mockReturnThis(), bindPopup: vi.fn().mockReturnThis() }),
    polyline: () => ({ addTo: vi.fn().mockReturnThis() }),
    polygon: () => ({ addTo: vi.fn().mockReturnThis() }),
    latLngBounds: vi.fn().mockReturnValue({ isValid: () => true }),
    Icon: { Default: { prototype: {}, mergeOptions: vi.fn() } },
  },
}))

vi.mock('leaflet/dist/leaflet.css', () => ({}))

vi.mock('~/components/chat/ChatMap.vue', () => ({
  default: defineComponent({
    name: 'ChatMap',
    props: {
      data: { type: Object, required: true },
      blockIndex: { type: Number, required: true },
      source: { type: String, required: true },
    },
    setup: (props) => () =>
      h('div', { class: 'map-stub', 'data-block-index': String(props.blockIndex) }),
  }),
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

const ECHARTS_BAR =
  '{"xAxis":{"type":"category","data":["a","b"]},"yAxis":{"type":"value"},"series":[{"type":"bar","data":[1,2]}]}'

const fence = (body: string) => ['```echarts', body, '```'].join('\n')

describe('S27, S26 MarkdownContent — ECharts engine is not loaded speculatively', () => {
  it('S27 never imports the ECharts engine for content without an echarts block', async () => {
    expect(echartsImportCount).toBe(0)

    await renderSettled('# Title\n\n```js\nconst a = 1\n```\n\nSome prose.')

    expect(echartsImportCount).toBe(0)
    expect(document.querySelector('[data-echart-id]')).toBeNull()
  })

  it('S26 leaves an unterminated echarts fence untouched and loads no engine', async () => {
    expect(echartsImportCount).toBe(0)

    const { container } = await renderSettled(`Here it comes:\n\n\`\`\`echarts\n${ECHARTS_BAR}`)

    expect(echartsImportCount).toBe(0)
    expect(container.querySelector('[data-echart-id]')).toBeNull()
    expect(container.querySelector('.echart-stub')).toBeNull()
    expect(container.textContent).toContain('"series"')
  })
})

describe('S22, S23 MarkdownContent — ECharts block extraction', () => {
  it('S22 replaces a single echarts block with a placeholder holding the chart', async () => {
    const { container } = await renderSettled(
      `## Revenue\n\n${fence(ECHARTS_BAR)}\n\nThat is the split.`,
    )

    const placeholder = container.querySelector('[data-echart-id]')
    expect(placeholder).not.toBeNull()
    expect(placeholder?.querySelector('.echart-stub')).not.toBeNull()

    expect(container.querySelector('code.language-echarts')).toBeNull()
    expect(container.textContent).not.toContain('"series"')
    expect(container.textContent).toContain('That is the split.')
  })

  it('S23 gives three blocks three placeholders with distinct ids and block indexes', async () => {
    const { container } = await renderSettled(
      [
        fence(ECHARTS_BAR),
        fence('{"series":[{"type":"line","data":[3,4]}]}'),
        fence('{"series":[{"type":"pie","data":[{"value":5,"name":"x"}]}]}'),
      ].join('\n\n'),
    )

    const placeholders = [...container.querySelectorAll('[data-echart-id]')]
    expect(placeholders).toHaveLength(3)

    const ids = placeholders.map((el) => el.getAttribute('data-echart-id'))
    expect(new Set(ids).size).toBe(3)

    const indexes = [...container.querySelectorAll('.echart-stub')].map((el) =>
      el.getAttribute('data-block-index'),
    )
    expect(indexes).toEqual(['0', '1', '2'])
  })
})

const STORED_CHART_JS_MESSAGE = [
  '## Quarterly revenue',
  '',
  'Here is the breakdown you asked for:',
  '',
  '```chart.js',
  '{"type":"bar","data":{"labels":["North","South"],"datasets":[{"label":"Q4","data":[820,932]}]}}',
  '```',
  '',
  'Let me know if you want it by month.',
].join('\n')

async function renderSettled(content: string) {
  const utils = await renderMarkdown(content)
  for (let i = 0; i < 6; i++) {
    await Promise.resolve()
    await nextTick()
  }
  return utils
}

describe('S25 MarkdownContent — rejected ECharts block', () => {
  it('keeps the rejected block as code, renders its siblings, and logs reason plus index', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    const { container } = await renderSettled(
      [
        fence(ECHARTS_BAR),
        fence('{ not json at all }'),
        fence('{"series":[{"type":"line"}]}'),
      ].join('\n\n'),
    )

    const indexes = [...container.querySelectorAll('.echart-stub')].map((el) =>
      el.getAttribute('data-block-index'),
    )
    expect(indexes).toEqual(['0', '2'])

    const survivor = [...container.querySelectorAll('pre')].find((el) =>
      el.textContent?.includes('not json at all'),
    )
    expect(survivor).toBeDefined()

    const records = warnSpy.mock.calls.filter((call) => call[0] === '[MarkdownContent]')
    expect(records).toHaveLength(1)
    expect(records[0]?.[2]).toEqual({ reason: 'unparseable', blockIndex: 1 })

    warnSpy.mockRestore()
  })
})

const MIXED_MESSAGE = [
  '# Report',
  '',
  'Inline math $E = mc^2$ follows.',
  '',
  fence(ECHARTS_BAR),
  '',
  '```chart.js',
  '{"type":"bar","data":{"labels":["North"],"datasets":[{"label":"Q4","data":[820]}]}}',
  '```',
  '',
  '```rows',
  '[{"region":"North","q4":820}]',
  '```',
  '',
  '```pivot',
  '[{"region":"North","q4":820}]',
  '```',
  '',
  '```ts',
  'const x: number = 1',
  '```',
].join('\n')

describe('S24 MarkdownContent — mixed block types', () => {
  it('renders every block type independently in one message', async () => {
    const { container } = await renderSettled(MIXED_MESSAGE)

    const echart = container.querySelector('[data-echart-id]')
    expect(echart?.querySelector('.echart-stub')).not.toBeNull()

    const chart = container.querySelector('[data-chart-id]')
    expect(chart?.querySelector('.chart-stub')?.getAttribute('data-chart-type')).toBe('bar')

    const table = container.querySelector('[data-table-id]')
    expect(table?.querySelector('.table-stub')?.getAttribute('data-columns')).toBe('2')

    const pivot = container.querySelector('[data-pivot-id]')
    expect(pivot?.querySelector('.pivot-stub')?.getAttribute('data-rows')).toBe('1')

    expect(container.querySelector('.katex')).not.toBeNull()
    expect(container.querySelector('h1')?.textContent).toBe('Report')
    expect(container.textContent).toContain('const x: number = 1')

    expect(container.querySelector('code.language-echarts')).toBeNull()
    expect(container.querySelector('code.language-chart\\.js')).toBeNull()
  })
})

describe('S29 MarkdownContent — chart.js regression guard', () => {
  // Snapshot captured before MarkdownContent gained an ECharts pass (FR-020).
  // A mismatch means chart.js rendering changed — fix the code, never -u this.
  it('renders a stored chart.js message identically to the pre-ECharts snapshot', async () => {
    const { container } = await renderSettled(STORED_CHART_JS_MESSAGE)
    expect(container.innerHTML).toMatchSnapshot()
  })

  it('emits a chart placeholder and teleports the chart into it', async () => {
    const { container } = await renderSettled(STORED_CHART_JS_MESSAGE)

    const placeholder = container.querySelector('[data-chart-id]')
    expect(placeholder).not.toBeNull()
    expect(placeholder?.querySelector('.chart-stub')).not.toBeNull()
    expect(placeholder?.querySelector('.chart-stub')?.getAttribute('data-chart-type')).toBe('bar')
  })

  it('does not leave the raw chart.js fence in the rendered output', async () => {
    const { container } = await renderSettled(STORED_CHART_JS_MESSAGE)

    expect(container.querySelector('code.language-chart\\.js')).toBeNull()
    expect(container.textContent).toContain('Quarterly revenue')
    expect(container.textContent).toContain('Let me know if you want it by month.')
  })
})

const LEAFLET_MARKERS =
  '{"markers":[{"lat":48.2082,"lng":16.3738,"title":"Vienna","description":"Capital of Austria"}]}'

const leafletFence = (body: string) => ['```leaflet', body, '```'].join('\n')

describe('MarkdownContent — leaflet block extraction', () => {
  it('replaces a single leaflet block with a placeholder holding the map', async () => {
    const { container } = await renderSettled(`## Map\n\n${leafletFence(LEAFLET_MARKERS)}\n\nEnd.`)

    const placeholder = container.querySelector('[data-map-id]')
    expect(placeholder).not.toBeNull()
    expect(placeholder?.querySelector('.map-stub')).not.toBeNull()

    expect(container.querySelector('code.language-leaflet')).toBeNull()
    expect(container.textContent).not.toContain('"markers"')
    expect(container.textContent).toContain('End.')
  })

  it('gives two leaflet blocks distinct ids and block indexes', async () => {
    const second = '{"markers":[{"lat":0,"lng":0}]}'
    const { container } = await renderSettled(
      [leafletFence(LEAFLET_MARKERS), leafletFence(second)].join('\n\n'),
    )

    const placeholders = [...container.querySelectorAll('[data-map-id]')]
    expect(placeholders).toHaveLength(2)

    const ids = placeholders.map((el) => el.getAttribute('data-map-id'))
    expect(new Set(ids).size).toBe(2)

    const indexes = [...container.querySelectorAll('.map-stub')].map((el) =>
      el.getAttribute('data-block-index'),
    )
    expect(indexes).toEqual(['0', '1'])
  })

  it('keeps a rejected leaflet block (HTML in title) as code', async () => {
    const rejected = '{"markers":[{"lat":0,"lng":0,"title":"<b>bad</b>"}]}'
    const { container } = await renderSettled(leafletFence(rejected))

    expect(container.querySelector('[data-map-id]')).toBeNull()
    expect(container.querySelector('.map-stub')).toBeNull()
  })

  it('leaves an unterminated leaflet fence untouched', async () => {
    const { container } = await renderSettled(`\`\`\`leaflet\n${LEAFLET_MARKERS}`)

    expect(container.querySelector('[data-map-id]')).toBeNull()
    expect(container.querySelector('.map-stub')).toBeNull()
  })
})
