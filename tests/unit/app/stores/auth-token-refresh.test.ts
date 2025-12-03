import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useAuthStore } from '@/app/stores/auth'
import type { Result } from 'neverthrow'
import type { RefreshTokenResponseDTO } from '@/types/api/schemas'
import type { AppError } from '@/lib/errors/AppError'

vi.mock('@/lib/api/services/AuthService', () => ({
  authService: {
    refreshToken: vi.fn()
  }
}))

const mockLocalStorage = (() => {
  let store: Record<string, string> = {}
  return {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key]
    }),
    clear: vi.fn(() => {
      store = {}
    })
  }
})()

Object.defineProperty(global, 'localStorage', {
  value: mockLocalStorage,
  writable: true
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
      refreshToken: 'new-refresh-token'
    }

    vi.mocked(authService.refreshToken).mockResolvedValue({
      isOk: () => true,
      isErr: () => false,
      value: mockRefreshResponse
    } as Result<RefreshTokenResponseDTO, AppError>)

    const authStore = useAuthStore()

    authStore.accessToken = 'old-access-token'
    authStore.refreshToken = 'old-refresh-token'
    authStore.user = {
      id: '1',
      email: 'test@example.com',
      firstName: 'Test',
      lastName: 'User'
    }

    const result = await authStore.refreshAuthToken()

    expect(result.isOk()).toBe(true)

    expect(authStore.accessToken).toBe('new-access-token')
    expect(authStore.refreshToken).toBe('new-refresh-token')

    expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
      'innochat-auth',
      expect.stringContaining('new-access-token')
    )
    expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
      'innochat-auth',
      expect.stringContaining('new-refresh-token')
    )
  })

  it('should maintain tokens in localStorage across page reloads', async () => {
    const { authService } = await import('@/lib/api/services/AuthService')

    const mockRefreshResponse: RefreshTokenResponseDTO = {
      accessToken: 'refreshed-token',
      refreshToken: 'refreshed-refresh-token'
    }

    vi.mocked(authService.refreshToken).mockResolvedValue({
      isOk: () => true,
      isErr: () => false,
      value: mockRefreshResponse
    } as Result<RefreshTokenResponseDTO, AppError>)

    const authStore = useAuthStore()

    authStore.accessToken = 'initial-token'
    authStore.refreshToken = 'initial-refresh-token'
    authStore.user = {
      id: '1',
      email: 'test@example.com',
      firstName: 'Test',
      lastName: 'User'
    }

    await authStore.refreshAuthToken()

    const savedData = mockLocalStorage.getItem('innochat-auth')
    expect(savedData).toBeTruthy()

    const parsedData = JSON.parse(savedData!)
    expect(parsedData.accessToken).toBe('refreshed-token')
    expect(parsedData.refreshToken).toBe('refreshed-refresh-token')
  })

  it('should handle PascalCase token format from API', async () => {
    const { authService } = await import('@/lib/api/services/AuthService')

    const mockRefreshResponse: RefreshTokenResponseDTO = {
      accessToken: 'pascal-access-token',
      refreshToken: 'pascal-refresh-token'
    }

    vi.mocked(authService.refreshToken).mockResolvedValue({
      isOk: () => true,
      isErr: () => false,
      value: mockRefreshResponse
    } as Result<RefreshTokenResponseDTO, AppError>)

    const authStore = useAuthStore()

    authStore.accessToken = 'old-token'
    authStore.refreshToken = 'old-refresh'
    authStore.user = {
      id: '1',
      email: 'test@example.com',
      firstName: 'Test',
      lastName: 'User'
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
        message: 'Invalid refresh token'
      }
    } as Result<RefreshTokenResponseDTO, AppError>)

    const authStore = useAuthStore()

    authStore.accessToken = 'old-access-token'
    authStore.refreshToken = 'old-refresh-token'
    authStore.user = {
      id: '1',
      email: 'test@example.com',
      firstName: 'Test',
      lastName: 'User'
    }

    mockLocalStorage.setItem('innochat-auth', JSON.stringify({
      user: authStore.user,
      accessToken: 'old-access-token',
      refreshToken: 'old-refresh-token'
    }))

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
      refreshToken: 'new-refresh'
    }

    vi.mocked(authService.refreshToken).mockResolvedValue({
      isOk: () => true,
      isErr: () => false,
      value: mockRefreshResponse
    } as Result<RefreshTokenResponseDTO, AppError>)

    const authStore = useAuthStore()

    authStore.accessToken = 'old-token'
    authStore.refreshToken = 'old-refresh'
    authStore.user = {
      id: '1',
      email: 'test@example.com',
      firstName: 'Test',
      lastName: 'User'
    }

    await authStore.refreshAuthToken()

    expect(authStore.accessToken).toBe('new-token')
    expect(authStore.refreshToken).toBe('new-refresh')

    const savedData = mockLocalStorage.getItem('innochat-auth')
    expect(savedData).toBeTruthy()

    const parsedData = JSON.parse(savedData!)
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
      lastName: 'User'
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
      lastName: 'User'
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
      lastName: 'User'
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
      lastName: 'User'
    }

    await authStore.setTokens('persisted-access', 'persisted-refresh')

    const savedData = mockLocalStorage.getItem('innochat-auth')
    expect(savedData).toBeTruthy()

    const parsedData = JSON.parse(savedData!)
    expect(parsedData.accessToken).toBe('persisted-access')
    expect(parsedData.refreshToken).toBe('persisted-refresh')
  })
})
