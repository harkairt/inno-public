import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { nextTick, defineComponent, h  } from 'vue'
import { renderWithProviders } from '../../utils/render'
import type { PanelResizeOptions } from '~/composables/usePanelResize'
import { usePanelResize } from '~/composables/usePanelResize'

vi.mock('@vueuse/core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@vueuse/core')>()
  const { ref } = await import('vue')
  return {
    ...actual,
    useLocalStorage: vi.fn((_key: string, defaultValue: number) => ref(defaultValue)),
  }
})

function mountComposable(overrides: Partial<PanelResizeOptions> = {}) {
  let result!: ReturnType<typeof usePanelResize>

  const Wrapper = defineComponent({
    setup() {
      result = usePanelResize({
        defaultWidth: 320,
        minWidth: 200,
        maxWidthFraction: 0.5,
        direction: 'left',
        ...overrides,
      })
      return () => h('div')
    },
  })

  const { unmount } = renderWithProviders(Wrapper)
  return { result, unmount }
}

describe('usePanelResize', () => {
  let origInnerWidth: number

  beforeEach(() => {
    origInnerWidth = window.innerWidth
    Object.defineProperty(window, 'innerWidth', {
      value: 1200,
      writable: true,
      configurable: true,
    })
  })

  afterEach(() => {
    Object.defineProperty(window, 'innerWidth', {
      value: origInnerWidth,
      writable: true,
      configurable: true,
    })
  })

  it('starts with defaultWidth', () => {
    const { result } = mountComposable()
    expect(result.width.value).toBe(320)
    expect(result.isResizing.value).toBe(false)
  })

  it('resizes on mouse drag (direction=left)', async () => {
    const { result } = mountComposable({ direction: 'left' })

    result.onResizeStart(new MouseEvent('mousedown', { clientX: 320 }))
    expect(result.isResizing.value).toBe(true)

    document.dispatchEvent(new MouseEvent('mousemove', { clientX: 370 }))
    await nextTick()
    expect(result.width.value).toBe(370)

    document.dispatchEvent(new MouseEvent('mouseup'))
    expect(result.isResizing.value).toBe(false)
  })

  it('resizes on mouse drag (direction=right)', async () => {
    const { result } = mountComposable({ direction: 'right', defaultWidth: 380 })

    result.onResizeStart(new MouseEvent('mousedown', { clientX: 500 }))
    document.dispatchEvent(new MouseEvent('mousemove', { clientX: 450 }))
    await nextTick()
    expect(result.width.value).toBe(430)

    document.dispatchEvent(new MouseEvent('mouseup'))
    expect(result.isResizing.value).toBe(false)
  })

  it('clamps to minWidth', async () => {
    const { result } = mountComposable({ direction: 'left', minWidth: 200 })

    result.onResizeStart(new MouseEvent('mousedown', { clientX: 320 }))
    document.dispatchEvent(new MouseEvent('mousemove', { clientX: 50 }))
    await nextTick()
    expect(result.width.value).toBe(200)
    document.dispatchEvent(new MouseEvent('mouseup'))
  })

  it('clamps to maxWidthFraction of window', async () => {
    const { result } = mountComposable({ direction: 'left', maxWidthFraction: 0.5 })

    result.onResizeStart(new MouseEvent('mousedown', { clientX: 320 }))
    document.dispatchEvent(new MouseEvent('mousemove', { clientX: 1000 }))
    await nextTick()
    expect(result.width.value).toBe(600)
    document.dispatchEvent(new MouseEvent('mouseup'))
  })

  it('uses useLocalStorage when storageKey is provided', async () => {
    mountComposable({ storageKey: 'test-key' })
    const { useLocalStorage } = await import('@vueuse/core')
    expect(vi.mocked(useLocalStorage)).toHaveBeenCalledWith('test-key', 320)
  })

  it('disables text selection during resize', () => {
    const { result } = mountComposable()

    result.onResizeStart(new MouseEvent('mousedown', { clientX: 320 }))
    expect(document.body.style.userSelect).toBe('none')
    expect(document.body.style.cursor).toBe('col-resize')

    document.dispatchEvent(new MouseEvent('mouseup'))
    expect(document.body.style.userSelect).toBe('')
    expect(document.body.style.cursor).toBe('')
  })
})
