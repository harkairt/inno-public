/**
 * Enums extracted from backend DTO documentation
 * Generated from docs/backend/dto.md
 */

// AI Answer types (from lines 18-30 in dto.md)
export enum AIAnswerType {
  Text = 0,
  Command = 1,
  DataTable = 2,
  // File = 3, // Commented out in original
  Options = 4,
  URL = 5,
  Question = 6,
  ErrorText = 7,
  ServerTask = 8,
  Empty = 9
}

// AI Question types (from lines 67-71 in dto.md)
export enum AIQuestionType {
  Text = 0,
  Options = 1
}

// Authentication modes (referenced in LoginRequestDTO)
export enum AuthenticationMode {
  Basic = 0,
  Windows = 1,
  SAML = 2
}

// Log levels (referenced in LogInfoDTO)
export enum LogLevel {
  Trace = 0,
  Debug = 1,
  Information = 2,
  Warning = 3,
  Error = 4,
  Critical = 5,
  None = 6
}

// User status (referenced in UserDTOAgent)
// Changed to string union type to match API response format
export type UserStatus = 'active' | 'inactive' | 'suspended' | 'pending'

// Connection states for SignalR
export enum ConnectionState {
  Disconnected = 'disconnected',
  Connecting = 'connecting',
  Connected = 'connected',
  Reconnecting = 'reconnecting',
  Failed = 'failed'
}

// HTTP request methods for API calls
export enum HttpMethod {
  GET = 'GET',
  POST = 'POST',
  PUT = 'PUT',
  DELETE = 'DELETE',
  PATCH = 'PATCH'
}

// Error codes for normalized error handling
export enum ErrorCode {
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',
  NOT_FOUND = 'NOT_FOUND',
  CONFLICT = 'CONFLICT',
  SERVER_ERROR = 'SERVER_ERROR',
  NETWORK_ERROR = 'NETWORK_ERROR',
  TIMEOUT = 'TIMEOUT',
  UPLOAD_ERROR = 'UPLOAD_ERROR',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
  EMPTY_RESPONSE = 'EMPTY_RESPONSE',
  UPDATE_ERROR = 'UPDATE_ERROR',
  IMPORT_ERROR = 'IMPORT_ERROR',
  RESET_ERROR = 'RESET_ERROR',
  RESTORE_ERROR = 'RESTORE_ERROR',
}

// Cache strategies for Vue Query
export enum CacheStrategy {
  // Aggressive caching for stable data
  AGGRESSIVE = 'aggressive',
  // Conservative caching for dynamic data
  CONSERVATIVE = 'conservative',
  // No caching for real-time data
  NONE = 'none'
}

// Message status for chat messages
export enum MessageStatus {
  SENDING = 'sending',
  SENT = 'sent',
  DELIVERED = 'delivered',
  READ = 'read',
  FAILED = 'failed'
}

// Theme modes for UI preferences
export enum ThemeMode {
  LIGHT = 'light',
  DARK = 'dark',
  AUTO = 'auto'
}