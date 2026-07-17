import { describe, it, expect, vi, afterEach } from 'vitest'
import { defineComponent } from 'vue'
import { mount } from '@vue/test-utils'
import { VueQueryPlugin, QueryClient } from '@tanstack/vue-query'
import { createPinia, setActivePinia } from 'pinia'
import { server, http } from '@/tests/msw/server'
import { apiOk, apiError } from '@/tests/msw/http'
import { makeSession, makeRawMessage } from '@/tests/utils/factories'
import { seedAuthStorage } from '@/tests/utils/authSeed'
import { configureApiInterceptors } from '@/lib/api/interceptors/setup'
import { useAuthStore } from '@/app/stores/auth'
import { simulateWindowFocus } from '@/tests/utils/focus'
import { useFakeTimersSafe, advance, useRealTimers } from '@/tests/utils/timers'
import { trackPostCalls } from '@/tests/utils/requestCounter'
import {
  chatQueryKeys,
  useChatSession,
  useChatSessions,
  useSessionUnreadCount,
  useWelcomeMessage,
  resetWelcomeMessageTracking,
} from '~/composables/useChatQueries'

const GET_SESSION_BY_ID = '/api/AIWebAPI/GetSessionById'

/** Full-session GetSessionById reply for the given session id. */
function sessionReply(sessionId: string) {
  return apiOk({ ...makeSession({ sessionId }), messages: [] })
}

function mountQuery<T>(queryClient: QueryClient, setup: () => T): T {
  const pinia = createPinia()
  setActivePinia(pinia)
  let result!: T
  const Comp = defineComponent({
    setup() {
      result = setup()
      return () => null
    },
  })
  mount(Comp, { global: { plugins: [[VueQueryPlugin, { queryClient }], pinia] } })
  return result
}

function timingQueryClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } })
}

/** Mount an observer and return the wrapper so the test can unmount/remount. */
function mountObserver(queryClient: QueryClient, setup: () => unknown) {
  const pinia = createPinia()
  setActivePinia(pinia)
  const Comp = defineComponent({
    setup() {
      setup()
      return () => null
    },
  })
  return mount(Comp, { global: { plugins: [[VueQueryPlugin, { queryClient }], pinia] } })
}

// ---------------------------------------------------------------------------
// Query key correctness
// ---------------------------------------------------------------------------

describe('chatQueryKeys — cache key structure', () => {
  it('all returns base key', () => {
    expect(chatQueryKeys.all).toEqual(['chat'])
  })

  it('sessions key contains all', () => {
    expect(chatQueryKeys.sessions()).toEqual(['chat', 'sessions'])
  })

  it('session key is scoped under sessions', () => {
    expect(chatQueryKeys.session('session-123')).toEqual(['chat', 'sessions', 'session-123'])
  })

  it('messages key is scoped under session', () => {
    expect(chatQueryKeys.messages('session-123')).toEqual([
      'chat',
      'sessions',
      'session-123',
      'messages',
    ])
  })

  it('message key is scoped under all', () => {
    expect(chatQueryKeys.message('msg-456')).toEqual(['chat', 'message', 'msg-456'])
  })

  it('unread key is scoped under all', () => {
    expect(chatQueryKeys.unread()).toEqual(['chat', 'unread'])
  })

  it('sessionUnread key is scoped under all with session id', () => {
    expect(chatQueryKeys.sessionUnread('session-789')).toEqual([
      'chat',
      'sessionUnread',
      'session-789',
    ])
  })

  it('welcome key is scoped with agentId', () => {
    expect(chatQueryKeys.welcome(42)).toEqual(['chat', 'welcome', 42])
  })

  it('search key includes query string', () => {
    expect(chatQueryKeys.search('hello world')).toEqual(['chat', 'search', 'hello world'])
  })

  it('different session IDs produce different keys', () => {
    const key1 = chatQueryKeys.session('a')
    const key2 = chatQueryKeys.session('b')

    expect(key1).not.toEqual(key2)
  })

  it('invalidating "sessions" also invalidates "session/:id"', () => {
    // Prefix matching: sessions() is a prefix of session(id)
    const sessionsKey = chatQueryKeys.sessions()
    const sessionKey = chatQueryKeys.session('id-1')

    expect(sessionKey.slice(0, sessionsKey.length)).toEqual(sessionsKey)
  })
})

// ---------------------------------------------------------------------------
// Refetch behavior — driven through the real chatService against MSW
// ---------------------------------------------------------------------------

describe('useChatSessions — refetchOnWindowFocus', () => {
  it('refetches the session list when the window regains focus', async () => {
    seedAuthStorage()
    let calls = 0
    server.use(
      http.post('/api/AIWebAPI/GetSessionHeadersByUserId', () => {
        calls++
        return apiOk([makeSession()])
      }),
    )

    // staleTime 0 → the query is immediately stale, so focus triggers a refetch.
    const query = mountQuery(timingQueryClient(), () => useChatSessions({ staleTime: 0 }))

    await vi.waitFor(() => expect(query.isSuccess.value).toBe(true))
    expect(calls).toBe(1)

    simulateWindowFocus()

    await vi.waitFor(() => expect(calls).toBe(2))
  })
})

