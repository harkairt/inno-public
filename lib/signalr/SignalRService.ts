import * as signalR from '@microsoft/signalr'
import type { HubConnection } from '@microsoft/signalr'
import type { ConnectionState, SignalRConfig, SignalRConnectionInfo } from './types'

export class SignalRService {
  private static instance: SignalRService
  private connection: HubConnection | null = null
  private config: SignalRConfig
  private eventHandlers = new Map<string, Set<(...args: unknown[]) => void>>()
  private reconnectAttempts = 0
  private lastError: string | null = null

  private constructor(config: SignalRConfig) {
    this.config = config
  }

  /**
   * Get singleton instance
   */
  static getInstance(config?: SignalRConfig): SignalRService {
    if (!SignalRService.instance) {
      if (!config) {
        throw new Error('SignalRService: config required for first initialization')
      }
      SignalRService.instance = new SignalRService(config)
    }
    return SignalRService.instance
  }

  /** Reset the singleton (test isolation). */
  static resetInstance(): void {
    SignalRService.instance = null as unknown as SignalRService
  }

  /** Install a (duck-typed) fake instance for tests. */
  static setInstanceForTests(instance: SignalRService): void {
    SignalRService.instance = instance
  }

  /**
   * Connect to SignalR hub
   */
  async connect(accessToken: string): Promise<void> {
    if (this.connection?.state === signalR.HubConnectionState.Connected) {
      return
    }

    // Stop existing connection if any
    await this.disconnect()

    this.emit('stateChange', 'connecting')

    // Create new connection
    this.connection = new signalR.HubConnectionBuilder()
      .withUrl(this.config.hubUrl, {
        accessTokenFactory: () => accessToken,
        transport:
          signalR.HttpTransportType.WebSockets |
          signalR.HttpTransportType.ServerSentEvents |
          signalR.HttpTransportType.LongPolling,
      })
      .withAutomaticReconnect(this.config.reconnectDelays)
      .configureLogging(signalR.LogLevel.Warning)
      .build()

    this.connection.serverTimeoutInMilliseconds = this.config.serverTimeoutMs ?? 30_000
    this.connection.keepAliveIntervalInMilliseconds = this.config.keepAliveIntervalMs ?? 15_000

    // Setup lifecycle handlers
    this.connection.onreconnecting((error) => {
      this.reconnectAttempts++
      this.lastError = error?.message ?? 'Reconnection failed'
      this.emit('stateChange', 'reconnecting')
    })

    this.connection.onreconnected((connectionId) => {
      this.reconnectAttempts = 0
      this.lastError = null
      this.emit('stateChange', 'connected')
      this.emit('reconnected', connectionId)
    })

    this.connection.onclose((error) => {
      this.lastError = error?.message ?? 'Connection closed'
      this.emit('stateChange', 'disconnected')
      this.emit('closed', error)
    })

    // Re-register all event handlers
    this.registerAllEventHandlers()

    // Start connection with timeout
    try {
      const timeoutMs = this.config.connectionTimeoutMs ?? 15_000
      await Promise.race([
        this.connection.start(),
        new Promise<never>((_, reject) =>
          setTimeout(
            () => reject(new Error(`SignalR connection timed out after ${timeoutMs}ms`)),
            timeoutMs,
          ),
        ),
      ])
      this.reconnectAttempts = 0
      this.lastError = null
      this.emit('stateChange', 'connected')
    } catch (error) {
      await this.connection?.stop().catch(() => {}) // Clean up on timeout/failure
      this.lastError = error instanceof Error ? error.message : 'Connection failed'
      this.emit('stateChange', 'failed')
      throw error
    }
  }

  /**
   * Disconnect from SignalR hub
   */
  async disconnect(): Promise<void> {
    if (this.connection) {
      try {
        await this.connection.stop()
      } catch {
        // Silently ignore disconnect errors
      } finally {
        this.connection = null
        this.emit('stateChange', 'disconnected')
      }
    }
  }

