/**
 * API client setup and configuration
 * Combines all interceptors and provides a configured axios instance
 */

import { apiClient } from './client'
import type { InternalAxiosRequestConfig, AxiosResponse } from 'axios'
import {
  requestInterceptor,
  requestErrorInterceptor,
  createAuthRequestInterceptor,
  rateLimitInterceptor,
  cacheInterceptor,
  transformRequestInterceptor,
  debugInterceptor
} from './interceptors/request'
import {
  responseInterceptor,
  responseErrorInterceptor,
  cacheResponseInterceptor,
  clearExpiredCache,
  setAuthStore
} from './interceptors/response'

let isSetup = false

interface AuthStore {
  getAccessToken: string | null
  setTokens: (accessToken: string | null, refreshToken: string | null) => Promise<void>
  clearAuth: () => void
}

/**
 * Setup the API client with all interceptors
 * Should be called once during application initialization
 * @param authStore - Auth store instance for token management
 */
export function setupApiClient(authStore: AuthStore): void {
  if (isSetup) {
    console.warn('API client already setup')
    return
  }

  // Inject auth store into response interceptor module
  setAuthStore(authStore)

  // Setup request interceptors (order matters - first added runs first)

  // 1. Debug interceptor (should run first to log original request)
  apiClient.interceptors.request.use(debugInterceptor, requestErrorInterceptor)

  // 2. Auth interceptor (adds auth headers)
  const authRequestInterceptor = createAuthRequestInterceptor(() => authStore.getAccessToken)
  apiClient.interceptors.request.use(authRequestInterceptor, requestErrorInterceptor)

  // 3. Rate limiting interceptor (prevents overwhelming server)
  apiClient.interceptors.request.use(rateLimitInterceptor, requestErrorInterceptor)

  // 4. Cache interceptor (adds cache headers)
  apiClient.interceptors.request.use(cacheInterceptor, requestErrorInterceptor)

  // 5. Transform interceptor (transforms request data)
  apiClient.interceptors.request.use(transformRequestInterceptor, requestErrorInterceptor)

  // 6. Base request interceptor (adds request ID and metadata)
  apiClient.interceptors.request.use(requestInterceptor, requestErrorInterceptor)

  // Setup response interceptors (order matters - first added runs first)

  // 1. Cache response interceptor (handles caching)
  apiClient.interceptors.response.use(cacheResponseInterceptor, responseErrorInterceptor)

  // 2. Base response interceptor (handles successful responses)
  apiClient.interceptors.response.use(responseInterceptor, responseErrorInterceptor)

  // 3. Error response interceptor (handles errors and token refresh)
  apiClient.interceptors.response.use(
    (response) => response, // Pass through successful responses
    responseErrorInterceptor // Handle errors
  )

  // Cleanup expired cache periodically
  if (typeof setInterval !== 'undefined') {
    setInterval(clearExpiredCache, 300000) // Every 5 minutes
  }

  isSetup = true
  console.log('✅ API client setup complete')
}

/**
 * Setup API client for Nuxt 3 plugin system
 * This function can be used in a Nuxt plugin
 * @param authStore - Auth store instance for token management
 */
export function setupApiClientForNuxt(authStore: AuthStore): void {
  // Ensure setup happens on both client and server
  if (import.meta.client || import.meta.server) {
    setupApiClient(authStore)
  }
}

/**
 * Get the configured API client
 * @returns The configured axios instance
 */
export function getApiClient() {
  if (!isSetup) {
    console.warn('API client not setup. Call setupApiClient() first.')
  }
  return apiClient
}

/**
 * Reset API client configuration
 * Useful for testing or configuration changes
 */
export function resetApiClient(): void {
  // Clear all interceptors
  apiClient.interceptors.request.clear()
  apiClient.interceptors.response.clear()

  isSetup = false
  console.log('🔄 API client reset complete')
}

/**
 * Setup API client with custom configuration
 * Allows overriding default behavior for specific use cases
 * @param authStore - Auth store instance for token management
 * @param config - Configuration options
 */
export function setupApiClientWithConfig(
  authStore: AuthStore,
  config: {
    enableDebug?: boolean
    enableRateLimiting?: boolean
    enableCaching?: boolean
    enableTransform?: boolean
    customRequestInterceptors?: Array<(config: InternalAxiosRequestConfig) => InternalAxiosRequestConfig>
    customResponseInterceptors?: Array<(response: AxiosResponse) => AxiosResponse>
  }
): void {
  if (isSetup) {
    resetApiClient()
  }

  // Inject auth store into response interceptor module
  setAuthStore(authStore)

  // Setup base interceptors based on config
  if (config.enableDebug !== false) {
    apiClient.interceptors.request.use(debugInterceptor, requestErrorInterceptor)
  }

  const authRequestInterceptor = createAuthRequestInterceptor(() => authStore.getAccessToken)
  apiClient.interceptors.request.use(authRequestInterceptor, requestErrorInterceptor)

  if (config.enableRateLimiting !== false) {
    apiClient.interceptors.request.use(rateLimitInterceptor, requestErrorInterceptor)
  }

  if (config.enableCaching !== false) {
    apiClient.interceptors.request.use(cacheInterceptor, requestErrorInterceptor)
  }

  if (config.enableTransform !== false) {
    apiClient.interceptors.request.use(transformRequestInterceptor, requestErrorInterceptor)
  }

  apiClient.interceptors.request.use(requestInterceptor, requestErrorInterceptor)

  // Response interceptors
  if (config.enableCaching !== false) {
    apiClient.interceptors.response.use(cacheResponseInterceptor, responseErrorInterceptor)
  }

  apiClient.interceptors.response.use(responseInterceptor, responseErrorInterceptor)

  // Add custom interceptors
  if (config.customRequestInterceptors) {
    config.customRequestInterceptors.forEach(interceptor => {
      apiClient.interceptors.request.use(interceptor, requestErrorInterceptor)
    })
  }

  if (config.customResponseInterceptors) {
    config.customResponseInterceptors.forEach(interceptor => {
      apiClient.interceptors.response.use(interceptor, responseErrorInterceptor)
    })
  }

  isSetup = true
  console.log('✅ API client setup complete with custom configuration')
}

// Export for backward compatibility
export default apiClient