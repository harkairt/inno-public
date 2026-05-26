import type { QueryClient } from '@tanstack/vue-query'
import { chatQueryKeys } from '@/app/composables/useChatQueries'
import { createLogger } from '@/lib/utils/logger'

const logger = createLogger('SignalR')

export default defineNuxtPlugin(async (nuxtApp) => {
  const authStore = useAuthStore()

  // Track if listeners are already registered to prevent duplicates
  let listenersRegistered = false

  // Function to setup chat event listeners
  const setupChatEventListeners = (
    signalr: ReturnType<typeof useSignalR>,
    queryClient: QueryClient,
  ) => {
    if (listenersRegistered) {
      if (import.meta.dev) logger.debug('Chat event listeners already registered, skipping')
      return
    }

    // ReceiveMessage - invalidate queries to trigger refetch
    signalr.onEvent('ReceiveMessage', (sessionId: unknown, agentId: unknown) => {
      if (typeof sessionId !== 'string' || typeof agentId !== 'number') {
        if (import.meta.dev) logger.warn('Invalid ReceiveMessage payload:', { sessionId, agentId })
        return
      }

      if (import.meta.dev) logger.debug('New message notification:', { sessionId, agentId })

      void queryClient.invalidateQueries({
        queryKey: chatQueryKeys.session(sessionId),
      })
      void queryClient.invalidateQueries({
        queryKey: chatQueryKeys.unread(),
        exact: true,
      })
    })

    listenersRegistered = true
    if (import.meta.dev) logger.debug('Chat event listeners registered')
  }

  // Auto-connect if user is already authenticated (page refresh scenario)
  if (authStore.isAuthenticated && authStore.accessToken) {
    if (import.meta.dev) logger.debug('User authenticated on app load, initializing connection...')

    // Small delay to ensure all stores and plugins are fully initialized
    setTimeout(() => {
      void (async () => {
        try {
          const signalr = useSignalR()
          const queryClient = nuxtApp.$queryClient as QueryClient

          await signalr.connect(authStore.accessToken ?? undefined)

          if (signalr.isConnected.value) {
            setupChatEventListeners(signalr, queryClient)
          }

          watch(
            () => signalr.isConnected.value,
            (connected) => {
              if (connected) {
                setupChatEventListeners(signalr, queryClient)
              }
            },
          )

          if (import.meta.dev) logger.debug('Auto-connected on app initialization')
        } catch (error) {
          if (import.meta.dev) logger.error('Failed to auto-connect on app load:', error)
        }
      })()
    }, 500)
  } else {
    if (import.meta.dev) logger.debug('No authenticated user on app load, skipping auto-connect')
  }
})
