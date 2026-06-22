/**
 * Response interceptors for the API client
 * Handles response processing, error handling, and token refresh
 */

import type { AxiosError, AxiosResponse, InternalAxiosRequestConfig } from 'axios'
import { apiClient } from '../client'
import { normalizeApiError } from '@/lib/errors/normalize'
import { reportToSentry } from '@/lib/errors/sentry'
import { globalErrorTracker } from '@/lib/errors/utils'
import { extractTokensFromResponse } from '@/lib/api/utils/tokens'
import { createLogger } from '@/lib/utils/logger'

const logger = createLogger('ResponseInterceptor')

// Auth store interface for dependency injection
interface AuthStore {
  accessToken: string | null
  refreshToken: string | null
  setTokens: (accessToken: string | null, refreshToken: string | null) => Promise<void>
  clearAuth: () => void
}

// Extend Axios types for custom properties
declare module 'axios' {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars, @typescript-eslint/no-explicit-any
  export interface AxiosResponse<T = any, D = any> {
    metadata?: {
      requestId?: string
      duration?: number
      cached?: boolean
    }
  }

  export interface InternalAxiosRequestConfig {
    skipAuthRefresh?: boolean
    _retry?: boolean
    _retryCount?: number
  }
}

// ============================================================================
// TOKEN REFRESH QUEUE MANAGEMENT
// ============================================================================

interface QueuedRequest {
  resolve: (value: AxiosResponse) => void
  reject: (reason?: unknown) => void
  config: InternalAxiosRequestConfig
}

// Module-level state for token refresh management
let isRefreshing = false
let failedQueue: QueuedRequest[] = []
let authStoreInstance: AuthStore | null = null

// Set auth store instance (called from plugin)
export function setAuthStore(authStore: AuthStore): void {
  if (import.meta.dev)
    logger.debug('Setting auth store instance:', {
      hasAccessToken: !!authStore.accessToken,
      hasRefreshToken: !!authStore.refreshToken,
      hasSetTokens: typeof authStore.setTokens === 'function',
      hasClearAuth: typeof authStore.clearAuth === 'function',
    })
  authStoreInstance = authStore
}

function processQueue(error: unknown): void {
  const queueLength = failedQueue.length
  if (import.meta.dev) logger.debug(`Token refresh: Processing ${queueLength} queued requests...`)

  failedQueue.forEach((promise) => {
    if (error) {
      promise.reject(error)
    } else {
      // apiClient.request returns a Promise<AxiosResponse>
      apiClient.request(promise.config).then(promise.resolve).catch(promise.reject)
    }
  })

  failedQueue = []
  if (import.meta.dev) logger.debug('Token refresh: Queue processing completed')
}

// ============================================================================
// SUCCESS RESPONSE INTERCEPTOR
// ============================================================================

/**
 * Response interceptor for successful responses
 * Handles response transformation and logging
 */
export function responseInterceptor(response: AxiosResponse): AxiosResponse {
  // Handle specific response transformations
  const url = response.config.url ?? ''

  // Transform snake_case to camelCase for specific endpoints
  if (url.includes('/login') || url.includes('/user')) {
    response.data = transformToCamelCase(response.data as Record<string, unknown>)
  }

  // Add metadata to response for tracking
  const timestampHeader = response.config.headers['X-Client-Timestamp'] as string | undefined
  const timestamp = typeof timestampHeader === 'string' ? timestampHeader : '0'
  response.metadata = {
    requestId: response.config.headers['X-Request-ID'] as string | undefined,
    duration: Date.now() - parseInt(timestamp),
    cached: response.config.headers['X-Cache'] === 'HIT',
  }

  return response
}

// ============================================================================
// ERROR RESPONSE INTERCEPTOR
// ============================================================================

/**
 * Response error interceptor with automatic token refresh
 * Handles API errors, authentication failures, and token refresh
 * Can return a successful response if retry succeeds, otherwise rejects
 */
