/**
 * Unit tests for useChatAutoScroll. The mobile/desktop branch is decided by a
 * module-level `isMobile` computed from navigator.userAgent at import time, so
 * each block stubs the UA and re-imports the module. The scroll container is a
 * fake element exposing exactly the surface the composable touches.
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { ref, nextTick } from 'vue'

interface FakeContainer {
  scrollTo: ReturnType<typeof vi.fn>
  scrollHeight: number
  scrollTop: number
  getBoundingClientRect: () => { top: number }
  querySelector: ReturnType<typeof vi.fn>
  addEventListener: ReturnType<typeof vi.fn>
  removeEventListener: ReturnType<typeof vi.fn>
}

function makeContainer(child: unknown): FakeContainer {
  return {
    scrollTo: vi.fn(),
    scrollHeight: 1000,
    scrollTop: 100,
    getBoundingClientRect: () => ({ top: 0 }),
    querySelector: vi.fn(() => child),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }
}

const targetChild = {
  getBoundingClientRect: () => ({ top: 50 }),
  offsetTop: 200,
}

async function loadWithUserAgent(ua: string) {
  Object.defineProperty(navigator, 'userAgent', { value: ua, configurable: true })
  vi.resetModules()
  const mod = await import('@/app/composables/useChatAutoScroll')
  return mod.useChatAutoScroll
}

afterEach(() => {
  Object.defineProperty(navigator, 'userAgent', {
    value: 'Mozilla/5.0 (test)',
    configurable: true,
  })
})

describe('useChatAutoScroll — desktop', () => {
  it('scrolls to bottom using scrollHeight', async () => {
    const useChatAutoScroll = await loadWithUserAgent('Mozilla/5.0 (Macintosh)')
    const container = makeContainer(targetChild)
    const { scrollToBottom } = useChatAutoScroll(ref(container as unknown as HTMLElement))

    scrollToBottom(true)
    await nextTick()

    expect(container.scrollTo).toHaveBeenCalledWith({ top: 1000, behavior: 'auto' })
  })

  it('scrolls to an element using bounding-rect math', async () => {
    const useChatAutoScroll = await loadWithUserAgent('Mozilla/5.0 (Windows NT)')
    const container = makeContainer(targetChild)
    const { scrollToElement } = useChatAutoScroll(ref(container as unknown as HTMLElement))

    scrollToElement('.msg', true)
    await nextTick()

    // targetScrollTop = scrollTop(100) + (elementTop(50) - containerTop(0)) - 12 = 138
    expect(container.scrollTo).toHaveBeenCalledWith({ top: 138, behavior: 'auto' })
  })

  it('falls back to scroll-to-bottom when the element is not found', async () => {
    const useChatAutoScroll = await loadWithUserAgent('Mozilla/5.0 (X11; Linux)')
    const container = makeContainer(null)
    const { scrollToElement } = useChatAutoScroll(ref(container as unknown as HTMLElement))

    scrollToElement('.missing', true)
    // Fallback nests a second nextTick (scrollToElement → scrollToBottom).
    await vi.waitFor(() =>
      expect(container.scrollTo).toHaveBeenCalledWith({ top: 1000, behavior: 'auto' }),
    )
  })
})

describe('useChatAutoScroll — mobile', () => {
  it('scrolls to an element using offsetTop', async () => {
    const useChatAutoScroll = await loadWithUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS)')
    const container = makeContainer(targetChild)
    const { scrollToElement } = useChatAutoScroll(ref(container as unknown as HTMLElement))

    scrollToElement('.msg', true)
    await nextTick()

    // targetScrollTop = offsetTop(200) - 12 = 188
    expect(container.scrollTo).toHaveBeenCalledWith({ top: 188, behavior: 'auto' })
  })

  it('uses smooth behavior when not instant', async () => {
    const useChatAutoScroll = await loadWithUserAgent('Mozilla/5.0 (Android)')
    const container = makeContainer(targetChild)
    const { scrollToElement } = useChatAutoScroll(ref(container as unknown as HTMLElement))

    scrollToElement('.msg')
    await nextTick()

    expect(container.scrollTo).toHaveBeenCalledWith({ top: 188, behavior: 'smooth' })
  })

  it('falls back to scroll-to-bottom when the mobile element is not found', async () => {
    const useChatAutoScroll = await loadWithUserAgent('Mozilla/5.0 (iPad)')
    const container = makeContainer(null)
    const { scrollToElement } = useChatAutoScroll(ref(container as unknown as HTMLElement))

    scrollToElement('.missing', true)
    await vi.waitFor(() =>
      expect(container.scrollTo).toHaveBeenCalledWith({ top: 1000, behavior: 'auto' }),
    )
  })
})

describe('useChatAutoScroll — scroll state', () => {
  it('captureScrollState returns a boolean and updates wasAtBottom', async () => {
    const useChatAutoScroll = await loadWithUserAgent('Mozilla/5.0 (Macintosh)')
    // measure() calls getComputedStyle, which needs a real element.
    const el = document.createElement('div')
    const { captureScrollState, wasAtBottom } = useChatAutoScroll(ref(el))

    const result = captureScrollState()

    expect(typeof result).toBe('boolean')
    expect(wasAtBottom.value).toBe(result)
  })

  it('does nothing when the container ref is null', async () => {
    const useChatAutoScroll = await loadWithUserAgent('Mozilla/5.0 (Macintosh)')
    const { scrollToBottom } = useChatAutoScroll(ref(null))

    // Should not throw when there is no element to scroll.
    expect(() => scrollToBottom(true)).not.toThrow()
    await nextTick()
  })

  it('uses auto behavior when smooth is disabled and not instant', async () => {
    const useChatAutoScroll = await loadWithUserAgent('Mozilla/5.0 (Macintosh)')
    const container = makeContainer(targetChild)
    const { scrollToBottom } = useChatAutoScroll(ref(container as unknown as HTMLElement), {
      smooth: false,
    })

    scrollToBottom()
    await nextTick()

    expect(container.scrollTo).toHaveBeenCalledWith({ top: 1000, behavior: 'auto' })
  })
})
