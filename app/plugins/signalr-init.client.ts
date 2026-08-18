import type { QueryClient } from '@tanstack/vue-query'
import type { GetUnreadMessagesDTO } from '@/types/api/schemas'
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

    // ReceiveMessage - invalidate queries to trigger refetch.
    // Only sessionId is needed to refetch; agentId is informational, so don't gate the
    // refetch on its type (a backend type drift must not silently drop the event).
    signalr.onEvent('ReceiveMessage', (sessionId: unknown, agentId: unknown) => {
      if (typeof sessionId !== 'string' || !sessionId) {
        if (import.meta.dev) logger.warn('Invalid ReceiveMessage payload:', { sessionId, agentId })
        return
      }

      if (import.meta.dev) logger.debug('New message notification:', { sessionId, agentId })

      const chatStore = useChatStore()
      const isViewingSession = chatStore.activeSessionId === sessionId

      void queryClient.invalidateQueries({
        queryKey: chatQueryKeys.session(sessionId),
      })
      void queryClient.invalidateQueries({
        queryKey: chatQueryKeys.unread(),
        exact: true,
      })
      // Reorders the sidebar: the payload has no timestamp, so modifiedAt must be refetched.
      void queryClient.invalidateQueries({
        queryKey: chatQueryKeys.sessions(),
        exact: true,
      })

      if (isViewingSession) {
        queryClient.setQueryData<GetUnreadMessagesDTO[]>(chatQueryKeys.unread(), (old) =>
          old?.map((entry) =>
            entry.sessionId === sessionId ? { ...entry, unreadMessageCount: 0 } : entry,
          ),
        )
      }
    })

    listenersRegistered = true
    if (import.meta.dev) logger.debug('Chat event listeners registered')
  }

  const signalr = useSignalR()
  const queryClient = nuxtApp.$queryClient as QueryClient

  // Register chat listeners whenever the hub becomes connected — whether from the
  // page-load auto-connect below or a later post-login connect (fresh SPA login,
  // public/iframe auto-login). The `listenersRegistered` guard keeps this idempotent.
  watch(
    () => signalr.isConnected.value,
    (connected) => {
      if (connected) {
        setupChatEventListeners(signalr, queryClient)
      }
    },
    { immediate: true },
  )

  // Connect whenever auth becomes present — covers the page-refresh scenario (auth
  // already restored at setup, via `immediate`) AND fresh in-app login / public-mode
  // auto-login, where auth flips true only after this plugin has run.
  watch(
    () => authStore.isAuthenticated && !!authStore.accessToken,
    (authed) => {
      if (!authed) {
        if (import.meta.dev) logger.debug('No authenticated user, skipping auto-connect')
        return
      }

      if (import.meta.dev) logger.debug('User authenticated, initializing connection...')

      // Small delay to ensure all stores and plugins are fully initialized
      setTimeout(() => {
        void (async () => {
          try {
            await signalr.connect(authStore.accessToken ?? undefined)
            if (signalr.isConnected.value) {
              setupChatEventListeners(signalr, queryClient)
            }
            if (import.meta.dev) logger.debug('Auto-connected on app initialization')
          } catch (error) {
            if (import.meta.dev) logger.error('Failed to auto-connect:', error)
          }
        })()
      }, 500)
    },
    { immediate: true },
  )
})
