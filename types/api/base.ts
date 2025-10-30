/**
 * Base API types for consistent error handling and response wrapping
 * Based on the implementation plan specification
 */

import type { ErrorCode } from '../enums'

// API response wrapper (your backend uses this)
export interface ApiResponse<T> {
  data: T | null
  success?: string | null
  warning?: string | null
  error?: ApiError | null
}

// Normalized error (after our processing)
export interface ApiError {
  code: ErrorCode
  message: string
  statusCode?: number | null
  details?: unknown
  validationErrors?: ValidationError[] | null
}

export interface ValidationError {
  field: string
  message: string
}

// HTTP request/response types
export interface RequestConfig {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH'
  url: string
  data?: unknown
  params?: Record<string, unknown>
  headers?: Record<string, string>
  timeout?: number
}

// Pagination types (if needed)
export interface PaginationRequest {
  page: number
  pageSize: number
}

export interface PaginationResponse<T> {
  data: T[]
  totalCount: number
  currentPage: number
  pageSize: number
  totalPages: number
  hasNext: boolean
  hasPrevious: boolean
}

// Sorting types
export interface SortRequest {
  field: string
  direction: 'asc' | 'desc'
}

// Filter types
export interface FilterRequest {
  field: string
  operator: 'eq' | 'ne' | 'gt' | 'gte' | 'lt' | 'lte' | 'contains' | 'startsWith' | 'endsWith'
  value: unknown
}

// Generic API result types for different operations
export interface CreateResult<T> {
  id: string | number
  data: T
  created: string
}

export interface UpdateResult<T> {
  data: T
  updated: string
  modifiedFields: string[]
}

export interface DeleteResult {
  deleted: boolean
  deletedAt: string
}

// Bulk operation results
export interface BulkOperationResult<T> {
  successful: T[]
  failed: Array<{
    item: T
    error: string
  }>
  totalCount: number
  successCount: number
  failureCount: number
}

// File upload types
export interface FileUploadRequest {
  file: File
  fieldName?: string
  metadata?: Record<string, unknown>
}

export interface FileUploadResult {
  fileName: string
  originalName: string
  size: number
  mimeType: string
  url: string
  uploadedAt: string
}

// Health check types
export interface HealthCheckResult {
  status: 'healthy' | 'unhealthy' | 'degraded'
  timestamp: string
  services: ServiceHealth[]
  version?: string
}

export interface ServiceHealth {
  name: string
  status: 'healthy' | 'unhealthy' | 'degraded'
  responseTime?: number
  lastCheck: string
  details?: Record<string, unknown>
}

// WebSocket/SignalR types
export interface WebSocketMessage<T = unknown> {
  type: string
  payload: T
  timestamp: string
  messageId?: string
}

export interface SignalREvent {
  eventName: string
  data: unknown
  connectionId?: string
  timestamp: string
}

// Cache control types
export interface CacheConfig {
  enabled: boolean
  ttl?: number // Time to live in seconds
  strategy?: 'cache-first' | 'network-first' | 'stale-while-revalidate'
  key?: string
  tags?: string[]
}

// Rate limiting types
export interface RateLimitInfo {
  limit: number
  remaining: number
  resetTime: string
  retryAfter?: number
}

// Request metadata types
export interface RequestMetadata {
  requestId: string
  timestamp: string
  duration?: number
  userAgent?: string
  ip?: string
  userId?: string
  sessionId?: string
}

// API versioning types
export interface ApiVersion {
  version: string
  deprecated?: boolean
  sunsetDate?: string
  supportedUntil?: string
  migrationGuide?: string
}

/**
 * Result type for mutation operations that return success confirmation.
 * Backend returns: { data: "{\"message\":\"kész.\"}" }
 * We normalize this to a simple boolean for caller convenience.
 */
export type MutationSuccess = true