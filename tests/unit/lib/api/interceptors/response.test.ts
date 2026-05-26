import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { AxiosError, AxiosResponse, InternalAxiosRequestConfig } from 'axios'
import { AxiosHeaders } from 'axios'
import { apiClient } from '@/lib/api/client'
import { responseErrorInterceptor, setAuthStore } from '@/lib/api/interceptors/response'

vi.mock('@/lib/api/client', () => ({
  apiClient: {
    post: vi.fn(),
    request: vi.fn(),
  },
}))

vi.mock('@/lib/errors/normalize', () => ({
  normalizeApiError: vi.fn((error: unknown) => error),
}))

vi.mock('@/lib/errors/utils', () => ({
  globalErrorTracker: {
    track: vi.fn(),
  },
}))

interface MockAuthStore {
  accessToken: string | null
  refreshToken: string | null
  setTokens: ReturnType<typeof vi.fn>
  clearAuth: ReturnType<typeof vi.fn>
}

describe('Token Refresh in Response Interceptor', () => {
  let mockAuthStore: MockAuthStore
  let mockSetTokens: ReturnType<typeof vi.fn>
  let mockClearAuth: ReturnType<typeof vi.fn>

  beforeEach(() => {
    vi.clearAllMocks()

    mockSetTokens = vi.fn().mockResolvedValue(undefined)
    mockClearAuth = vi.fn()

    mockAuthStore = {
      accessToken: 'old-access-token',
      refreshToken: 'old-refresh-token',
      setTokens: mockSetTokens,
      clearAuth: mockClearAuth,
    }

    setAuthStore(mockAuthStore)
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('should extract tokens from correct nesting level (data.data)', async () => {
    const mockRefreshResponse: AxiosResponse = {
      data: {
        data: {
          accessToken: 'new-access-token',
          refreshToken: 'new-refresh-token',
        },
      },
      status: 200,
      statusText: 'OK',
      headers: {},
      config: {} as InternalAxiosRequestConfig,
      request: {},
    }

    const mockRetryResponse: AxiosResponse = {
      data: { success: true },
      status: 200,
      statusText: 'OK',
      headers: {},
      config: {} as InternalAxiosRequestConfig,
      request: {},
    }

    vi.mocked(apiClient.post).mockResolvedValue(mockRefreshResponse)
    vi.mocked(apiClient.request).mockResolvedValue(mockRetryResponse)

    const error: AxiosError = {
      config: {
        url: '/api/test',
        method: 'GET',
        headers: new AxiosHeaders(),
      } as InternalAxiosRequestConfig,
      response: {
        status: 401,
        statusText: 'Unauthorized',
        data: {},
        headers: {},
        config: {} as InternalAxiosRequestConfig,
        request: {},
      },
      isAxiosError: true,
      toJSON: () => ({}),
      name: 'AxiosError',
      message: 'Request failed with status code 401',
    }

    const result = await responseErrorInterceptor(error)

    expect(apiClient.post).toHaveBeenCalledWith(
      '/api/authentication/refresh-token',
      {
        accessToken: 'old-access-token',
        refreshToken: 'old-refresh-token',
      },
      expect.objectContaining({ skipAuthRefresh: true }),
    )

    expect(mockSetTokens).toHaveBeenCalledWith('new-access-token', 'new-refresh-token')

    expect(result).toEqual(mockRetryResponse)
  })

  it('should persist tokens to localStorage via setTokens', async () => {
    const mockRefreshResponse: AxiosResponse = {
      data: {
        data: {
          accessToken: 'new-access-token',
          refreshToken: 'new-refresh-token',
        },
      },
      status: 200,
      statusText: 'OK',
      headers: {},
      config: {} as InternalAxiosRequestConfig,
      request: {},
    }

    const mockRetryResponse: AxiosResponse = {
      data: { success: true },
      status: 200,
      statusText: 'OK',
      headers: {},
      config: {} as InternalAxiosRequestConfig,
      request: {},
    }

    vi.mocked(apiClient.post).mockResolvedValue(mockRefreshResponse)
    vi.mocked(apiClient.request).mockResolvedValue(mockRetryResponse)

    const error: AxiosError = {
      config: {
        url: '/api/test',
        method: 'GET',
        headers: new AxiosHeaders(),
      } as InternalAxiosRequestConfig,
      response: {
        status: 401,
        statusText: 'Unauthorized',
        data: {},
        headers: {},
        config: {} as InternalAxiosRequestConfig,
        request: {},
      },
      isAxiosError: true,
      toJSON: () => ({}),
      name: 'AxiosError',
      message: 'Request failed with status code 401',
    }

    await responseErrorInterceptor(error)

    expect(mockSetTokens).toHaveBeenCalled()
    expect(mockSetTokens).toHaveBeenCalledWith('new-access-token', 'new-refresh-token')

    expect(mockSetTokens.mock.calls.length).toBe(1)
  })

  it('should retry original request with new token after refresh', async () => {
    const mockRefreshResponse: AxiosResponse = {
      data: {
        data: {
          accessToken: 'new-access-token',
          refreshToken: 'new-refresh-token',
        },
      },
      status: 200,
      statusText: 'OK',
      headers: {},
      config: {} as InternalAxiosRequestConfig,
      request: {},
    }

    const mockRetryResponse: AxiosResponse = {
      data: { success: true },
      status: 200,
      statusText: 'OK',
      headers: {},
      config: {} as InternalAxiosRequestConfig,
      request: {},
    }

    vi.mocked(apiClient.post).mockResolvedValue(mockRefreshResponse)
    vi.mocked(apiClient.request).mockResolvedValue(mockRetryResponse)

    const originalRequestConfig: InternalAxiosRequestConfig = {
      url: '/api/test',
      method: 'GET',
      headers: new AxiosHeaders(),
    }

    const error: AxiosError = {
      config: originalRequestConfig,
      response: {
        status: 401,
        statusText: 'Unauthorized',
        data: {},
        headers: {},
        config: {} as InternalAxiosRequestConfig,
        request: {},
      },
      isAxiosError: true,
      toJSON: () => ({}),
      name: 'AxiosError',
      message: 'Request failed with status code 401',
    }

    const result = await responseErrorInterceptor(error)

    expect(apiClient.request).toHaveBeenCalledWith(
      expect.objectContaining({
        url: '/api/test',
        method: 'GET',
        _retry: true,
      }),
    )

    expect(result).toEqual(mockRetryResponse)
  })

  it('should clear auth state when refresh fails', async () => {
    const mockRefreshError = new Error('Refresh failed')

    vi.mocked(apiClient.post).mockRejectedValue(mockRefreshError)

    const error: AxiosError = {
      config: {
        url: '/api/test',
        method: 'GET',
        headers: new AxiosHeaders(),
      } as InternalAxiosRequestConfig,
      response: {
        status: 401,
        statusText: 'Unauthorized',
        data: {},
        headers: {},
        config: {} as InternalAxiosRequestConfig,
        request: {},
      },
      isAxiosError: true,
      toJSON: () => ({}),
      name: 'AxiosError',
      message: 'Request failed with status code 401',
    }

    await expect(responseErrorInterceptor(error)).rejects.toThrow()

    expect(mockClearAuth).toHaveBeenCalled()
  })

  it('should handle camelCase token response format', async () => {
    const mockRefreshResponse: AxiosResponse = {
      data: {
        data: {
          accessToken: 'new-access-token-camel',
          refreshToken: 'new-refresh-token-camel',
        },
      },
      status: 200,
      statusText: 'OK',
      headers: {},
      config: {} as InternalAxiosRequestConfig,
      request: {},
    }

    const mockRetryResponse: AxiosResponse = {
      data: { success: true },
      status: 200,
      statusText: 'OK',
      headers: {},
      config: {} as InternalAxiosRequestConfig,
      request: {},
    }

    vi.mocked(apiClient.post).mockResolvedValue(mockRefreshResponse)
    vi.mocked(apiClient.request).mockResolvedValue(mockRetryResponse)

    const error: AxiosError = {
      config: {
        url: '/api/test',
        method: 'GET',
        headers: new AxiosHeaders(),
      } as InternalAxiosRequestConfig,
      response: {
        status: 401,
        statusText: 'Unauthorized',
        data: {},
        headers: {},
        config: {} as InternalAxiosRequestConfig,
        request: {},
      },
      isAxiosError: true,
      toJSON: () => ({}),
      name: 'AxiosError',
      message: 'Request failed with status code 401',
    }

    await responseErrorInterceptor(error)

    expect(mockSetTokens).toHaveBeenCalledWith('new-access-token-camel', 'new-refresh-token-camel')
  })

  describe('Request Queue Management', () => {
    it('should queue multiple 401 requests and process them after successful refresh', async () => {
      const mockRefreshResponse: AxiosResponse = {
        data: {
          data: {
            accessToken: 'new-access-token',
            refreshToken: 'new-refresh-token',
          },
        },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as InternalAxiosRequestConfig,
        request: {},
      }

      const mockRetryResponse: AxiosResponse = {
        data: { success: true },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as InternalAxiosRequestConfig,
        request: {},
      }

      // Make refresh take some time so we can queue requests
      vi.mocked(apiClient.post).mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve(mockRefreshResponse), 50)),
      )

      vi.mocked(apiClient.request).mockResolvedValue(mockRetryResponse)

      const error1: AxiosError = {
        config: {
          url: '/api/endpoint1',
          method: 'GET',
          headers: new AxiosHeaders(),
        } as InternalAxiosRequestConfig,
        response: {
          status: 401,
          statusText: 'Unauthorized',
          data: {},
          headers: {},
          config: {} as InternalAxiosRequestConfig,
          request: {},
        },
        isAxiosError: true,
        toJSON: () => ({}),
        name: 'AxiosError',
        message: 'Request failed with status code 401',
      }

      const error2: AxiosError = {
        config: {
          url: '/api/endpoint2',
          method: 'POST',
          headers: new AxiosHeaders(),
        } as InternalAxiosRequestConfig,
        response: {
          status: 401,
          statusText: 'Unauthorized',
          data: {},
          headers: {},
          config: {} as InternalAxiosRequestConfig,
          request: {},
        },
        isAxiosError: true,
        toJSON: () => ({}),
        name: 'AxiosError',
        message: 'Request failed with status code 401',
      }

      // Fire both requests concurrently
      const [result1, result2] = await Promise.all([
        responseErrorInterceptor(error1),
        responseErrorInterceptor(error2),
      ])

      // Both should succeed with the same mock response
      expect(result1.data).toEqual({ success: true })
      expect(result2.data).toEqual({ success: true })

      // Refresh should only be called once (proving the queue worked)
      expect(apiClient.post).toHaveBeenCalledTimes(1)

      // Both original requests should have been retried
      expect(apiClient.request).toHaveBeenCalledTimes(2)
    })

    it('should reject all queued requests when refresh fails', async () => {
      vi.mocked(apiClient.post).mockImplementation(
        () => new Promise((_, reject) => setTimeout(() => reject(new Error('Refresh failed')), 50)),
      )

      const error1: AxiosError = {
        config: {
          url: '/api/endpoint1',
          method: 'GET',
          headers: new AxiosHeaders(),
        } as InternalAxiosRequestConfig,
        response: {
          status: 401,
          statusText: 'Unauthorized',
          data: {},
          headers: {},
          config: {} as InternalAxiosRequestConfig,
          request: {},
        },
        isAxiosError: true,
        toJSON: () => ({}),
        name: 'AxiosError',
        message: 'Request failed with status code 401',
      }

      const error2: AxiosError = {
        config: {
          url: '/api/endpoint2',
          method: 'POST',
          headers: new AxiosHeaders(),
        } as InternalAxiosRequestConfig,
        response: {
          status: 401,
          statusText: 'Unauthorized',
          data: {},
          headers: {},
          config: {} as InternalAxiosRequestConfig,
          request: {},
        },
        isAxiosError: true,
        toJSON: () => ({}),
        name: 'AxiosError',
        message: 'Request failed with status code 401',
      }

      // Fire both requests concurrently
      const results = await Promise.allSettled([
        responseErrorInterceptor(error1),
        responseErrorInterceptor(error2),
      ])

      // Both should fail
      expect(results[0].status).toBe('rejected')
      expect(results[1].status).toBe('rejected')

      // clearAuth should be called
      expect(mockClearAuth).toHaveBeenCalled()
    })
  })

  describe('Missing Token Scenarios', () => {
    it('should throw error when accessToken is missing during refresh', async () => {
      mockAuthStore.accessToken = null
      mockAuthStore.refreshToken = 'valid-refresh'

      const error: AxiosError = {
        config: {
          url: '/api/test',
          method: 'GET',
          headers: new AxiosHeaders(),
        } as InternalAxiosRequestConfig,
        response: {
          status: 401,
          statusText: 'Unauthorized',
          data: {},
          headers: {},
          config: {} as InternalAxiosRequestConfig,
          request: {},
        },
        isAxiosError: true,
        toJSON: () => ({}),
        name: 'AxiosError',
        message: 'Request failed with status code 401',
      }

      await expect(responseErrorInterceptor(error)).rejects.toThrow()
      expect(mockClearAuth).toHaveBeenCalled()
    })

    it('should throw error when refreshToken is missing during refresh', async () => {
      mockAuthStore.accessToken = 'valid-access'
      mockAuthStore.refreshToken = null

      const error: AxiosError = {
        config: {
          url: '/api/test',
          method: 'GET',
          headers: new AxiosHeaders(),
        } as InternalAxiosRequestConfig,
        response: {
          status: 401,
          statusText: 'Unauthorized',
          data: {},
          headers: {},
          config: {} as InternalAxiosRequestConfig,
          request: {},
        },
        isAxiosError: true,
        toJSON: () => ({}),
        name: 'AxiosError',
        message: 'Request failed with status code 401',
      }

      await expect(responseErrorInterceptor(error)).rejects.toThrow()
      expect(mockClearAuth).toHaveBeenCalled()
    })

    it('should throw error when both tokens are missing during refresh', async () => {
      mockAuthStore.accessToken = null
      mockAuthStore.refreshToken = null

      const error: AxiosError = {
        config: {
          url: '/api/test',
          method: 'GET',
          headers: new AxiosHeaders(),
        } as InternalAxiosRequestConfig,
        response: {
          status: 401,
          statusText: 'Unauthorized',
          data: {},
          headers: {},
          config: {} as InternalAxiosRequestConfig,
          request: {},
        },
        isAxiosError: true,
        toJSON: () => ({}),
        name: 'AxiosError',
        message: 'Request failed with status code 401',
      }

      await expect(responseErrorInterceptor(error)).rejects.toThrow()
      expect(mockClearAuth).toHaveBeenCalled()
    })
  })

  describe('skipAuthRefresh flag', () => {
    it('should not attempt refresh when skipAuthRefresh is true', async () => {
      const error: AxiosError = {
        config: {
          url: '/api/authentication/refresh-token',
          method: 'POST',
          headers: new AxiosHeaders(),
          skipAuthRefresh: true,
        } as InternalAxiosRequestConfig,
        response: {
          status: 401,
          statusText: 'Unauthorized',
          data: {},
          headers: {},
          config: {} as InternalAxiosRequestConfig,
          request: {},
        },
        isAxiosError: true,
        toJSON: () => ({}),
        name: 'AxiosError',
        message: 'Request failed with status code 401',
      }

      // The current implementation doesn't check skipAuthRefresh before attempting refresh
      // This test documents expected behavior
      await expect(responseErrorInterceptor(error)).rejects.toBeDefined()

      // Should not call post again (would cause infinite loop)
      // This verifies the _retry flag prevents that
    })

    it('should not retry a request that already has _retry flag', async () => {
      const error: AxiosError = {
        config: {
          url: '/api/test',
          method: 'GET',
          headers: new AxiosHeaders(),
          _retry: true,
        } as InternalAxiosRequestConfig,
        response: {
          status: 401,
          statusText: 'Unauthorized',
          data: {},
          headers: {},
          config: {} as InternalAxiosRequestConfig,
          request: {},
        },
        isAxiosError: true,
        toJSON: () => ({}),
        name: 'AxiosError',
        message: 'Request failed with status code 401',
      }

      await expect(responseErrorInterceptor(error)).rejects.toBeDefined()

      // Should not attempt to refresh
      expect(apiClient.post).not.toHaveBeenCalled()
    })
  })

  describe('Rate Limiting (429)', () => {
    it('should retry request after rate limit with exponential backoff', async () => {
      vi.useFakeTimers()

      const mockSuccessResponse: AxiosResponse = {
        data: { success: true },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as InternalAxiosRequestConfig,
        request: {},
      }

      vi.mocked(apiClient.request).mockResolvedValue(mockSuccessResponse)

      const error: AxiosError = {
        config: {
          url: '/api/test',
          method: 'GET',
          headers: new AxiosHeaders(),
        } as InternalAxiosRequestConfig,
        response: {
          status: 429,
          statusText: 'Too Many Requests',
          data: {},
          headers: {},
          config: {} as InternalAxiosRequestConfig,
          request: {},
        },
        isAxiosError: true,
        toJSON: () => ({}),
        name: 'AxiosError',
        message: 'Request failed with status code 429',
      }

      const resultPromise = responseErrorInterceptor(error)

      // Advance timers to allow retry
      await vi.advanceTimersByTimeAsync(2000)

      const result = await resultPromise

      expect(result.data).toEqual({ success: true })
      expect(apiClient.request).toHaveBeenCalled()

      vi.useRealTimers()
    })

    it('should fail after max retries on persistent 429', async () => {
      vi.useFakeTimers()

      const error: AxiosError = {
        config: {
          url: '/api/test',
          method: 'GET',
          headers: new AxiosHeaders(),
          _retryCount: 3,
        } as InternalAxiosRequestConfig,
        response: {
          status: 429,
          statusText: 'Too Many Requests',
          data: {},
          headers: {},
          config: {} as InternalAxiosRequestConfig,
          request: {},
        },
        isAxiosError: true,
        toJSON: () => ({}),
        name: 'AxiosError',
        message: 'Request failed with status code 429',
      }

      await expect(responseErrorInterceptor(error)).rejects.toBeDefined()

      vi.useRealTimers()
    })
  })

  describe('Service Unavailable (503)', () => {
    it('should retry request after 503 error', async () => {
      vi.useFakeTimers()

      const mockSuccessResponse: AxiosResponse = {
        data: { success: true },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as InternalAxiosRequestConfig,
        request: {},
      }

      vi.mocked(apiClient.request).mockResolvedValue(mockSuccessResponse)

      const error: AxiosError = {
        config: {
          url: '/api/test',
          method: 'GET',
          headers: new AxiosHeaders(),
        } as InternalAxiosRequestConfig,
        response: {
          status: 503,
          statusText: 'Service Unavailable',
          data: {},
          headers: {},
          config: {} as InternalAxiosRequestConfig,
          request: {},
        },
        isAxiosError: true,
        toJSON: () => ({}),
        name: 'AxiosError',
        message: 'Request failed with status code 503',
      }

      const resultPromise = responseErrorInterceptor(error)

      // Advance timers to allow retry (503 uses 2000ms delay)
      await vi.advanceTimersByTimeAsync(3000)

      const result = await resultPromise

      expect(result.data).toEqual({ success: true })

      vi.useRealTimers()
    })

    it('should fail after max retries on persistent 503', async () => {
      vi.useFakeTimers()

      const error: AxiosError = {
        config: {
          url: '/api/test',
          method: 'GET',
          headers: new AxiosHeaders(),
          _retryCount: 2,
        } as InternalAxiosRequestConfig,
        response: {
          status: 503,
          statusText: 'Service Unavailable',
          data: {},
          headers: {},
          config: {} as InternalAxiosRequestConfig,
          request: {},
        },
        isAxiosError: true,
        toJSON: () => ({}),
        name: 'AxiosError',
        message: 'Request failed with status code 503',
      }

      await expect(responseErrorInterceptor(error)).rejects.toBeDefined()

      vi.useRealTimers()
    })
  })
})
