/**
 * Error utility functions
 * Helper functions for working with errors throughout the application
 */

import { ErrorCode } from "@/types/enums";
import { reportToSentry } from "./sentry";
import { AppError, NetworkError, ValidationError } from "./types";

// ============================================================================
// ERROR TYPE CHECKING UTILITIES
// ============================================================================

export function isUnauthorized(error: AppError): boolean {
  return error.code === "UNAUTHORIZED" || error.statusCode === 401;
}

export function isForbidden(error: AppError): boolean {
  return error.code === "FORBIDDEN" || error.statusCode === 403;
}

export function isValidationError(error: AppError): error is ValidationError {
  return error.code === "VALIDATION_ERROR" || error instanceof ValidationError;
}

export function isNotFoundError(error: AppError): boolean {
  return error.code === "NOT_FOUND" || error.statusCode === 404;
}

export function isNetworkError(error: AppError): boolean {
  return error.code === "NETWORK_ERROR" || error instanceof NetworkError;
}

export function isServerError(error: AppError): boolean {
  return (
    error.code === "SERVER_ERROR" ||
    (error.statusCode !== undefined && error.statusCode >= 500)
  );
}

export function isTimeoutError(error: AppError): boolean {
  return error.code === "TIMEOUT" || error.statusCode === 408;
}

export function isClientError(error: AppError): boolean {
  return (
    error.statusCode !== undefined &&
    error.statusCode >= 400 &&
    error.statusCode < 500
  );
}

// ============================================================================
// ERROR MESSAGE UTILITIES
// ============================================================================

export function getUserFriendlyMessage(error: AppError): string {
  switch (error.code) {
    case "VALIDATION_ERROR":
      if (error instanceof ValidationError) {
        return error.validationErrors.map((ve) => ve.message).join(", ");
      }
      return error.message;

    case "UNAUTHORIZED":
      return "Your session has expired. Please log in again.";

    case "FORBIDDEN":
      return "You do not have permission to perform this action.";

    case "NOT_FOUND":
      return "The requested resource was not found.";

    case "NETWORK_ERROR":
      return "Network error. Please check your connection and try again.";

    case "TIMEOUT":
      return "Request timed out. Please try again.";

    case "SERVER_ERROR":
      return "Server error. Please try again later.";

    case "UNKNOWN_ERROR":
    default:
      return "An error occurred. Please try again.";
  }
}

export function getTechnicalMessage(error: AppError): string {
  let message = `[${error.code}] ${error.message}`;

  if (error.statusCode) {
    message += ` (HTTP ${error.statusCode})`;
  }

  if (error.details) {
    message += ` - Details: ${JSON.stringify(error.details)}`;
  }

  return message;
}

export function formatValidationErrors(
  error: ValidationError
): Record<string, string[]> {
  const errors: Record<string, string[]> = {};

  for (const validationError of error.validationErrors) {
    errors[validationError.field] ??= [];
    errors[validationError.field]?.push(validationError.message);
  }

  return errors;
}

// ============================================================================
// ERROR RECOVERY UTILITIES
// ============================================================================

export function shouldRetryRequest(error: AppError): boolean {
  // Retry on network errors, timeouts, and server errors
  return isNetworkError(error) || isTimeoutError(error) || isServerError(error);
}

export function shouldRedirectToLogin(error: AppError): boolean {
  // Redirect to login on unauthorized errors
  return isUnauthorized(error);
}

export function shouldShowErrorDialog(error: AppError): boolean {
  // Show error dialog for client errors and unexpected errors
  return isClientError(error) || error.code === "UNKNOWN_ERROR";
}

export function shouldShowToastNotification(error: AppError): boolean {
  // Show toast for network errors and server errors (less intrusive)
  return isNetworkError(error) || isServerError(error) || isTimeoutError(error);
}

// ============================================================================
// ERROR LOGGING UTILITIES
// ============================================================================

export function logError(
  error: AppError,
  context?: Record<string, unknown>
): void {
  const logData = {
    type: "error",
    code: error.code,
    message: error.message,
    statusCode: error.statusCode,
    details: error.details,
    stack: error.stack,
    timestamp: new Date().toISOString(),
    context,
  };

  // In development, log to console with more details
  if (process.env.NODE_ENV === "development") {
    console.error("Application Error:", logData);
  } else {
    console.error("Application Error:", {
      code: error.code,
      message: error.message,
      statusCode: error.statusCode,
      timestamp: logData.timestamp,
      context,
    });
  }

  // Report to Sentry (filtering is handled inside reportToSentry)
  reportToSentry(error, context);
}

