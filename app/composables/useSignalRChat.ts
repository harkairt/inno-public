import { onUnmounted, computed, watch } from 'vue'
import { useSignalR } from './useSignalR'
import { useChatStore } from '@/app/stores/chat'
import { useAuthStore } from '@/app/stores/auth'

// --- useSignalRChat helpers ---

function setupTypingEventListeners(
  signalr: ReturnType<typeof useSignalR>,
  chatStore: ReturnType<typeof useChatStore>,
  authStore: ReturnType<typeof useAuthStore>,
  unsubscribers: Array<() => void>,
): void {
  if (!signalr.isReady()) return

  const unsubscribeStartTyping = signalr.onEvent(
    'SendStartTypingInfo',
    (name: string, email: string, sessionId: string) => {
      if (email !== authStore.user?.email) {
        chatStore.addTypingUser(sessionId, name)
      }
    },
  )

  const unsubscribeStopTyping = signalr.onEvent(
    'SendStopTypingInfo',
    (name: string, _email: string, sessionId: string) => {
      chatStore.removeTypingUser(sessionId, name)
    },
  )

  unsubscribers.push(unsubscribeStartTyping, unsubscribeStopTyping)
}

function cleanupEventListeners(unsubscribers: Array<() => void>): void {
  unsubscribers.forEach((unsubscribe) => unsubscribe())
  unsubscribers.length = 0
}

interface SignalRWatcherOptions {
  signalr: ReturnType<typeof useSignalR>
  authStore: ReturnType<typeof useAuthStore>
  chatStore: ReturnType<typeof useChatStore>
  unsubscribers: Array<() => void>
  connect: () => Promise<void>
  disconnect: () => Promise<void>
  autoConnect: boolean
}

function setupSignalRWatchers(options: SignalRWatcherOptions): void {
  const { signalr, authStore, chatStore, unsubscribers, connect, disconnect, autoConnect } = options
  watch(
    () => authStore.isAuthenticated,
    async (isAuthenticated) => {
      if (isAuthenticated && autoConnect) {
        await connect()
      } else if (!isAuthenticated) {
        await disconnect()
      }
    },
  )

  watch(
    () => authStore.accessToken,
    async (newToken, oldToken) => {
      if (newToken && oldToken && newToken !== oldToken && signalr.isConnected.value) {
        try {
          await signalr.forceReconnect(newToken)
        } catch {
          // Silent fail - app works without SignalR
        }
      }
    },
  )

  watch(
    () => signalr.isConnected.value,
    (connected) => {
      if (connected && authStore.isAuthenticated && unsubscribers.length === 0) {
        setupTypingEventListeners(signalr, chatStore, authStore, unsubscribers)
      } else if (!connected) {
        cleanupEventListeners(unsubscribers)
      }
    },
    { immediate: true },
  )
}

/**
 * SignalR chat integration composable
 * Integrates SignalR real-time events with Vue Query state management
 */
export function useSignalRChat(options?: { autoConnect?: boolean; reconnectOnAuth?: boolean }) {
  const signalr = useSignalR()
  const chatStore = useChatStore()
  const authStore = useAuthStore()
  const unsubscribers: Array<() => void> = []

  const isConnected = computed(() => signalr.isConnected.value)
  const isConnecting = computed(() => signalr.isConnecting.value)
  const isReconnecting = computed(() => signalr.isReconnecting.value)
  const connectionStatus = computed(() => signalr.state.value)

  const connect = async () => {
    if (!authStore.isAuthenticated || !authStore.user) return
    if (isConnected.value || isConnecting.value) return

    try {
      const token = authStore.accessToken
      if (!token) return
      await signalr.connect(token)
    } catch {
      // Silent fail - app works via HTTP polling
    }
  }

  const disconnect = async () => {
    try {
      await signalr.disconnect()
    } catch {
      // Silently ignore disconnect errors
    }
  }

  setupSignalRWatchers({
    signalr,
    authStore,
    chatStore,
    unsubscribers,
    connect,
    disconnect,
    autoConnect: options?.autoConnect ?? true,
  })

  onUnmounted(async () => {
    cleanupEventListeners(unsubscribers)
    await disconnect()
  })

  const sendTypingIndicator = (sessionId: string, memberEmails: string[]) => {
    if (signalr.isReady() && authStore.user?.email && authStore.user?.name) {
      signalr.operations.sendStartTypingInfo(
        memberEmails,
        authStore.user.name,
        authStore.user.email,
        sessionId,
      )
    }
  }

  const sendStoppedTypingIndicator = (sessionId: string, memberEmails: string[]) => {
    if (signalr.isReady() && authStore.user?.email && authStore.user?.name) {
      signalr.operations.sendStopTypingInfo(
        memberEmails,
        authStore.user.name,
        authStore.user.email,
        sessionId,
      )
    }
  }

  return {
    isConnected,
    isConnecting,
    isReconnecting,
    connectionStatus,
    connect,
    disconnect,
    sendTypingIndicator,
    sendStoppedTypingIndicator,
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
        return signalr.signalr.lastError.value ?? 'Connection failed'
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
    return (
      signalr.connectionStatus.value === 'disconnected' ||
      signalr.connectionStatus.value === 'failed'
    )
  })

  return {
    ...signalr,
    statusMessage,
    statusColor,
    canInteract,
    showReconnectButton,
  }
}
