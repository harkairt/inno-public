import { ref, computed, onUnmounted, readonly, type Ref } from 'vue'
import { SignalRService } from '@/lib/signalr/SignalRService'
import { SignalROperations } from '@/lib/signalr/SignalROperations'
import type { ConnectionState, SignalRConnectionInfo } from '@/lib/signalr/types'
import { useAuthStore } from '@/app/stores/auth'

export function useSignalR() {
  const config = useRuntimeConfig()

  // Get SignalR hub URL - use relative path in dev, full URL in production
  const getSignalRHubUrl = (): string => {
    if (import.meta.dev) {
      return '/chatHub' // Relative URL proxied by Nitro in dev
    }

    // In production, use the API base URL (Netlify proxy)
    const apiBaseUrl = config.public.apiBaseUrl
    return `${apiBaseUrl}/chatHub`
  }

  const service = SignalRService.getInstance({
    hubUrl: getSignalRHubUrl(),
    automaticReconnect: true,
    reconnectDelays: [0, 1000, 2000, 5000, 10000],  // Exponential backoff
  })

  // Operations for hub method invocations
  const operations = new SignalROperations(service)

  // Reactive state
  const state: Ref<ConnectionState> = ref(service.getState())
  const connectionInfo: Ref<SignalRConnectionInfo> = ref(service.getConnectionInfo())

  // Computed properties
  const isConnected = computed(() => state.value === 'connected')
  const isConnecting = computed(() => state.value === 'connecting')
  const isReconnecting = computed(() => state.value === 'reconnecting')
  const isDisconnected = computed(() => state.value === 'disconnected')
  const hasError = computed(() => state.value === 'failed' || !!connectionInfo.value.lastError)
  const reconnectAttempts = computed(() => connectionInfo.value.reconnectAttempts)
  const lastError = computed(() => connectionInfo.value.lastError)
  const connectionId = computed(() => connectionInfo.value.connectionId)

  // Subscribe to state changes
  const unsubscribeStateChange = service.on('stateChange', (...args: unknown[]) => {
    const newState = args[0] as unknown as ConnectionState
    state.value = newState

    connectionInfo.value = service.getConnectionInfo()
  })

  const unsubscribeReconnected = service.on('reconnected', () => {
    connectionInfo.value = service.getConnectionInfo()
  })

  const unsubscribeClosed = service.on('closed', () => {
    connectionInfo.value = service.getConnectionInfo()
  })

  // Cleanup on unmount
  onUnmounted(() => {
    unsubscribeStateChange()
    unsubscribeReconnected()
    unsubscribeClosed()
  })

  /**
   * Connect to SignalR hub
   * Failures are silently handled - SignalR is optional (app uses HTTP polling as fallback)
   */
  async function connect(accessToken?: string): Promise<void> {
    const authStore = useAuthStore()

    try {
      // Get token from auth store if not provided
      const token = accessToken ?? authStore.accessToken ?? ''

      if (!token) {
        return // Silent fail - app works without SignalR
      }

      await service.connect(token)
      connectionInfo.value = service.getConnectionInfo()
    } catch {
      // Silent fail - SignalR is for real-time updates only, app uses HTTP polling as fallback
      connectionInfo.value = service.getConnectionInfo()
    }
  }

  /**
   * Disconnect from SignalR hub
   */
  async function disconnect(): Promise<void> {
    try {
      await service.disconnect()
      connectionInfo.value = service.getConnectionInfo()
    } catch (error) {
      connectionInfo.value = service.getConnectionInfo()
      throw error
    }
  }

  /**
   * Force reconnection
   * Failures are silently handled - SignalR is optional
   */
  async function forceReconnect(accessToken?: string): Promise<void> {
    const authStore = useAuthStore()

    try {
      const token = accessToken ?? authStore.accessToken ?? ''

      if (!token) {
        return // Silent fail
      }

      await service.forceReconnect(token)
      connectionInfo.value = service.getConnectionInfo()
    } catch {
      // Silent fail - app works without SignalR
      connectionInfo.value = service.getConnectionInfo()
    }
  }

  /**
   * Subscribe to SignalR event with automatic cleanup
   */
  function onEvent<T extends readonly unknown[] = readonly unknown[]>(
    eventName: string,
    handler: (...args: T) => void
  ): () => void {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- SignalR handler requires flexible typing
    return service.on(eventName, handler as (...args: any[]) => void)
  }

  /**
   * Invoke server method
   */
  async function invoke<TResult = unknown>(methodName: string, ...args: unknown[]): Promise<TResult> {
    return await service.invoke(methodName, ...args)
  }

  /**
   * Send message to server without waiting for response
   */
  function send(methodName: string, ...args: unknown[]): void {
    service.send(methodName, ...args)
  }

  /**
   * Check if service is ready for operations
   */
  function isReady(): boolean {
    return isConnected.value
  }

  /**
   * Get service instance for advanced usage
   */
  function getService(): SignalRService {
    return service
  }

  return {
    // State (readonly for external consumers)
    state: readonly(state),
    connectionInfo: readonly(connectionInfo),
    isConnected,
    isConnecting,
    isReconnecting,
    isDisconnected,
    hasError,
    reconnectAttempts,
    lastError,
    connectionId,

    // Methods
    connect,
    disconnect,
    forceReconnect,
    onEvent,
    invoke,
    send,
    isReady,
    getService,

    // Hub operations
    operations,
  }
}

/**
 * SignalR connection monitoring composable
 * Useful for showing connection status in UI
 */
export function useSignalRConnectionMonitor() {
  const signalr = useSignalR()

  const statusMessage = computed(() => {
    switch (signalr.state.value) {
      case 'connected':
        return 'Connected'
      case 'connecting':
        return 'Connecting...'
      case 'reconnecting':
        return `Reconnecting... (attempt ${signalr.reconnectAttempts.value})`
      case 'disconnected':
        return 'Disconnected'
      case 'failed':
        return signalr.lastError.value ?? 'Connection failed'
      default:
        return 'Unknown status'
    }
  })

  const statusColor = computed(() => {
    switch (signalr.state.value) {
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

  const canShowContent = computed(() => {
    return signalr.isConnected.value || signalr.isConnecting.value
  })

  return {
    ...signalr,
    statusMessage,
    statusColor,
    canShowContent,
  }
}