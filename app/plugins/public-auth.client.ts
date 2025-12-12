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
    const { isPublicMode, publicLoginEmail, publicLoginPassword, hasPublicCredentials, getPublicChatUrl } = usePublicMode()

    // Only run in public mode
    if (!isPublicMode.value) {
      console.log('🔐 Not in public mode, skipping public auth')
      return
    }

    console.log('🔐 Public mode detected, initiating auto-authentication...')

    // Set storage mode to sessionStorage for public mode
    setStorageMode('sessionStorage')
    console.log('📦 Storage mode set to sessionStorage')

    // Clear any existing auth state to ensure fresh session
    authStore.clearAuth()

    // Check if we have credentials configured
    if (!hasPublicCredentials.value) {
      console.error('❌ Public mode enabled but credentials not configured')
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

      if (result.isOk()) {
        console.log('✅ Public mode auto-authentication successful')
      } else {
        console.error('❌ Public mode auto-authentication failed:', result.error)
        configStore.setPublicAuthError(true)
      }
    } catch (error) {
      console.error('❌ Public mode auto-authentication error:', error)
      configStore.setPublicAuthError(true)
    }
  },
})
