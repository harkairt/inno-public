import { ref, computed, getCurrentInstance, onUnmounted, readonly, type Ref } from 'vue'
import { SignalRService } from '@/lib/signalr/SignalRService'
import { SignalROperations } from '@/lib/signalr/SignalROperations'
import type { ConnectionState, SignalRConnectionInfo } from '@/lib/signalr/types'
import { useAuthStore } from '@/app/stores/auth'

function getSignalRHubUrl(config: ReturnType<typeof useRuntimeConfig>): string {
  if (import.meta.dev) {
    return '/chatHub' // Relative URL proxied by Nitro in dev
  }

  // In production, use the API base URL (Netlify proxy)
  const apiBaseUrl = config.public.apiBaseUrl
  return `${apiBaseUrl}/chatHub`
}

function createReactiveState(service: SignalRService) {
  const state: Ref<ConnectionState> = ref(service.getState())
  const connectionInfo: Ref<SignalRConnectionInfo> = ref(service.getConnectionInfo())

  const isConnected = computed(() => state.value === 'connected')
  const isConnecting = computed(() => state.value === 'connecting')
  const isReconnecting = computed(() => state.value === 'reconnecting')
  const isDisconnected = computed(() => state.value === 'disconnected')
  const hasError = computed(() => state.value === 'failed' || !!connectionInfo.value.lastError)
  const reconnectAttempts = computed(() => connectionInfo.value.reconnectAttempts)
  const lastError = computed(() => connectionInfo.value.lastError)
  const connectionId = computed(() => connectionInfo.value.connectionId)

  return {
    state,
    connectionInfo,
    isConnected,
    isConnecting,
    isReconnecting,
    isDisconnected,
    hasError,
    reconnectAttempts,
    lastError,
    connectionId,
  }
}

function subscribeToStateChanges(
  service: SignalRService,
  state: Ref<ConnectionState>,
  connectionInfo: Ref<SignalRConnectionInfo>,
) {
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

  return { unsubscribeStateChange, unsubscribeReconnected, unsubscribeClosed }
}

export function useSignalR() {
  const config = useRuntimeConfig()

  const service = SignalRService.getInstance({
    hubUrl: getSignalRHubUrl(config),
    automaticReconnect: true,
    reconnectDelays: [0, 1000, 2000, 5000, 10000], // Exponential backoff
  })

  const operations = new SignalROperations(service)
  const reactiveState = createReactiveState(service)
  const { state, connectionInfo, isConnected } = reactiveState

  const subs = subscribeToStateChanges(service, state, connectionInfo)

  if (getCurrentInstance()) {
    onUnmounted(() => {
      subs.unsubscribeStateChange()
      subs.unsubscribeReconnected()
      subs.unsubscribeClosed()
    })
  }

  async function connect(accessToken?: string): Promise<void> {
    const authStore = useAuthStore()
    try {
      const token = accessToken ?? authStore.accessToken ?? ''
      if (!token) return
      await service.connect(token)
      connectionInfo.value = service.getConnectionInfo()
    } catch {
      connectionInfo.value = service.getConnectionInfo()
    }
  }

  async function disconnect(): Promise<void> {
    try {
      await service.disconnect()
      connectionInfo.value = service.getConnectionInfo()
    } catch (error) {
      connectionInfo.value = service.getConnectionInfo()
      throw error
    }
  }

  async function forceReconnect(accessToken?: string): Promise<void> {
    const authStore = useAuthStore()
    try {
      const token = accessToken ?? authStore.accessToken ?? ''
      if (!token) return
      await service.forceReconnect(token)
      connectionInfo.value = service.getConnectionInfo()
    } catch {
      connectionInfo.value = service.getConnectionInfo()
    }
  }

  function onEvent<T extends readonly unknown[] = readonly unknown[]>(
    eventName: string,
    handler: (...args: T) => void,
  ): () => void {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- SignalR handler requires flexible typing
    return service.on(eventName, handler as (...args: any[]) => void)
  }

  async function invoke<TResult = unknown>(
    methodName: string,
    ...args: unknown[]
  ): Promise<TResult> {
    return await service.invoke(methodName, ...args)
  }

  function send(methodName: string, ...args: unknown[]): void {
    void service.send(methodName, ...args)
  }

  const { state: _state, connectionInfo: _connInfo, ...derivedState } = reactiveState

  return {
    state: readonly(state),
    connectionInfo: readonly(connectionInfo),
    ...derivedState,
    connect,
    disconnect,
    forceReconnect,
    onEvent,
    invoke,
    send,
    isReady: (): boolean => isConnected.value,
    getService: (): SignalRService => service,
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
