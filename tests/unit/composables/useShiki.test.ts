/**
 * Unit tests for useShiki. Shiki loads a WASM engine that won't run in happy-dom,
 * so `shiki` is mocked with a fake highlighter. Covers the singleton/cache,
 * concurrent-load dedupe, language fallback, and the error → plain-code paths.
 *
 * The composable keeps a module-level singleton, so each test re-imports it
 * after vi.resetModules() for isolation.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

const codeToHtml = vi.fn(
  (code: string, opts: { lang: string }) => `<pre lang="${opts.lang}">${code}</pre>`,
)
const getLoadedLanguages = vi.fn(() => ['javascript', 'typescript', 'text'])
const createHighlighter = vi.fn(async () => ({ codeToHtml, getLoadedLanguages }))

vi.mock('shiki', () => ({ createHighlighter }))

beforeEach(() => {
  vi.resetModules()
  createHighlighter.mockClear()
  codeToHtml.mockClear()
  getLoadedLanguages.mockClear()
  createHighlighter.mockResolvedValue({ codeToHtml, getLoadedLanguages })
})

async function importShiki() {
  const { useShiki } = await import('@/app/composables/useShiki')
  return useShiki()
}

describe('useShiki.loadHighlighter', () => {
  it('creates the highlighter once and caches it', async () => {
    const shiki = await importShiki()

    const first = await shiki.loadHighlighter()
    const second = await shiki.loadHighlighter()

    expect(first).toBe(second)
    expect(createHighlighter).toHaveBeenCalledTimes(1)
    expect(shiki.isLoaded.value).toBe(true)
  })

  it('dedupes concurrent loads into a single createHighlighter call', async () => {
    const shiki = await importShiki()

    await Promise.all([shiki.loadHighlighter(), shiki.loadHighlighter()])

    expect(createHighlighter).toHaveBeenCalledTimes(1)
  })

  it('returns null and stays unloaded when createHighlighter throws', async () => {
    createHighlighter.mockRejectedValueOnce(new Error('wasm boom'))
    const shiki = await importShiki()

    const result = await shiki.loadHighlighter()

    expect(result).toBeNull()
    expect(shiki.isLoaded.value).toBe(false)
    expect(shiki.isLoading.value).toBe(false)
  })
})

describe('useShiki.highlightCode', () => {
  it('returns the original code when the highlighter is not loaded', async () => {
    const shiki = await importShiki()
    expect(shiki.highlightCode('const a = 1', 'javascript')).toBe('const a = 1')
  })

  it('highlights with the requested language when it is loaded', async () => {
    const shiki = await importShiki()
    await shiki.loadHighlighter()

    const html = shiki.highlightCode('const a = 1', 'typescript')

    expect(html).toContain('lang="typescript"')
    expect(codeToHtml).toHaveBeenCalledWith('const a = 1', {
      lang: 'typescript',
      theme: 'github-dark-dimmed',
    })
  })

  it('falls back to the text grammar for an unloaded language', async () => {
    const shiki = await importShiki()
    await shiki.loadHighlighter()

    shiki.highlightCode('SELECT 1', 'cobol')

    expect(codeToHtml).toHaveBeenCalledWith('SELECT 1', {
      lang: 'text',
      theme: 'github-dark-dimmed',
    })
  })

  it('returns the original code when codeToHtml throws', async () => {
    codeToHtml.mockImplementationOnce(() => {
      throw new Error('render fail')
    })
    const shiki = await importShiki()
    await shiki.loadHighlighter()

    expect(shiki.highlightCode('oops', 'javascript')).toBe('oops')
  })
})
