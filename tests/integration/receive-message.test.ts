/**
 * Integration flow #5 — server push ReceiveMessage → UI refresh.
 *
 * Drives the REAL signalr-init plugin's ReceiveMessage handler end to end
 * against a real QueryClient with an active useChatSession observer, real Pinia
 * stores, the real ChatService/axios, and MSW at the network boundary. SignalR
 * is swapped for the fake singleton (no real /chatHub negotiate). Nothing here
 * mocks the store, service, or apiClient.
 *
 * The wired handler (app/plugins/signalr-init.client.ts) reads the push args as
 * (sessionId: string, agentId: number) and invalidates chatQueryKeys.session(id)
 * + chatQueryKeys.unread(); the active session observer then refetches and the
 * new server message becomes visible in the cache.
 */
import { describe, it, expect, afterEach, vi } from 'vitest'
import { defineComponent } from 'vue'
import { mount } from '@vue/test-utils'
import { VueQueryPlugin, type QueryClient } from '@tanstack/vue-query'
import { createPinia, setActivePinia } from 'pinia'
import { server, http } from '@/tests/msw/server'
import { apiOk } from '@/tests/msw/http'
import { makeSession, makeRawMessage, makeUser } from '@/tests/utils/factories'
import { seedAuthStorage } from '@/tests/utils/authSeed'
import { installFakeSignalR } from '@/tests/utils/fakeSignalR'
import { createTestQueryClient } from '@/tests/utils/render'
import { useFakeTimersSafe, advance, useRealTimers } from '@/tests/utils/timers'
import { chatQueryKeys, useChatSession } from '@/app/composables/useChatQueries'
import { useSendMessage } from '@/app/composables/useChatMutations'
import { useAuthStore } from '@/app/stores/auth'
import { useSignalR } from '@/app/composables/useSignalR'
import signalrInitPlugin from '@/app/plugins/signalr-init.client'
import type { AISessionDTO, AiQuestionRequestDTO } from '@/types/api/schemas'

const GET_SESSION_PATH = '/api/AIWebAPI/GetSessionById'
const SESSION_ID = 'session-1'
const AGENT_ID = 5
const ME = 'me@example.com'

/** Serve GetSessionById as a full session carrying exactly the given message. */
function serveSessionWithMessage(text: string) {
  server.use(
    http.post(GET_SESSION_PATH, () =>
      apiOk({
        ...makeSession({ sessionId: SESSION_ID, agentId: AGENT_ID, userCode: ME }),
        messages: [makeRawMessage({ messageID: text, messageText: text, sessionId: SESSION_ID })],
      }),
    ),
  )
}

/** Mount an active useChatSession observer against the shared QueryClient. */
function mountSessionObserver(queryClient: QueryClient) {
  const pinia = createPinia()
  setActivePinia(pinia)
  const Comp = defineComponent({
    setup() {
      useChatSession(SESSION_ID)
      return () => null
    },
  })
  mount(Comp, { global: { plugins: [[VueQueryPlugin, { queryClient }], pinia] } })
}

function sessionTexts(queryClient: QueryClient): (string | undefined)[] {
  const session = queryClient.getQueryData<AISessionDTO>(chatQueryKeys.session(SESSION_ID))
  return session?.messages?.map((m) => m.messageText) ?? []
}

/** Mount an active useChatSession observer for an arbitrary sessionId on a shared pinia. */
function mountSessionObserverFor(
  queryClient: QueryClient,
  pinia: ReturnType<typeof createPinia>,
  sessionId: string,
) {
  const Comp = defineComponent({
    setup() {
      useChatSession(sessionId)
      return () => null
    },
  })
  mount(Comp, { global: { plugins: [[VueQueryPlugin, { queryClient }], pinia] } })
}

function sessionTextsFor(queryClient: QueryClient, sessionId: string): (string | undefined)[] {
  const session = queryClient.getQueryData<AISessionDTO>(chatQueryKeys.session(sessionId))
  return session?.messages?.map((m) => m.messageText) ?? []
}

