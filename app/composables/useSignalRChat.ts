import { onMounted, onUnmounted, computed, watch } from 'vue'
import { useSignalR } from './useSignalR'
import { useChatStore } from '@/app/stores/chat'
import { useAuthStore } from '@/app/stores/auth'
import { useQueryClient } from '@tanstack/vue-query'
import { chatQueryKeys } from './useChatQueries'
import type { Message } from '@/types/domain/models'

// SignalR event types for chat
interface _ChatSignalREvents {
  ReceiveMessage: [sessionId: string, agentId: number]
  UserJoined: [{ sessionId: string; userCode: string; userName: string }]
  UserLeft: [{ sessionId: string; userCode: string; userName: string }]
  UserTyping: [{ sessionId: string; userCode: string; userName: string }]
  UserStoppedTyping: [{ sessionId: string; userCode: string; userName: string }]
  MessageRead: [{ sessionId: string; messageId: string; userCode: string }]
  MessageUpdated: [{ sessionId: string; messageId: string; updates: Partial<Message> }]
  SessionUpdated: [{ sessionId: string; updates: Record<string, unknown> }]
  UnreadCountUpdated: [{ sessionId: string; count: number }]
}

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
  const queryClient = useQueryClient()

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

    // User joined session
    const unsubscribeUserJoined = signalr.onEvent('UserJoined', (data: {
      sessionId: string
      userCode: string
      userName: string
    }) => {
      console.log('👋 User joined session:', data)

      // Invalidate session data (will refetch with updated member list)
      queryClient.invalidateQueries({
        queryKey: chatQueryKeys.session(data.sessionId),
      })
    })

    // User left session
    const unsubscribeUserLeft = signalr.onEvent('UserLeft', (data: {
      sessionId: string
      userCode: string
      userName: string
    }) => {
      console.log('👋 User left session:', data)

      // Invalidate session data (will refetch with updated member list)
      queryClient.invalidateQueries({
        queryKey: chatQueryKeys.session(data.sessionId),
      })
    })

    // User is typing
    const unsubscribeUserTyping = signalr.onEvent('UserTyping', (data: {
      sessionId: string
      userCode: string
      userName: string
    }) => {
      console.log('⌨️  User typing:', data)

      // Don't show typing indicator for current user
      if (data.userCode !== authStore.user?.email) {
        chatStore.addTypingUser(data.sessionId, data.userName)
      }
    })

    // User stopped typing
    const unsubscribeUserStoppedTyping = signalr.onEvent('UserStoppedTyping', (data: {
      sessionId: string
      userCode: string
      userName: string
    }) => {
      console.log('⌨️  User stopped typing:', data)

      // Remove typing indicator for this user
      chatStore.removeTypingUser(data.sessionId, data.userName)
    })

    // Message read status updated
    const unsubscribeMessageRead = signalr.onEvent('MessageRead', (data: {
      sessionId: string
      messageId: string
      userCode: string
    }) => {
      console.log('📖 Message read:', data)

      // Invalidate queries (will refetch with updated read status and unread count)
      queryClient.invalidateQueries({
        queryKey: chatQueryKeys.messages(data.sessionId),
      })
      queryClient.invalidateQueries({
        queryKey: chatQueryKeys.unread(),
      })
    })

    // Message updated
    const unsubscribeMessageUpdated = signalr.onEvent('MessageUpdated', (data: {
      sessionId: string
      messageId: string
      updates: Partial<Message>
    }) => {
      console.log('✏️  Message updated:', data)

      // Invalidate queries (will refetch with updated message)
      queryClient.invalidateQueries({
        queryKey: chatQueryKeys.messages(data.sessionId),
      })
    })

    // Session updated
    const unsubscribeSessionUpdated = signalr.onEvent('SessionUpdated', (data: {
      sessionId: string
      updates: Record<string, unknown>
    }) => {
      console.log('🔄 Session updated:', data)

      // Invalidate queries (will refetch with updated session data)
      queryClient.invalidateQueries({
        queryKey: chatQueryKeys.session(data.sessionId),
      })
      queryClient.invalidateQueries({
        queryKey: chatQueryKeys.sessions(),
      })
    })

    // Unread count updated
    const unsubscribeUnreadCountUpdated = signalr.onEvent('UnreadCountUpdated', (data: {
      sessionId: string
      count: number
    }) => {
      console.log('🔔 Unread count updated:', data)

      // Invalidate queries (will refetch with updated unread count)
      queryClient.invalidateQueries({
        queryKey: chatQueryKeys.unread(),
      })
    })

    // Store unsubscribe functions for cleanup
    unsubscribers.push(
      unsubscribeUserJoined,
      unsubscribeUserLeft,
      unsubscribeUserTyping,
      unsubscribeUserStoppedTyping,
      unsubscribeMessageRead,
      unsubscribeMessageUpdated,
      unsubscribeSessionUpdated,
      unsubscribeUnreadCountUpdated
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

  // Auto-reconnect when SignalR reconnects
  watch(
    () => signalr.isConnected.value,
    async (connected) => {
      if (connected && authStore.isAuthenticated && unsubscribers.length === 0) {
        setupEventListeners()
      } else if (!connected) {
        cleanupEventListeners()
      }
    }
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
  const sendTypingIndicator = (sessionId: string) => {
    if (signalr.isReady()) {
      signalr.send('UserTyping', { sessionId })
    }
  }

  // Send stopped typing indicator
  const sendStoppedTypingIndicator = (sessionId: string) => {
    if (signalr.isReady()) {
      signalr.send('UserStoppedTyping', { sessionId })
    }
  }

  // Mark message as read
  const markMessageAsRead = (sessionId: string, messageId: string) => {
    if (signalr.isReady()) {
      signalr.send('MarkMessageRead', { sessionId, messageId })
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
    markMessageAsRead,

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