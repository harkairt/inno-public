/**
 * Integration — session-detail refetch duplication.
 *
 * These tests measure what the user actually sees: the number of
 * POST /api/AIWebAPI/GetSessionById (and GetSessionHeadersByUserId) requests
 * that hit the network after a send, counted at the MSW boundary with active
 * useChatSession / useChatSessions observers mounted. Counting at the boundary
 * (not spying on invalidateQueries) keeps the assertions refactor-proof: any
 * key-prefix cascade shows up as an extra POST regardless of how the cache
 * invalidation is expressed.
 *
 * Real stack throughout — real QueryClient, real Pinia stores, real
 * ChatService/axios; MSW at the boundary; SignalR swapped for the fake
 * singleton. Nothing mocks the store, service, or apiClient.
 *
 * Test A (desired behavior — passes only after the useChatMutations fix):
 *   a brand-new-session send drives GetSessionById once and
 *   GetSessionHeadersByUserId once.
 * Test B (characterization — passes on current code, documents a known,
 *   deliberately-unfixed duplicate): an existing-session send followed by the
 *   backend's own ReceiveMessage echo refetches the session TWICE. The echo
 *   redundancy is a sender-side backend concern; removing it needs backend
 *   cooperation, so it stays and is pinned here.
 */
import { describe, it, expect, afterEach, vi } from 'vitest'
import { defineComponent } from 'vue'
import { mount } from '@vue/test-utils'
import { VueQueryPlugin } from '@tanstack/vue-query'
import { createPinia, setActivePinia } from 'pinia'
import { server, http } from '@/tests/msw/server'
import { apiOk, apiError } from '@/tests/msw/http'
import { makeSession, makeRawMessage, makeUser } from '@/tests/utils/factories'
import { seedAuthStorage } from '@/tests/utils/authSeed'
import { installFakeSignalR } from '@/tests/utils/fakeSignalR'
import { createTestQueryClient } from '@/tests/utils/render'
import { useFakeTimersSafe, advance, useRealTimers } from '@/tests/utils/timers'
import { trackPostCalls } from '@/tests/utils/requestCounter'
import { chatQueryKeys, useChatSession, useChatSessions } from '@/app/composables/useChatQueries'
import { useSendMessage } from '@/app/composables/useChatMutations'
import { useAuthStore } from '@/app/stores/auth'
import { useSignalR } from '@/app/composables/useSignalR'
import signalrInitPlugin from '@/app/plugins/signalr-init.client'
import type { AISessionDTO, AiQuestionRequestDTO } from '@/types/api/schemas'

const GET_SESSION_BY_ID = '/api/AIWebAPI/GetSessionById'
const GET_SESSION_HEADERS = '/api/AIWebAPI/GetSessionHeadersByUserId'
const QUESTION_TEXT = '/api/AIWebAPI/question/text'
const SESSION_ID = 'session-1'
const AGENT_ID = 5
const ME = 'me@example.com'

function sendRequest(): AiQuestionRequestDTO {
  return {
    sessionId: SESSION_ID,
    agentId: AGENT_ID,
    userCode: ME,
    members: [ME],
    question: 'hello there',
    group: 'default',
    pquestionType: 0,
    options: [],
  } as unknown as AiQuestionRequestDTO
}

function existingSession(): AISessionDTO {
  return {
    ...makeSession({ sessionId: SESSION_ID, agentId: AGENT_ID, userCode: ME }),
    messages: [],
  } as AISessionDTO
}

