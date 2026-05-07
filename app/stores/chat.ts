import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { AISessionMessageDTO } from '@/types/api/schemas'
import type { MessageStatus } from '@/types/enums'

// Extended message type for failed messages (DTO format with status)
type FailedMessage = AISessionMessageDTO & { status: MessageStatus }

export const useChatStore = defineStore('chat', () => {
  // State
  const activeSessionId = ref<string | null>(null)
  const isLoading = ref(false)
  const error = ref<string | null>(null)
  const typingUsers = ref<Map<string, Set<string>>>(new Map()) // sessionId -> Set of user names
  const failedMessages = ref<Record<string, FailedMessage[]>>({}) // sessionId -> failed messages (DTO format)
  const draftMessages = ref<Record<string, string>>({}) // key -> draft text
  const skipNextEntranceAnimation = ref(false)

  // Actions
  function setActiveSession(sessionId: string | null) {
    activeSessionId.value = sessionId
  }

  function setError(errorMessage: string) {
    error.value = errorMessage
  }

  function clearError() {
    error.value = null
  }

  // Failed messages management
  function addFailedMessage(sessionId: string, message: FailedMessage) {
    const messages = failedMessages.value[sessionId] ?? []
    failedMessages.value[sessionId] = [...messages, message]
  }

  function removeFailedMessage(sessionId: string, messageId: string) {
    const messages = failedMessages.value[sessionId] ?? []
    failedMessages.value[sessionId] = messages.filter(m => m.messageID !== messageId)
  }

  function removeAllFailedMessages(sessionId: string) {
    const { [sessionId]: _, ...rest } = failedMessages.value
    failedMessages.value = rest
  }

  function getFailedMessages(sessionId: string): FailedMessage[] {
    return failedMessages.value[sessionId] ?? []
  }

  // Draft messages management
  function saveDraft(key: string, text: string) {
    if (text.trim()) {
      draftMessages.value[key] = text
    } else {
      const { [key]: _, ...rest } = draftMessages.value
      draftMessages.value = rest
    }
  }

  function getDraft(key: string): string {
    return draftMessages.value[key] ?? ''
  }

  function clearDraft(key: string) {
    const { [key]: _, ...rest } = draftMessages.value
    draftMessages.value = rest
  }

  // Reset all user-scoped state (called on logout)
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

  // New session callback registry (not persisted)
  const newSessionCallbacks = new Map<string, () => void>()

  function onNewSessionConfirmed(sessionId: string, callback: () => void) {
    newSessionCallbacks.set(sessionId, callback)
  }

  function executeNewSessionCallback(sessionId: string) {
    const callback = newSessionCallbacks.get(sessionId)
    if (callback) {
      newSessionCallbacks.delete(sessionId)
      callback()
    }
  }

  function removeNewSessionCallback(sessionId: string) {
    newSessionCallbacks.delete(sessionId)
  }

  // Typing indicator management
  function addTypingUser(sessionId: string, userName: string) {
    if (!typingUsers.value.has(sessionId)) {
      typingUsers.value.set(sessionId, new Set())
    }
    typingUsers.value.get(sessionId)!.add(userName)
  }

  function removeTypingUser(sessionId: string, userName: string) {
    typingUsers.value.get(sessionId)?.delete(userName)
  }

  function getTypingUsers(sessionId: string): string[] {
    return Array.from(typingUsers.value.get(sessionId) ?? [])
  }

  return {
    // State
    activeSessionId,
    isLoading,
    error,
    failedMessages,
    draftMessages,

    // Actions
    setActiveSession,
    setError,
    clearError,

    // Failed messages
    addFailedMessage,
    removeFailedMessage,
    removeAllFailedMessages,
    getFailedMessages,

    // Draft messages
    saveDraft,
    getDraft,
    clearDraft,

    // Typing indicators
    addTypingUser,
    removeTypingUser,
    getTypingUsers,

    // Animation control
    skipNextEntranceAnimation,

    // New session callbacks
    onNewSessionConfirmed,
    executeNewSessionCallback,
    removeNewSessionCallback,

    // Cleanup
    resetUserData,
  }
}, {
  persist: {
    key: 'innochat-chat',
    pick: ['failedMessages', 'activeSessionId', 'draftMessages'], // Persist failed messages, active session, and drafts
  },
})
