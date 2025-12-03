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
   * Fired when a user joins a chat session
   * @param data - User and session information
   */
  UserJoined: [{ sessionId: string; userCode: string; userName: string }]

  /**
   * Fired when a user leaves a chat session
   * @param data - User and session information
   */
  UserLeft: [{ sessionId: string; userCode: string; userName: string }]

  /**
   * Fired when a user starts typing
   * @param data - User and session information
   */
  UserTyping: [{ sessionId: string; userCode: string; userName: string }]

  /**
   * Fired when a user stops typing
   * @param data - User and session information
   */
  UserStoppedTyping: [{ sessionId: string; userCode: string; userName: string }]

  /**
   * Fired when a message is marked as read
   * @param data - Message and user information
   */
  MessageRead: [{ sessionId: string; messageId: string; userCode: string }]

  /**
   * Fired when session metadata is updated
   * @param data - Session ID and partial updates
   */
  SessionUpdated: [{ sessionId: string; updates: Record<string, unknown> }]

  /**
   * Fired when unread message count changes
   * @param data - Session ID and new count
   */
  UnreadCountUpdated: [{ sessionId: string; count: number }]

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