import { onMounted, onUnmounted, computed, watch } from 'vue'
import { useSignalR } from './useSignalR'
import { useChatStore } from '@/app/stores/chat'
import { useAuthStore } from '@/app/stores/auth'

/**
 * SignalR chat integration composable
 * Integrates SignalR real-time events with Vue Query state management
 */
export function useSignalRChat(options?: {
  autoConnect?: boolean
  reconnectOnAuth?: boolean
}) {
  const signalr = useSignalR()
  const chatStore = useChatStore()
  const authStore = useAuthStore()

  // Store unsubscribe functions for cleanup
  const unsubscribers: Array<() => void> = []

  // Computed properties
  const isConnected = computed(() => signalr.isConnected.value)
  const isConnecting = computed(() => signalr.isConnecting.value)
  const isReconnecting = computed(() => signalr.isReconnecting.value)
  const connectionStatus = computed(() => signalr.state.value)

  // Connect to SignalR when user is authenticated
  // Failures are silently handled - SignalR is optional for basic functionality
  const connect = async () => {
    if (!authStore.isAuthenticated || !authStore.user) {
      console.warn('Cannot connect to SignalR: User not authenticated')
      return
    }

    if (isConnected.value || isConnecting.value) {
      console.log('SignalR already connected or connecting')
      return
    }

    try {
      // Get fresh access token from auth store
      const token = authStore.accessToken

      if (!token) {
        console.warn('Cannot connect to SignalR: No access token available')
        return // Silent fail - app works without SignalR
      }

      console.log('🔗 Connecting to SignalR with JWT token...')
      await signalr.connect(token)
      console.log('✅ SignalR chat connected')
    } catch (error) {
      // Silent fail - SignalR is for real-time updates only
      // App still works via HTTP polling
      console.warn('SignalR connection failed (app will use polling):', error)
    }
  }

  // Disconnect from SignalR
  const disconnect = async () => {
    try {
      await signalr.disconnect()
      console.log('✅ SignalR chat disconnected')
    } catch (error) {
      console.error('❌ Failed to disconnect from SignalR chat:', error)
    }
  }

  // Setup event listeners
  const setupEventListeners = () => {
    if (!signalr.isReady()) {
      console.warn('SignalR not ready, cannot setup event listeners')
      return
    }

    // Note: ReceiveMessage handler is in signalr-init.client.ts plugin (centralized)

    // User started typing
    const unsubscribeStartTyping = signalr.onEvent('SendStartTypingInfo', (name: string, email: string, sessionId: string) => {
      console.log('⌨️  User started typing:', { name, email, sessionId })

      // Don't show typing indicator for current user
      if (email !== authStore.user?.email) {
        chatStore.addTypingUser(sessionId, name)
      }
    })

    // User stopped typing
    const unsubscribeStopTyping = signalr.onEvent('SendStopTypingInfo', (name: string, email: string, sessionId: string) => {
      console.log('⌨️  User stopped typing:', { name, email, sessionId })

      // Remove typing indicator for this user
      chatStore.removeTypingUser(sessionId, name)
    })

    // Store unsubscribe functions for cleanup
    unsubscribers.push(
      unsubscribeStartTyping,
      unsubscribeStopTyping
    )
  }

  // Cleanup event listeners
  const cleanupEventListeners = () => {
    unsubscribers.forEach(unsubscribe => unsubscribe())
    unsubscribers.length = 0
  }

  // Auto-connect when authentication state changes
  watch(
    () => authStore.isAuthenticated,
    async (isAuthenticated) => {
      if (isAuthenticated && (options?.autoConnect ?? true)) {
        await connect()
      } else if (!isAuthenticated) {
        await disconnect()
      }
    },
    { immediate: true }
  )

  // Watch for token refresh and reconnect
  watch(
    () => authStore.accessToken,
    async (newToken, oldToken) => {
      // Only reconnect if:
      // 1. Token actually changed (not just initial load)
      // 2. Both old and new tokens exist (not logout)
      // 3. We're currently connected
      if (newToken && oldToken && newToken !== oldToken && isConnected.value) {
        console.log('🔄 Access token refreshed, reconnecting SignalR with new token...')
        try {
          await signalr.forceReconnect(newToken)
          console.log('✅ SignalR reconnected with new token')
        } catch (error) {
          // Silent fail - app works without SignalR
          console.warn('SignalR reconnect failed (app will use polling):', error)
        }
      }
    }
  )

  // Setup event listeners when connected (immediate: true to handle already-connected state)
  watch(
    () => signalr.isConnected.value,
    async (connected) => {
      if (connected && authStore.isAuthenticated && unsubscribers.length === 0) {
        setupEventListeners()
      } else if (!connected) {
        cleanupEventListeners()
      }
    },
    { immediate: true }
  )

  // Lifecycle management
  onMounted(async () => {
    if (authStore.isAuthenticated && (options?.autoConnect ?? true)) {
      await connect()
    }
  })

  onUnmounted(async () => {
    cleanupEventListeners()
    await disconnect()
  })

  // Send typing indicator
  const sendTypingIndicator = (sessionId: string, memberEmails: string[]) => {
    if (signalr.isReady() && authStore.user?.email && authStore.user?.name) {
      signalr.operations.sendStartTypingInfo(
        memberEmails,
        authStore.user.name,
        authStore.user.email,
        sessionId
      )
    }
  }

  // Send stopped typing indicator
  const sendStoppedTypingIndicator = (sessionId: string, memberEmails: string[]) => {
    if (signalr.isReady() && authStore.user?.email && authStore.user?.name) {
      signalr.operations.sendStopTypingInfo(
        memberEmails,
        authStore.user.name,
        authStore.user.email,
        sessionId
      )
    }
  }

  return {
    // Connection state
    isConnected,
    isConnecting,
    isReconnecting,
    connectionStatus,

    // Connection methods
    connect,
    disconnect,

    // Event interaction methods
    sendTypingIndicator,
    sendStoppedTypingIndicator,

    // Access to underlying signalr composable
    signalr,
  }
}

/**
 * SignalR connection monitoring composable for chat
 * Provides chat-specific connection status and user-friendly messages
 */
export function useSignalRChatMonitor() {
  const signalr = useSignalRChat()

  const statusMessage = computed(() => {
    switch (signalr.connectionStatus.value) {
      case 'connected':
        return 'Connected'
      case 'connecting':
        return 'Connecting to chat...'
      case 'reconnecting':
        return `Reconnecting... (attempt ${signalr.signalr.reconnectAttempts.value})`
      case 'disconnected':
        return 'Disconnected from chat'
      case 'failed':
        return signalr.signalr.lastError.value || 'Connection failed'
      default:
        return 'Unknown status'
    }
  })

  const statusColor = computed(() => {
    switch (signalr.connectionStatus.value) {
      case 'connected':
        return 'text-green-500'
      case 'connecting':
      case 'reconnecting':
        return 'text-yellow-500'
      case 'disconnected':
        return 'text-gray-500'
      case 'failed':
        return 'text-red-500'
      default:
        return 'text-gray-500'
    }
  })

  const canInteract = computed(() => {
    return signalr.isConnected.value || signalr.isConnecting.value
  })

  const showReconnectButton = computed(() => {
    return signalr.connectionStatus.value === 'disconnected' || signalr.connectionStatus.value === 'failed'
  })

  return {
    ...signalr,
    statusMessage,
    statusColor,
    canInteract,
    showReconnectButton,
  }
}