describe('useSessionUnreadCount — refetchInterval', () => {
  afterEach(() => {
    useRealTimers()
  })

  it('polls the unread count on the 30s interval', async () => {
    seedAuthStorage()
    let calls = 0
    server.use(
      http.post('/api/AIWebAPI/GetSessionUnreadMessages', () => {
        calls++
        return apiOk(0)
      }),
    )

    useFakeTimersSafe()
    const query = mountQuery(timingQueryClient(), () => useSessionUnreadCount('session-1', 1))

    await vi.waitFor(() => expect(query.isSuccess.value).toBe(true))
    expect(calls).toBe(1)

    await advance(30 * 1000)
    await vi.waitFor(() => expect(calls).toBe(2))

    await advance(30 * 1000)
    await vi.waitFor(() => expect(calls).toBe(3))
  })
})

describe('useWelcomeMessage — 500 tracking', () => {
  it('stops re-fetching an agent whose welcome text 500s, until tracking is reset', async () => {
    seedAuthStorage()
    let calls = 0
    server.use(
      http.post('/api/AIWebAPI/welcomeText', () => {
        calls++
        return apiError(500)
      }),
    )

    // First mount: server 500 → agent recorded as having no welcome message,
    // query resolves to an empty message rather than erroring.
    const first = mountQuery(timingQueryClient(), () => useWelcomeMessage(42))
    await vi.waitFor(() => expect(first.isSuccess.value).toBe(true))
    expect(first.data.value).toEqual({ message: '' })
    expect(calls).toBe(1)

    // Second mount for the same agent short-circuits — no HTTP.
    const second = mountQuery(timingQueryClient(), () => useWelcomeMessage(42))
    await vi.waitFor(() => expect(second.isSuccess.value).toBe(true))
    expect(second.data.value).toEqual({ message: '' })
    expect(calls).toBe(1)

    // Resetting the tracking set makes the next mount hit the network again.
    resetWelcomeMessageTracking()
    const third = mountQuery(timingQueryClient(), () => useWelcomeMessage(42))
    await vi.waitFor(() => expect(third.isSuccess.value).toBe(true))
    expect(calls).toBe(2)
  })

  // The test above runs a BARE apiClient (no interceptors), so the service catch
  // receives a raw AxiosError and the guard works. Production arms the response
  // interceptor, which rejects with an already-normalized AppError; a non-idempotent
  // normalizeApiError would collapse it to UnknownError (statusCode undefined), the
  // >=500 guard would never fire, and every remount would refetch + retry. This drives
  // the ARMED chain to pin that the guard still fires end-to-end.
  it('memoizes the 500 through the armed interceptor chain (no refetch on remount)', async () => {
    seedAuthStorage()
    setActivePinia(createPinia())
    configureApiInterceptors({ authStore: useAuthStore(), redirectToLogin: vi.fn() })

    let calls = 0
    server.use(
      http.post('/api/AIWebAPI/welcomeText', () => {
        calls++
        return apiError(500)
      }),
    )

    const first = mountQuery(timingQueryClient(), () => useWelcomeMessage(77))
    await vi.waitFor(() => expect(first.isSuccess.value).toBe(true))
    expect(first.data.value).toEqual({ message: '' })
    expect(calls).toBe(1)

    // Same agent on remount short-circuits — zero network requests.
    const second = mountQuery(timingQueryClient(), () => useWelcomeMessage(77))
    await vi.waitFor(() => expect(second.isSuccess.value).toBe(true))
    expect(second.data.value).toEqual({ message: '' })
    expect(calls).toBe(1)
  })
})

// ---------------------------------------------------------------------------
// Invalidation cascade — the key-prefix footgun and its cure (Test C)
// ---------------------------------------------------------------------------

describe('useChatSession — sessions() invalidation cascade', () => {
  it('non-exact sessions() invalidation refetches session(id); exact:true spares it', async () => {
    seedAuthStorage()
    const counter = trackPostCalls(GET_SESSION_BY_ID, () => sessionReply('id-1'))

    const queryClient = timingQueryClient()
    mountObserver(queryClient, () => useChatSession('id-1'))
    // Initial fetch by the active detail observer.
    await vi.waitFor(() => expect(counter.count).toBe(1))

    // Non-exact: sessions() = ['chat','sessions'] is a prefix of
    // session('id-1') = ['chat','sessions','id-1'], so the detail query is
    // dragged into the refetch even though only the list was invalidated.
    await queryClient.invalidateQueries({ queryKey: chatQueryKeys.sessions() })
    expect(counter.count).toBe(2)

    // exact:true matches ONLY a literal ['chat','sessions'] observer — the
    // detail query is left untouched. This is the cure applied in useChatMutations.
    await queryClient.invalidateQueries({ queryKey: chatQueryKeys.sessions(), exact: true })
    expect(counter.count).toBe(2)
  })
})

