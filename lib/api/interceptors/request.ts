/**
 * Request interceptors for the API client
 * Handles request modification and validation
 */

import type { InternalAxiosRequestConfig } from 'axios'
import { generateUUID } from '../../utils/uuid'
import { AppError } from '../../errors/types'
import { ErrorCode } from '@/types/enums'
import { createLogger } from '@/lib/utils/logger'

const logger = createLogger('RequestInterceptor')

/**
 * Request interceptor that adds headers and metadata to outgoing requests
 */
export function requestInterceptor(config: InternalAxiosRequestConfig): InternalAxiosRequestConfig {
  // Add request ID for tracking and debugging
  config.headers = config.headers || {}
  config.headers['X-Request-ID'] = generateUUID()

  // Add client timestamp
  config.headers['X-Client-Timestamp'] = new Date().toISOString()

  // Add client info
  if (typeof navigator !== 'undefined') {
    config.headers['X-Client-User-Agent'] = navigator.userAgent
  }

  // Add app version if available
  const buildVersion =
    (import.meta.env.NUXT_PUBLIC_BUILD_VERSION as string | undefined) ?? 'unknown'
  config.headers['X-App-Version'] = buildVersion

  return config
}

/**
 * Request error interceptor for handling request configuration errors
 */
export function requestErrorInterceptor(error: unknown): Promise<never> {
  return Promise.reject(error)
}

/**
 * Factory function to create authentication request interceptor
 * Takes auth store as parameter to avoid context issues
 * @param getToken - Function that returns the current access token
 */
export function createAuthRequestInterceptor(getToken: () => string | null) {
  return function authRequestInterceptor(
    config: InternalAxiosRequestConfig,
  ): InternalAxiosRequestConfig {
    const token = getToken()

    // Add Authorization header if token exists
    if (token) {
      config.headers = config.headers || {}
      config.headers['Authorization'] = `Bearer ${token}`
    }

    return config
  }
}

/**
 * Request interceptor for rate limiting
 * Implements client-side rate limiting to prevent overwhelming the server
 */
class RateLimiter {
  private requests: Map<string, number[]> = new Map()
  private readonly maxRequests: number
  private readonly windowMs: number

  constructor(maxRequests = 100, windowMs = 60000) {
    // 100 requests per minute by default
    this.maxRequests = maxRequests
    this.windowMs = windowMs
  }

  canMakeRequest(key = 'default'): boolean {
    const now = Date.now()
    const windowStart = now - this.windowMs

    if (!this.requests.has(key)) {
      this.requests.set(key, [])
    }

    const timestamps = this.requests.get(key)!

    // Remove old requests outside the window
    const validTimestamps = timestamps.filter((timestamp) => timestamp > windowStart)
    this.requests.set(key, validTimestamps)

    // Check if we can make a new request
    if (validTimestamps.length < this.maxRequests) {
      validTimestamps.push(now)
      return true
    }

    return false
  }

  getResetTime(key = 'default'): number {
    const timestamps = this.requests.get(key) ?? []
    if (timestamps.length === 0) return 0

    const oldestRequest = Math.min(...timestamps)
    return oldestRequest + this.windowMs
  }
}

// Global rate limiter instance
const rateLimiter = new RateLimiter()

export function rateLimitInterceptor(
  config: InternalAxiosRequestConfig,
): InternalAxiosRequestConfig | Promise<never> {
  const key = `${config.method}_${config.url}`

  if (!rateLimiter.canMakeRequest(key)) {
    const resetTime = rateLimiter.getResetTime(key)
    const waitTime = Math.max(0, resetTime - Date.now())

    if (import.meta.dev) {
      logger.warn(`Rate limit exceeded for ${key}. Reset in ${waitTime}ms`)
    }

    return Promise.reject(
      new AppError(
        ErrorCode.RATE_LIMITED,
        `Rate limit exceeded. Try again in ${Math.ceil(waitTime / 1000)}s`,
      ),
    )
  }

  return config
}

/**
 * Request interceptor for caching
 * Adds cache control headers based on request type
 */
export function cacheInterceptor(config: InternalAxiosRequestConfig): InternalAxiosRequestConfig {
  // Add cache control headers for GET requests
  if (config.method?.toLowerCase() === 'get') {
    config.headers = config.headers || {}

    // Add no-cache for dynamic data endpoints
    const noCacheEndpoints = ['/messages', '/sessions', '/unread']

    const url = config.url ?? ''
    const shouldNoCache = noCacheEndpoints.some((endpoint) => url.includes(endpoint))

    if (shouldNoCache) {
      config.headers['Cache-Control'] = 'no-cache'
      config.headers['Pragma'] = 'no-cache'
    } else {
      // Allow caching for static data endpoints
      config.headers['Cache-Control'] = 'max-age=300' // 5 minutes
    }
  }

  return config
}

/**
 * Request interceptor for request transformation
 * Transforms request data to match API expectations
 */
export function transformRequestInterceptor(
  config: InternalAxiosRequestConfig,
): InternalAxiosRequestConfig {
  // Handle FormData requests - remove Content-Type to let browser set it with boundary
  if (config.data instanceof FormData) {
    delete config.headers['Content-Type']
  }

  return config
}

/**
 * Request interceptor for debugging
 * Provides detailed logging for development
 */
export function debugInterceptor(config: InternalAxiosRequestConfig): InternalAxiosRequestConfig {
  if (import.meta.dev) {
    logger.debug(`${config.method?.toUpperCase()} ${config.url}`, {
      requestId: config.headers['X-Request-ID'] as string | undefined,
    })
  }

  return config
}
