import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useAuthStore } from '@/app/stores/auth'
import { useChatStore } from '@/app/stores/chat'
import { installFakeSignalR } from '@/tests/utils/fakeSignalR'
import { makeUser } from '@/tests/utils/factories'
import { AuthenticationMode } from '@/types/enums'
import type { Result } from 'neverthrow'
import type { RefreshTokenResponseDTO } from '@/types/api/schemas'
import type { AppError } from '@/lib/errors/types'

vi.mock('@/lib/api/services/AuthService', () => ({
  authService: {
    refreshToken: vi.fn(),
    login: vi.fn(),
  },
}))

const mockLocalStorage = (() => {
  let store: Record<string, string> = {}
  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key]
    }),
    clear: vi.fn(() => {
      store = {}
    }),
  }
})()

Object.defineProperty(global, 'localStorage', {
  value: mockLocalStorage,
  writable: true,
})

describe('Auth Store Token Refresh', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    mockLocalStorage.clear()
  })

  it('should persist tokens to localStorage after successful refresh', async () => {
    const { authService } = await import('@/lib/api/services/AuthService')

    const mockRefreshResponse: RefreshTokenResponseDTO = {
      accessToken: 'new-access-token',
      refreshToken: 'new-refresh-token',
    }

    vi.mocked(authService.refreshToken).mockResolvedValue({
      isOk: () => true,
      isErr: () => false,
      value: mockRefreshResponse,
    } as Result<RefreshTokenResponseDTO, AppError>)

    const authStore = useAuthStore()

    authStore.accessToken = 'old-access-token'
    authStore.refreshToken = 'old-refresh-token'
    authStore.user = {
      id: '1',
      email: 'test@example.com',
      firstName: 'Test',
      lastName: 'User',
    }

    const result = await authStore.refreshAuthToken()

    expect(result.isOk()).toBe(true)

    expect(authStore.accessToken).toBe('new-access-token')
    expect(authStore.refreshToken).toBe('new-refresh-token')

    expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
      'innochat-auth',
      expect.stringContaining('new-access-token'),
    )
    expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
      'innochat-auth',
      expect.stringContaining('new-refresh-token'),
    )
  })

  it('should maintain tokens in localStorage across page reloads', async () => {
    const { authService } = await import('@/lib/api/services/AuthService')

    const mockRefreshResponse: RefreshTokenResponseDTO = {
      accessToken: 'refreshed-token',
      refreshToken: 'refreshed-refresh-token',
    }

    vi.mocked(authService.refreshToken).mockResolvedValue({
      isOk: () => true,
      isErr: () => false,
      value: mockRefreshResponse,
    } as Result<RefreshTokenResponseDTO, AppError>)

    const authStore = useAuthStore()

    authStore.accessToken = 'initial-token'
    authStore.refreshToken = 'initial-refresh-token'
    authStore.user = {
      id: '1',
      email: 'test@example.com',
      firstName: 'Test',
      lastName: 'User',
    }

    await authStore.refreshAuthToken()

    const savedData = mockLocalStorage.getItem('innochat-auth')
    expect(savedData).toBeTruthy()

    const parsedData = JSON.parse(savedData!) as Record<string, unknown>
    expect(parsedData.accessToken).toBe('refreshed-token')
    expect(parsedData.refreshToken).toBe('refreshed-refresh-token')
  })

  it('should handle PascalCase token format from API', async () => {
    const { authService } = await import('@/lib/api/services/AuthService')

    const mockRefreshResponse: RefreshTokenResponseDTO = {
      accessToken: 'pascal-access-token',
      refreshToken: 'pascal-refresh-token',
    }

    vi.mocked(authService.refreshToken).mockResolvedValue({
      isOk: () => true,
      isErr: () => false,
      value: mockRefreshResponse,
    } as Result<RefreshTokenResponseDTO, AppError>)

    const authStore = useAuthStore()

    authStore.accessToken = 'old-token'
    authStore.refreshToken = 'old-refresh'
    authStore.user = {
      id: '1',
      email: 'test@example.com',
      firstName: 'Test',
      lastName: 'User',
    }

    await authStore.refreshAuthToken()

    expect(authStore.accessToken).toBe('pascal-access-token')
    expect(authStore.refreshToken).toBe('pascal-refresh-token')
  })

  it('should clear tokens from localStorage on refresh failure', async () => {
    const { authService } = await import('@/lib/api/services/AuthService')

    vi.mocked(authService.refreshToken).mockResolvedValue({
      isOk: () => false,
      isErr: () => true,
      error: {
        code: 'UNAUTHORIZED',
        message: 'Invalid refresh token',
      },
    } as Result<RefreshTokenResponseDTO, AppError>)

    const authStore = useAuthStore()

    authStore.accessToken = 'old-access-token'
    authStore.refreshToken = 'old-refresh-token'
    authStore.user = {
      id: '1',
      email: 'test@example.com',
      firstName: 'Test',
      lastName: 'User',
    }

    mockLocalStorage.setItem(
      'innochat-auth',
      JSON.stringify({
        user: authStore.user,
        accessToken: 'old-access-token',
        refreshToken: 'old-refresh-token',
      }),
    )

    const result = await authStore.refreshAuthToken()

    expect(result.isErr()).toBe(true)

    expect(authStore.accessToken).toBeNull()
    expect(authStore.refreshToken).toBeNull()
    expect(authStore.user).toBeNull()
  })

  it('should update both reactive state and localStorage after refresh', async () => {
    const { authService } = await import('@/lib/api/services/AuthService')

    const mockRefreshResponse: RefreshTokenResponseDTO = {
      accessToken: 'new-token',
      refreshToken: 'new-refresh',
    }

    vi.mocked(authService.refreshToken).mockResolvedValue({
      isOk: () => true,
      isErr: () => false,
      value: mockRefreshResponse,
    } as Result<RefreshTokenResponseDTO, AppError>)

    const authStore = useAuthStore()

    authStore.accessToken = 'old-token'
    authStore.refreshToken = 'old-refresh'
    authStore.user = {
      id: '1',
      email: 'test@example.com',
      firstName: 'Test',
      lastName: 'User',
    }

    await authStore.refreshAuthToken()

    expect(authStore.accessToken).toBe('new-token')
    expect(authStore.refreshToken).toBe('new-refresh')

    const savedData = mockLocalStorage.getItem('innochat-auth')
    expect(savedData).toBeTruthy()

    const parsedData = JSON.parse(savedData!) as Record<string, unknown>
    expect(parsedData.accessToken).toBe('new-token')
    expect(parsedData.refreshToken).toBe('new-refresh')
  })

  it('should return error when not authenticated', async () => {
    const authStore = useAuthStore()

    // Ensure store is not authenticated
    authStore.user = null
    authStore.accessToken = null
    authStore.refreshToken = null

    const result = await authStore.refreshAuthToken()

    expect(result.isErr()).toBe(true)
    if (result.isErr()) {
      expect(result.error.code).toBe('UNAUTHORIZED')
      expect(result.error.message).toBe('No user to refresh token for')
    }
  })

  it('should return error when accessToken is missing', async () => {
    const authStore = useAuthStore()

    authStore.user = {
      id: '1',
      email: 'test@example.com',
      firstName: 'Test',
      lastName: 'User',
    }
    authStore.accessToken = null
    authStore.refreshToken = 'valid-refresh-token'

    const result = await authStore.refreshAuthToken()

    expect(result.isErr()).toBe(true)
    if (result.isErr()) {
      expect(result.error.code).toBe('UNAUTHORIZED')
      expect(result.error.message).toBe('No tokens available for refresh')
    }
  })

  it('should return error when refreshToken is missing', async () => {
    const authStore = useAuthStore()

    authStore.user = {
      id: '1',
      email: 'test@example.com',
      firstName: 'Test',
      lastName: 'User',
    }
    authStore.accessToken = 'valid-access-token'
    authStore.refreshToken = null

    const result = await authStore.refreshAuthToken()

    expect(result.isErr()).toBe(true)
    if (result.isErr()) {
      expect(result.error.code).toBe('UNAUTHORIZED')
      expect(result.error.message).toBe('No tokens available for refresh')
    }
  })

  it('keeps refreshed tokens in memory when storage.setItem throws (blocked/quota)', async () => {
    const { authService } = await import('@/lib/api/services/AuthService')

    vi.mocked(authService.refreshToken).mockResolvedValue({
      isOk: () => true,
      isErr: () => false,
      value: { accessToken: 'mem-access', refreshToken: 'mem-refresh' },
    } as Result<RefreshTokenResponseDTO, AppError>)

    const authStore = useAuthStore()
    authStore.accessToken = 'old-access'
    authStore.refreshToken = 'old-refresh'
    authStore.user = {
      id: '1',
      email: 'test@example.com',
      firstName: 'Test',
      lastName: 'User',
    }

    // The persist that setTokens performs after a successful refresh fails
    // (blocked/quota-full Storage). The guard must swallow it so the refresh
    // resolves ok and tokens stay in memory — no unhandled rejection, no reset.
    mockLocalStorage.setItem.mockImplementationOnce(() => {
      throw new DOMException('The quota has been exceeded.', 'QuotaExceededError')
    })

    const result = await authStore.refreshAuthToken()

    expect(result.isOk()).toBe(true)
    expect(authStore.accessToken).toBe('mem-access')
    expect(authStore.refreshToken).toBe('mem-refresh')
    expect(authStore.user).not.toBeNull()
  })

  it('should clear auth state on unexpected exception', async () => {
    const { authService } = await import('@/lib/api/services/AuthService')

    vi.mocked(authService.refreshToken).mockRejectedValue(new Error('Unexpected error'))

    const authStore = useAuthStore()

    authStore.accessToken = 'access-token'
    authStore.refreshToken = 'refresh-token'
    authStore.user = {
      id: '1',
      email: 'test@example.com',
      firstName: 'Test',
      lastName: 'User',
    }

    const result = await authStore.refreshAuthToken()

    expect(result.isErr()).toBe(true)
    expect(authStore.user).toBeNull()
    expect(authStore.accessToken).toBeNull()
    expect(authStore.refreshToken).toBeNull()
  })
})

