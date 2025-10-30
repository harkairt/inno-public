import { describe, it, expect, vi, beforeEach } from 'vitest'
import { authService } from '@/lib/api/services/AuthService'
import { apiClient } from '@/lib/api/client'
import { ErrorCode } from '@/types/enums'

vi.mock('@/lib/api/client', () => ({
  apiClient: {
    post: vi.fn(),
    get: vi.fn(),
    put: vi.fn()
  }
}))

vi.mock('@/lib/errors/normalize', () => ({
  normalizeApiError: vi.fn((error) => ({
    code: ErrorCode.NETWORK_ERROR,
    message: error.message || 'Network error'
  }))
}))

describe('AuthService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('refreshToken', () => {
    it('should successfully refresh tokens with valid credentials', async () => {
      const mockResponse = {
        data: {
          data: {
            AccessToken: 'new-access-token',
            RefreshToken: 'new-refresh-token'
          }
        }
      }

      vi.mocked(apiClient.post).mockResolvedValue(mockResponse)

      const result = await authService.refreshToken('old-access', 'old-refresh')

      expect(result.isOk()).toBe(true)
      if (result.isOk()) {
        expect(result.value).toEqual({
          AccessToken: 'new-access-token',
          RefreshToken: 'new-refresh-token'
        })
      }

      expect(apiClient.post).toHaveBeenCalledWith(
        '/api/authentication/refresh-token',
        {
          accessToken: 'old-access',
          refreshToken: 'old-refresh'
        }
      )
    })

    it('should return error when response has no data', async () => {
      const mockResponse = {
        data: {
          data: null
        }
      }

      vi.mocked(apiClient.post).mockResolvedValue(mockResponse)

      const result = await authService.refreshToken('access', 'refresh')

      expect(result.isErr()).toBe(true)
      if (result.isErr()) {
        expect(result.error.code).toBe(ErrorCode.UNAUTHORIZED)
        expect(result.error.message).toBe('Failed to refresh token')
      }
    })

    it('should return error when API call fails', async () => {
      vi.mocked(apiClient.post).mockRejectedValue(new Error('Network error'))

      const result = await authService.refreshToken('access', 'refresh')

      expect(result.isErr()).toBe(true)
    })

    it('should return error when API returns 401', async () => {
      const error = new Error('Unauthorized')
      ;(error as any).response = { status: 401 }

      vi.mocked(apiClient.post).mockRejectedValue(error)

      const result = await authService.refreshToken('expired-access', 'invalid-refresh')

      expect(result.isErr()).toBe(true)
    })
  })
})
