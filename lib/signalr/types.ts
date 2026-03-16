export type ConnectionState =
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'failed'

export interface SignalRConfig {
  hubUrl: string
  automaticReconnect: boolean
  reconnectDelays: number[]  // ms delays between reconnect attempts
}

export interface SignalRMessage {
  type: string
  payload: unknown
}

export interface SignalREventHandlers {
  stateChange?: (...args: unknown[]) => void
  reconnected?: (...args: unknown[]) => void
  closed?: (...args: unknown[]) => void
  [key: string]: ((...args: unknown[]) => void) | undefined
}

export interface SignalRConnectionInfo {
  state: ConnectionState
  connectionId?: string
  reconnectAttempts: number
  lastError?: string
}

/**
 * SignalR event registry for type-safe event handlers
 * Add new events here as they are implemented on the backend
 *
 * Usage:
 * - Provides autocomplete for event names
 * - Type-checks event handler parameters
 * - Documents all available SignalR events
 */
export interface SignalREventRegistry {
  // ========================================
  // Chat Events
  // ========================================

  /**
   * Fired when a new message is received in a session
   * @param sessionId - UUID of the session that received a message
   * @param agentId - ID of the agent that sent the message
   */
  ReceiveMessage: [sessionId: string, agentId: number]

  /**
   * Fired when a user starts typing
   * @param name - Name of the user who started typing
   * @param email - Email of the user who started typing
   * @param sessionId - UUID of the session
   */
  SendStartTypingInfo: [name: string, email: string, sessionId: string]

  /**
   * Fired when a user stops typing
   * @param name - Name of the user who stopped typing
   * @param email - Email of the user who stopped typing
   * @param sessionId - UUID of the session
   */
  SendStopTypingInfo: [name: string, email: string, sessionId: string]

  // ========================================
  // Connection Lifecycle Events (Internal)
  // ========================================

  /**
   * Fired when connection state changes
   * @param state - New connection state
   */
  stateChange: [ConnectionState]

  /**
   * Fired when connection is re-established after disconnect
   * @param connectionId - New connection ID (undefined if not available)
   */
  reconnected: [string | undefined]

  /**
   * Fired when connection is closed
   * @param error - Error that caused closure (undefined if graceful close)
   */
  closed: [Error | undefined]
}

/**
 * Type-safe SignalR event handler
 * @template TArgs - Tuple type of event arguments
 */
export type SignalREventHandler<TArgs extends readonly unknown[] = readonly unknown[]> =
  (...args: TArgs) => void | Promise<void>

/**
 * Helper type to extract event names from registry
 */
export type SignalREventName = keyof SignalREventRegistry

/**
 * Helper type to extract handler type for specific event
 * @template TEventName - Name of the event
 */
export type SignalREventHandlerFor<TEventName extends SignalREventName> =
  SignalREventHandler<SignalREventRegistry[TEventName]>