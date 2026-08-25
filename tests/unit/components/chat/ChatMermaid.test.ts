import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick, ref } from 'vue'
import type { Component } from 'vue'
import { renderWithProviders } from '@/tests/utils/render'

const viewerApiSpy = vi.hoisted(() => vi.fn())
const initializeSpy = vi.fn()
const renderSpy = vi.fn(async (id: string) => ({ svg: `<svg id="${id}"></svg>` }))
const colorMode = ref('light')

vi.mock('vue-i18n', () => ({
  useI18n: () => ({ t: (key: string) => key, locale: ref('en') }),
}))

vi.mock('v-viewer', () => ({ api: viewerApiSpy }))

beforeEach(() => {
  vi.resetModules()
  vi.doMock('mermaid', () => ({
    default: { initialize: initializeSpy, render: renderSpy },
  }))
  initializeSpy.mockClear()
  renderSpy.mockClear()
  viewerApiSpy.mockClear()
  renderSpy.mockImplementation(async (id: string) => ({ svg: `<svg id="${id}"></svg>` }))
  colorMode.value = 'light'
  vi.stubGlobal('useColorMode', () => colorMode)
})

const data = { source: 'flowchart LR\n A --> B' }

async function renderMermaid(props: Record<string, unknown> = {}) {
  const { default: ChatMermaid } = (await import('~/components/chat/ChatMermaid.vue')) as {
    default: Component
  }

  return renderWithProviders(ChatMermaid, {
    props: { data, blockIndex: 0, source: data.source, ...props },
  })
}

async function settle() {
  for (let index = 0; index < 6; index++) {
    await Promise.resolve()
    await nextTick()
  }
}

describe('ChatMermaid', () => {
  it('shows loading before the engine is available and an isolated SVG image after rendering', async () => {
    const { container } = await renderMermaid()
    expect(container.querySelector('.mermaid-loading')?.textContent?.trim()).toBe(
      'chat.mermaid.loading',
    )

    await settle()

    const image = container.querySelector<HTMLImageElement>('.mermaid-image')
    expect(image).not.toBeNull()
    expect(image?.src).toContain('data:image/svg+xml')
    expect(renderSpy).toHaveBeenCalledWith(expect.any(String), data.source)
    expect(initializeSpy).toHaveBeenCalledWith(
      expect.objectContaining({ securityLevel: 'strict', htmlLabels: false, startOnLoad: false }),
    )
  })

  it('opens the full-size Mermaid SVG in the lightbox', async () => {
    renderSpy.mockImplementation(async (id: string) => ({
      svg: `<svg id="${id}" width="100%" viewBox="0 0 1600 240"></svg>`,
    }))

    const { container } = await renderMermaid()
    await settle()

    const parentClick = vi.fn()
    container.addEventListener('click', parentClick)
    container.querySelector<HTMLImageElement>('.mermaid-image')?.click()

    const options = viewerApiSpy.mock.calls[0]?.[0]
    expect(parentClick).not.toHaveBeenCalled()
    const lightboxSvg = decodeURIComponent(options.images[0])
    expect(lightboxSvg).toContain('width="1600"')
    expect(lightboxSvg).toContain('<rect width="100%" height="100%" fill="#fff"/>')
    expect(options).toMatchObject({ options: { initialCoverage: 1 } })
    await nextTick()
    expect(
      container
        .querySelector('.mermaid-lightbox-trigger')
        ?.classList.contains('mermaid-lightbox-trigger--hidden'),
    ).toBe(true)

    options.options.hidden()
    await nextTick()

    expect(
      container
        .querySelector('.mermaid-lightbox-trigger')
        ?.classList.contains('mermaid-lightbox-trigger--hidden'),
    ).toBe(false)
  })

  it('re-renders when the source or theme changes', async () => {
    const { rerender } = await renderMermaid()
    await settle()

    const callsBefore = renderSpy.mock.calls.length
    const nextData = { source: 'flowchart TB\n X --> Y' }
    await rerender({ data: nextData, blockIndex: 0, source: nextData.source })
    await settle()
    colorMode.value = 'dark'
    await settle()

    expect(renderSpy.mock.calls.length).toBeGreaterThan(callsBefore + 1)
  })

  it('shows an error when Mermaid cannot render the source', async () => {
    renderSpy
      .mockResolvedValueOnce({ svg: '<svg></svg>' })
      .mockRejectedValueOnce(new Error('bad source'))
    const { rerender, container } = await renderMermaid()
    await settle()

    const nextData = { source: 'not valid Mermaid' }
    await rerender({ data: nextData, blockIndex: 0, source: nextData.source })
    await settle()

    expect(container.querySelector('.mermaid-error')?.textContent?.trim()).toBe(
      'chat.mermaid.renderFailed',
    )
  })

  it('shows an error when the engine fails to load', async () => {
    vi.doMock('mermaid', () => {
      throw new Error('engine unavailable')
    })

    const { container } = await renderMermaid()
    await settle()

    expect(container.querySelector('.mermaid-error')?.textContent?.trim()).toBe(
      'chat.mermaid.renderFailed',
    )
  })
})
