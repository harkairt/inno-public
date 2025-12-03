import { computed, nextTick, ref, type ComputedRef, type Ref } from 'vue'
import { useScroll } from '@vueuse/core'

interface UseChatAutoScrollOptions {
  /** Offset from bottom to consider "at bottom" (default: 50px) */
  bottomThreshold?: number
  /** Whether to use smooth scrolling (default: true) */
  smooth?: boolean
}

interface UseChatAutoScrollReturn {
  /** Whether the container is currently at the bottom */
  isAtBottom: ComputedRef<boolean>
  /** Scroll to the bottom of the container. Pass `true` for instant (no animation). */
  scrollToBottom: (instant?: boolean) => void
  /** Scroll to a specific element within the container. Pass `true` for instant (no animation). */
  scrollToElement: (selector: string, instant?: boolean) => void
  /** Call before content changes to capture scroll state */
  captureScrollState: () => boolean
  /** The last captured scroll state (was at bottom before content change) */
  wasAtBottom: Ref<boolean>
}

/**
 * Composable for handling chat auto-scroll behavior.
 *
 * Features:
 * - Tracks if the container is scrolled to the bottom
 * - Provides smooth scrolling utilities
 * - Captures scroll state before content changes (for proper auto-scroll detection)
 *
 * @example
 * ```ts
 * const messagesContainer = ref<HTMLElement | null>(null)
 * const { isAtBottom, scrollToBottom, scrollToElement } = useChatAutoScroll(messagesContainer)
 *
 * // Scroll to bottom when user sends a message
 * scrollToBottom()
 *
 * // Scroll to a specific message (user's message at top)
 * scrollToElement('[data-testid="message-123"]')
 * ```
 */
export function useChatAutoScroll(
  container: Ref<HTMLElement | null>,
  options: UseChatAutoScrollOptions = {}
): UseChatAutoScrollReturn {
  const { bottomThreshold = 50, smooth = true } = options

  // Use VueUse's useScroll for reactive scroll tracking
  const { arrivedState, measure } = useScroll(container, {
    offset: { bottom: bottomThreshold },
  })

  const isAtBottom = computed(() => arrivedState.bottom)

  // Stored flag to capture "was at bottom" before content changes
  const wasAtBottom = ref(true)

  // Flag to prevent scrollToBottom from interfering with scrollToElement
  let scrollToElementActive = false

  /**
   * Call this BEFORE content changes (e.g., before adding messages)
   * Returns whether the container was at the bottom.
   *
   * This is useful when you need to know the scroll state before
   * new content is added, which would change the scroll position.
   */
  function captureScrollState(): boolean {
    // Force recalculate scroll state
    measure()
    wasAtBottom.value = arrivedState.bottom
    return wasAtBottom.value
  }

  /**
   * Scroll to the bottom of the container
   * @param instant - If true, scroll instantly without animation (useful for initial load)
   */
  function scrollToBottom(instant?: boolean) {
    // Skip if scrollToElement is active (prevents race condition)
    // But allow instant scrolls (used for initial load)
    if (scrollToElementActive && !instant) {
      console.log('[scrollToBottom] Skipped - scrollToElement is active, flag:', scrollToElementActive)
      return
    }
    console.log('[scrollToBottom] Called, instant:', instant, 'flag:', scrollToElementActive)
    nextTick(() => {
      if (container.value && (!scrollToElementActive || instant)) {
        const behavior = instant ? 'auto' : (smooth ? 'smooth' : 'auto')
        console.log('[scrollToBottom] Scrolling to:', container.value.scrollHeight, 'behavior:', behavior)
        container.value.scrollTo({
          top: container.value.scrollHeight,
          behavior,
        })
      }
    })
  }

  /**
   * Scroll to a specific element within the container.
   * Uses scrollIntoView to position the element at the top of the viewport.
   * Falls back to scrollToBottom if element is not found.
   *
   * @param selector - CSS selector for the target element
   * @param instant - If true, scroll instantly without animation
   */
  function scrollToElement(selector: string, instant?: boolean) {
    console.log('[scrollToElement] Called with selector:', selector)
    nextTick(() => {
      console.log('[scrollToElement] nextTick - container exists:', !!container.value)
      if (!container.value) {
        console.log('[scrollToElement] No container, falling back to scrollToBottom')
        scrollToBottom(instant)
        return
      }

      const element = container.value.querySelector(selector) as HTMLElement | null
      console.log('[scrollToElement] Element found:', !!element, element)

      if (element) {
        // Set flag to prevent scrollToBottom from interfering
        scrollToElementActive = true

        const behavior = instant ? 'auto' : (smooth ? 'smooth' : 'auto')
        // Calculate the element's position relative to the container
        const containerRect = container.value.getBoundingClientRect()
        const elementRect = element.getBoundingClientRect()
        const currentScrollTop = container.value.scrollTop
        const targetScrollTop = currentScrollTop + (elementRect.top - containerRect.top) - 12

        console.log('[scrollToElement] Scrolling to:', targetScrollTop, 'from:', currentScrollTop)

        // First, cancel any ongoing smooth scroll by doing an instant scroll to current position
        container.value.scrollTo({ top: currentScrollTop, behavior: 'auto' })

        // Then scroll to target
        container.value.scrollTo({
          top: targetScrollTop,
          behavior,
        })

        // Clear flag after animation completes (smooth scroll takes ~300-500ms)
        setTimeout(() => {
          scrollToElementActive = false
          console.log('[scrollToElement] Flag cleared')
        }, 500)
      } else {
        console.log('[scrollToElement] Element not found, falling back to scrollToBottom')
        scrollToBottom(instant)
      }
    })
  }

  return {
    isAtBottom,
    scrollToBottom,
    scrollToElement,
    captureScrollState,
    wasAtBottom,
  }
}
