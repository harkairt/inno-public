/**
 * API Interceptors Plugin
 * Wires up request/response interceptors to the API client at startup.
 * The actual wiring lives in lib/api/interceptors/setup.ts so tests can reuse it.
 */

import { configureApiInterceptors } from '@/lib/api/interceptors/setup'
import { startCacheCleanup } from '@/lib/api/interceptors/response'
import { useAuthStore } from '@/app/stores/auth'

export default defineNuxtPlugin(() => {
  // Get auth store in plugin context (where we have Nuxt context)
  const authStore = useAuthStore()

  configureApiInterceptors({
    authStore,
    // Router-aware login redirect (respects app.baseURL, avoids full reload)
    redirectToLogin: () => {
      void navigateTo('/login', { replace: true })
    },
  })

  // Start periodic cache cleanup (moved out of response.ts import-time side effect)
  startCacheCleanup()
})
