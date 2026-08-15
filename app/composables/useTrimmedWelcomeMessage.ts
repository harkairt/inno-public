import { computed, toValue, type MaybeRefOrGetter, type ComputedRef, type Ref } from 'vue'
import { useWelcomeMessage } from '@/app/composables/useChatQueries'

export interface UseTrimmedWelcomeMessageReturn {
  trimmedWelcomeMessage: ComputedRef<string | undefined>
  isLoading: Ref<boolean>
}

export function useTrimmedWelcomeMessage(
  agentId: MaybeRefOrGetter<number>,
  options?: {
    enabled?: MaybeRefOrGetter<boolean>
    sessionId?: string
    cacheScope?: MaybeRefOrGetter<string>
    showOnlyWhen?: MaybeRefOrGetter<boolean>
  },
): UseTrimmedWelcomeMessageReturn {
  const { data: welcomeMessageData, isLoading } = useWelcomeMessage(agentId, {
    enabled: options?.enabled,
    sessionId: options?.sessionId,
    cacheScope: options?.cacheScope,
  })

  const trimmedWelcomeMessage = computed(() => {
    if (options?.showOnlyWhen !== undefined && !toValue(options.showOnlyWhen)) {
      return undefined
    }
    if (!welcomeMessageData.value?.message) return undefined
    let msg = welcomeMessageData.value.message
    if (msg.startsWith('"') && msg.endsWith('"')) {
      msg = msg.slice(1, -1)
    }
    return msg
  })

  return {
    trimmedWelcomeMessage,
    isLoading,
  }
}
