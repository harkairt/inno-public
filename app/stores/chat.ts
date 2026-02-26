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
  const failedMessages = ref<Map<string, FailedMessage[]>>(new Map()) // sessionId -> failed messages (DTO format)
  const draftMessages = ref<Map<string, string>>(new Map()) // key -> draft text

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
    const messages = failedMessages.value.get(sessionId) || []
    failedMessages.value.set(sessionId, [...messages, message])
  }

  function removeFailedMessage(sessionId: string, messageId: string) {
    const messages = failedMessages.value.get(sessionId) || []
    failedMessages.value.set(sessionId, messages.filter(m => m.messageID !== messageId))
  }

  function removeAllFailedMessages(sessionId: string) {
    failedMessages.value.delete(sessionId)
  }

  function getFailedMessages(sessionId: string): FailedMessage[] {
    return failedMessages.value.get(sessionId) || []
  }

  // Draft messages management
  function saveDraft(key: string, text: string) {
    if (text.trim()) {
      draftMessages.value.set(key, text)
    } else {
      draftMessages.value.delete(key)
    }
  }

  function getDraft(key: string): string {
    return draftMessages.value.get(key) ?? ''
  }

  function clearDraft(key: string) {
    draftMessages.value.delete(key)
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
    return Array.from(typingUsers.value.get(sessionId) || [])
  }

  return {
    // State
    activeSessionId,
    isLoading,
    error,
    failedMessages,

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
  }
}, {
  persist: {
    key: 'innochat-chat',
    pick: ['failedMessages', 'activeSessionId', 'draftMessages'], // Persist failed messages, active session, and drafts
  },
})