/**
 * Config Initialization Plugin
 * Loads runtime configuration from backend and applies values
 * Runs after Pinia is initialized (default order, no enforce)
 */

import { apiClient } from '@/lib/api/client'
import { useConfigStore } from '@/app/stores/config'

export default defineNuxtPlugin({
  name: 'config-init',
  async setup() {
    const configStore = useConfigStore()

    await configStore.loadConfig()

    if (configStore.isLoaded) {
      apiClient.defaults.timeout = configStore.axiosTimeout
    }

    return {
      provide: {
        configStore,
      },
    }
  },
})
