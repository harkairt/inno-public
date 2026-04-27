/**
 * Tests for useChatMutations composables.
 *
 * Goal: verify the cache management and side-effect logic in each composable's
 * onMutate / onSuccess / onError / onSettled hooks — NOT that the composable
 * delegates to the service (that's tested in ChatService.test.ts).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { defineComponent, ref } from 'vue'
import { mount } from '@vue/test-utils'
import { VueQueryPlugin, QueryClient } from '@tanstack/vue-query'
import { setActivePinia, createPinia } from 'pinia'
import { ok, err } from 'neverthrow'
import { chatQueryKeys } from '~/composables/useChatQueries'
import type { AISessionHeaderDTO, AISessionDTO, AISessionMessageDTO, GetUnreadMessagesDTO } from '@/types/api/schemas'
import { AIAnswerType } from '@/types/enums'
import { UnknownError } from '@/lib/errors/types'

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockRemoveAllFailedMessages = vi.fn()
const mockAddFailedMessage = vi.fn()

vi.mock('@/lib/api/services/ChatService', () => ({
  chatService: {
    sendQuestion: vi.fn(),
    deleteSession: vi.fn(),
    updateSessionName: vi.fn(),
    rateMessage: vi.fn(),
    addUserToSession: vi.fn(),
    removeUserFromSession: vi.fn(),
    markMessagesRead: vi.fn(),
  }
}))

vi.mock('@/app/composables/useSignalR', () => ({
  useSignalR: () => ({
    isConnected: ref(false),
    operations: {
      notifyMessageSent: vi.fn(),
      notifyTypingStarted: vi.fn(),
      notifyTypingStopped: vi.fn(),
    }
  })
}))

vi.mock('@/app/stores/auth', () => ({
  useAuthStore: () => ({
    user: { id: 1, email: 'user@test.com', name: 'Test User' },
    isAuthenticated: true,
  })
}))

vi.mock('@/app/stores/chat', () => ({
  useChatStore: () => ({
    activeSessionId: ref(null),
    addFailedMessage: mockAddFailedMessage,
    removeAllFailedMessages: mockRemoveAllFailedMessages,
    addTypingUser: vi.fn(),
    removeTypingUser: vi.fn(),
    onNewSessionConfirmed: vi.fn(),
    executeNewSessionCallback: vi.fn(),
    removeNewSessionCallback: vi.fn(),
  })
}))

vi.mock('@/app/composables/useUsers', () => ({
  userQueryKeys: {
    selectable: () => ['users', 'selectable'],
  }
}))

vi.mock('@/app/composables/usePublicChatAgent', () => ({
  publicChatAgentQueryKeys: {
    agent: (id: number) => ['publicChatAgent', id],
  }
}))

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeOkResult<T>(value: T) {
  return ok<T, UnknownError>(value)
}

function makeErrResult(message = 'Test error') {
  return err(new UnknownError(message))
}

function makeSessionHeader(overrides: Partial<AISessionHeaderDTO> = {}): AISessionHeaderDTO {
  return {
    sessionId: 'session-1',
    sessionName: 'Test Chat',
    agentId: 1,
    agentImage: null,
    agentDarkImage: null,
    insertDate: '2024-01-01T00:00:00Z',
    members: ['user@test.com'],
    memberDetails: null,
    userCode: 'user@test.com',
    ...overrides,
  }
}

function makeSessionDTO(overrides: Partial<AISessionDTO> = {}): AISessionDTO {
  return {
    sessionId: 'session-1',
    sessionName: 'Test Chat',
    agentId: 1,
    agentImage: null,
    agentDarkImage: null,
    userCode: 'user@test.com',
    members: ['user@test.com'],
    insertDate: '2024-01-01T00:00:00Z',
    messages: [],
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

function createWrapper<T>(queryClient: QueryClient, setup: () => T) {
  const pinia = createPinia()
  setActivePinia(pinia)

  const TestComponent = defineComponent({
    setup() {
      const result = setup()
      return { result }
    },
    template: '<div></div>',
  })

  mount(TestComponent, {
    global: {
      plugins: [[VueQueryPlugin, { queryClient }], pinia],
    }
  })
}

// ---------------------------------------------------------------------------
// useDeleteSession
// ---------------------------------------------------------------------------

describe('useDeleteSession — cache management', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('removes deleted session from sessions list cache on success', async () => {
    const { chatService } = await import('@/lib/api/services/ChatService')
    const { useDeleteSession } = await import('~/composables/useChatMutations')
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })

    vi.mocked(chatService.deleteSession).mockResolvedValue(makeOkResult(true))

    // Pre-populate cache with two sessions
    queryClient.setQueryData<AISessionHeaderDTO[]>(chatQueryKeys.sessions(), [
      makeSessionHeader({ sessionId: 'session-1' }),
      makeSessionHeader({ sessionId: 'session-2' }),
    ])

    let mutation: ReturnType<typeof useDeleteSession> | undefined
    createWrapper(queryClient, () => {
      mutation = useDeleteSession()
    })

    await mutation!.mutateAsync({ sessionId: 'session-1', agentId: 1 })

    const remaining = queryClient.getQueryData<AISessionHeaderDTO[]>(chatQueryKeys.sessions())
    expect(remaining).toHaveLength(1)
    expect(remaining?.[0]?.sessionId).toBe('session-2')
  })

  it('removes individual session data from cache on success', async () => {
    const { chatService } = await import('@/lib/api/services/ChatService')
    const { useDeleteSession } = await import('~/composables/useChatMutations')
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })

    vi.mocked(chatService.deleteSession).mockResolvedValue(makeOkResult(true))

    queryClient.setQueryData(chatQueryKeys.session('session-1'), makeSessionDTO())

    let mutation: ReturnType<typeof useDeleteSession> | undefined
    createWrapper(queryClient, () => {
      mutation = useDeleteSession()
    })

    await mutation!.mutateAsync({ sessionId: 'session-1', agentId: 1 })

    expect(queryClient.getQueryData(chatQueryKeys.session('session-1'))).toBeUndefined()
  })

  it('clears failed messages store for deleted session on success', async () => {
    const { chatService } = await import('@/lib/api/services/ChatService')
    const { useDeleteSession } = await import('~/composables/useChatMutations')
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })

    vi.mocked(chatService.deleteSession).mockResolvedValue(makeOkResult(true))

    let mutation: ReturnType<typeof useDeleteSession> | undefined
    createWrapper(queryClient, () => {
      mutation = useDeleteSession()
    })

    await mutation!.mutateAsync({ sessionId: 'session-1', agentId: 1 })

    expect(mockRemoveAllFailedMessages).toHaveBeenCalledWith('session-1')
  })

  it('throws when service returns error', async () => {
    const { chatService } = await import('@/lib/api/services/ChatService')
    const { useDeleteSession } = await import('~/composables/useChatMutations')
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })

    vi.mocked(chatService.deleteSession).mockResolvedValue(
      makeErrResult('Network error: Failed')
    )

    let mutation: ReturnType<typeof useDeleteSession> | undefined
    createWrapper(queryClient, () => {
      mutation = useDeleteSession()
    })

    await expect(
      mutation!.mutateAsync({ sessionId: 'session-1', agentId: 1 })
    ).rejects.toBeDefined()
  })
})

// ---------------------------------------------------------------------------
// useUpdateSessionName
// ---------------------------------------------------------------------------

describe('useUpdateSessionName — cache management', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('updates session name in sessions list cache on success', async () => {
    const { chatService } = await import('@/lib/api/services/ChatService')
    const { useUpdateSessionName } = await import('~/composables/useChatMutations')
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })

    vi.mocked(chatService.updateSessionName).mockResolvedValue(makeOkResult(true))

    queryClient.setQueryData<AISessionHeaderDTO[]>(chatQueryKeys.sessions(), [
      makeSessionHeader({ sessionId: 'session-1', sessionName: 'Old Name' }),
    ])

    let mutation: ReturnType<typeof useUpdateSessionName> | undefined
    createWrapper(queryClient, () => {
      mutation = useUpdateSessionName()
    })

    await mutation!.mutateAsync({ sessionId: 'session-1', sessionName: 'New Name', agentId: 1 })

    const sessions = queryClient.getQueryData<AISessionHeaderDTO[]>(chatQueryKeys.sessions())
    expect(sessions?.[0]?.sessionName).toBe('New Name')
  })

  it('updates session name in individual session cache on success', async () => {
    const { chatService } = await import('@/lib/api/services/ChatService')
    const { useUpdateSessionName } = await import('~/composables/useChatMutations')
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })

    vi.mocked(chatService.updateSessionName).mockResolvedValue(makeOkResult(true))

    queryClient.setQueryData(chatQueryKeys.session('session-1'), makeSessionDTO({ sessionName: 'Old Name' }))

    let mutation: ReturnType<typeof useUpdateSessionName> | undefined
    createWrapper(queryClient, () => {
      mutation = useUpdateSessionName()
    })

    await mutation!.mutateAsync({ sessionId: 'session-1', sessionName: 'New Name', agentId: 1 })

    const session = queryClient.getQueryData<AISessionDTO>(chatQueryKeys.session('session-1'))
    expect(session?.sessionName).toBe('New Name')
  })

  it('leaves other sessions unchanged in list cache', async () => {
    const { chatService } = await import('@/lib/api/services/ChatService')
    const { useUpdateSessionName } = await import('~/composables/useChatMutations')
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })

    vi.mocked(chatService.updateSessionName).mockResolvedValue(makeOkResult(true))

    queryClient.setQueryData<AISessionHeaderDTO[]>(chatQueryKeys.sessions(), [
      makeSessionHeader({ sessionId: 'session-1', sessionName: 'To Rename' }),
      makeSessionHeader({ sessionId: 'session-2', sessionName: 'Keep This' }),
    ])

    let mutation: ReturnType<typeof useUpdateSessionName> | undefined
    createWrapper(queryClient, () => {
      mutation = useUpdateSessionName()
    })

    await mutation!.mutateAsync({ sessionId: 'session-1', sessionName: 'Renamed', agentId: 1 })

    const sessions = queryClient.getQueryData<AISessionHeaderDTO[]>(chatQueryKeys.sessions())
    expect(sessions?.find(s => s.sessionId === 'session-2')?.sessionName).toBe('Keep This')
  })
})

// ---------------------------------------------------------------------------
// useRateMessage
// ---------------------------------------------------------------------------

describe('useRateMessage — optimistic updates', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('optimistically marks message as rated in session cache', async () => {
    const { chatService } = await import('@/lib/api/services/ChatService')
    const { useRateMessage } = await import('~/composables/useChatMutations')
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })

    // Service resolves but we assert cache state after onMutate
    let resolveService!: () => void
    vi.mocked(chatService.rateMessage).mockReturnValue(
      new Promise((res) => {
        resolveService = () => res(makeOkResult(undefined))
      })
    )

    queryClient.setQueryData<AISessionDTO>(chatQueryKeys.session('session-1'), makeSessionDTO({
      messages: [makeMessage({ messageID: 'msg-1', isRated: false, rating: null })],
    }))

    let mutation: ReturnType<typeof useRateMessage> | undefined
    createWrapper(queryClient, () => {
      mutation = useRateMessage()
    })

    // Start mutation — don't await, so we can inspect cache after onMutate runs
    const mutatePromise = mutation!.mutateAsync({
      sessionId: 'session-1',
      messageId: 'msg-1',
      agentId: 1,
      rating: 1,
    })

    // Give onMutate a chance to run
    await new Promise(r => setTimeout(r, 0))

    const session = queryClient.getQueryData<AISessionDTO>(chatQueryKeys.session('session-1'))
    const ratedMessage = session?.messages?.find(m => m.messageID === 'msg-1')
    expect(ratedMessage?.isRated).toBe(true)
    expect(ratedMessage?.rating).toBe(1)

    // Resolve the service so the mutation can settle
    resolveService()
    await mutatePromise
  })

  it('rolls back rating on error', async () => {
    const { chatService } = await import('@/lib/api/services/ChatService')
    const { useRateMessage } = await import('~/composables/useChatMutations')
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })

    vi.mocked(chatService.rateMessage).mockResolvedValue(
      makeErrResult('Server error: Failed')
    )

    const originalMessage = makeMessage({ messageID: 'msg-1', isRated: false, rating: null })
    queryClient.setQueryData<AISessionDTO>(chatQueryKeys.session('session-1'), makeSessionDTO({
      messages: [originalMessage],
    }))

    let mutation: ReturnType<typeof useRateMessage> | undefined
    createWrapper(queryClient, () => {
      mutation = useRateMessage()
    })

    await mutation!.mutateAsync({
      sessionId: 'session-1',
      messageId: 'msg-1',
      agentId: 1,
      rating: 1,
    }).catch(() => { /* expected to throw */ })

    const session = queryClient.getQueryData<AISessionDTO>(chatQueryKeys.session('session-1'))
    const msg = session?.messages?.find(m => m.messageID === 'msg-1')
    expect(msg?.isRated).toBe(false)
    expect(msg?.rating).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// useMarkMessagesRead