export async function responseErrorInterceptor(error: AxiosError): Promise<AxiosResponse> {
  const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean }

  // Track error for analytics
  const normalizedError = normalizeApiError(error)
  globalErrorTracker.track(normalizedError)

  // Log error in development
  if (import.meta.dev && !!originalRequest) {
    logger.error(`API Error: ${originalRequest.method?.toUpperCase()} ${originalRequest.url}`, {
      status: error.response?.status,
      requestId: originalRequest.headers['X-Request-ID'] as string | undefined,
      error: normalizedError,
    })
  }

  // Skip token refresh for requests that already opted out (e.g., the refresh request itself)
  if (originalRequest.skipAuthRefresh) {
    reportToSentry(normalizedError, { endpoint: originalRequest.url, phase: 'skipAuthRefresh' })
    return Promise.reject(normalizedError)
  }

  // Handle 401 Unauthorized - attempt token refresh
  if (error.response?.status === 401 && !originalRequest._retry) {
    if (import.meta.dev)
      logger.debug('Token refresh: 401 error detected, initiating token refresh...')
    return handleTokenRefresh(originalRequest)
  }

  // Handle 429 Too Many Requests - implement retry with exponential backoff
  if (error.response?.status === 429) {
    return handleRateLimitRetry(originalRequest, error)
  }

  // Handle 503 Service Unavailable - implement retry
  if (error.response?.status === 503 && !originalRequest._retry) {
    return handleServiceUnavailableRetry(originalRequest, error)
  }

  // For all other errors, normalize, report to Sentry, and reject
  reportToSentry(normalizedError, { endpoint: originalRequest.url })
  return Promise.reject(normalizedError)
}

/**
 * Handle token refresh for 401 errors
 */
async function handleTokenRefresh(
  originalRequest: InternalAxiosRequestConfig & { _retry?: boolean },
): Promise<AxiosResponse> {
  // If already refreshing, queue this request
  if (isRefreshing) {
    return new Promise<AxiosResponse>((resolve, reject) => {
      failedQueue.push({
        resolve,
        reject,
        config: originalRequest,
      })
    })
  }

  originalRequest._retry = true
  isRefreshing = true

  try {
    // Get current tokens from auth store
    if (!authStoreInstance?.accessToken || !authStoreInstance?.refreshToken) {
      throw new Error('No tokens available for refresh')
    }

    const currentAccessToken = authStoreInstance.accessToken
    const currentRefreshToken = authStoreInstance.refreshToken

    // Attempt to refresh the token
    const refreshResponse = await apiClient.post(
      '/api/authentication/refresh-token',
      {
        accessToken: currentAccessToken,
        refreshToken: currentRefreshToken,
      },
      {
        skipAuthRefresh: true, // Flag to prevent infinite refresh loops
      } as InternalAxiosRequestConfig,
    )

    // Extract and store new tokens
    const responseData = refreshResponse.data as { data: unknown }
    const tokens = extractTokensFromResponse(responseData.data)
    if (authStoreInstance) {
      if (import.meta.dev) logger.debug('Token refresh: Storing new tokens...')
      await authStoreInstance.setTokens(tokens.accessToken, tokens.refreshToken)
      if (import.meta.dev) logger.debug('Token refresh: Tokens stored successfully')
    }

    // If refresh successful, process queued requests
    if (import.meta.dev) logger.debug('Token refresh: Processing queued requests...')
    processQueue(null)

    // Retry the original request
    return apiClient.request(originalRequest)
  } catch (refreshError) {
    return handleTokenRefreshFailure(refreshError)
  } finally {
    isRefreshing = false
  }
}

/**
 * Handle token refresh failure - clear auth state and redirect to login
 */
function handleTokenRefreshFailure(refreshError: unknown): Promise<never> {
  processQueue(refreshError)

  const normalizedRefreshError = normalizeApiError(refreshError)
  reportToSentry(normalizedRefreshError, { phase: 'tokenRefreshFailed' })

  if (authStoreInstance) {
    authStoreInstance.clearAuth()
  }

  if (import.meta.dev) logger.error('Token refresh failed, redirecting to login')

  redirectToLogin()

  return Promise.reject(normalizedRefreshError)
}

/**
 * Redirect the user to the login page
 */
function redirectToLogin(): void {
  if (typeof window !== 'undefined') {
    type NuxtWindow = { __NUXT__?: { config?: { app?: { baseURL?: string } } } }
    const baseUrl = (window as unknown as NuxtWindow).__NUXT__?.config?.app?.baseURL ?? '/'
    window.location.href = `${baseUrl}login`
  }
}

