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

// Controllable public-mode state, mirroring the real usePublicMode() shape.
// The middleware reads `isPublicMode.value`, `isValidPublicAgent(id)`, and
// `getPublicChatUrl()`; each test tunes these to drive a specific branch.
const publicModeState = {
  isPublicMode: { value: false },
  isValidPublicAgent: vi.fn((_id: number | string) => false),
  getPublicChatUrl: vi.fn((): string | null => null),
}

vi.stubGlobal('defineNuxtRouteMiddleware', (fn: MiddlewareFn) => fn)
vi.stubGlobal('navigateTo', mockNavigateTo)
vi.stubGlobal('useAuthStore', mockUseAuthStore)
vi.stubGlobal('usePublicMode', () => publicModeState)

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

    mockAuthStore = {
      isAuthenticated: false,
    }
    mockUseAuthStore.mockReturnValue(mockAuthStore)

    // Reset public-mode state to private-mode defaults before each test.
    publicModeState.isPublicMode.value = false
    publicModeState.isValidPublicAgent = vi.fn((_id: number | string) => false)
    publicModeState.getPublicChatUrl = vi.fn((): string | null => null)
  })

  async function loadMiddleware() {
    const authMiddleware = await import('@/app/middleware/auth.global')
    return authMiddleware.default
  }

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

  describe('public mode', () => {
    beforeEach(() => {
      publicModeState.isPublicMode.value = true
      publicModeState.getPublicChatUrl = vi.fn(() => '/chats/public/new/42')
    })

    it('allows a valid public agent chat URL (skips auth checks)', async () => {
      publicModeState.isValidPublicAgent = vi.fn((id) => Number(id) === 42)
      const middleware = await loadMiddleware()

      const result = await middleware(
        makeRoute({ path: '/chats/public/new/42', fullPath: '/chats/public/new/42' }),
        makeRoute({ path: '/' }),
      )

      expect(mockNavigateTo).not.toHaveBeenCalled()
      expect(result).toBeUndefined()
    })

    it('redirects to the configured public chat when the agent id is not the valid one', async () => {
      publicModeState.isValidPublicAgent = vi.fn((id) => Number(id) === 42)
      const middleware = await loadMiddleware()

      await middleware(
        makeRoute({ path: '/chats/public/new/99', fullPath: '/chats/public/new/99' }),
        makeRoute({ path: '/' }),
      )

      expect(mockNavigateTo).toHaveBeenCalledWith('/chats/public/new/42', { replace: true })
    })

    it('allows a public chat route whose agent id fails the numeric regex (no redirect)', async () => {
      // `/^\/chats\/public\/new\/(\d+)$/` does not match a non-numeric id, so
      // validatePublicAgent returns undefined and the route is left alone.
      publicModeState.isValidPublicAgent = vi.fn(() => false)
      const middleware = await loadMiddleware()

      const result = await middleware(
        makeRoute({ path: '/chats/public/new/abc', fullPath: '/chats/public/new/abc' }),
        makeRoute({ path: '/' }),
      )

      expect(publicModeState.isValidPublicAgent).not.toHaveBeenCalled()
      expect(mockNavigateTo).not.toHaveBeenCalled()
      expect(result).toBeUndefined()
    })

    it('redirects a non-public route back to the public chat entry URL', async () => {
      const middleware = await loadMiddleware()

      await middleware(makeRoute({ path: '/chats', fullPath: '/chats' }), makeRoute({ path: '/' }))

      expect(mockNavigateTo).toHaveBeenCalledWith('/chats/public/new/42', { replace: true })
    })

    it('leaves /login reachable in public mode (auth-error surface)', async () => {
      const middleware = await loadMiddleware()

      const result = await middleware(
        makeRoute({ path: '/login', fullPath: '/login' }),
        makeRoute({ path: '/' }),
      )

      expect(mockNavigateTo).not.toHaveBeenCalled()
      expect(result).toBeUndefined()
    })
  })

  describe('private mode', () => {
    it('redirects a /chats/public/* route to login', async () => {
      const middleware = await loadMiddleware()

      await middleware(
        makeRoute({ path: '/chats/public/new/42', fullPath: '/chats/public/new/42' }),
        makeRoute({ path: '/' }),
      )

      expect(mockNavigateTo).toHaveBeenCalledWith('/login', { replace: true })
    })

    it('preserves the full intended path (incl. query) in the redirect param', async () => {
      const middleware = await loadMiddleware()

      await middleware(
        makeRoute({ path: '/chats/123', fullPath: '/chats/123?foo=bar' }),
        makeRoute({ path: '/' }),
      )

      expect(mockNavigateTo).toHaveBeenCalledWith({
        path: '/login',
        query: { redirect: '/chats/123?foo=bar' },
      })
    })

    it('redirects an authenticated user off /login to / by default', async () => {
      mockAuthStore.isAuthenticated = true
      const middleware = await loadMiddleware()

      await middleware(makeRoute({ path: '/login', fullPath: '/login' }), makeRoute({ path: '/' }))

      expect(mockNavigateTo).toHaveBeenCalledWith('/')
    })

    it('honours a safe internal redirect query when authenticated user hits /login', async () => {
      mockAuthStore.isAuthenticated = true
      const middleware = await loadMiddleware()

      await middleware(
        makeRoute({
          path: '/login',
          fullPath: '/login?redirect=/chats',
          query: { redirect: '/chats' },
        }),
        makeRoute({ path: '/' }),
      )

      expect(mockNavigateTo).toHaveBeenCalledWith('/chats')
    })

    it('breaks a /login redirect loop by sending the authenticated user to /', async () => {
      mockAuthStore.isAuthenticated = true
      const middleware = await loadMiddleware()

      await middleware(
        makeRoute({ path: '/login', fullPath: '/login', query: { redirect: '/login' } }),
        makeRoute({ path: '/' }),
      )

      expect(mockNavigateTo).toHaveBeenCalledWith('/')
    })

    it('ignores an external redirect query and sends the authenticated user to /', async () => {
      mockAuthStore.isAuthenticated = true
      const middleware = await loadMiddleware()

      await middleware(
        makeRoute({
          path: '/login',
          fullPath: '/login',
          query: { redirect: 'https://evil.example.com' },
        }),
        makeRoute({ path: '/' }),
      )

      expect(mockNavigateTo).toHaveBeenCalledWith('/')
    })
  })
})
