import type { LogInfoDTO } from '@/types/api/schemas'
import { apiClient } from '../client'
import type { ErrorData } from '@/types/api/log-types'
import { LogLevel } from '@/types/enums'

export class LogService {
  /**
   * Send client log to backend
   * Fire and forget - doesn't throw errors to avoid crashing the app
   */
  async log(logInfo: LogInfoDTO): Promise<void> {
    try {
      // Fire and forget - don't await or throw errors
      apiClient.post('/api/logs/Log', logInfo).catch(() => {
        // Silently fail - logging errors shouldn't crash app
      })
    } catch {
      // Silently fail
    }
  }

  /**
   * Log debug message
   */
  async debug(message: string, data?: string, context?: Record<string, unknown>): Promise<void> {
    await this.log({
      loglevel: LogLevel.Debug,
      title: message,
      details: data ?? undefined,
      source: 'client',
    })
  }

  /**
   * Log info message
   */
  async info(message: string, data?: unknown, context?: Record<string, unknown>): Promise<void> {
    await this.log({
      loglevel: LogLevel.Information,
      title: message,
      details: data || context ? JSON.stringify({ data, context }) : undefined,
      source: 'client',
    })
  }

  /**
   * Log warning message
   */
  async warn(message: string, data?: unknown, context?: Record<string, unknown>): Promise<void> {
    await this.log({
      loglevel: LogLevel.Warning,
      title: message,
      details: data || context ? JSON.stringify({ data, context }) : undefined,
      source: 'client',
    })
  }

  /**
   * Log error message
   */
  async error(
    message: string,
    error?: Error | unknown,
    context?: Record<string, unknown>,
  ): Promise<void> {
    let errorData: ErrorData | undefined = undefined

    if (error instanceof Error) {
      errorData = {
        name: error.name,
        message: error.message,
        stack: error.stack,
      }
    } else if (error) {
      errorData = error as ErrorData
    }

    await this.log({
      loglevel: LogLevel.Error,
      title: message,
      details: errorData || context ? JSON.stringify({ error: errorData, context }) : undefined,
      source: 'client',
    })
  }

  /**
   * Log user action
   */
  async logUserAction(
    action: string,
    userId?: number,
    data?: unknown,
    context?: Record<string, unknown>,
  ): Promise<void> {
    await this.log({
      loglevel: LogLevel.Information,
      title: `User action: ${action}`,
      details: JSON.stringify({
        action,
        userId,
        ...(data as Record<string, unknown>),
        ...(context && { context: { ...context, type: 'user_action' } }),
      }),
      source: 'client',
    })
  }

  /**
   * Log API request
   */
  async logApiRequest(
    method: string,
    url: string,
    statusCode?: number,
    duration?: number,
    error?: unknown,
  ): Promise<void> {
    await this.log({
      loglevel: statusCode && statusCode >= 400 ? LogLevel.Error : LogLevel.Information,
      title: `API ${method} ${url}`,
      details: JSON.stringify({
        method,
        url,
        statusCode,
        duration,
        error: error ? {
          message: (error as ErrorData).message,
          code: (error as ErrorData).code,
        } : undefined,
        context: { type: 'api_request' },
      }),
      source: 'client',
    })
  }

  /**
   * Log performance metrics
   */
  async logPerformance(
    metric: string,
    value: number,
    unit: string = 'ms',
    context?: Record<string, unknown>,
  ): Promise<void> {
    await this.log({
      loglevel: LogLevel.Information,
      title: `Performance: ${metric}`,
      details: JSON.stringify({
        metric,
        value,
        unit,
        ...(context && { context: { ...context, type: 'performance' } }),
      }),
      source: 'client',
    })
  }

