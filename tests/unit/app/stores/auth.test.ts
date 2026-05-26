import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useAuthStore } from '~/stores/auth'
import { makeUser } from '@/tests/utils/factories'
import { AuthenticationMode } from '@/types/enums'

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('@/lib/api/services/AuthService', () => ({
  authService: {
    login: vi.fn(),
    getProfile: vi.fn(),
    refreshToken: vi.fn(),
  },
}))

vi.mock('@/app/composables/useSignalR', () => ({
  useSignalR: () => ({
    connect: vi.fn().mockResolvedValue(undefined),
    disconnect: vi.fn().mockResolvedValue(undefined),
  }),
}))

vi.mock('@/app/stores/chat', () => ({
  useChatStore: () => ({
    resetUserData: vi.fn(),
  }),
}))

vi.mock('@tanstack/vue-query', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/vue-query')>()
  return {
    ...actual,
    useQueryClient: () => ({
      clear: vi.fn(),
    }),
  }
})

vi.mock('@/lib/queryClientSingleton', () => ({
  getQueryClient: () => ({
    clear: vi.fn(),
  }),
  createQueryClient: vi.fn(),
}))

vi.mock('@/lib/errors/normalize', () => ({
  normalizeApiError: vi.fn((e: unknown) => e),
}))

// localStorage mock
const mockStorage = (() => {
  let store: Record<string, string> = {}
  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value
    }),
    removeItem: vi.fn((key: string): void => {
      delete store[key]
    }),
    clear: vi.fn(() => {
      store = {}
    }),
  }
})()

Object.defineProperty(global, 'localStorage', { value: mockStorage, writable: true })

// ---------------------------------------------------------------------------
// login
// ---------------------------------------------------------------------------

describe('Auth Store — login', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    mockStorage.clear()
  })

  it('stores user and tokens on successful login', async () => {
    const { authService } = await import('@/lib/api/services/AuthService')
    const mockUser = makeUser()

    vi.mocked(authService.login).mockResolvedValue({
      isOk: () => true,
      isErr: () => false,
      value: {
        data: {
          user: mockUser,
          accessToken: 'access-token',
          refreshToken: 'refresh-token',
        },
      },
    } as Awaited<ReturnType<typeof authService.login>>)

    const store = useAuthStore()
    const result = await store.login({
      email: 'test@example.com',
      password: 'password123',
      mode: AuthenticationMode.Basic,
    })

    expect(result.isOk()).toBe(true)
    expect(store.user).toEqual(mockUser)
    expect(store.accessToken).toBe('access-token')
    expect(store.isAuthenticated).toBe(true)
  })

  it('returns error when service fails', async () => {
    const { authService } = await import('@/lib/api/services/AuthService')

    vi.mocked(authService.login).mockResolvedValue({
      isOk: () => false,
      isErr: () => true,
      error: { code: 'UNAUTHORIZED', message: 'Invalid credentials' },
    } as Awaited<ReturnType<typeof authService.login>>)

    const store = useAuthStore()
    const result = await store.login({
      email: 'test@example.com',
      password: 'wrong',
      mode: AuthenticationMode.Basic,
    })

    expect(result.isErr()).toBe(true)
    expect(store.user).toBeNull()
    expect(store.isAuthenticated).toBe(false)
  })

  it('sets isLoading false after login (success)', async () => {
    const { authService } = await import('@/lib/api/services/AuthService')
    const mockUser = makeUser()

    vi.mocked(authService.login).mockResolvedValue({
      isOk: () => true,
      isErr: () => false,
      value: { data: { user: mockUser, accessToken: 'tok', refreshToken: 'ref' } },
    } as Awaited<ReturnType<typeof authService.login>>)

    const store = useAuthStore()
    await store.login({ email: 'a@b.com', password: 'pw', mode: AuthenticationMode.Basic })

    expect(store.isLoading).toBe(false)
  })

  it('sets isLoading false after login (failure)', async () => {
    const { authService } = await import('@/lib/api/services/AuthService')

    vi.mocked(authService.login).mockResolvedValue({
      isOk: () => false,
      isErr: () => true,
      error: { code: 'UNAUTHORIZED', message: 'Bad creds' },
    } as Awaited<ReturnType<typeof authService.login>>)

    const store = useAuthStore()
    await store.login({ email: 'a@b.com', password: 'pw', mode: AuthenticationMode.Basic })

    expect(store.isLoading).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// logout
// ---------------------------------------------------------------------------

describe('Auth Store — logout', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    mockStorage.clear()
  })

  it('clears all auth state on logout', async () => {
    const store = useAuthStore()

    store.user = makeUser()
    store.accessToken = 'access-token'
    store.refreshToken = 'refresh-token'

    await store.logout()

    expect(store.user).toBeNull()
    expect(store.accessToken).toBeNull()
    expect(store.refreshToken).toBeNull()
    expect(store.isAuthenticated).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// clearAuth
// ---------------------------------------------------------------------------

describe('Auth Store — clearAuth', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    mockStorage.clear()
  })

  it('clears user and tokens', () => {
    const store = useAuthStore()

    store.user = makeUser()
    store.accessToken = 'tok'
    store.refreshToken = 'ref'
    store.clearAuth()

    expect(store.user).toBeNull()
    expect(store.accessToken).toBeNull()
    expect(store.refreshToken).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// computed getters
// ---------------------------------------------------------------------------

describe('Auth Store — computed getters', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    mockStorage.clear()
  })

  it('isAdmin returns true when user has admin role', () => {
    const store = useAuthStore()
    store.user = makeUser({ roles: ['admin'] })

    expect(store.isAdmin).toBe(true)
    expect(store.isAgent).toBe(false)
  })

  it('isAgent returns true when user has agent role', () => {
    const store = useAuthStore()
    store.user = makeUser({ roles: ['agent'] })

    expect(store.isAgent).toBe(true)
    expect(store.isAdmin).toBe(false)
  })

  it('userDisplayName returns name from user', () => {
    const store = useAuthStore()
    store.user = makeUser({ name: 'John Doe' })

    expect(store.userDisplayName).toBe('John Doe')
  })

  it('userDisplayName returns Unknown User when not authenticated', () => {
    const store = useAuthStore()
    store.user = null

    expect(store.userDisplayName).toBe('Unknown User')
  })
})
