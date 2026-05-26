import { defineStore } from 'pinia'
import { ref, type Ref } from 'vue'
import type { AISessionMessageDTO } from '@/types/api/schemas'
import type { MessageStatus } from '@/types/enums'

// Extended message type for failed messages (DTO format with status)
type FailedMessage = AISessionMessageDTO & { status: MessageStatus }

// Extracted: failed messages helpers
function createFailedMessageActions(failedMessages: Ref<Record<string, FailedMessage[]>>) {
  return {
    addFailedMessage(sessionId: string, message: FailedMessage) {
      const messages = failedMessages.value[sessionId] ?? []
      failedMessages.value[sessionId] = [...messages, message]
    },
    removeFailedMessage(sessionId: string, messageId: string) {
      const messages = failedMessages.value[sessionId] ?? []
      failedMessages.value[sessionId] = messages.filter((m) => m.messageID !== messageId)
    },
    removeAllFailedMessages(sessionId: string) {
      const { [sessionId]: _, ...rest } = failedMessages.value
      failedMessages.value = rest
    },
    getFailedMessages(sessionId: string): FailedMessage[] {
      return failedMessages.value[sessionId] ?? []
    },
  }
}

// Extracted: draft messages helpers
function createDraftActions(draftMessages: Ref<Record<string, string>>) {
  return {
    saveDraft(key: string, text: string) {
      if (text.trim()) {
        draftMessages.value[key] = text
      } else {
        const { [key]: _, ...rest } = draftMessages.value
        draftMessages.value = rest
      }
    },
    getDraft(key: string): string {
      return draftMessages.value[key] ?? ''
    },
    clearDraft(key: string) {
      const { [key]: _, ...rest } = draftMessages.value
      draftMessages.value = rest
    },
  }
}

// Extracted: typing indicator helpers
function createTypingActions(typingUsers: Ref<Map<string, Set<string>>>) {
  return {
    addTypingUser(sessionId: string, userName: string) {
      if (!typingUsers.value.has(sessionId)) {
        typingUsers.value.set(sessionId, new Set())
      }
      typingUsers.value.get(sessionId)!.add(userName)
    },
    removeTypingUser(sessionId: string, userName: string) {
      typingUsers.value.get(sessionId)?.delete(userName)
    },
    getTypingUsers(sessionId: string): string[] {
      return Array.from(typingUsers.value.get(sessionId) ?? [])
    },
  }
}

// Extracted: new session callback helpers
function createSessionCallbackActions(callbacks: Map<string, () => void>) {
  return {
    onNewSessionConfirmed(sessionId: string, callback: () => void) {
      callbacks.set(sessionId, callback)
    },
    executeNewSessionCallback(sessionId: string) {
      const cb = callbacks.get(sessionId)
      if (cb) {
        callbacks.delete(sessionId)
        cb()
      }
    },
    removeNewSessionCallback(sessionId: string) {
      callbacks.delete(sessionId)
    },
  }
}

export const useChatStore = defineStore(
  'chat',
  () => {
    // State
    const activeSessionId = ref<string | null>(null)
    const isLoading = ref(false)
    const error = ref<string | null>(null)
    const typingUsers = ref<Map<string, Set<string>>>(new Map())
    const failedMessages = ref<Record<string, FailedMessage[]>>({})
    const draftMessages = ref<Record<string, string>>({})
    const skipNextEntranceAnimation = ref(false)
    const newSessionCallbacks = new Map<string, () => void>()

    // Composed action groups
    const failedMessageActions = createFailedMessageActions(failedMessages)
    const draftActions = createDraftActions(draftMessages)
    const typingActions = createTypingActions(typingUsers)
    const sessionCallbackActions = createSessionCallbackActions(newSessionCallbacks)

    function setActiveSession(sessionId: string | null) {
      activeSessionId.value = sessionId
    }
    function setError(errorMessage: string) {
      error.value = errorMessage
    }
    function clearError() {
      error.value = null
    }

    function resetUserData() {
      activeSessionId.value = null
      isLoading.value = false
      error.value = null
      typingUsers.value = new Map()
      failedMessages.value = {}
      draftMessages.value = {}
      skipNextEntranceAnimation.value = false
      newSessionCallbacks.clear()
    }

    return {
      activeSessionId,
      isLoading,
      error,
      failedMessages,
      draftMessages,
      setActiveSession,
      setError,
      clearError,
      ...failedMessageActions,
      ...draftActions,
      ...typingActions,
      skipNextEntranceAnimation,
      ...sessionCallbackActions,
      resetUserData,
    }
  },
  {
    persist: {
      key: 'innochat-chat',
      pick: ['failedMessages', 'activeSessionId', 'draftMessages'], // Persist failed messages, active session, and drafts
    },
  },
)
