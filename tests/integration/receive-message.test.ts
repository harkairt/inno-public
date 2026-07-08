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
import { useAuthStore } from '@/app/stores/auth'
import { useSignalR } from '@/app/composables/useSignalR'
import signalrInitPlugin from '@/app/plugins/signalr-init.client'
import type { AISessionDTO } from '@/types/api/schemas'

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
})
