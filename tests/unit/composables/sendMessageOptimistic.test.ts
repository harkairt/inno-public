import { describe, it, expect, vi, beforeEach } from 'vitest'
import { QueryClient } from '@tanstack/vue-query'
import { chatQueryKeys } from '~/composables/useChatQueries'
import { userQueryKeys } from '~/composables/useUsers'
import { publicChatAgentQueryKeys } from '~/composables/usePublicChatAgent'
import { applyOptimisticSend, confirmSend, rollbackSend } from '~/composables/sendMessageOptimistic'
import type { SendMessageMutateContext } from '~/composables/sendMessageOptimistic'
import type {
  AISessionDTO,
  AISessionHeaderDTO,
  AISessionMessageDTO,
  AiQuestionRequestDTO,
  UserDTO,
} from '@/types/api/schemas'
import { AIAnswerType, AIQuestionType, MessageStatus } from '@/types/enums'

const ME = 'user@test.com'

function makeRequest(overrides: Partial<AiQuestionRequestDTO> = {}): AiQuestionRequestDTO {
  return {
    userCode: ME,
    sessionId: 'session-1',
    agentId: 1,
    members: [ME],
    question: 'Hello',
    group: '',
    pquestionType: AIQuestionType.Text,
    options: [],
    ...overrides,
  }
}

function makeSession(overrides: Partial<AISessionDTO> = {}): AISessionDTO {
  return {
    sessionId: 'session-1',
    sessionName: 'Chat',
    agentId: 1,
    agentImage: null,
    agentDarkImage: null,
    userCode: ME,
    members: [ME],
    insertDate: '2024-01-01T00:00:00Z',
    modifiedAt: '2024-01-01T00:00:00Z',
    messages: [],
    ...overrides,
  }
}

function makeHeader(overrides: Partial<AISessionHeaderDTO> = {}): AISessionHeaderDTO {
  return {
    sessionId: 'session-1',
    sessionName: 'Chat',
    agentId: 1,
    agentImage: null,
    agentDarkImage: null,
    userCode: ME,
    members: [ME],
    insertDate: '2024-01-01T00:00:00Z',
    modifiedAt: '2024-01-01T00:00:00Z',
    ...overrides,
  }
}

function makeMessage(overrides: Partial<AISessionMessageDTO> = {}): AISessionMessageDTO {
  return {
    messageID: 'msg-1',
    messageText: 'Hello',
    messageType: AIAnswerType.Text,
    senderUserCode: 'agent@test.com',
    senderName: 'Agent',
    sendDate: '2024-01-01T10:00:00Z',
    isRated: false,
    rating: null,
    readByUsers: [],
    sessionId: 'session-1',
    ...overrides,
  }
}

function makeDeps(queryClient: QueryClient) {
  return {
    queryClient,
    chatStore: {
      addPendingMessage: vi.fn(),
      removePendingMessage: vi.fn(),
      addFailedMessage: vi.fn(),
      startAgentThinking: vi.fn(),
      stopAgentThinking: vi.fn(),
      executeNewSessionCallback: vi.fn(),
    } as unknown as ReturnType<typeof import('@/app/stores/chat').useChatStore>,
    authStore: {
      user: { id: 1, email: ME, name: 'Test User' },
    } as unknown as ReturnType<typeof import('@/app/stores/auth').useAuthStore>,
  }
}