describe('setTokens Method', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    mockLocalStorage.clear()
  })

  it('should validate and store valid tokens', async () => {
    const authStore = useAuthStore()

    await authStore.setTokens('valid-access', 'valid-refresh')

    expect(authStore.accessToken).toBe('valid-access')
    expect(authStore.refreshToken).toBe('valid-refresh')
  })

  it('should set null for empty string access token', async () => {
    const authStore = useAuthStore()

    await authStore.setTokens('', 'valid-refresh')

    expect(authStore.accessToken).toBeNull()
    expect(authStore.refreshToken).toBe('valid-refresh')
  })

  it('should set null for whitespace-only access token', async () => {
    const authStore = useAuthStore()

    await authStore.setTokens('   ', 'valid-refresh')

    expect(authStore.accessToken).toBeNull()
    expect(authStore.refreshToken).toBe('valid-refresh')
  })

  it('should set null for whitespace-only refresh token', async () => {
    const authStore = useAuthStore()

    await authStore.setTokens('valid-access', '   ')

    expect(authStore.accessToken).toBe('valid-access')
    expect(authStore.refreshToken).toBeNull()
  })

  it('should set null for empty string refresh token', async () => {
    const authStore = useAuthStore()

    await authStore.setTokens('valid-access', '')

    expect(authStore.accessToken).toBe('valid-access')
    expect(authStore.refreshToken).toBeNull()
  })

  it('should handle null tokens', async () => {
    const authStore = useAuthStore()

    // Set initial tokens
    await authStore.setTokens('initial-access', 'initial-refresh')

    // Clear with nulls
    await authStore.setTokens(null, null)

    expect(authStore.accessToken).toBeNull()
    expect(authStore.refreshToken).toBeNull()
  })

  it('should persist tokens to localStorage', async () => {
    const authStore = useAuthStore()
    authStore.user = {
      id: '1',
      email: 'test@example.com',
      firstName: 'Test',
      lastName: 'User',
    }

    await authStore.setTokens('persisted-access', 'persisted-refresh')

    const savedData = mockLocalStorage.getItem('innochat-auth')
    expect(savedData).toBeTruthy()

    const parsedData = JSON.parse(savedData!) as Record<string, unknown>
    expect(parsedData.accessToken).toBe('persisted-access')
    expect(parsedData.refreshToken).toBe('persisted-refresh')
  })
})

