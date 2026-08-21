import { describe, expect, it, vi } from 'vitest'
import { fireEvent } from '@testing-library/vue'
import { ref } from 'vue'
import type { SvgData } from '@/lib/validation/svg'
import { renderWithProviders } from '@/tests/utils/render'
import ChatSvg from '~/components/chat/ChatSvg.vue'

vi.mock('vue-i18n', () => ({
  useI18n: () => ({ t: (key: string) => key, locale: ref('en') }),
}))

const svgData: SvgData = {
  markup:
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 50"><title>Sales overview</title><rect width="100" height="50" fill="#4f46e5"/></svg>',
  title: 'Sales overview',
}

const renderSvg = (props: Record<string, unknown> = {}) =>
  renderWithProviders(ChatSvg, {
    props: {
      data: svgData,
      blockIndex: 0,
      source: svgData.markup,
      ...props,
    },
  })

describe('ChatSvg', () => {
  it('shows a loading state while the isolated SVG image loads', () => {
    const { container } = renderSvg()

    expect(container.querySelector('.svg-loading')?.textContent?.trim()).toBe('chat.svg.loading')
    expect(container.querySelector('.svg-image')).not.toBeNull()
  })

  it('renders canonical markup through an encoded SVG data URL', async () => {
    const { container } = renderSvg()
    const image = container.querySelector<HTMLImageElement>('.svg-image')

    expect(image).not.toBeNull()
    if (!image) return

    const encodedMarkup = image.src.slice(image.src.indexOf(',') + 1)
    expect(decodeURIComponent(encodedMarkup)).toBe(svgData.markup)
    expect(image.alt).toBe('Sales overview')

    await fireEvent.load(image)

    expect(container.querySelector('.svg-loading')).toBeNull()
    expect(image.style.display).not.toBe('none')
  })

  it('uses localized fallback alt text when the SVG has no title', () => {
    const { container } = renderSvg({
      data: { markup: '<svg xmlns="http://www.w3.org/2000/svg"/>' },
    })

    expect(container.querySelector<HTMLImageElement>('.svg-image')?.alt).toBe('chat.svg.altText')
  })

  it('returns to loading state and updates the image when streamed source changes', async () => {
    const { container, rerender } = renderSvg()
    const initialImage = container.querySelector<HTMLImageElement>('.svg-image')
    if (!initialImage) return
    await fireEvent.load(initialImage)

    const nextData: SvgData = {
      markup:
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><circle cx="10" cy="10" r="8" fill="#ef4444"/></svg>',
    }
    await rerender({ data: nextData, blockIndex: 0, source: nextData.markup })

    const nextImage = container.querySelector<HTMLImageElement>('.svg-image')
    expect(container.querySelector('.svg-loading')).not.toBeNull()
    expect(nextImage?.src).toContain(encodeURIComponent('<circle'))
  })

  it('shows a localized error if the browser cannot decode the image', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { container } = renderSvg({ blockIndex: 3 })
    const image = container.querySelector<HTMLImageElement>('.svg-image')
    if (!image) return

    await fireEvent.error(image)

    expect(container.querySelector('.svg-loading')).toBeNull()
    expect(container.querySelector('.svg-error')?.textContent?.trim()).toBe('chat.svg.renderFailed')
    expect(errorSpy).toHaveBeenCalled()
    errorSpy.mockRestore()
  })
})
