/**
 * Integration tests for the useChatMutations composables driven end to end
 * through the REAL chatService against MSW, real Pinia stores, and (for send)
 * the fake SignalR singleton. No service/store/apiClient mocking.
 *
 * Purpose: kill behavioral survivors from mutation testing by asserting only
 * public observables — TanStack Query cache (getQueryData / getQueryState),
 * real chat-store getters (getTypingUsers, getPendingMessages, getFailedMessages,
 * getUnconfirmedPendingMessages), and captured request bodies.
 */
import { describe, it, expect, vi } from 'vitest'
import { defineComponent } from 'vue'
import { mount } from '@vue/test-utils'
import { VueQueryPlugin, QueryClient } from '@tanstack/vue-query'
import { createPinia, setActivePinia } from 'pinia'
import { server, http } from '@/tests/msw/server'
import { apiOk, apiError, mutationOk } from '@/tests/msw/http'
import { makeRawMessage, makeUser, makeMessage } from '@/tests/utils/factories'
import { seedAuthStorage } from '@/tests/utils/authSeed'
import { installFakeSignalR } from '@/tests/utils/fakeSignalR'
import {
  useSendMessage,
  useUpdateSessionName,
  useDeleteSession,
  useRateMessage,
  useMarkMessagesRead,
} from '@/app/composables/useChatMutations'
import { chatQueryKeys } from '@/app/composables/useChatQueries'
import { userQueryKeys } from '@/app/composables/useUsers'
import { publicChatAgentQueryKeys } from '@/app/composables/usePublicChatAgent'
import { useChatStore } from '@/app/stores/chat'
import type {
  AISessionDTO,
  AISessionHeaderDTO,
  AiQuestionRequestDTO,
  GetUnreadMessagesDTO,
} from '@/types/api/schemas'

const ME = 'me@example.com'
const OTHER = 'other@example.com'

function existingSession(overrides: Partial<AISessionDTO> = {}): AISessionDTO {
  return {
    sessionId: 'session-1',
    sessionName: 'Chat',
    agentId: 1,
    agentImage: null,
    agentDarkImage: null,
    userCode: ME,
    members: [ME, OTHER],
    insertDate: '2024-01-01T00:00:00Z',
    messages: [],
    ...overrides,
  }
}

function sendRequest(): AiQuestionRequestDTO {
  return {
    sessionId: 'session-1',
    agentId: 1,
    userCode: ME,
    members: [ME, OTHER],
    question: 'hello there',
    group: 'default',
    pquestionType: 0,
    options: [],
  } as unknown as AiQuestionRequestDTO
}

function testQueryClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
}

// Mount a throwaway component so the composable runs inside a Vue Query +
// Pinia context; returns the composable's value. The pinia created here stays
// active, so a subsequent useChatStore() resolves against the same instance.
function mountWith<T>(queryClient: QueryClient, useComposable: () => T): T {
  const pinia = createPinia()
  setActivePinia(pinia)
  let result!: T
  const Comp = defineComponent({
    setup() {
      result = useComposable()
      return () => null
    },
  })
  mount(Comp, { global: { plugins: [[VueQueryPlugin, { queryClient }], pinia] } })
  return result
}

