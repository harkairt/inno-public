import { ref, readonly, watch, type Ref } from 'vue'

// Type for the useRegisterSW return value
interface RegisterSWResult {
  needRefresh: Ref<boolean>
  offlineReady: Ref<boolean>
  updateServiceWorker: (reloadPage?: boolean) => Promise<void>
}

const needRefresh = ref(false)
const offlineReady = ref(false)
let updateSW: ((reloadPage?: boolean) => Promise<void>) | undefined

// Track if we've already initialized
let initialized = false

/**
 * Composable for handling PWA updates
 * Uses @vite-pwa/nuxt's virtual module to detect when a new service worker is available
 */
export function usePWAUpdate() {
  // Initialize only once and only on client
  if (import.meta.client && !initialized) {
    initialized = true

    // Dynamic import to avoid SSR issues with virtual module
    import('virtual:pwa-register/vue').then(({ useRegisterSW }) => {
      const { needRefresh: nr, offlineReady: or, updateServiceWorker } = useRegisterSW({
        immediate: true,
        onRegisteredSW(_swUrl, registration) {
          // Check for updates periodically (every 10 minutes)
          if (registration) {
            setInterval(() => {
              registration.update()
            }, 10 * 60 * 1000)
          }
        },
        onRegisterError(_error) {
          // Silently ignore SW registration errors
        }
      }) as RegisterSWResult

      // Sync the refs
      watch(nr, (value) => {
        needRefresh.value = value
      }, { immediate: true })

      watch(or, (value) => {
        offlineReady.value = value
      }, { immediate: true })

      updateSW = updateServiceWorker
    }).catch(() => {
      // Silently ignore PWA module load errors
    })
  }

  /**
   * Apply the update and reload the page
   */
  const applyUpdate = async () => {
    if (updateSW) {
      await updateSW(true)
    }
  }

  return {
    /** True when a new version is available and waiting */
    needRefresh: readonly(needRefresh),
    /** True when the app is ready for offline use */
    offlineReady: readonly(offlineReady),
    /** Apply the pending update and reload */
    applyUpdate
  }
}