describe('sendMessageOptimistic', () => {
  let queryClient: QueryClient

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    })
  })

  describe('applyOptimisticSend', () => {
    it('seeds a synthetic session and sidebar header for a new session', async () => {
      const deps = makeDeps(queryClient)
      const request = makeRequest({ sessionId: 'new-session' })

      const ctx = await applyOptimisticSend(request, deps)

      expect(ctx.isNewSession).toBe(true)

      const session = queryClient.getQueryData<AISessionDTO>(chatQueryKeys.session('new-session'))
      expect(session).toBeDefined()
      expect(session!.sessionId).toBe('new-session')
      expect(session!.messages).toEqual([])

      const headers = queryClient.getQueryData<AISessionHeaderDTO[]>(chatQueryKeys.sessions())
      expect(headers).toHaveLength(1)
      expect(headers![0].sessionId).toBe('new-session')
    })

    it('bumps modifiedAt on the sidebar header for an existing session', async () => {
      const deps = makeDeps(queryClient)
      const oldDate = '2024-01-01T00:00:00Z'
      queryClient.setQueryData(chatQueryKeys.session('session-1'), makeSession())
      queryClient.setQueryData(chatQueryKeys.sessions(), [makeHeader({ modifiedAt: oldDate })])

      await applyOptimisticSend(makeRequest(), deps)

      const headers = queryClient.getQueryData<AISessionHeaderDTO[]>(chatQueryKeys.sessions())
      expect(headers![0].modifiedAt).not.toBe(oldDate)
    })

    it('adds a pending message to the chat store', async () => {
      const deps = makeDeps(queryClient)

      await applyOptimisticSend(makeRequest(), deps)

      expect(deps.chatStore.addPendingMessage).toHaveBeenCalledWith(
        'session-1',
        expect.objectContaining({ messageText: 'Hello', senderUserCode: ME }),
        0,
      )
    })

    it('starts agent thinking when agent is virtual', async () => {
      const deps = makeDeps(queryClient)
      const virtualAgent: UserDTO = {
        id: 1,
        name: 'Bot',
        email: 'bot@test.com',
        isVirtual: true,
        status: 'active',
        invitationAccepted: true,
        roles: [],
        url: null,
        image: null,
        darkImage: null,
        userIds: [],
        users: null,
        isAvailable: true,
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: null,
      }
      queryClient.setQueryData(userQueryKeys.selectable(), [virtualAgent])

      const ctx = await applyOptimisticSend(makeRequest(), deps)

      expect(deps.chatStore.startAgentThinking).toHaveBeenCalledWith('session-1', 'Bot')
      expect(ctx.thinkingAgentName).toBe('Bot')
    })

    it('resolves agent from public chat agent cache as fallback', async () => {
      const deps = makeDeps(queryClient)
      const agent = {
        id: 1,
        name: 'Public Bot',
        email: 'bot@test.com',
        isVirtual: true,
        status: 'active',
        invitationAccepted: true,
        roles: [],
        url: null,
        image: null,
        darkImage: null,
        userIds: [],
        users: null,
        isAvailable: true,
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: null,
      }
      queryClient.setQueryData(publicChatAgentQueryKeys.agent(1), { agent })

      const ctx = await applyOptimisticSend(makeRequest(), deps)

      expect(ctx.thinkingAgentName).toBe('Public Bot')
    })

    it('deduplicates when sidebar header already exists for the session', async () => {
      const deps = makeDeps(queryClient)
      const request = makeRequest({ sessionId: 'new-session' })
      queryClient.setQueryData(chatQueryKeys.sessions(), [makeHeader({ sessionId: 'new-session' })])

      await applyOptimisticSend(request, deps)

      const headers = queryClient.getQueryData<AISessionHeaderDTO[]>(chatQueryKeys.sessions())
      expect(headers).toHaveLength(1)
    })

    it('counts baseline for repeated identical messages', async () => {
      const deps = makeDeps(queryClient)
      queryClient.setQueryData(
        chatQueryKeys.session('session-1'),
        makeSession({
          messages: [makeMessage({ senderUserCode: ME, messageText: 'Hello' })],
        }),
      )

      await applyOptimisticSend(makeRequest(), deps)

      expect(deps.chatStore.addPendingMessage).toHaveBeenCalledWith(
        'session-1',
        expect.anything(),
        1,
      )
    })
  })

  describe('confirmSend', () => {
    it('invalidates session cache for existing sessions', async () => {
      const deps = makeDeps(queryClient)
      const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')

      const context: SendMessageMutateContext = {
        previousSession: makeSession(),
        tempMessageId: 'temp-1',
        tempMessageDTO: makeMessage({ messageID: 'temp-1' }),
        userMessageTimestamp: new Date(),
        isNewSession: false,
        thinkingAgentName: undefined,
      }

      await confirmSend({
        ...deps,
        serverMessage: makeMessage({ messageID: 'server-msg-1' }),
        request: makeRequest(),
        context,
      })

      expect(invalidateSpy).toHaveBeenCalledWith(
        expect.objectContaining({ queryKey: chatQueryKeys.session('session-1') }),
      )
    })

    it('removes pending message from chat store', async () => {
      const deps = makeDeps(queryClient)
      const context: SendMessageMutateContext = {
        previousSession: makeSession(),
        tempMessageId: 'temp-1',
        tempMessageDTO: makeMessage({ messageID: 'temp-1' }),
        userMessageTimestamp: new Date(),
        isNewSession: false,
        thinkingAgentName: undefined,
      }

      await confirmSend({
        ...deps,
        serverMessage: makeMessage(),
        request: makeRequest(),
        context,
      })

      expect(deps.chatStore.removePendingMessage).toHaveBeenCalledWith('session-1', 'temp-1')
    })

    it('stops agent thinking if started', async () => {
      const deps = makeDeps(queryClient)
      const context: SendMessageMutateContext = {
        previousSession: makeSession(),
        tempMessageId: 'temp-1',
        tempMessageDTO: makeMessage({ messageID: 'temp-1' }),
        userMessageTimestamp: new Date(),
        isNewSession: false,
        thinkingAgentName: 'Bot',
      }

      await confirmSend({
        ...deps,
        serverMessage: makeMessage(),
        request: makeRequest(),
        context,
      })

      expect(deps.chatStore.stopAgentThinking).toHaveBeenCalledWith('session-1', 'Bot')
    })

    it('merges server message into new session cache', async () => {
      const deps = makeDeps(queryClient)
      queryClient.setQueryData(chatQueryKeys.session('session-1'), makeSession())

      const context: SendMessageMutateContext = {
        previousSession: undefined,
        tempMessageId: 'temp-1',
        tempMessageDTO: makeMessage({ messageID: 'temp-1' }),
        userMessageTimestamp: new Date(),
        isNewSession: true,
        thinkingAgentName: undefined,
      }

      const serverMessage = makeMessage({ messageID: 'server-1', messageText: 'Hi back' })

      await confirmSend({
        ...deps,
        serverMessage,
        request: makeRequest(),
        context,
      })

      const session = queryClient.getQueryData<AISessionDTO>(chatQueryKeys.session('session-1'))
      expect(session!.messages).toHaveLength(2)
      expect(session!.messages[1].messageID).toBe('server-1')
    })

    it('filters empty server responses for new sessions', async () => {
      const deps = makeDeps(queryClient)
      queryClient.setQueryData(chatQueryKeys.session('session-1'), makeSession())

      const context: SendMessageMutateContext = {
        previousSession: undefined,
        tempMessageId: 'temp-1',
        tempMessageDTO: makeMessage({ messageID: 'temp-1' }),
        userMessageTimestamp: new Date(),
        isNewSession: true,
        thinkingAgentName: undefined,
      }

      const emptyMessage = makeMessage({
        messageID: 'server-1',
        messageType: AIAnswerType.Empty,
      })

      await confirmSend({
        ...deps,
        serverMessage: emptyMessage,
        request: makeRequest(),
        context,
      })

      const session = queryClient.getQueryData<AISessionDTO>(chatQueryKeys.session('session-1'))
      expect(session!.messages).toHaveLength(1)
    })

    it('deduplicates when SignalR already populated the cache', async () => {
      const deps = makeDeps(queryClient)
      const existingMsg = makeMessage({ messageID: 'server-1' })
      queryClient.setQueryData(
        chatQueryKeys.session('session-1'),
        makeSession({ messages: [existingMsg] }),
      )

      const context: SendMessageMutateContext = {
        previousSession: undefined,
        tempMessageId: 'temp-1',
        tempMessageDTO: makeMessage({ messageID: 'temp-1' }),
        userMessageTimestamp: new Date(),
        isNewSession: true,
        thinkingAgentName: undefined,
      }

      await confirmSend({
        ...deps,
        serverMessage: makeMessage({ messageID: 'server-1' }),
        request: makeRequest(),
        context,
      })

      const session = queryClient.getQueryData<AISessionDTO>(chatQueryKeys.session('session-1'))
      expect(session!.messages).toHaveLength(1)
    })

    it('executes new session callback', async () => {
      const deps = makeDeps(queryClient)

      const context: SendMessageMutateContext = {
        previousSession: undefined,
        tempMessageId: 'temp-1',
        tempMessageDTO: makeMessage({ messageID: 'temp-1' }),
        userMessageTimestamp: new Date(),
        isNewSession: true,
        thinkingAgentName: undefined,
      }

      await confirmSend({
        ...deps,
        serverMessage: makeMessage(),
        request: makeRequest(),
        context,
      })

      expect(deps.chatStore.executeNewSessionCallback).toHaveBeenCalledWith('session-1')
    })
  })

  describe('rollbackSend', () => {
    it('stops agent thinking and removes pending message', () => {
      const deps = makeDeps(queryClient)
      const context: SendMessageMutateContext = {
        previousSession: makeSession(),
        tempMessageId: 'temp-1',
        tempMessageDTO: makeMessage({ messageID: 'temp-1', messageText: 'Hello' }),
        userMessageTimestamp: new Date(),
        isNewSession: false,
        thinkingAgentName: 'Bot',
      }

      rollbackSend(makeRequest(), context, deps)

      expect(deps.chatStore.stopAgentThinking).toHaveBeenCalledWith('session-1', 'Bot')
      expect(deps.chatStore.removePendingMessage).toHaveBeenCalledWith('session-1', 'temp-1')
    })

    it('adds a failed message with FAILED status', () => {
      const deps = makeDeps(queryClient)
      const tempMsg = makeMessage({ messageID: 'temp-1' })
      const context: SendMessageMutateContext = {
        previousSession: makeSession(),
        tempMessageId: 'temp-1',
        tempMessageDTO: tempMsg,
        userMessageTimestamp: new Date(),
        isNewSession: false,
        thinkingAgentName: undefined,
      }

      rollbackSend(makeRequest(), context, deps)

      expect(deps.chatStore.addFailedMessage).toHaveBeenCalledWith(
        'session-1',
        expect.objectContaining({
          optimisticDisplay: expect.objectContaining({ messageID: 'temp-1' }),
          request: expect.objectContaining({ sessionId: 'session-1' }),
          status: MessageStatus.FAILED,
        }),
      )
    })

    it('handles undefined context gracefully', () => {
      const deps = makeDeps(queryClient)

      expect(() => rollbackSend(makeRequest(), undefined, deps)).not.toThrow()

      expect(deps.chatStore.stopAgentThinking).not.toHaveBeenCalled()
      expect(deps.chatStore.removePendingMessage).not.toHaveBeenCalled()
      expect(deps.chatStore.addFailedMessage).not.toHaveBeenCalled()
    })
  })
})
