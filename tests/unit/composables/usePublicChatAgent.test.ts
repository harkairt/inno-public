/**
 * Unit tests for usePublicChatAgent. Query keys are pure; the query itself is
 * driven through the REAL auth store + REAL ChatService against MSW (no mocking).
 */
import { describe, it, expect, vi } from 'vitest'
import { defineComponent } from 'vue'
import { mount } from '@vue/test-utils'
import { VueQueryPlugin, QueryClient } from '@tanstack/vue-query'
import { createPinia, setActivePinia } from 'pinia'
import { server, http } from '@/tests/msw/server'
import { apiOk } from '@/tests/msw/http'
import { makeUser } from '@/tests/utils/factories'
import { seedAuthStorage } from '@/tests/utils/authSeed'
import { usePublicChatAgent, publicChatAgentQueryKeys } from '@/app/composables/usePublicChatAgent'

const START_PUBLIC_CHAT = '/api/AIWebAPI/startPublicChat'

function createTestQueryClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } })
}

/** Mount the composable inside a throwaway component and expose its result. */
function mountQuery(queryClient: QueryClient, agentId: number | null) {
  const pinia = createPinia()
  setActivePinia(pinia)

  let query!: ReturnType<typeof usePublicChatAgent>
  const TestComponent = defineComponent({
    setup() {
      query = usePublicChatAgent(agentId)
      return () => null
    },
  })
  mount(TestComponent, { global: { plugins: [[VueQueryPlugin, { queryClient }], pinia] } })
  return query
}

describe('publicChatAgentQueryKeys', () => {
  it('all is the base key', () => {
    expect(publicChatAgentQueryKeys.all).toEqual(['publicChatAgent'])
  })

  it('agent scopes under all with the agent id', () => {
    expect(publicChatAgentQueryKeys.agent(7)).toEqual(['publicChatAgent', 7])
  })
})

describe('usePublicChatAgent', () => {
  it('fetches the agent via startPublicChat when authenticated with a valid agent id', async () => {
    seedAuthStorage({ user: makeUser({ email: 'visitor@example.com' }) })

    let capturedBody: unknown
    server.use(
      http.post(START_PUBLIC_CHAT, async ({ request }) => {
        capturedBody = await request.json()
        return apiOk({ user: makeUser(), agent: makeUser({ name: 'Support Agent' }) })
      }),
    )

    const query = mountQuery(createTestQueryClient(), 5)

    await vi.waitFor(() => expect(query.isSuccess.value).toBe(true))
    expect(query.data.value?.agent?.name).toBe('Support Agent')
    expect(capturedBody).toEqual({ agentId: 5, userEmail: 'visitor@example.com' })
  })

  it('stays disabled (no fetch) when unauthenticated', async () => {
    // No auth seeded → authStore.isAuthenticated is false → enabled resolves false.
    const query = mountQuery(createTestQueryClient(), 5)
    await Promise.resolve()

    expect(query.fetchStatus.value).toBe('idle')
    expect(query.data.value).toBeUndefined()
  })

  it('stays disabled when the agent id is null', async () => {
    seedAuthStorage()
    const query = mountQuery(createTestQueryClient(), null)
    await Promise.resolve()

    expect(query.fetchStatus.value).toBe('idle')
    expect(query.data.value).toBeUndefined()
  })
})