  /**
   * Get current connection state
   */
  getState(): ConnectionState {
    if (!this.connection) return 'disconnected'

    switch (this.connection.state) {
      case signalR.HubConnectionState.Connected:
        return 'connected'
      case signalR.HubConnectionState.Connecting:
        return 'connecting'
      case signalR.HubConnectionState.Reconnecting:
        return 'reconnecting'
      case signalR.HubConnectionState.Disconnected:
        return 'disconnected'
      default:
        return 'failed'
    }
  }

  /**
   * Get connection info
   */
  getConnectionInfo(): SignalRConnectionInfo {
    return {
      state: this.getState(),
      connectionId: this.connection?.connectionId ?? undefined,
      reconnectAttempts: this.reconnectAttempts,
      lastError: this.lastError ?? undefined,
    }
  }

  /**
   * Subscribe to SignalR event
   * Returns unsubscribe function
   */
  on(eventName: string, handler: (...args: unknown[]) => void): () => void {
    // Add to handlers map
    if (!this.eventHandlers.has(eventName)) {
      this.eventHandlers.set(eventName, new Set())
    }
    this.eventHandlers.get(eventName)!.add(handler)

    // Register with connection if connected
    if (this.connection && this.isConnectionReady()) {
      this.connection.on(eventName, handler)
    }

    // Return unsubscribe function
    return () => {
      this.eventHandlers.get(eventName)?.delete(handler)
      if (this.connection) {
        this.connection.off(eventName, handler)
      }
    }
  }

  /**
   * Send message to server
   */
  async invoke<TResult = unknown>(methodName: string, ...args: unknown[]): Promise<TResult> {
    if (this.connection?.state !== signalR.HubConnectionState.Connected) {
      throw new Error('SignalR not connected - cannot invoke method')
    }

    try {
      return await this.connection.invoke<TResult>(methodName, ...args)
    } catch (error) {
      this.lastError = error instanceof Error ? error.message : 'Invoke failed'
      throw error
    }
  }

  /**
   * Send message to server without waiting for response
   */
  async send(methodName: string, ...args: unknown[]): Promise<void> {
    if (this.connection?.state !== signalR.HubConnectionState.Connected) {
      return
    }

    try {
      await this.connection.send(methodName, ...args)
    } catch (error) {
      this.lastError = error instanceof Error ? error.message : 'Send failed'
      throw error
    }
  }

  /**
   * Check if connection is ready for events
   */
  private isConnectionReady(): boolean {
    return (
      this.connection?.state === signalR.HubConnectionState.Connected ||
      this.connection?.state === signalR.HubConnectionState.Connecting ||
      this.connection?.state === signalR.HubConnectionState.Reconnecting
    )
  }

  /**
   * Register all event handlers with current connection
   */
  private registerAllEventHandlers(): void {
    if (!this.connection) return

    for (const [eventName, handlers] of this.eventHandlers.entries()) {
      // Skip internal events that are handled separately
      if (eventName === 'stateChange' || eventName === 'reconnected' || eventName === 'closed') {
        continue
      }

      for (const handler of handlers) {
        this.connection.on(eventName, handler)
      }
    }
  }

  /**
   * Emit internal event to all subscribers
   */
  private emit(eventName: string, ...args: unknown[]) {
    const handlers = this.eventHandlers.get(eventName)
    if (handlers) {
      for (const handler of handlers) {
        try {
          handler(...args)
        } catch {
          // Silently ignore event handler errors
        }
      }
    }
  }

  /**
   * Clear all event handlers
   */
  clearAllEventHandlers(): void {
    this.eventHandlers.clear()
  }

  /**
   * Get the number of event handlers for debugging
   */
  getEventHandlerCount(): number {
    let count = 0
    for (const handlers of this.eventHandlers.values()) {
      count += handlers.size
    }
    return count
  }

  /**
   * Force reconnection
   */
  async forceReconnect(accessToken: string): Promise<void> {
    await this.disconnect()
    await this.connect(accessToken)
  }
}
