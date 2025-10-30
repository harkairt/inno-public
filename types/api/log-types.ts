/**
 * Enhanced logging types for client-side logging
 * These extend the base LogInfoDTO with additional fields for client-side logging
 */

import type { LogLevel } from '../enums'

// ============================================================================
// ENHANCED LOG ENTRY
// ============================================================================

export interface ClientLogEntry {
  level: LogLevel
  message: string
  data?: unknown
  context?: Record<string, unknown>
  timestamp: string
  source: string
}

// ============================================================================
// ERROR DATA TYPES
// ============================================================================

export interface ErrorData {
  name?: string
  message?: string
  stack?: string
  code?: string
  [key: string]: unknown
}

export interface ApiErrorData {
  message?: string
  code?: string
  statusCode?: number
  [key: string]: unknown
}

// ============================================================================
// USER ACTION LOG
// ============================================================================

export interface UserActionLog extends ClientLogEntry {
  data: {
    action: string
    userId?: number
    [key: string]: unknown
  }
  context: {
    type: 'user_action'
    [key: string]: unknown
  }
}

// ============================================================================
// API REQUEST LOG
// ============================================================================

export interface ApiRequestLog extends ClientLogEntry {
  data: {
    method: string
    url: string
    statusCode?: number
    duration?: number
    error?: ApiErrorData
  }
  context: {
    type: 'api_request'
  }
}

// ============================================================================
// PERFORMANCE LOG
// ============================================================================

export interface PerformanceLog extends ClientLogEntry {
  data: {
    metric: string
    value: number
    unit: string
  }
  context: {
    type: 'performance'
    [key: string]: unknown
  }
}

// ============================================================================
// CHAT INTERACTION LOG
// ============================================================================

export interface ChatInteractionLog extends ClientLogEntry {
  data: {
    sessionId: string
    action: 'message_sent' | 'message_received' | 'session_started' | 'session_ended'
    [key: string]: unknown
  }
  context: {
    type: 'chat_interaction'
  }
}

// ============================================================================
// AUTHENTICATION EVENT LOG
// ============================================================================

export interface AuthEventLog extends ClientLogEntry {
  data: {
    event: 'login' | 'logout' | 'token_refresh' | 'login_failed' | 'token_expired'
    userId?: number
    [key: string]: unknown
  }
  context: {
    type: 'auth_event'
  }
}

// ============================================================================
// SIGNALR EVENT LOG
// ============================================================================

export interface SignalREventLog extends ClientLogEntry {
  data: {
    event: 'connected' | 'disconnected' | 'reconnecting' | 'reconnected' | 'error'
    [key: string]: unknown
  }
  context: {
    type: 'signalr_event'
  }
}

// ============================================================================
// ERROR BOUNDARY LOG
// ============================================================================

export interface ErrorBoundaryLog extends ClientLogEntry {
  data: {
    error: {
      name: string
      message: string
      stack?: string
    }
    errorInfo: {
      componentStack: string
      errorBoundary?: string
      errorBoundaryStack?: string
    }
  }
  context: {
    type: 'error_boundary'
    [key: string]: unknown
  }
}

// ============================================================================
// FEATURE USAGE LOG
// ============================================================================

export interface FeatureUsageLog extends ClientLogEntry {
  data: {
    feature: string
    action: string
    [key: string]: unknown
  }
  context: {
    type: 'feature_usage'
    [key: string]: unknown
  }
}

// ============================================================================
// SYSTEM INFO LOG
// ============================================================================

export interface SystemInfoLog extends ClientLogEntry {
  data: Record<string, unknown>
  context: {
    type: 'system_info'
    [key: string]: unknown
  }
}

// ============================================================================
// UNION TYPE FOR ALL LOG TYPES
// ============================================================================

export type LogEntry =
  | ClientLogEntry
  | UserActionLog
  | ApiRequestLog
  | PerformanceLog
  | ChatInteractionLog
  | AuthEventLog
  | SignalREventLog
  | ErrorBoundaryLog
  | FeatureUsageLog
  | SystemInfoLog