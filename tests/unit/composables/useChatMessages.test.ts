import { describe, it, expect } from 'vitest'
import { ref } from 'vue'
import { useChatMessages } from '@/app/composables/useChatMessages'
import { useChatStore } from '@/app/stores/chat'
import { useAuthStore } from '@/app/stores/auth'
import { AIAnswerType } from '@/types/enums'
import type { AISessionDTO, AISessionMessageDTO } from '@/types/api/schemas'

function makeMessage(overrides: Partial<AISessionMessageDTO> = {}): AISessionMessageDTO {
  return {
    messageID: 'msg-1',
    messageText: 'Hello',
    senderUserCode: 'bot@test.com',
    messageType: AIAnswerType.Text,
    insertDate: new Date().toISOString(),
    senderName: 'Bot',
    messageTranslations: null,
    files: null,
    feedbackStatus: null,
    options: null,
    ...overrides,
  }
}

function makeSession(messages: AISessionMessageDTO[] = []): AISessionDTO {
  return {
    sessionId: 's-1',
    sessionName: 'Test session',
    agentId: 1,
    insertDate: new Date().toISOString(),
    members: ['user@test.com', 'bot@test.com'],
    messages,
    unreadCount: 0,
  }
}

describe('useChatMessages', () => {
  it('returns empty messages when session data is undefined', () => {
    const sessionData = ref<AISessionDTO | undefined>(undefined)
    const { messages } = useChatMessages('s-1', sessionData)
    expect(messages.value).toEqual([])
  })

  it('returns query messages from session data', () => {
    const msg = makeMessage()
    const sessionData = ref<AISessionDTO | undefined>(makeSession([msg]))
    const { messages } = useChatMessages('s-1', sessionData)
    expect(messages.value).toEqual([msg])
  })

  it('includes pending messages after query messages', () => {
    const chatStore = useChatStore()
    const queryMsg = makeMessage({ messageID: 'q-1' })
    const pendingMsg = makeMessage({ messageID: 'p-1', messageText: 'Pending' })

    chatStore.addPendingMessage('s-1', pendingMsg)
    const sessionData = ref<AISessionDTO | undefined>(makeSession([queryMsg]))
    const { messages } = useChatMessages('s-1', sessionData)

    expect(messages.value).toHaveLength(2)
    expect(messages.value[0]!.messageID).toBe('q-1')
    expect(messages.value[1]!.messageID).toBe('p-1')
  })

  it('includes failed messages after query and pending messages', () => {
    const chatStore = useChatStore()
    const queryMsg = makeMessage({ messageID: 'q-1' })
    chatStore.addFailedMessage('s-1', {
      optimisticDisplay: makeMessage({ messageID: 'f-1' }),
      request: {
        userCode: 'user',
        sessionId: 's-1',
        agentId: 1,
        members: [],
        question: '',
        group: '',
        pquestionType: 0,
        options: [],
        files: [],
      },
      status: 'failed' as const,
    })

    const sessionData = ref<AISessionDTO | undefined>(makeSession([queryMsg]))
    const { messages } = useChatMessages('s-1', sessionData)

    expect(messages.value).toHaveLength(2)
    expect(messages.value[1]!.messageID).toBe('f-1')
  })

  it('reacts to sessionData changes', () => {
    const sessionData = ref<AISessionDTO | undefined>(undefined)
    const { messages } = useChatMessages('s-1', sessionData)

    expect(messages.value).toHaveLength(0)

    sessionData.value = makeSession([makeMessage()])
    expect(messages.value).toHaveLength(1)
  })

  it('works with ref-based sessionId', () => {
    const chatStore = useChatStore()
    const sid = ref('s-1')
    chatStore.addFailedMessage('s-1', {
      optimisticDisplay: makeMessage({ messageID: 'f-1' }),
      request: {
        userCode: 'user',
        sessionId: 's-1',
        agentId: 1,
        members: [],
        question: '',
        group: '',
        pquestionType: 0,
        options: [],
        files: [],
      },
      status: 'failed' as const,
    })
    chatStore.addFailedMessage('s-2', {
      optimisticDisplay: makeMessage({ messageID: 'f-2' }),
      request: {
        userCode: 'user',
        sessionId: 's-2',
        agentId: 1,
        members: [],
        question: '',
        group: '',
        pquestionType: 0,
        options: [],
        files: [],
      },
      status: 'failed' as const,
    })

    const sessionData = ref<AISessionDTO | undefined>(makeSession())
    const { messages } = useChatMessages(sid, sessionData)

    expect(messages.value).toHaveLength(1)
    expect(messages.value[0]!.messageID).toBe('f-1')
  })

  describe('typing and thinking indicators', () => {
    it('returns typing users for the session', () => {
      const chatStore = useChatStore()
      chatStore.addTypingUser('s-1', 'Alice')
      chatStore.addTypingUser('s-1', 'Bob')

      const sessionData = ref<AISessionDTO | undefined>(undefined)
      const { typingUsers } = useChatMessages('s-1', sessionData)

      expect(typingUsers.value).toEqual(['Alice', 'Bob'])
    })

    it('returns thinking agents for the session', () => {
      const chatStore = useChatStore()
      chatStore.startAgentThinking('s-1', 'AI Agent')

      const sessionData = ref<AISessionDTO | undefined>(undefined)
      const { thinkingAgents } = useChatMessages('s-1', sessionData)

      expect(thinkingAgents.value).toEqual(['AI Agent'])
    })
  })

  describe('options mode detection', () => {
    it('returns undefined when there are no options messages', () => {
      const msg = makeMessage({ messageType: AIAnswerType.Text })
      const sessionData = ref<AISessionDTO | undefined>(makeSession([msg]))
      const { lastUnansweredOptionsMessageId, isOptionsMode } = useChatMessages('s-1', sessionData)

      expect(lastUnansweredOptionsMessageId.value).toBeUndefined()
      expect(isOptionsMode.value).toBe(false)
    })

    it('detects last unanswered options message', () => {
      const authStore = useAuthStore()
      authStore.user = { email: 'user@test.com', id: 1, name: 'User' } as typeof authStore.user

      const msgs = [
        makeMessage({
          messageID: 'opt-1',
          messageType: AIAnswerType.Options,
          senderUserCode: 'bot@test.com',
        }),
      ]
      const sessionData = ref<AISessionDTO | undefined>(makeSession(msgs))
      const { lastUnansweredOptionsMessageId, isOptionsMode } = useChatMessages('s-1', sessionData)

      expect(lastUnansweredOptionsMessageId.value).toBe('opt-1')
      expect(isOptionsMode.value).toBe(true)
    })

    it('returns undefined when user has replied after options message', () => {
      const authStore = useAuthStore()
      authStore.user = { email: 'user@test.com', id: 1, name: 'User' } as typeof authStore.user

      const msgs = [
        makeMessage({
          messageID: 'opt-1',
          messageType: AIAnswerType.Options,
          senderUserCode: 'bot@test.com',
        }),
        makeMessage({
          messageID: 'reply-1',
          messageType: AIAnswerType.Text,
          senderUserCode: 'user@test.com',
        }),
      ]
      const sessionData = ref<AISessionDTO | undefined>(makeSession(msgs))
      const { lastUnansweredOptionsMessageId, isOptionsMode } = useChatMessages('s-1', sessionData)

      expect(lastUnansweredOptionsMessageId.value).toBeUndefined()
      expect(isOptionsMode.value).toBe(false)
    })

    it('detects last options message when multiple exist and last is unanswered', () => {
      const authStore = useAuthStore()
      authStore.user = { email: 'user@test.com', id: 1, name: 'User' } as typeof authStore.user

      const msgs = [
        makeMessage({
          messageID: 'opt-1',
          messageType: AIAnswerType.Options,
          senderUserCode: 'bot@test.com',
        }),
        makeMessage({
          messageID: 'reply-1',
          messageType: AIAnswerType.Text,
          senderUserCode: 'user@test.com',
        }),
        makeMessage({
          messageID: 'opt-2',
          messageType: AIAnswerType.Options,
          senderUserCode: 'bot@test.com',
        }),
      ]
      const sessionData = ref<AISessionDTO | undefined>(makeSession(msgs))
      const { lastUnansweredOptionsMessageId } = useChatMessages('s-1', sessionData)

      expect(lastUnansweredOptionsMessageId.value).toBe('opt-2')
    })
  })
})
