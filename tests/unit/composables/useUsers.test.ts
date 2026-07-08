/**
 * Unit tests for useSelectableUsers. Driven through the REAL UserService against
 * MSW's GET /api/user/get-selectable-users (verified path in UserService.ts). No
 * service/store mocking — auth is seeded via authSeed so the real store gates the
 * query's `enabled`.
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
import { useSelectableUsers, userQueryKeys } from '@/app/composables/useUsers'

function mountQuery(queryClient: QueryClient, options?: Parameters<typeof useSelectableUsers>[0]) {
  const pinia = createPinia()
  setActivePinia(pinia)

  let query!: ReturnType<typeof useSelectableUsers>
  const TestComponent = defineComponent({
    setup() {
      query = useSelectableUsers(options)
      return () => null
    },
  })
  mount(TestComponent, { global: { plugins: [[VueQueryPlugin, { queryClient }], pinia] } })
  return query
}

function testQueryClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } })
}

describe('userQueryKeys', () => {
  it('selectable scopes under the base key', () => {
    expect(userQueryKeys.all).toEqual(['users'])
    expect(userQueryKeys.selectable()).toEqual(['users', 'selectable'])
  })
})

describe('useSelectableUsers', () => {
  it('fetches and returns the selectable users when authenticated', async () => {
    seedAuthStorage()
    server.use(
      http.get('/api/user/get-selectable-users', () =>
        apiOk([makeUser({ name: 'Alice' }), makeUser({ name: 'Bob' })]),
      ),
    )

    const query = mountQuery(testQueryClient())

    await vi.waitFor(() => expect(query.isSuccess.value).toBe(true))
    expect(query.data.value).toHaveLength(2)
    expect(query.data.value?.map((u) => u.name)).toEqual(['Alice', 'Bob'])
  })

  it('passes the authenticated user email as the ?email query param', async () => {
    seedAuthStorage({ user: makeUser({ email: 'seeded@example.com' }) })
    let capturedEmail: string | null = null
    server.use(
      http.get('/api/user/get-selectable-users', ({ request }) => {
        capturedEmail = new URL(request.url).searchParams.get('email')
        return apiOk([makeUser()])
      }),
    )

    const query = mountQuery(testQueryClient())

    await vi.waitFor(() => expect(query.isSuccess.value).toBe(true))
    expect(capturedEmail).toBe('seeded@example.com')
  })

  it('honours an explicit email override', async () => {
    seedAuthStorage()
    let capturedEmail: string | null = null
    server.use(
      http.get('/api/user/get-selectable-users', ({ request }) => {
        capturedEmail = new URL(request.url).searchParams.get('email')
        return apiOk([makeUser()])
      }),
    )

    const query = mountQuery(testQueryClient(), { email: 'override@example.com' })

    await vi.waitFor(() => expect(query.isSuccess.value).toBe(true))
    expect(capturedEmail).toBe('override@example.com')
  })

  it('stays idle (no fetch) when unauthenticated', async () => {
    // No seed → store is logged-out → enabled defaults to false.
    const query = mountQuery(testQueryClient())
    await Promise.resolve()

    expect(query.fetchStatus.value).toBe('idle')
    expect(query.data.value).toBeUndefined()
  })

  it('stays idle when enabled is explicitly false', async () => {
    seedAuthStorage()
    const query = mountQuery(testQueryClient(), { enabled: false })
    await Promise.resolve()

    expect(query.fetchStatus.value).toBe('idle')
  })
})