describe('session-detail refetch duplication (real stack, MSW at the boundary)', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    useRealTimers()
  })

  it('Test A — a new-session send fetches GetSessionById once and GetSessionHeaders once', async () => {
    seedAuthStorage({ user: makeUser({ email: ME }) })
    const fake = installFakeSignalR()
    fake.setState('connected')

    // GetSessionById 404s (NOT_FOUND → no retry): the detail observer fetches
    // once at mount but populates NO cache, so onMutate still sees the session
    // as new. The post-send invalidation then refetches it exactly once more.
    const byIdCounter = trackPostCalls(GET_SESSION_BY_ID, () => apiError(404))
    const headersCounter = trackPostCalls(GET_SESSION_HEADERS, () => apiOk([makeSession()]))
    server.use(
      http.post(QUESTION_TEXT, () =>
        apiOk(makeRawMessage({ messageID: 'server-msg', messageText: 'AI reply' })),
      ),
    )

    const queryClient = createTestQueryClient()
    const pinia = createPinia()
    setActivePinia(pinia)

    let sendMutation!: ReturnType<typeof useSendMessage>
    const Comp = defineComponent({
      setup() {
        useChatSessions()
        useChatSession(SESSION_ID)
        sendMutation = useSendMessage()
        return () => null
      },
    })
    mount(Comp, { global: { plugins: [[VueQueryPlugin, { queryClient }], pinia] } })

    // Settle the initial mount fetches (one of each) before recording the baseline.
    await vi.waitFor(() => {
      expect(byIdCounter.count).toBe(1)
      expect(headersCounter.count).toBe(1)
    })
    const baseById = byIdCounter.count
    const baseHeaders = headersCounter.count

    // No pre-seeded session(id) cache (the 404 left it empty) → isNewSession path.
    await sendMutation.mutateAsync(sendRequest())

    // Invalidations are awaited inside onSuccess, so the counts are exact the
    // moment mutateAsync resolves — real timers, no waitFor race.
    expect(byIdCounter.count - baseById).toBe(1)
    expect(headersCounter.count - baseHeaders).toBe(1)
  })

  it('Test B — existing-session send + SignalR echo = exactly 2 GetSessionById fetches (characterization)', async () => {
    seedAuthStorage({ user: makeUser({ email: ME }) })
    // The plugin resolves useAuthStore / useSignalR as Nuxt auto-imports.
    vi.stubGlobal('useAuthStore', useAuthStore)
    vi.stubGlobal('useSignalR', useSignalR)

    const fake = installFakeSignalR()
    useFakeTimersSafe()

    const byIdCounter = trackPostCalls(GET_SESSION_BY_ID, () => apiOk(existingSession()))
    server.use(
      http.post(QUESTION_TEXT, () =>
        apiOk(makeRawMessage({ messageID: 'server-msg', messageText: 'AI reply' })),
      ),
    )

    const queryClient = createTestQueryClient()
    const pinia = createPinia()
    setActivePinia(pinia)

    // Wire the REAL ReceiveMessage handler against this QueryClient.
    await signalrInitPlugin({ $queryClient: queryClient } as unknown as Parameters<
      typeof signalrInitPlugin
    >[0])
    await advance(500) // connect + listener registration behind the 500ms delay
    expect(fake.connect).toHaveBeenCalledWith('seeded-access-token')

    // Seed the session cache so onMutate treats the send as existing-session,
    // and mounting the observer does NOT fetch (data is fresh).
    queryClient.setQueryData<AISessionDTO>(chatQueryKeys.session(SESSION_ID), existingSession())

    let sendMutation!: ReturnType<typeof useSendMessage>
    const Comp = defineComponent({
      setup() {
        useChatSession(SESSION_ID)
        sendMutation = useSendMessage()
        return () => null
      },
    })
    mount(Comp, { global: { plugins: [[VueQueryPlugin, { queryClient }], pinia] } })
    await advance(0)
    expect(byIdCounter.count).toBe(0) // fresh seeded cache → no mount fetch

    // Fetch #1: existing-session onSuccess invalidates session(id) (useChatMutations.ts:158).
    await sendMutation.mutateAsync(sendRequest())

    // Fetch #2: the backend echoes the sender's own message back via
    // ReceiveMessage; the plugin invalidates session(id) a second time. This is
    // the deliberately-unfixed sender-echo duplicate documented in the plan.
    fake.emitFromServer('ReceiveMessage', SESSION_ID, AGENT_ID)

    await vi.waitFor(() => expect(byIdCounter.count).toBe(2))

    // No THIRD fetch materializes after things settle.
    await advance(50)
    expect(byIdCounter.count).toBe(2)
  })
})