export function logValidationError(
  error: ValidationError,
  context?: Record<string, unknown>
): void {
  const validationContext = {
    ...context,
    validationErrors: error.validationErrors,
    fieldsWithErrors: error.getErrorFields(),
  };

  logError(error, validationContext);
}

// ============================================================================
// ERROR ANALYTICS UTILITIES
// ============================================================================

export interface ErrorMetrics {
  totalCount: number;
  countByCode: Record<string, number>;
  countByStatusCode: Record<number, number>;
  recentErrors: Array<{
    error: AppError;
    timestamp: string;
  }>;
}

export class ErrorTracker {
  private metrics: ErrorMetrics = {
    totalCount: 0,
    countByCode: {},
    countByStatusCode: {},
    recentErrors: [],
  };

  private maxRecentErrors = 100;

  track(error: AppError): void {
    this.metrics.totalCount++;

    // Track by error code
    this.metrics.countByCode[error.code] =
      (this.metrics.countByCode[error.code] ?? 0) + 1;

    // Track by status code
    if (error.statusCode) {
      this.metrics.countByStatusCode[error.statusCode] =
        (this.metrics.countByStatusCode[error.statusCode] ?? 0) + 1;
    }

    // Track recent errors
    this.metrics.recentErrors.push({
      error,
      timestamp: new Date().toISOString(),
    });

    // Limit recent errors array
    if (this.metrics.recentErrors.length > this.maxRecentErrors) {
      this.metrics.recentErrors = this.metrics.recentErrors.slice(
        -this.maxRecentErrors
      );
    }
  }

  getMetrics(): ErrorMetrics {
    return { ...this.metrics };
  }

  getMostCommonError(): { code: string; count: number } | null {
    const entries = Object.entries(this.metrics.countByCode);
    if (entries.length === 0) return null;

    return entries.reduce(
      (max, [code, count]) => (count > max.count ? { code, count } : max),
      { code: "", count: 0 }
    );
  }

  getErrorRate(timeWindowMs: number = 300000): number {
    // Default 5 minutes
    const cutoff = new Date(Date.now() - timeWindowMs);
    const recentErrors = this.metrics.recentErrors.filter(
      (entry) => new Date(entry.timestamp) > cutoff
    );

    return recentErrors.length / (timeWindowMs / 1000 / 60); // errors per minute
  }

  reset(): void {
    this.metrics = {
      totalCount: 0,
      countByCode: {},
      countByStatusCode: {},
      recentErrors: [],
    };
  }
}

// Global error tracker instance
export const globalErrorTracker = new ErrorTracker();

// ============================================================================
// ERROR BOUNDARY HELPERS
// ============================================================================

export interface ErrorBoundaryState {
  hasError: boolean;
  error: AppError | null;
  errorInfo: Record<string, unknown> | undefined;
}

export function createErrorBoundaryState(): ErrorBoundaryState {
  return {
    hasError: false,
    error: null,
    errorInfo: undefined,
  };
}

export function handleBoundaryError(
  error: unknown,
  errorInfo?: Record<string, unknown>
): ErrorBoundaryState {
  const appError =
    error instanceof AppError
      ? error
      : new AppError(
          ErrorCode.UNKNOWN_ERROR,
          error instanceof Error ? error.message : String(error)
        );

  // Track the error
  globalErrorTracker.track(appError);

  // Log the error with additional context
  logError(appError, {
    componentStack: errorInfo?.componentStack,
    ...errorInfo,
  });

  return {
    hasError: true,
    error: appError,
    errorInfo,
  };
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

export function createErrorContext(
  operation: string,
  data?: Record<string, unknown>
): Record<string, unknown> {
  return {
    operation,
    timestamp: new Date().toISOString(),
    userAgent:
      typeof navigator !== "undefined" ? navigator.userAgent : undefined,
    url: typeof window !== "undefined" ? window.location.href : undefined,
    ...data,
  };
}

export function sanitizeErrorForLogging(
  error: AppError
): Record<string, unknown> {
  return {
    name: error.name,
    code: error.code,
    message: error.message,
    statusCode: error.statusCode,
    // Only include details if they're not too large or sensitive
    details:
      error.details &&
      typeof error.details === "object" &&
      !isLargeObject(error.details)
        ? error.details
        : "[Object too large or potentially sensitive]",
    // Don't include stack trace in production logs
    ...(process.env.NODE_ENV === "development" && { stack: error.stack }),
  };
}

function isLargeObject(obj: unknown): boolean {
  try {
    return JSON.stringify(obj).length > 10000; // 10KB limit
  } catch {
    return true; // If stringify fails, consider it too large
  }
}