  /**
   * Log chat interaction
   */
  async logChatInteraction(
    sessionId: string,
    action: 'message_sent' | 'message_received' | 'session_started' | 'session_ended',
    data?: unknown,
  ): Promise<void> {
    await this.log({
      loglevel: LogLevel.Information,
      title: `Chat ${action}`,
      details: JSON.stringify({
        sessionId,
        action,
        ...(data as Record<string, unknown>),
        context: { type: 'chat_interaction' },
      }),
      source: 'client',
    })
  }

  /**
   * Log authentication event
   */
  async logAuthEvent(
    event: 'login' | 'logout' | 'token_refresh' | 'login_failed' | 'token_expired',
    userId?: number,
    data?: unknown,
  ): Promise<void> {
    await this.log({
      loglevel: event.includes('failed') || event.includes('expired') ? LogLevel.Warning : LogLevel.Information,
      title: `Auth ${event}`,
      details: JSON.stringify({
        event,
        userId,
        ...(data as Record<string, unknown>),
        context: { type: 'auth_event' },
      }),
      source: 'client',
    })
  }

  /**
   * Log SignalR event
   */
  async logSignalREvent(
    event: 'connected' | 'disconnected' | 'reconnecting' | 'reconnected' | 'error',
    data?: unknown,
  ): Promise<void> {
    await this.log({
      loglevel: event === 'error' ? LogLevel.Error : LogLevel.Information,
      title: `SignalR ${event}`,
      details: JSON.stringify({
        event,
        ...(data as Record<string, unknown>),
        context: { type: 'signalr_event' },
      }),
      source: 'client',
    })
  }

  /**
   * Log error boundary event
   */
  async logErrorBoundary(
    error: Error,
    errorInfo: {
      componentStack: string
      errorBoundary?: string
      errorBoundaryStack?: string
    },
    context?: Record<string, unknown>,
  ): Promise<void> {
    await this.log({
      loglevel: LogLevel.Error,
      title: 'React Error Boundary caught an error',
      details: JSON.stringify({
        error: {
          name: error.name,
          message: error.message,
          stack: error.stack,
        },
        errorInfo,
        ...(context && { context: { ...context, type: 'error_boundary' } }),
      }),
      source: 'client',
    })
  }

  /**
   * Log feature usage
   */
  async logFeatureUsage(
    feature: string,
    action: string,
    data?: unknown,
    context?: Record<string, unknown>,
  ): Promise<void> {
    await this.log({
      loglevel: LogLevel.Information,
      title: `Feature usage: ${feature} - ${action}`,
      details: JSON.stringify({
        feature,
        action,
        ...(data as Record<string, unknown>),
        ...(context && { context: { ...context, type: 'feature_usage' } }),
      }),
      source: 'client',
    })
  }

  /**
   * Log system information
   */
  async logSystemInfo(
    info: Record<string, unknown>,
    context?: Record<string, unknown>,
  ): Promise<void> {
    await this.log({
      loglevel: LogLevel.Information,
      title: 'System information',
      details: JSON.stringify({
        ...info,
        ...(context && { context: { ...context, type: 'system_info' } }),
      }),
      source: 'client',
    })
  }

  /**
   * Batch log multiple events
   */
  async logBatch(events: LogInfoDTO[]): Promise<void> {
    try {
      // Fire and forget - don't await or throw errors
      apiClient.post('/api/logs/LogBatch', { events }).catch(() => {
        // Silently fail - logging errors shouldn't crash app
      })
    } catch {
      // Silently fail
    }
  }

  /**
   * Create a child logger with additional context
   */
  createChild(context: Record<string, unknown>): LogService {
    const childService = new LogService()

    // Override the log method to include context
    childService.log = async (logInfo: LogInfoDTO) => {
      const existingDetails = logInfo.details ? JSON.parse(logInfo.details) : {}
      await this.log({
        ...logInfo,
        details: JSON.stringify({
          ...existingDetails,
          context: {
            ...context,
            ...(existingDetails.context || {}),
          },
        }),
      })
    }

    return childService
  }
}

// Singleton
export const logService = new LogService()