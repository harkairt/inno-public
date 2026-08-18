import { computed, toValue, type MaybeRefOrGetter, type Ref, type ComputedRef } from 'vue'
import { useChatStore } from '@/app/stores/chat'
import { useAuthStore } from '@/app/stores/auth'
import { AIAnswerType } from '@/types/enums'
import type { AISessionDTO, AISessionMessageDTO } from '@/types/api/schemas'

export interface UseChatMessagesReturn {
  messages: ComputedRef<AISessionMessageDTO[]>
  typingUsers: ComputedRef<string[]>
  thinkingAgents: ComputedRef<string[]>
  lastUnansweredOptionsMessageId: ComputedRef<string | undefined>
  isOptionsMode: ComputedRef<boolean>
  pendingIds: ComputedRef<Set<string>>
  failedIds: ComputedRef<Set<string>>
}

export function useChatMessages(
  sessionId: MaybeRefOrGetter<string>,
  sessionData: Ref<AISessionDTO | undefined>,
): UseChatMessagesReturn {
  const chatStore = useChatStore()
  const authStore = useAuthStore()

  const resolved = computed(() => {
    const id = toValue(sessionId)
    const queryMessages = sessionData.value?.messages ?? []
    const pending = chatStore.getUnconfirmedPendingMessages(id, queryMessages)
    const failed = chatStore.getFailedMessages(id)
    return {
      messages: [...queryMessages, ...pending, ...failed],
      pendingIds: new Set(pending.map((m) => m.messageID)),
      failedIds: new Set(failed.map((m) => m.messageID)),
    }
  })

  const messages = computed(() => resolved.value.messages)
  const pendingIds = computed(() => resolved.value.pendingIds)
  const failedIds = computed(() => resolved.value.failedIds)

  const typingUsers = computed(() => chatStore.getTypingUsers(toValue(sessionId)))
  const thinkingAgents = computed(() => chatStore.getThinkingAgents(toValue(sessionId)))

  const lastUnansweredOptionsMessageId = computed(() => {
    const msgs = messages.value
    const userEmail = authStore.user?.email
    for (let i = msgs.length - 1; i >= 0; i--) {
      const msg = msgs[i]
      if (msg?.messageType === AIAnswerType.Options) {
        const hasUserAfter = msgs.slice(i + 1).some((m) => m.senderUserCode === userEmail)
        return hasUserAfter ? undefined : msg.messageID
      }
    }
    return undefined
  })

  const isOptionsMode = computed(() => !!lastUnansweredOptionsMessageId.value)

  return {
    messages,
    typingUsers,
    thinkingAgents,
    lastUnansweredOptionsMessageId,
    isOptionsMode,
    pendingIds,
    failedIds,
  }
}
