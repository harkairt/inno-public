import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import type { RouteLocationNormalized } from 'vue-router'

const mockNavigateTo = vi.fn()

const mockUseAuthStore = vi.fn()

type MiddlewareFn = (...args: unknown[]) => unknown

vi.mock('@/app/stores/auth', () => ({
  useAuthStore: mockUseAuthStore,
}))

vi.mock('#app', () => ({
  navigateTo: mockNavigateTo,
  defineNuxtRouteMiddleware: (fn: MiddlewareFn) => fn,
}))

vi.stubGlobal('defineNuxtRouteMiddleware', (fn: MiddlewareFn) => fn)
vi.stubGlobal('navigateTo', mockNavigateTo)
vi.stubGlobal('useAuthStore', mockUseAuthStore)
vi.stubGlobal('usePublicMode', () => ({
  isPublicMode: { value: false },
  isValidPublicAgent: vi.fn(),
  getPublicChatUrl: vi.fn(),
}))

function makeRoute(overrides: Partial<RouteLocationNormalized>): RouteLocationNormalized {
  return {
    path: '/',
    fullPath: '/',
    query: {},
    hash: '',
    name: undefined,
    params: {},
    matched: [],
    meta: {},
    redirectedFrom: undefined,
    ...overrides,
  } as RouteLocationNormalized
}

describe('auth middleware', () => {
  let mockAuthStore: { isAuthenticated: boolean }

  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()

    mockAuthStore = {
      isAuthenticated: false,
    }
    mockUseAuthStore.mockReturnValue(mockAuthStore)
  })

  it('redirects to login when user is not authenticated', async () => {
    const authMiddleware = await import('@/app/middleware/auth.global')
    const middleware = authMiddleware.default

    await middleware(makeRoute({ path: '/chats', fullPath: '/chats' }), makeRoute({ path: '/' }))

    expect(mockNavigateTo).toHaveBeenCalledWith({ path: '/login', query: { redirect: '/chats' } })
  })

  it('allows access when user is authenticated', async () => {
    mockAuthStore.isAuthenticated = true

    const authMiddleware = await import('@/app/middleware/auth.global')
    const middleware = authMiddleware.default

    const result = await middleware(
      makeRoute({ path: '/chats', fullPath: '/chats' }),
      makeRoute({ path: '/login' }),
    )

    expect(mockNavigateTo).not.toHaveBeenCalled()
    expect(result).toBeUndefined()
  })

  it('redirects unauthenticated user from any protected route', async () => {
    const authMiddleware = await import('@/app/middleware/auth.global')
    const middleware = authMiddleware.default

    await middleware(
      makeRoute({ path: '/some-protected-route', fullPath: '/some-protected-route' }),
      makeRoute({ path: '/login' }),
    )

    expect(mockNavigateTo).toHaveBeenCalledWith({
      path: '/login',
      query: { redirect: '/some-protected-route' },
    })
  })
})
