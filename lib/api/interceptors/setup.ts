/**
 * API interceptor wiring, framework-agnostic.
 *
 * Extracted from app/plugins/api-interceptors.client.ts so both the Nuxt plugin
 * (production) and tests can attach the real request/response interceptor chain
 * to the singleton apiClient. The Nuxt plugin is now a thin caller.
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
  setRedirectToLogin,
} from '@/lib/api/interceptors/response'
import { createLogger } from '@/lib/utils/logger'

const logger = createLogger('ApiInterceptors')

/** Duck-typed auth store surface the interceptors depend on. */
export interface AuthStoreLike {
  accessToken: string | null
  refreshToken: string | null
  getAccessToken: string | null
  setTokens: (accessToken: string | null, refreshToken: string | null) => Promise<void>
  clearAuth: () => void
}

// Module-level flag to track if interceptors have been set up
let interceptorsConfigured = false

/**
 * Attach request/response interceptors to the singleton apiClient and inject
 * dependencies (auth store + login redirect). Idempotent: repeated calls are
 * no-ops until clearApiInterceptors() is called.
 */
export function configureApiInterceptors(deps: {
  authStore: AuthStoreLike
  redirectToLogin: () => void
}): void {
  if (interceptorsConfigured) {
    logger.debug('API interceptors already configured')
    return
  }

  logger.debug('Setting up API interceptors...')

  const { authStore, redirectToLogin } = deps

  // Inject auth store + login redirect into the response interceptor module
  setAuthStore(authStore)
  setRedirectToLogin(redirectToLogin)

  // ============================================================================
  // REQUEST INTERCEPTORS (order matters - first added = first executed)
  // ============================================================================

  // 1. Debug interceptor (first for detailed logging)
  apiClient.interceptors.request.use(debugInterceptor, requestErrorInterceptor)

  // 2. Rate limiting interceptor (check limits before making request)
  apiClient.interceptors.request.use(rateLimitInterceptor, requestErrorInterceptor)

  // 3. Authentication interceptor (adds auth-related headers)
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

  interceptorsConfigured = true

  logger.info('API interceptors configured successfully')
}

/**
 * Remove all interceptors from the API client and reset the configured flag.
 * Useful for testing or cleanup.
 */
export function clearApiInterceptors(): void {
  apiClient.interceptors.request.clear()
  apiClient.interceptors.response.clear()
  interceptorsConfigured = false

  logger.debug('All API interceptors cleared')
}