// ---------------------------------------------------------------------------
// SignalR + chat-store side effects of login / clearAuth / logout
//
// This file (unlike auth.test.ts) does NOT mock useSignalR, the chat store, or
// the query client, so the real wiring runs: login connects SignalR, clearAuth
// resets the chat store, logout disconnects. The SignalR singleton is swapped
// for the duck-typed fake so no real connection is attempted.
// ---------------------------------------------------------------------------

describe('Auth Store — SignalR + chat side effects', () => {
  const ME = 'me@example.com'

  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    mockLocalStorage.clear()
  })

  it('connects SignalR on login, resets the chat store on clearAuth, disconnects on logout', async () => {
    const { authService } = await import('@/lib/api/services/AuthService')
    const fake = installFakeSignalR()

    vi.mocked(authService.login).mockResolvedValue({
      isErr: () => false,
      value: {
        data: { user: makeUser({ email: ME }), accessToken: 'tok', refreshToken: 'ref' },
      },
    } as Awaited<ReturnType<typeof authService.login>>)

    const store = useAuthStore()
    await store.login({ email: ME, password: 'pw', mode: AuthenticationMode.Basic })

    // performLogin's SignalR connect ran against the fake singleton.
    expect(fake.getState()).toBe('connected')

    // Seed chat-store state, then clearAuth must wipe it via resetUserData().
    const chat = useChatStore()
    chat.setActiveSession('session-1')
    chat.saveDraft('session-1', 'draft text')
    expect(chat.activeSessionId).toBe('session-1')

    store.clearAuth()
    expect(chat.activeSessionId).toBeNull()
    expect(chat.getDraft('session-1')).toBe('')

    // logout disconnects SignalR.
    await store.logout()
    expect(fake.getState()).toBe('disconnected')
  })
})
