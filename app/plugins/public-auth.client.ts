/**
 * Public Auth Plugin
 * Auto-authenticates with config credentials in public mode
 * Runs after config-init to ensure config is loaded first
 */

import { useConfigStore } from '@/app/stores/config'
import { useAuthStore, setStorageMode } from '@/app/stores/auth'
import { usePublicMode } from '@/app/composables/usePublicMode'
import { AuthenticationMode } from '@/types/enums'

export default defineNuxtPlugin({
  name: 'public-auth',
  dependsOn: ['config-init'],
  async setup() {
    const configStore = useConfigStore()
    const authStore = useAuthStore()
    const { isPublicMode, publicLoginEmail, publicLoginPassword, hasPublicCredentials } =
      usePublicMode()

    // Only run in public mode
    if (!isPublicMode.value) {
      return
    }

    // Set storage mode to sessionStorage for public mode
    setStorageMode('sessionStorage')

    // Clear any existing auth state to ensure fresh session
    authStore.clearAuth()

    // Check if we have credentials configured
    if (!hasPublicCredentials.value) {
      configStore.setPublicAuthError(true)
      return
    }

    // Attempt login with public credentials
    try {
      const result = await authStore.login({
        email: publicLoginEmail.value!,
        password: publicLoginPassword.value!,
        mode: AuthenticationMode.Basic,
      })

      if (result.isErr()) {
        configStore.setPublicAuthError(true)
      }
    } catch {
      configStore.setPublicAuthError(true)
    }
  },
})
