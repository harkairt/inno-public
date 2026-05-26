/**
 * API Interceptors Plugin
 * Wires up sophisticated request/response interceptors to the API client
 * This enables error normalization, token refresh, caching, rate limiting, etc.
 */

import { apiClient } from '@/lib/api/client'
import {
  requestInterceptor,
  requestErrorInterceptor,
  createAuthRequestInterceptor,
  rateLimitInterceptor,
  cacheInterceptor,
  transformRequestInterceptor,
  debugInterceptor,
} from '@/lib/api/interceptors/request'
import {
  responseInterceptor,
  responseErrorInterceptor,
  cacheResponseInterceptor,
  setAuthStore,
} from '@/lib/api/interceptors/response'
import { useAuthStore } from '@/app/stores/auth'
import { createLogger } from '@/lib/utils/logger'

const logger = createLogger('ApiInterceptors')

// Module-level flag to track if interceptors have been set up
let interceptorsConfigured = false

export default defineNuxtPlugin(() => {
  // Check if interceptors are already set up to avoid duplication
  if (interceptorsConfigured) {
    logger.debug('API interceptors already configured')
    return
  }

  logger.debug('Setting up API interceptors...')

  // Get auth store in plugin context (where we have Nuxt context)
  const authStore = useAuthStore()

  // Inject auth store into response interceptor module
  setAuthStore(authStore)

  // ============================================================================
  // REQUEST INTERCEPTORS (order matters - first added = first executed)
  // ============================================================================

  // 1. Debug interceptor (first for detailed logging)
  apiClient.interceptors.request.use(debugInterceptor, requestErrorInterceptor)

  // 2. Rate limiting interceptor (check limits before making request)
  apiClient.interceptors.request.use(rateLimitInterceptor, requestErrorInterceptor)

  // 3. Authentication interceptor (adds auth-related headers)
  // Use factory function to create interceptor with access to auth store
  const authRequestInterceptor = createAuthRequestInterceptor(() => authStore.getAccessToken)
  apiClient.interceptors.request.use(authRequestInterceptor, requestErrorInterceptor)

  // 4. Transform interceptor (modifies request data)
  apiClient.interceptors.request.use(transformRequestInterceptor, requestErrorInterceptor)

  // 5. Cache control headers interceptor
  apiClient.interceptors.request.use(cacheInterceptor, requestErrorInterceptor)

  // 6. Request metadata interceptor (adds tracking headers)
  apiClient.interceptors.request.use(requestInterceptor, requestErrorInterceptor)

  // ============================================================================
  // RESPONSE INTERCEPTORS (order matters - first added = first executed)
  // ============================================================================

  // 1. Response interceptor (handles successful responses)
  apiClient.interceptors.response.use(responseInterceptor, responseErrorInterceptor)

  // 2. Cache response interceptor (caches successful responses)
  apiClient.interceptors.response.use(cacheResponseInterceptor, responseErrorInterceptor)

  // Mark interceptors as configured
  interceptorsConfigured = true

  logger.info('API interceptors configured successfully')
})

// ============================================================================
// UTILITY FUNCTIONS FOR INTERCEPTOR MANAGEMENT
// ============================================================================

/**
 * Remove all interceptors from the API client
 * Useful for testing or cleanup
 */
export function clearApiInterceptors(): void {
  // Clear all request interceptors
  apiClient.interceptors.request.clear()

  // Clear all response interceptors
  apiClient.interceptors.response.clear()

  // Reset configuration flag
  interceptorsConfigured = false

  logger.debug('All API interceptors cleared')
}

// Export for type augmentation and testing
export { apiClient }
