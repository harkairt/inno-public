import { computed, nextTick, ref, type ComputedRef, type Ref } from 'vue'
import { useScroll } from '@vueuse/core'
import { createLogger } from '@/lib/utils/logger'

const logger = createLogger('ChatAutoScroll')

interface UseChatAutoScrollOptions {
  bottomThreshold?: number
  smooth?: boolean
}

interface UseChatAutoScrollReturn {
  isAtBottom: ComputedRef<boolean>
  scrollToBottom: (instant?: boolean) => void
  scrollToElement: (selector: string, instant?: boolean) => void
  captureScrollState: () => boolean
  wasAtBottom: Ref<boolean>
}

interface ScrollContext {
  container: Ref<HTMLElement | null>
  scrollToElementActive: boolean
  resolveBehavior: (instant?: boolean) => ScrollBehavior
}

function performScrollToBottom(ctx: ScrollContext, instant?: boolean) {
  if (ctx.scrollToElementActive && !instant) {
    logger.debug('scrollToBottom skipped - scrollToElement active')
    return
  }
  logger.debug('scrollToBottom called, instant:', instant)
  void nextTick(() => {
    if (ctx.container.value && (!ctx.scrollToElementActive || instant)) {
      ctx.container.value.scrollTo({
        top: ctx.container.value.scrollHeight,
        behavior: ctx.resolveBehavior(instant),
      })
    }
  })
}

function performScrollToElementDesktop(
  ctx: ScrollContext,
  selector: string,
  instant: boolean | undefined,
  onActivate: (active: boolean) => void,
) {
  logger.debug('scrollToElement:desktop selector:', selector)
  void nextTick(() => {
    if (!ctx.container.value) {
      performScrollToBottom(ctx, instant)
      return
    }

    const element = ctx.container.value.querySelector(selector) as HTMLElement | null

    if (element) {
      onActivate(true)
      const containerRect = ctx.container.value.getBoundingClientRect()
      const elementRect = element.getBoundingClientRect()
      const currentScrollTop = ctx.container.value.scrollTop
      const targetScrollTop = currentScrollTop + (elementRect.top - containerRect.top) - 12

      logger.debug('scrollToElement:desktop to:', targetScrollTop, 'from:', currentScrollTop)

      ctx.container.value.scrollTo({ top: currentScrollTop, behavior: 'auto' })
      ctx.container.value.scrollTo({
        top: targetScrollTop,
        behavior: ctx.resolveBehavior(instant),
      })

      setTimeout(() => onActivate(false), 500)
    } else {
      logger.debug('scrollToElement:desktop element not found, falling back')
      performScrollToBottom(ctx, instant)
    }
  })
}

function performScrollToElementMobile(
  ctx: ScrollContext,
  selector: string,
  instant: boolean | undefined,
  onActivate: (active: boolean) => void,
) {
  logger.debug('scrollToElement:mobile selector:', selector)
  void nextTick(() => {
    if (!ctx.container.value) {
      performScrollToBottom(ctx, instant)
      return
    }

    const element = ctx.container.value.querySelector(selector) as HTMLElement | null

    if (element) {
      onActivate(true)
      const targetScrollTop = element.offsetTop - 12

      logger.debug('scrollToElement:mobile to:', targetScrollTop)

      ctx.container.value.scrollTo({
        top: targetScrollTop,
        behavior: ctx.resolveBehavior(instant),
      })

      setTimeout(() => onActivate(false), 500)
    } else {
      logger.debug('scrollToElement:mobile element not found, falling back')
      performScrollToBottom(ctx, instant)
    }
  })
}

const isMobile =
  typeof navigator !== 'undefined' && /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)

export function useChatAutoScroll(
  container: Ref<HTMLElement | null>,
  options: UseChatAutoScrollOptions = {},
): UseChatAutoScrollReturn {
  const { bottomThreshold = 50, smooth = true } = options

  const { arrivedState, measure } = useScroll(container, {
    offset: { bottom: bottomThreshold },
  })

  const isAtBottom = computed(() => arrivedState.bottom)
  const wasAtBottom = ref(true)
  let scrollToElementActive = false

  function resolveBehavior(instant?: boolean): ScrollBehavior {
    if (instant) return 'auto'
    return smooth ? 'smooth' : 'auto'
  }

  const ctx: ScrollContext = {
    container,
    get scrollToElementActive() {
      return scrollToElementActive
    },
    resolveBehavior,
  }

  const onActivate = (active: boolean) => {
    scrollToElementActive = active
  }

  function captureScrollState(): boolean {
    measure()
    wasAtBottom.value = arrivedState.bottom
    return wasAtBottom.value
  }

  function scrollToBottom(instant?: boolean) {
    performScrollToBottom(ctx, instant)
  }

  function scrollToElement(selector: string, instant?: boolean) {
    if (isMobile) {
      performScrollToElementMobile(ctx, selector, instant, onActivate)
    } else {
      performScrollToElementDesktop(ctx, selector, instant, onActivate)
    }
  }

  return {
    isAtBottom,
    scrollToBottom,
    scrollToElement,
    captureScrollState,
    wasAtBottom,
  }
}