// ---------------------------------------------------------------------------

describe('useMarkMessagesRead — optimistic updates', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('optimistically sets unread count to 0 for the session', async () => {
    const { chatService } = await import('@/lib/api/services/ChatService')
    const { useMarkMessagesRead } = await import('~/composables/useChatMutations')
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })

    let resolveService!: () => void
    vi.mocked(chatService.markMessagesRead).mockReturnValue(
      new Promise((res) => {
        resolveService = () => res(makeOkResult(undefined))
      })
    )

    queryClient.setQueryData<GetUnreadMessagesDTO[]>(chatQueryKeys.unread(), [
      { sessionId: 'session-1', unreadMessageCount: 5 },
      { sessionId: 'session-2', unreadMessageCount: 3 },
    ])

    let mutation: ReturnType<typeof useMarkMessagesRead> | undefined
    createWrapper(queryClient, () => {
      mutation = useMarkMessagesRead()
    })

    const mutatePromise = mutation!.mutateAsync({ sessionId: 'session-1', agentId: 1, userCode: 'user@test.com' })
    await new Promise(r => setTimeout(r, 0))

    const unread = queryClient.getQueryData<GetUnreadMessagesDTO[]>(chatQueryKeys.unread())
    expect(unread?.find(u => u.sessionId === 'session-1')?.unreadMessageCount).toBe(0)
    // Other sessions unaffected
    expect(unread?.find(u => u.sessionId === 'session-2')?.unreadMessageCount).toBe(3)

    resolveService()
    await mutatePromise
  })

  it('rolls back unread count on error', async () => {
    const { chatService } = await import('@/lib/api/services/ChatService')
    const { useMarkMessagesRead } = await import('~/composables/useChatMutations')
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })

    vi.mocked(chatService.markMessagesRead).mockResolvedValue(
      makeErrResult('Server error: Failed')
    )

    queryClient.setQueryData<GetUnreadMessagesDTO[]>(chatQueryKeys.unread(), [
      { sessionId: 'session-1', unreadMessageCount: 7 },
    ])

    let mutation: ReturnType<typeof useMarkMessagesRead> | undefined
    createWrapper(queryClient, () => {
      mutation = useMarkMessagesRead()
    })

    await mutation!.mutateAsync({ sessionId: 'session-1', agentId: 1, userCode: 'user@test.com' })
      .catch(() => { /* expected */ })

    const unread = queryClient.getQueryData<GetUnreadMessagesDTO[]>(chatQueryKeys.unread())
    expect(unread?.find(u => u.sessionId === 'session-1')?.unreadMessageCount).toBe(7)
  })

  it('adds userCode to readByUsers for all messages on success', async () => {
    const { chatService } = await import('@/lib/api/services/ChatService')
    const { useMarkMessagesRead } = await import('~/composables/useChatMutations')
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })

    vi.mocked(chatService.markMessagesRead).mockResolvedValue(makeOkResult(undefined))

    queryClient.setQueryData<AISessionDTO>(chatQueryKeys.session('session-1'), makeSessionDTO({
      messages: [
        makeMessage({ messageID: 'msg-1', readByUsers: [] }),
        makeMessage({ messageID: 'msg-2', readByUsers: ['other@test.com'] }),
      ],
    }))

    let mutation: ReturnType<typeof useMarkMessagesRead> | undefined
    createWrapper(queryClient, () => {
      mutation = useMarkMessagesRead()
    })

    await mutation!.mutateAsync({ sessionId: 'session-1', agentId: 1, userCode: 'user@test.com' })

    const session = queryClient.getQueryData<AISessionDTO>(chatQueryKeys.session('session-1'))
    expect(session?.messages?.[0]?.readByUsers).toContain('user@test.com')
    expect(session?.messages?.[1]?.readByUsers).toContain('user@test.com')
    expect(session?.messages?.[1]?.readByUsers).toContain('other@test.com')
  })

  it('does not duplicate userCode in readByUsers if already present', async () => {
    const { chatService } = await import('@/lib/api/services/ChatService')
    const { useMarkMessagesRead } = await import('~/composables/useChatMutations')
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })

    vi.mocked(chatService.markMessagesRead).mockResolvedValue(makeOkResult(undefined))

    queryClient.setQueryData<AISessionDTO>(chatQueryKeys.session('session-1'), makeSessionDTO({
      messages: [makeMessage({ messageID: 'msg-1', readByUsers: ['user@test.com'] })],
    }))

    let mutation: ReturnType<typeof useMarkMessagesRead> | undefined
    createWrapper(queryClient, () => {
      mutation = useMarkMessagesRead()
    })

    await mutation!.mutateAsync({ sessionId: 'session-1', agentId: 1, userCode: 'user@test.com' })

    const session = queryClient.getQueryData<AISessionDTO>(chatQueryKeys.session('session-1'))
    const readBy = session?.messages?.[0]?.readByUsers
    expect(readBy?.filter(u => u === 'user@test.com')).toHaveLength(1)
  })
})