/**
 * Handle rate limiting with exponential backoff
 */
async function handleRateLimitRetry(
  originalRequest: InternalAxiosRequestConfig & { _retry?: boolean; _retryCount?: number },
  error: AxiosError,
): Promise<AxiosResponse> {
  const maxRetries = 3
  const baseDelay = 1000 // 1 second

  originalRequest._retryCount = (originalRequest._retryCount ?? 0) + 1

  if (originalRequest._retryCount > maxRetries) {
    const normalizedError = normalizeApiError(error)
    reportToSentry(normalizedError, {
      endpoint: originalRequest.url,
      phase: 'rateLimitRetriesExhausted',
    })
    return Promise.reject(normalizedError)
  }

  // Calculate delay with exponential backoff
  const delay = baseDelay * Math.pow(2, originalRequest._retryCount - 1)

  // Add jitter to prevent thundering herd
  const jitter = Math.random() * 0.1 * delay
  const finalDelay = delay + jitter

  if (import.meta.dev)
    logger.debug(
      `Rate limited. Retrying in ${finalDelay}ms (attempt ${originalRequest._retryCount}/${maxRetries})`,
    )

  // Wait and retry
  await new Promise((resolve) => setTimeout(resolve, finalDelay))
  return apiClient.request(originalRequest)
}

/**
 * Handle service unavailable (503) with retry
 */
async function handleServiceUnavailableRetry(
  originalRequest: InternalAxiosRequestConfig & { _retry?: boolean; _retryCount?: number },
  error: AxiosError,
): Promise<AxiosResponse> {
  const maxRetries = 2
  const delay = 2000 // 2 seconds

  originalRequest._retryCount = (originalRequest._retryCount ?? 0) + 1

  if (originalRequest._retryCount > maxRetries) {
    return Promise.reject(normalizeApiError(error))
  }

  if (import.meta.dev)
    logger.debug(
      `Service unavailable. Retrying in ${delay}ms (attempt ${originalRequest._retryCount}/${maxRetries})`,
    )

  // Wait and retry
  await new Promise((resolve) => setTimeout(resolve, delay))
  return apiClient.request(originalRequest)
}

// ============================================================================
// CACHE INTERCEPTOR
// ============================================================================

/**
 * Response interceptor for caching
 * Handles response caching based on cache headers
 */
const responseCache = new Map<string, { data: unknown; timestamp: number; ttl: number }>()

export function cacheResponseInterceptor(response: AxiosResponse): AxiosResponse {
  const url = response.config.url ?? ''
  const method = response.config.method?.toLowerCase()

  // Only cache GET requests
  if (method !== 'get') return response

  // Check for cache-control headers
  const cacheControlHeader: unknown = response.headers['cache-control']
  const cacheControl = typeof cacheControlHeader === 'string' ? cacheControlHeader : ''
  const noCache = cacheControl.includes('no-cache') || cacheControl.includes('no-store')

  if (noCache) return response

  // Extract max-age if present
  const maxAgeMatch = cacheControl.match(/max-age=(\d+)/)
  const maxAge = maxAgeMatch?.[1] ? parseInt(maxAgeMatch[1]) * 1000 : 300000 // Default 5 minutes

  // Cache the response
  const cacheKey = `${method}:${url}:${JSON.stringify(response.config.params)}`
  responseCache.set(cacheKey, {
    data: response.data,
    timestamp: Date.now(),
    ttl: maxAge,
  })

  return response
}

function transformToCamelCase(obj: unknown): unknown {
  if (obj === null || obj === undefined) return obj
  if (typeof obj !== 'object') return obj
  if (obj instanceof Date) return obj
  if (Array.isArray(obj)) return obj.map(transformToCamelCase)

  const result: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(obj)) {
    const camelKey = key.replace(/_([a-z])/g, (_: string, letter: string) => letter.toUpperCase())
    result[camelKey] = transformToCamelCase(value)
  }
  return result
}

function clearExpiredCache(): void {
  const now = Date.now()
  for (const [key, cached] of responseCache.entries()) {
    if (now - cached.timestamp > cached.ttl) {
      responseCache.delete(key)
    }
  }
}

if (typeof setInterval !== 'undefined') {
  setInterval(clearExpiredCache, 60000)
}
