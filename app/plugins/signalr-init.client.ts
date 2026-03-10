import type { QueryClient } from '@tanstack/vue-query'
import { chatQueryKeys } from '@/app/composables/useChatQueries'

export default defineNuxtPlugin(async (nuxtApp) => {
  const authStore = useAuthStore()

  // Track if listeners are already registered to prevent duplicates
  let listenersRegistered = false

  // Function to setup chat event listeners
  const setupChatEventListeners = (signalr: ReturnType<typeof useSignalR>, queryClient: QueryClient) => {
    if (listenersRegistered) {
      if (import.meta.dev) console.log('SignalR chat event listeners already registered, skipping')
      return
    }

    // ReceiveMessage - invalidate queries to trigger refetch
    signalr.onEvent('ReceiveMessage', (sessionId: unknown, agentId: unknown) => {
      if (typeof sessionId !== 'string' || typeof agentId !== 'number') {
        if (import.meta.dev) console.warn('Invalid ReceiveMessage payload:', { sessionId, agentId })
        return
      }

      if (import.meta.dev) console.log('New message notification:', { sessionId, agentId })

      queryClient.invalidateQueries({
        queryKey: chatQueryKeys.session(sessionId),
      })
      queryClient.invalidateQueries({
        queryKey: chatQueryKeys.sessions(),
        exact: true,
      })
      queryClient.invalidateQueries({
        queryKey: chatQueryKeys.unread(),
        exact: true,
      })
    })

    listenersRegistered = true
    if (import.meta.dev) console.log('SignalR chat event listeners registered')
  }

  // Auto-connect if user is already authenticated (page refresh scenario)
  if (authStore.isAuthenticated && authStore.accessToken) {
    if (import.meta.dev) console.log('User authenticated on app load, initializing SignalR connection...')

    // Small delay to ensure all stores and plugins are fully initialized
    setTimeout(async () => {
      try {
        const signalr = useSignalR()
        // Get queryClient from nuxtApp (provided by vue-query.client.ts plugin)
        const queryClient = nuxtApp.$queryClient as QueryClient

        await signalr.connect(authStore.accessToken ?? undefined)

        // Setup event listeners after connection
        if (signalr.isConnected.value) {
          setupChatEventListeners(signalr, queryClient)
        }

        // Also setup listeners when reconnecting
        watch(() => signalr.isConnected.value, (connected) => {
          if (connected) {
            setupChatEventListeners(signalr, queryClient)
          }
        })

        if (import.meta.dev) console.log('SignalR auto-connected on app initialization')
      } catch (error) {
        if (import.meta.dev) console.error('Failed to auto-connect SignalR on app load:', error)
        // Don't throw - SignalR is not critical for app initialization
      }
    }, 500)
  } else {
    if (import.meta.dev) console.log('No authenticated user on app load, skipping SignalR auto-connect')
  }
})