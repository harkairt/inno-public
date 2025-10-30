import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { ChatSession, Message, MessageSender } from '@/types/domain/models'
import type { AISessionMessageDTO } from '@/types/api/schemas'
import { AIAnswerType, MessageStatus } from '@/types/enums'

// Extended message type for failed messages (DTO format with status)
type FailedMessage = AISessionMessageDTO & { status: MessageStatus }

export const useChatStore = defineStore('chat', () => {
  // State
  const activeSessionId = ref<string | null>(null)
  const isLoading = ref(false)
  const error = ref<string | null>(null)
  const typingUsers = ref<Map<string, Set<string>>>(new Map()) // sessionId -> Set of user names
  const failedMessages = ref<Map<string, FailedMessage[]>>(new Map()) // sessionId -> failed messages (DTO format)

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

  // Helper functions for creating domain objects
  function createMessage(
    id: string,
    sessionId: string,
    content: string,
    sender: MessageSender,
    type: AIAnswerType = AIAnswerType.Text
  ): Message {
    return {
      id,
      sessionId,
      type,
      content,
      sender,
      sentAt: new Date(),
      isRated: false,
      rating: null,
      readBy: [sender.userCode], // Sender has read their own message
      status: MessageStatus.SENDING,
    }
  }

  function createSession(
    id: string,
    name: string,
    createdBy: string,
    agentId: number,
    agentAvatar: string,
    agentDarkAvatar: string,
    members: string[] = []
  ): ChatSession {
    return {
      id,
      name,
      createdBy,
      createdAt: new Date(),
      agentId,
      agentAvatar,
      agentDarkAvatar,
      members,
      messages: [],
      unreadCount: 0,
      isActive: true,
      lastActivity: new Date(),
    }
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

    // Helper functions
    createMessage,
    createSession,

    // Failed messages
    addFailedMessage,
    removeFailedMessage,
    removeAllFailedMessages,
    getFailedMessages,

    // Typing indicators
    addTypingUser,
    removeTypingUser,
    getTypingUsers,
  }
}, {
  persist: {
    key: 'innochat-chat',
    pick: ['failedMessages', 'activeSessionId'], // Persist failed messages and active session
  },
})