function deferred<T = void>() {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

describe('useSendMessage — empty-response filtering (isEmptyResponse)', () => {
  it('keeps only the user message when the server reply is typed Empty despite carrying text', async () => {
    seedAuthStorage({ user: makeUser({ email: ME }) })
    installFakeSignalR().setState('connected')
    // messageType 'empty' → AIAnswerType.Empty after parse, so the non-empty text
    // must NOT be treated as a real reply (kills the messageType===Empty branch).
    server.use(
      http.post('/api/AIWebAPI/question/text', () =>
        apiOk(makeRawMessage({ messageType: 'empty', messageText: 'internal ack' })),
      ),
    )

    const queryClient = testQueryClient()
    const mutation = mountWith(queryClient, useSendMessage)

    await mutation.mutateAsync({ request: sendRequest() })

    const session = queryClient.getQueryData<AISessionDTO>(chatQueryKeys.session('session-1'))
    const messages = session?.messages ?? []
    expect(messages).toHaveLength(1)
    expect(messages[0]?.messageText).toBe('hello there')
    expect(messages.some((m) => m.messageText === 'internal ack')).toBe(false)
  })

  it('keeps only the user message when the server reply is whitespace-only', async () => {
    seedAuthStorage({ user: makeUser({ email: ME }) })
    installFakeSignalR().setState('connected')
    // Whitespace text exercises the `!text || text.trim() === ''` branches.
    server.use(
      http.post('/api/AIWebAPI/question/text', () =>
        apiOk(makeRawMessage({ messageType: 'text', messageText: '   ' })),
      ),
    )

    const queryClient = testQueryClient()
    const mutation = mountWith(queryClient, useSendMessage)

    await mutation.mutateAsync({ request: sendRequest() })

    const session = queryClient.getQueryData<AISessionDTO>(chatQueryKeys.session('session-1'))
    expect(session?.messages ?? []).toHaveLength(1)
    expect(session?.messages?.[0]?.messageText).toBe('hello there')
  })
})

describe('useSendMessage — virtual-agent typing indicator', () => {
  it('shows the virtual agent typing mid-flight and clears it on success', async () => {
    seedAuthStorage({ user: makeUser({ email: ME }) })
    installFakeSignalR().setState('connected')

    const gate = deferred()
    server.use(
      http.post('/api/AIWebAPI/question/text', async () => {
        await gate.promise
        return apiOk(makeRawMessage())
      }),
    )

    const queryClient = testQueryClient()
    // Virtual agent resolved from the selectable-users cache.
    queryClient.setQueryData(userQueryKeys.selectable(), [
      makeUser({ id: 1, isVirtual: true, name: 'Bot' }),
    ])
    const mutation = mountWith(queryClient, useSendMessage)
    const chatStore = useChatStore()

    const inFlight = mutation.mutateAsync({ request: sendRequest() })
    await vi.waitFor(() => expect(chatStore.getThinkingAgents('session-1')).toContain('Bot'))

    gate.resolve()
    await inFlight

    expect(chatStore.getThinkingAgents('session-1')).toEqual([])
  })

  it('clears the virtual-agent typing indicator when the send fails', async () => {
    seedAuthStorage({ user: makeUser({ email: ME }) })
    installFakeSignalR().setState('connected')
    server.use(http.post('/api/AIWebAPI/question/text', () => apiError(500)))

    const queryClient = testQueryClient()
    queryClient.setQueryData(userQueryKeys.selectable(), [
      makeUser({ id: 1, isVirtual: true, name: 'Bot' }),
    ])
    const mutation = mountWith(queryClient, useSendMessage)
    const chatStore = useChatStore()

    await expect(mutation.mutateAsync({ request: sendRequest() })).rejects.toBeDefined()

    expect(chatStore.getThinkingAgents('session-1')).toEqual([])
  })

  it('resolves the virtual agent from the public-chat-agent cache when not selectable', async () => {
    seedAuthStorage({ user: makeUser({ email: ME }) })
    installFakeSignalR().setState('connected')

    const gate = deferred()
    server.use(
      http.post('/api/AIWebAPI/question/text', async () => {
        await gate.promise
        return apiOk(makeRawMessage())
      }),
    )

    const queryClient = testQueryClient()
    // No selectable-users cache → falls back to the public-chat-agent cache.
    queryClient.setQueryData(publicChatAgentQueryKeys.agent(1), {
      agent: makeUser({ id: 1, isVirtual: true, name: 'PubBot' }),
    })
    const mutation = mountWith(queryClient, useSendMessage)
    const chatStore = useChatStore()

    const inFlight = mutation.mutateAsync({ request: sendRequest() })
    await vi.waitFor(() => expect(chatStore.getThinkingAgents('session-1')).toContain('PubBot'))

    gate.resolve()
    await inFlight
    expect(chatStore.getThinkingAgents('session-1')).toEqual([])
  })
})

describe('useSendMessage — failed-message identity on rollback', () => {
  it('stamps the failed message with the authenticated user identity', async () => {
    seedAuthStorage({ user: makeUser({ email: ME, name: 'Me Myself' }) })
    installFakeSignalR()
    server.use(http.post('/api/AIWebAPI/question/text', () => apiError(500)))

    const queryClient = testQueryClient()
    queryClient.setQueryData(chatQueryKeys.session('session-1'), existingSession())
    const mutation = mountWith(queryClient, useSendMessage)
    const chatStore = useChatStore()

    await expect(mutation.mutateAsync({ request: sendRequest() })).rejects.toBeDefined()

    const failed = chatStore.getFailedMessages('session-1')
    expect(failed).toHaveLength(1)
    expect(failed[0]?.senderUserCode).toBe(ME)
    expect(failed[0]?.senderName).toBe('Me Myself')
    expect(failed[0]?.isRated).toBe(false)
    expect(failed[0]?.readByUsers).toContain(ME)
  })

  it('falls back to unknown/You identity when unauthenticated', async () => {
    // No seedAuthStorage → authStore.user is null.
    installFakeSignalR()
    server.use(http.post('/api/AIWebAPI/question/text', () => apiError(500)))

    const queryClient = testQueryClient()
    queryClient.setQueryData(chatQueryKeys.session('session-1'), existingSession())
    const mutation = mountWith(queryClient, useSendMessage)
    const chatStore = useChatStore()

    await expect(mutation.mutateAsync({ request: sendRequest() })).rejects.toBeDefined()

    const failed = chatStore.getFailedMessages('session-1')
    expect(failed).toHaveLength(1)
    expect(failed[0]?.senderUserCode).toBe('unknown')
    expect(failed[0]?.senderName).toBe('You')
    expect(failed[0]?.readByUsers).toEqual(['unknown'])
  })
})

describe('useSendMessage — synthetic session fields on a new session', () => {
  it('populates the synthetic session with request-derived fields mid-flight', async () => {
    seedAuthStorage({ user: makeUser({ email: ME }) })
    installFakeSignalR().setState('connected')

    const gate = deferred()
    server.use(
      http.post('/api/AIWebAPI/question/text', async () => {
        await gate.promise
        return apiOk(makeRawMessage())
      }),
    )

    // No pre-seeded session → onMutate treats this as a new session.
    const queryClient = testQueryClient()
    const mutation = mountWith(queryClient, useSendMessage)

    const inFlight = mutation.mutateAsync({ request: sendRequest() })
    await vi.waitFor(() =>
      expect(queryClient.getQueryData(chatQueryKeys.session('session-1'))).toBeDefined(),
    )

    const session = queryClient.getQueryData<AISessionDTO>(chatQueryKeys.session('session-1'))
    expect(session?.sessionId).toBe('session-1')
    expect(session?.agentId).toBe(1)
    expect(session?.members).toEqual([ME, OTHER])
    expect(session?.userCode).toBe(ME)

    gate.resolve()
    await inFlight
  })
})

describe('useSendMessage — new-session dedupe on merge', () => {
  it('does not duplicate a server message already present from a concurrent refetch', async () => {
    seedAuthStorage({ user: makeUser({ email: ME }) })
    installFakeSignalR().setState('connected')

    const gate = deferred()
    server.use(
      http.post('/api/AIWebAPI/question/text', async () => {
        await gate.promise
        return apiOk(makeRawMessage({ messageID: 'dup-id', messageText: 'AI reply' }))
      }),
    )

    const queryClient = testQueryClient()
    const mutation = mountWith(queryClient, useSendMessage)

    const inFlight = mutation.mutateAsync({ request: sendRequest() })
    await vi.waitFor(() =>
      expect(queryClient.getQueryData(chatQueryKeys.session('session-1'))).toBeDefined(),
    )

    // Simulate a SignalR-triggered refetch landing the same message before onSuccess.
    queryClient.setQueryData<AISessionDTO>(chatQueryKeys.session('session-1'), (old) => ({
      ...(old as AISessionDTO),
      messages: [makeMessage({ messageID: 'dup-id', messageText: 'AI reply' })],
    }))

    gate.resolve()
    await inFlight

    const session = queryClient.getQueryData<AISessionDTO>(chatQueryKeys.session('session-1'))
    const dups = (session?.messages ?? []).filter((m) => m.messageID === 'dup-id')
    expect(dups).toHaveLength(1)
  })
})

describe('useSendMessage — pending baseline count', () => {
  it('keeps a repeated message unconfirmed against a pre-existing identical one', async () => {
    seedAuthStorage({ user: makeUser({ email: ME }) })
    installFakeSignalR().setState('connected')

    const gate = deferred()
    server.use(
      http.post('/api/AIWebAPI/question/text', async () => {
        await gate.promise
        return apiOk(makeRawMessage())
      }),
    )

    const existingMessages = [makeMessage({ senderUserCode: ME, messageText: 'hello there' })]
    const queryClient = testQueryClient()
    queryClient.setQueryData(
      chatQueryKeys.session('session-1'),
      existingSession({ messages: existingMessages }),
    )
    const mutation = mountWith(queryClient, useSendMessage)
    const chatStore = useChatStore()

    const inFlight = mutation.mutateAsync({ request: sendRequest() })
    // Wait until onMutate has parked the pending message.
    await vi.waitFor(() => expect(chatStore.getPendingMessages('session-1')).toHaveLength(1))

    // baselineCount=1 was captured, so the single pre-existing identical message
    // does NOT confirm this fresh send — it stays unconfirmed.
    expect(chatStore.getUnconfirmedPendingMessages('session-1', existingMessages)).toHaveLength(1)

    gate.resolve()
    await inFlight
  })
})

describe('useSendMessage — sidebar header insert', () => {
  it('prepends the new-session header without dropping existing headers', async () => {
    seedAuthStorage({ user: makeUser({ email: ME }) })
    installFakeSignalR().setState('connected')
    server.use(http.post('/api/AIWebAPI/question/text', () => apiOk(makeRawMessage())))

    const other: AISessionHeaderDTO = {
      sessionId: 'session-2',
      sessionName: 'Other',
      agentId: 1,
      agentImage: null,
      agentDarkImage: null,
      userCode: ME,
      members: [ME],
      insertDate: '2024-01-01T00:00:00Z',
    }
    const queryClient = testQueryClient()
    queryClient.setQueryData(chatQueryKeys.sessions(), [other])
    const mutation = mountWith(queryClient, useSendMessage)

    await mutation.mutateAsync({ request: sendRequest() })

    const headers = queryClient.getQueryData<AISessionHeaderDTO[]>(chatQueryKeys.sessions()) ?? []
    const ids = headers.map((h) => h.sessionId)
    expect(ids).toContain('session-1')
    expect(ids).toContain('session-2')
  })
})

describe('useUpdateSessionName', () => {
  it('rolls back both caches when the server errors', async () => {
    server.use(http.post('/api/AIWebAPI/SetSessionName', () => apiError(500)))

    const queryClient = testQueryClient()
    queryClient.setQueryData(chatQueryKeys.sessions(), [
      { sessionId: 'session-1', sessionName: 'Old Name', agentId: 1 } as AISessionHeaderDTO,
    ])
    queryClient.setQueryData(
      chatQueryKeys.session('session-1'),
      existingSession({ sessionName: 'Old Name' }),
    )
    const mutation = mountWith(queryClient, useUpdateSessionName)

    await expect(
      mutation.mutateAsync({ sessionId: 'session-1', sessionName: 'New Name', agentId: 1 }),
    ).rejects.toBeDefined()

    expect(
      queryClient.getQueryData<AISessionDTO>(chatQueryKeys.session('session-1'))?.sessionName,
    ).toBe('Old Name')
    expect(
      queryClient.getQueryData<AISessionHeaderDTO[]>(chatQueryKeys.sessions())?.[0]?.sessionName,
    ).toBe('Old Name')
  })

  it('optimistically updates both caches and invalidates only affected queries on success', async () => {
    server.use(http.post('/api/AIWebAPI/SetSessionName', () => mutationOk()))

    const queryClient = testQueryClient()
    queryClient.setQueryData(chatQueryKeys.sessions(), [
      { sessionId: 'session-1', sessionName: 'Old', agentId: 1 } as AISessionHeaderDTO,
    ])
    queryClient.setQueryData(
      chatQueryKeys.session('session-1'),
      existingSession({ sessionName: 'Old' }),
    )
    queryClient.setQueryData(
      chatQueryKeys.session('other'),
      existingSession({ sessionId: 'other', sessionName: 'Other' }),
    )
    const mutation = mountWith(queryClient, useUpdateSessionName)

    await mutation.mutateAsync({ sessionId: 'session-1', sessionName: 'New', agentId: 1 })

    const headers = queryClient.getQueryData<AISessionHeaderDTO[]>(chatQueryKeys.sessions())
    expect(headers?.[0]?.sessionName).toBe('New')
    expect(
      queryClient.getQueryData<AISessionDTO>(chatQueryKeys.session('session-1'))?.sessionName,
    ).toBe('New')

    expect(queryClient.getQueryState(chatQueryKeys.sessions())?.isInvalidated).toBe(true)
    expect(queryClient.getQueryState(chatQueryKeys.session('session-1'))?.isInvalidated).toBe(true)
    expect(queryClient.getQueryState(chatQueryKeys.session('other'))?.isInvalidated).toBe(false)
  })
})

describe('useDeleteSession', () => {
  it('removes the session, clears failed messages, and invalidates unread on success', async () => {
    server.use(http.post('/api/AIWebAPI/DeleteSessionById', () => mutationOk()))

    const queryClient = testQueryClient()
    queryClient.setQueryData(chatQueryKeys.sessions(), [
      { sessionId: 'session-1', sessionName: 'A', agentId: 1 } as AISessionHeaderDTO,
      { sessionId: 'session-2', sessionName: 'B', agentId: 1 } as AISessionHeaderDTO,
    ])
    queryClient.setQueryData<GetUnreadMessagesDTO[]>(chatQueryKeys.unread(), [
      { sessionId: 'session-1', unreadMessageCount: 3 },
    ])
    const mutation = mountWith(queryClient, useDeleteSession)
    const chatStore = useChatStore()
    chatStore.addFailedMessage('session-1', {
      optimisticDisplay: makeMessage({ messageID: 'f1' }),
      request: {
        userCode: 'user',
        sessionId: 'session-1',
        agentId: 1,
        members: [],
        question: '',
        group: '',
        pquestionType: 0,
        options: [],
        files: [],
      },
      status: 3 as never,
    })

    await mutation.mutateAsync({ sessionId: 'session-1', agentId: 1 })

    const headers = queryClient.getQueryData<AISessionHeaderDTO[]>(chatQueryKeys.sessions()) ?? []
    expect(headers.map((h) => h.sessionId)).toEqual(['session-2'])
    expect(chatStore.getFailedMessages('session-1')).toHaveLength(0)
    expect(queryClient.getQueryState(chatQueryKeys.unread())?.isInvalidated).toBe(true)
  })
})

describe('useRateMessage', () => {
  it('resolves even when the cached session has no messages array', async () => {
    server.use(http.post('/api/AIWebAPI/SetSessionMessageRating', () => apiOk(null)))

    const queryClient = testQueryClient()
    queryClient.setQueryData(
      chatQueryKeys.session('session-1'),
      existingSession({ messages: undefined as never }),
    )
    const mutation = mountWith(queryClient, useRateMessage)

    await expect(
      mutation.mutateAsync({ sessionId: 'session-1', messageId: 'm1', rating: true, agentId: 1 }),
    ).resolves.toBeUndefined()
  })

  it('optimistically writes rating 0 for a negative rating', async () => {
    server.use(http.post('/api/AIWebAPI/SetSessionMessageRating', () => apiOk(null)))

    const queryClient = testQueryClient()
    queryClient.setQueryData(
      chatQueryKeys.session('session-1'),
      existingSession({
        messages: [makeMessage({ messageID: 'm1', isRated: false, rating: null })],
      }),
    )
    const mutation = mountWith(queryClient, useRateMessage)

    await mutation.mutateAsync({
      sessionId: 'session-1',
      messageId: 'm1',
      rating: false,
      agentId: 1,
    })

    const session = queryClient.getQueryData<AISessionDTO>(chatQueryKeys.session('session-1'))
    const rated = session?.messages?.find((m) => m.messageID === 'm1')
    expect(rated?.isRated).toBe(true)
    expect(rated?.rating).toBe(0)
    // onSettled re-syncs via invalidation.
    expect(queryClient.getQueryState(chatQueryKeys.session('session-1'))?.isInvalidated).toBe(true)
  })

  it('optimistically writes rating 1 for a positive rating', async () => {
    server.use(http.post('/api/AIWebAPI/SetSessionMessageRating', () => apiOk(null)))

    const queryClient = testQueryClient()
    queryClient.setQueryData(
      chatQueryKeys.session('session-1'),
      existingSession({
        messages: [makeMessage({ messageID: 'm1', isRated: false, rating: null })],
      }),
    )
    const mutation = mountWith(queryClient, useRateMessage)

    await mutation.mutateAsync({
      sessionId: 'session-1',
      messageId: 'm1',
      rating: true,
      agentId: 1,
    })

    const session = queryClient.getQueryData<AISessionDTO>(chatQueryKeys.session('session-1'))
    expect(session?.messages?.find((m) => m.messageID === 'm1')?.rating).toBe(1)
  })
})

describe('useMarkMessagesRead', () => {
  it('defaults userCode to the authenticated email and marks messages read', async () => {
    seedAuthStorage({ user: makeUser({ email: ME }) })

    let captured: { userCode?: string } | undefined
    server.use(
      http.post('/api/AIWebAPI/Set_SessionMessagesRead', async ({ request }) => {
        captured = (await request.json()) as { userCode?: string }
        return apiOk(null)
      }),
    )

    const queryClient = testQueryClient()
    queryClient.setQueryData(
      chatQueryKeys.session('session-1'),
      existingSession({
        messages: [
          makeMessage({ messageID: 'm1', readByUsers: undefined as never }),
          makeMessage({ messageID: 'm2', readByUsers: ['other'] }),
        ],
      }),
    )
    queryClient.setQueryData<GetUnreadMessagesDTO[]>(chatQueryKeys.unread(), [
      { sessionId: 'session-1', unreadMessageCount: 2 },
    ])
    // No userCode passed → mutationFn falls back to authStore.user.email.
    const mutation = mountWith(queryClient, useMarkMessagesRead)

    await mutation.mutateAsync({ sessionId: 'session-1', agentId: 1 })

    expect(captured?.userCode).toBe(ME)

    const session = queryClient.getQueryData<AISessionDTO>(chatQueryKeys.session('session-1'))
    const m1 = session?.messages?.find((m) => m.messageID === 'm1')
    const m2 = session?.messages?.find((m) => m.messageID === 'm2')
    expect(m1?.readByUsers).toEqual([ME])
    expect(m2?.readByUsers).toEqual(['other', ME])

    expect(queryClient.getQueryState(chatQueryKeys.unread())?.isInvalidated).toBe(true)
  })
})