// ---------------------------------------------------------------------------
// staleTime window guard (Test D) — pins refetchOnMount:true + staleTime 10s.
// Guards against "fixing" duplication by dropping staleTime to 0 /
// refetchOnMount:'always', which would reintroduce refetch-on-every-mount.
// ---------------------------------------------------------------------------

describe('useChatSession — staleTime window', () => {
  afterEach(() => {
    useRealTimers()
  })

  it('remount within 10s reuses the cache; remount after 10s refetches', async () => {
    seedAuthStorage()
    const counter = trackPostCalls(GET_SESSION_BY_ID, () => sessionReply('id-1'))

    useFakeTimersSafe()
    // Do NOT pass a staleTime option — the composable's real 10s must apply
    // (the test QueryClient default is 0, which would defeat the guard).
    const queryClient = timingQueryClient()

    const first = mountObserver(queryClient, () => useChatSession('id-1'))
    await vi.waitFor(() => expect(counter.count).toBe(1))

    // Unmount + remount inside the 10s window: data is still fresh, so
    // refetchOnMount:true is a no-op — no second fetch.
    first.unmount()
    const second = mountObserver(queryClient, () => useChatSession('id-1'))
    await advance(0)
    expect(counter.count).toBe(1)

    // Cross the staleTime boundary, then remount: now the data is stale and
    // refetchOnMount fires.
    second.unmount()
    await advance(10_001)
    mountObserver(queryClient, () => useChatSession('id-1'))
    await vi.waitFor(() => expect(counter.count).toBe(2))
  })
})

// ---------------------------------------------------------------------------
// Stale-while-revalidate on revisit — pins the user-visible SWR contract that
// Test D (network-call counts only) does not cover: on remounting a >staleTime
// session, cached data is served SYNCHRONOUSLY (no shimmer) while a background
// refetch runs and eventually replaces it with fresh server data.
// ---------------------------------------------------------------------------

describe('useChatSession — stale-while-revalidate on revisit', () => {
  afterEach(() => {
    useRealTimers()
  })

  it('serves cached messages instantly on remount, then swaps in the background refetch', async () => {
    seedAuthStorage()

    // session-a's 2nd+ fetch appends 'fresh v2' so the background refetch is provable.
    const fetches: Record<string, number> = { 'session-a': 0, 'session-b': 0 }
    server.use(
      http.post(GET_SESSION_BY_ID, async ({ request }) => {
        const { sessionId } = (await request.json()) as { sessionId: string }
        fetches[sessionId] = (fetches[sessionId] ?? 0) + 1

        if (sessionId === 'session-a') {
          const messages =
            fetches[sessionId] === 1
              ? [makeRawMessage({ messageText: 'alpha v1' })]
              : [
                  makeRawMessage({ messageText: 'alpha v1' }),
                  makeRawMessage({ messageText: 'fresh v2' }),
                ]
          return apiOk({ ...makeSession({ sessionId }), messages })
        }

        return apiOk({
          ...makeSession({ sessionId }),
          messages: [makeRawMessage({ messageText: 'bravo' })],
        })
      }),
    )

    useFakeTimersSafe()
    // No staleTime override — the composable's real 10s must apply.
    const queryClient = timingQueryClient()

    const texts = (q: ReturnType<typeof useChatSession>) =>
      (q.data.value?.messages ?? []).map((m) => m.messageText)

    let qa: ReturnType<typeof useChatSession>
    const firstA = mountObserver(queryClient, () => {
      qa = useChatSession('session-a')
    })
    await vi.waitFor(() => expect(qa!.isSuccess.value).toBe(true))
    expect(texts(qa!)).toEqual(['alpha v1'])
    expect(fetches['session-a']).toBe(1)
    firstA.unmount()

    let qb: ReturnType<typeof useChatSession>
    const firstB = mountObserver(queryClient, () => {
      qb = useChatSession('session-b')
    })
    await vi.waitFor(() => expect(qb!.isSuccess.value).toBe(true))
    firstB.unmount()

    // Cross staleTime but stay within the 2min gcTime, so A remains cached.
    await advance(10_001)

    // Synchronously after remount, cached v1 must be served as real data
    // (non-placeholder, non-loading) — the page's isMessagesReady gate would
    // render it, not a shimmer.
    let qa2: ReturnType<typeof useChatSession>
    mountObserver(queryClient, () => {
      qa2 = useChatSession('session-a')
    })
    expect(texts(qa2!)).toContain('alpha v1')
    expect(qa2!.isPlaceholderData.value).toBe(false)
    expect(qa2!.isLoading.value).toBe(false)

    await vi.waitFor(() => expect(fetches['session-a']).toBe(2))
    await vi.waitFor(() => expect(texts(qa2!)).toContain('fresh v2'))
  })
})
