import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useAuthStore, getRememberedEmail, clearRememberedEmail } from '~/stores/auth'
import { makeUser } from '@/tests/utils/factories'
import { seedRememberedEmail } from '@/tests/utils/authSeed'
import { AuthenticationMode, ErrorCode } from '@/types/enums'

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

  it('is loading while logout is in flight and resets it to false afterwards', async () => {
    const store = useAuthStore()
    store.user = makeUser()

    const p = store.logout()
    // performLogout flips isLoading true synchronously, before awaiting disconnect.
    expect(store.isLoading).toBe(true)
    await p
    expect(store.isLoading).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// clearAuth
// ---------------------------------------------------------------------------

describe('Auth Store — clearAuth', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
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

  it('resets isLoading to false', () => {
    const store = useAuthStore()
    store.isLoading = true
    store.clearAuth()
    expect(store.isLoading).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// computed getters
// ---------------------------------------------------------------------------

describe('Auth Store — computed getters', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
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

  it('isAdmin and isAgent are false when there is no user (no throw on null)', () => {
    const store = useAuthStore()
    store.user = null

    expect(store.isAdmin).toBe(false)
    expect(store.isAgent).toBe(false)
  })

  it('avatars fall back to the default paths when there is no user', () => {
    const store = useAuthStore()
    store.user = null

    expect(store.userAvatar).toBe('/images/default-avatar.png')
    expect(store.userDarkAvatar).toBe('/images/default-avatar-dark.png')
  })

  it('avatars use the user image paths when present', () => {
    const store = useAuthStore()
    store.user = makeUser({ image: '/img/a.png', darkImage: '/img/a-dark.png' })

    expect(store.userAvatar).toBe('/img/a.png')
    expect(store.userDarkAvatar).toBe('/img/a-dark.png')
  })
})

// ---------------------------------------------------------------------------
// remembered email
// ---------------------------------------------------------------------------

describe('Auth Store — remembered email', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    mockStorage.clear()
  })

  it('reads a remembered email and clears it back to null', () => {
    seedRememberedEmail('a@b.c')
    expect(getRememberedEmail()).toBe('a@b.c')

    clearRememberedEmail()
    expect(getRememberedEmail()).toBeNull()
    expect(mockStorage.getItem('innochat-remembered-email')).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// storage hydration type guards
// ---------------------------------------------------------------------------

describe('Auth Store — storage hydration type guards', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    mockStorage.clear()
  })

  it('ignores a non-string accessToken and does not hydrate as authenticated', () => {
    mockStorage.setItem(
      'innochat-auth',
      JSON.stringify({ user: makeUser(), accessToken: 12345, refreshToken: 'r' }),
    )

    const store = useAuthStore()

    expect(store.isAuthenticated).toBe(false)
    expect(store.accessToken).toBeNull()
  })

  it('hydrates the access token but nulls a non-string refresh token', () => {
    mockStorage.setItem(
      'innochat-auth',
      JSON.stringify({ user: makeUser(), accessToken: 'a', refreshToken: 999 }),
    )

    const store = useAuthStore()

    expect(store.isAuthenticated).toBe(true)
    expect(store.accessToken).toBe('a')
    expect(store.refreshToken).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// login edge cases
// ---------------------------------------------------------------------------

describe('Auth Store — login edge cases', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    mockStorage.clear()
  })

  it('is loading while login is in flight', async () => {
    const { authService } = await import('@/lib/api/services/AuthService')
    let resolveLogin!: (v: unknown) => void
    vi.mocked(authService.login).mockReturnValue(
      new Promise((res) => {
        resolveLogin = res
      }) as ReturnType<typeof authService.login>,
    )

    const store = useAuthStore()
    const p = store.login({ email: 'a@b.com', password: 'pw', mode: AuthenticationMode.Basic })
    expect(store.isLoading).toBe(true)

    resolveLogin({
      isErr: () => false,
      value: { data: { user: makeUser(), accessToken: 't', refreshToken: 'r' } },
    })
    await p
    expect(store.isLoading).toBe(false)
  })

  it('returns a validation error when the password is not a string', async () => {
    const { authService } = await import('@/lib/api/services/AuthService')

    const store = useAuthStore()
    const result = await store.login({
      email: 'a@b.com',
      password: undefined as unknown as string,
      mode: AuthenticationMode.Basic,
    })

    expect(result.isErr()).toBe(true)
    if (result.isErr()) expect(result.error.code).toBe(ErrorCode.VALIDATION_ERROR)
    // The guard short-circuits before the service is ever called.
    expect(authService.login).not.toHaveBeenCalled()
  })

  it('returns UNAUTHORIZED and writes no state when the response has no user', async () => {
    const { authService } = await import('@/lib/api/services/AuthService')
    vi.mocked(authService.login).mockResolvedValue({
      isErr: () => false,
      value: { data: { accessToken: 't', refreshToken: 'r' } },
    } as Awaited<ReturnType<typeof authService.login>>)

    const store = useAuthStore()
    const result = await store.login({
      email: 'a@b.com',
      password: 'pw',
      mode: AuthenticationMode.Basic,
    })

    expect(result.isErr()).toBe(true)
    if (result.isErr()) expect(result.error.code).toBe(ErrorCode.UNAUTHORIZED)
    expect(store.user).toBeNull()
    expect(store.accessToken).toBeNull()
    expect(mockStorage.getItem('innochat-auth')).toBeNull()
  })
})