describe('ReceiveMessage → UI refresh (real stack, MSW at the boundary)', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    useRealTimers()
  })

  it('refetches the session on a ReceiveMessage push so the new message appears', async () => {
    seedAuthStorage({ user: makeUser({ email: ME }) })
    // The plugin resolves useAuthStore / useSignalR as Nuxt auto-imports.
    vi.stubGlobal('useAuthStore', useAuthStore)
    vi.stubGlobal('useSignalR', useSignalR)

    const fake = installFakeSignalR()
    useFakeTimersSafe()

    const queryClient = createTestQueryClient()

    // Active observer performs the initial fetch (session with the first message).
    serveSessionWithMessage('first message')
    mountSessionObserver(queryClient)
    await vi.waitFor(() => expect(sessionTexts(queryClient)).toContain('first message'))

    // Wire the real SignalR handler against the same QueryClient.
    await signalrInitPlugin({ $queryClient: queryClient } as unknown as Parameters<
      typeof signalrInitPlugin
    >[0])
    await advance(500) // connect + listener registration behind the 500ms delay
    expect(fake.connect).toHaveBeenCalledWith('seeded-access-token')

    // Server now has a newer message; the push should trigger a refetch.
    serveSessionWithMessage('second message')
    fake.emitFromServer('ReceiveMessage', SESSION_ID, AGENT_ID)

    await vi.waitFor(() => expect(sessionTexts(queryClient)).toContain('second message'))
  })

  it('ignores a ReceiveMessage push with a non-string sessionId (no refetch)', async () => {
    seedAuthStorage({ user: makeUser({ email: ME }) })
    vi.stubGlobal('useAuthStore', useAuthStore)
    vi.stubGlobal('useSignalR', useSignalR)

    const fake = installFakeSignalR()
    useFakeTimersSafe()

    const queryClient = createTestQueryClient()
    serveSessionWithMessage('first message')
    mountSessionObserver(queryClient)
    await vi.waitFor(() => expect(sessionTexts(queryClient)).toContain('first message'))

    await signalrInitPlugin({ $queryClient: queryClient } as unknown as Parameters<
      typeof signalrInitPlugin
    >[0])
    await advance(500)

    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')
    // Malformed payload — the handler's type guard drops it.
    fake.emitFromServer('ReceiveMessage', 42, 'not-a-number')

    expect(invalidateSpy).not.toHaveBeenCalled()
  })

  // The scenario the whole `fix/early-signalr-ReceiveMessage` work exists for and
  // that previously had NO direct coverage: the user sends the FIRST message of a
  // brand-new session; while that POST /question/text is still in flight, the backend
  // pushes ReceiveMessage for its intermediate "working on it" message. That push must
  // drive a GetSessionById refetch so the interim message renders mid-wait, and the
  // final answer (from the POST response) must then MERGE — not clobber it.
  it('refetches GetSessionById on a mid-send ReceiveMessage and merges the final answer without clobbering', async () => {
    const NEW_SESSION = 'brand-new-session'
    const WORKING = 'working on your request'
    const FINAL = 'final answer'

    seedAuthStorage({ user: makeUser({ email: ME }) })
    vi.stubGlobal('useAuthStore', useAuthStore)
    vi.stubGlobal('useSignalR', useSignalR)

    const fake = installFakeSignalR()
    useFakeTimersSafe()

    // Authoritative server state, mutated as the backend makes progress. Every
    // GetSessionById refetch returns whatever is here now (and counts the hit).
    let serverMessages: ReturnType<typeof makeRawMessage>[] = []
    let getSessionHits = 0
    server.use(
      http.post(GET_SESSION_PATH, () => {
        getSessionHits++
        return apiOk({
          ...makeSession({ sessionId: NEW_SESSION, agentId: AGENT_ID, userCode: ME }),
          messages: serverMessages,
        })
      }),
    )

    // Hang the first-question POST until we release it — it stays in flight across
    // the ReceiveMessage push, exactly as in the real mid-send race.
    let releasePost!: () => void
    const postGate = new Promise<void>((resolve) => {
      releasePost = resolve
    })
    server.use(
      http.post('/api/AIWebAPI/question/text', async () => {
        await postGate
        return apiOk(
          makeRawMessage({ messageID: FINAL, messageText: FINAL, sessionId: NEW_SESSION }),
        )
      }),
    )

    const queryClient = createTestQueryClient()
    const pinia = createPinia()
    setActivePinia(pinia)

    // Wire the real ReceiveMessage handler against this QueryClient.
    await signalrInitPlugin({ $queryClient: queryClient } as unknown as Parameters<
      typeof signalrInitPlugin
    >[0])
    await advance(500)
    expect(fake.connect).toHaveBeenCalledWith('seeded-access-token')

    // Send the first message of the brand-new session. onMutate seeds a synthetic
    // empty session in the cache; the POST then hangs on the gate.
    let mutation!: ReturnType<typeof useSendMessage>
    const SendComp = defineComponent({
      setup() {
        mutation = useSendMessage()
        return () => null
      },
    })
    mount(SendComp, { global: { plugins: [[VueQueryPlugin, { queryClient }], pinia] } })

    const request: AiQuestionRequestDTO = {
      sessionId: NEW_SESSION,
      agentId: AGENT_ID,
      userCode: ME,
      members: [ME],
      question: 'first question',
      group: 'default',
      pquestionType: 0,
      options: [],
    } as unknown as AiQuestionRequestDTO
    const sendPromise = mutation.mutateAsync(request)
    await vi.waitFor(() =>
      expect(queryClient.getQueryData(chatQueryKeys.session(NEW_SESSION))).toBeTruthy(),
    )

    // Active observer for the in-flight session. The synthetic cache seeded by
    // onMutate is still fresh, so mounting does NOT fetch — GetSessionById stays
    // untouched until the ReceiveMessage push invalidates it.
    mountSessionObserverFor(queryClient, pinia, NEW_SESSION)
    const hitsBeforeReceive = getSessionHits
    expect(hitsBeforeReceive).toBe(0)

    // Backend produced its interim "working on it" message and pushes ReceiveMessage
    // while the POST is STILL hanging.
    serverMessages = [
      makeRawMessage({ messageID: WORKING, messageText: WORKING, sessionId: NEW_SESSION }),
    ]
    fake.emitFromServer('ReceiveMessage', NEW_SESSION, AGENT_ID)

    // The push drove a real GetSessionById refetch and the interim message is now cached.
    await vi.waitFor(() => expect(sessionTextsFor(queryClient, NEW_SESSION)).toContain(WORKING))
    expect(getSessionHits).toBeGreaterThan(hitsBeforeReceive)

    // Backend now also has the final answer; release the POST so onSuccess reconciles.
    serverMessages = [
      makeRawMessage({ messageID: WORKING, messageText: WORKING, sessionId: NEW_SESSION }),
      makeRawMessage({ messageID: FINAL, messageText: FINAL, sessionId: NEW_SESSION }),
    ]
    releasePost()
    await sendPromise

    // Final answer merged in AND the interim "working on it" survived (not clobbered).
    const texts = sessionTextsFor(queryClient, NEW_SESSION)
    expect(texts).toContain(FINAL)
    expect(texts).toContain(WORKING)
  })
})
