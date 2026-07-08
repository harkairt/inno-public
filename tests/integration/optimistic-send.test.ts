/**
 * Integration test for useSendMessage — the optimistic-send flow driven end to
 * end through the REAL chatService against MSW, real Pinia stores, and the fake
 * SignalR singleton. No service/store/apiClient mocking.
 *
 * Covers: optimistic temp message appended on mutate; MSW 500 → rollback + the
 * failed message landing in chatStore; SignalR member notification on success.
 */
import { describe, it, expect } from 'vitest'
import { defineComponent } from 'vue'
import { mount } from '@vue/test-utils'
import { VueQueryPlugin, QueryClient } from '@tanstack/vue-query'
import { createPinia, setActivePinia } from 'pinia'
import { server, http } from '@/tests/msw/server'
import { apiOk, apiError } from '@/tests/msw/http'
import { makeRawMessage, makeUser } from '@/tests/utils/factories'
import { seedAuthStorage } from '@/tests/utils/authSeed'
import { installFakeSignalR } from '@/tests/utils/fakeSignalR'
import { useSendMessage } from '@/app/composables/useChatMutations'
import { chatQueryKeys } from '@/app/composables/useChatQueries'
import { useChatStore } from '@/app/stores/chat'
import { MessageStatus } from '@/types/enums'
import type { AISessionDTO, AiQuestionRequestDTO } from '@/types/api/schemas'

const ME = 'me@example.com'
const OTHER = 'other@example.com'

function existingSession(): AISessionDTO {
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

function mountSend(queryClient: QueryClient) {
  const pinia = createPinia()
  setActivePinia(pinia)

  let mutation!: ReturnType<typeof useSendMessage>
  const Comp = defineComponent({
    setup() {
      mutation = useSendMessage()
      return () => null
    },
  })
  mount(Comp, { global: { plugins: [[VueQueryPlugin, { queryClient }], pinia] } })
  return mutation
}

function testQueryClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
}

describe('useSendMessage — optimistic send integration', () => {
  it('invalidates the session query and clears the optimistic message on success', async () => {
    seedAuthStorage({ user: makeUser({ email: ME }) })
    const fake = installFakeSignalR()
    fake.setState('connected')
    server.use(
      http.post('/api/AIWebAPI/question/text', () =>
        apiOk(makeRawMessage({ messageID: 'server-msg', messageText: 'AI reply' })),
      ),
    )

    const queryClient = testQueryClient()
    queryClient.setQueryData(chatQueryKeys.session('session-1'), existingSession())
    const mutation = mountSend(queryClient)

    await mutation.mutateAsync(sendRequest())

    // Existing-session success reconciles by invalidating the session query — the
    // ensuing GetSessionById refetch is authoritative — rather than clobbering the
    // cache with the lone server message.
    expect(queryClient.getQueryState(chatQueryKeys.session('session-1'))?.isInvalidated).toBe(true)

    // The optimistic message lives in the pending-message store and is cleared once
    // the server confirms the send.
    const chatStore = useChatStore()
    expect(chatStore.getPendingMessages('session-1')).toHaveLength(0)
  })

  it('clears the optimistic message even when the server reply is empty', async () => {
    seedAuthStorage({ user: makeUser({ email: ME }) })
    const fake = installFakeSignalR()
    fake.setState('connected')
    // Empty reply (no text): the agent acknowledged without a message body.
    server.use(
      http.post('/api/AIWebAPI/question/text', () =>
        apiOk(makeRawMessage({ messageID: 'server-empty', messageText: '' })),
      ),
    )

    const queryClient = testQueryClient()
    queryClient.setQueryData(chatQueryKeys.session('session-1'), existingSession())
    const mutation = mountSend(queryClient)

    await mutation.mutateAsync(sendRequest())

    // The old code skipped cache work on an empty reply; the new code still
    // invalidates and clears the pending bubble so it can't linger forever.
    expect(queryClient.getQueryState(chatQueryKeys.session('session-1'))?.isInvalidated).toBe(true)
    const chatStore = useChatStore()
    expect(chatStore.getPendingMessages('session-1')).toHaveLength(0)
  })

  it('clears the optimistic message on a brand-new session without duplicating the user message', async () => {
    seedAuthStorage({ user: makeUser({ email: ME }) })
    const fake = installFakeSignalR()
    fake.setState('connected')
    server.use(
      http.post('/api/AIWebAPI/question/text', () =>
        apiOk(makeRawMessage({ messageID: 'server-msg', messageText: 'AI reply' })),
      ),
    )

    // No pre-seeded cache → onMutate treats this as a new session.
    const queryClient = testQueryClient()
    const mutation = mountSend(queryClient)

    await mutation.mutateAsync(sendRequest())

    const chatStore = useChatStore()
    // Pending optimistic message removed on success...
    expect(chatStore.getPendingMessages('session-1')).toHaveLength(0)

    // ...and the synthetic user message appears exactly once (no pending + synthetic dupe).
    const session = queryClient.getQueryData<AISessionDTO>(chatQueryKeys.session('session-1'))
    const userCopies = (session?.messages ?? []).filter((m) => m.messageText === 'hello there')
    expect(userCopies).toHaveLength(1)
    expect(session?.messages?.some((m) => m.messageText === 'AI reply')).toBe(true)
  })

  it('notifies other session members via SignalR on success', async () => {
    seedAuthStorage({ user: makeUser({ email: ME }) })
    const fake = installFakeSignalR()
    fake.setState('connected')
    server.use(http.post('/api/AIWebAPI/question/text', () => apiOk(makeRawMessage())))

    const queryClient = testQueryClient()
    queryClient.setQueryData(chatQueryKeys.session('session-1'), existingSession())
    const mutation = mountSend(queryClient)

    await mutation.mutateAsync(sendRequest())

    expect(fake.invocations).toContainEqual({
      method: 'SendMessageToUser',
      args: [[OTHER], 'session-1', 1],
    })
  })

  it('rolls back the optimistic message and records a failed message on 500', async () => {
    seedAuthStorage({ user: makeUser({ email: ME }) })
    installFakeSignalR()
    server.use(http.post('/api/AIWebAPI/question/text', () => apiError(500)))

    const queryClient = testQueryClient()
    queryClient.setQueryData(chatQueryKeys.session('session-1'), existingSession())
    const mutation = mountSend(queryClient)

    await expect(mutation.mutateAsync(sendRequest())).rejects.toBeDefined()

    // Optimistic temp message removed from the cache (rollback).
    const session = queryClient.getQueryData<AISessionDTO>(chatQueryKeys.session('session-1'))
    expect(session?.messages ?? []).toHaveLength(0)

    // Failed message parked in the chat store, tagged FAILED, temp-ID prefixed.
    const chatStore = useChatStore()
    const failed = chatStore.getFailedMessages('session-1')
    expect(failed).toHaveLength(1)
    expect(failed[0]?.messageText).toBe('hello there')
    expect(failed[0]?.status).toBe(MessageStatus.FAILED)
    expect(failed[0]?.messageID).toMatch(/^temp-/)
  })
})
