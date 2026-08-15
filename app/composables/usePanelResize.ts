import { onBeforeUnmount, ref } from 'vue'
import { useLocalStorage } from '@vueuse/core'

export interface PanelResizeOptions {
  defaultWidth: number
  minWidth: number
  maxWidthFraction: number
  direction: 'left' | 'right'
  storageKey?: string
}

export function usePanelResize(options: PanelResizeOptions) {
  const { defaultWidth, minWidth, maxWidthFraction, direction, storageKey } = options

  const width = storageKey ? useLocalStorage(storageKey, defaultWidth) : ref(defaultWidth)

  const isResizing = ref(false)
  let cleanup: (() => void) | null = null

  function clampWidth(raw: number): number {
    const maxWidth = Math.floor(window.innerWidth * maxWidthFraction)
    return Math.min(maxWidth, Math.max(minWidth, raw))
  }

  function onResizeStart(e: MouseEvent | TouchEvent) {
    e.preventDefault()
    isResizing.value = true

    const startX = 'touches' in e ? e.touches[0]!.clientX : e.clientX
    const startWidth = width.value
    const sign = direction === 'right' ? -1 : 1

    function onMove(ev: MouseEvent | TouchEvent) {
      const currentX = 'touches' in ev ? ev.touches[0]!.clientX : ev.clientX
      const delta = (currentX - startX) * sign
      width.value = clampWidth(startWidth + delta)
    }

    function onEnd() {
      isResizing.value = false
      document.body.style.userSelect = ''
      document.body.style.cursor = ''
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onEnd)
      document.removeEventListener('touchmove', onMove)
      document.removeEventListener('touchend', onEnd)
      cleanup = null
    }

    document.body.style.userSelect = 'none'
    document.body.style.cursor = 'col-resize'
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onEnd)
    document.addEventListener('touchmove', onMove, { passive: false })
    document.addEventListener('touchend', onEnd)
    cleanup = onEnd
  }

  onBeforeUnmount(() => {
    cleanup?.()
  })

  return { width, isResizing, onResizeStart }
}
