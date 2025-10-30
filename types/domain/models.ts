/**
 * Domain models (our internal representation)
 * May differ from DTOs for better ergonomics
 * These are the types our application will use internally
 */

import type {
  AIAnswerType,
  MessageStatus,
  ConnectionState,
  ThemeMode,
  UserStatus,
  CacheStrategy
} from '../enums'

// ============================================================================
// USER DOMAIN MODELS
// ============================================================================

export interface User {
  id: number
  name: string
  email: string
  roles: string[]
  isVirtual: boolean
  isAvailable: boolean
  avatarUrl?: string
  darkAvatarUrl?: string
  status: UserStatus
  lastSeen?: Date | null
  invitationAccepted: boolean
  userIds: number[] // Associated user IDs
}

export interface UserProfile extends User {
  preferences: UserPreferences
  statistics: UserStatistics
}

export interface UserPreferences {
  compactMode: boolean
  notificationsEnabled: boolean
  soundEnabled: boolean
  language: string
  timezone: string
}

export interface UserStatistics {
  totalSessions: number
  totalMessages: number
  averageResponseTime?: number | null
  lastActivity?: Date | null
}

// ============================================================================
// CHAT DOMAIN MODELS
// ============================================================================

export interface ChatSession {
  id: string
  name: string
  createdBy: string
  createdAt: Date
  agentId: number
  agentAvatar: string
  agentDarkAvatar: string
  members: string[]
  messages: Message[]
  unreadCount: number
  isActive: boolean
  lastActivity?: Date | null
  metadata?: SessionMetadata
}

export interface Message {
  id: string
  sessionId: string
  type: AIAnswerType
  content: string
  sender: MessageSender
  sentAt: Date
  isRated: boolean
  rating?: number | null
  readBy: string[]
  status: MessageStatus
  metadata?: MessageMetadata
}

export interface MessageSender {
  userCode: string
  name: string
  avatar?: string | null
  isAgent: boolean
  isCurrentUser: boolean
}

export interface SessionMetadata {
  group?: string
  tags?: string[]
  isPublic?: boolean
  priority?: 'low' | 'normal' | 'high'
}

export interface MessageMetadata {
  edited?: boolean
  editedAt?: Date
  attachments?: MessageAttachment[]
  reactions?: MessageReaction[]
  options?: MessageOption[]
}

export interface MessageAttachment {
  id: string
  name: string
  type: string
  size: number
  url: string
  thumbnailUrl?: string | null
}

export interface MessageReaction {
  emoji: string
  count: number
  users: string[]
}

export interface MessageOption {
  id: string
  text: string
  value: string
  isSelected: boolean
  votes: number
}

// ============================================================================
// AGENT DOMAIN MODELS
// ============================================================================

export interface Agent {
  id: number
  name: string
  description?: string | null
  avatarUrl: string
  darkAvatarUrl: string
  capabilities: AgentCapability[]
  status: 'online' | 'offline' | 'busy'
  statistics: AgentStatistics
  configuration: AgentConfiguration
}

export interface AgentCapability {
  type: 'text' | 'file' | 'data' | 'commands'
  name: string
  enabled: boolean
  configuration?: Record<string, unknown> | null
}

export interface AgentStatistics {
  totalSessions: number
  totalMessages: number
  averageResponseTime?: number | null
  satisfaction?: number | null
  lastActivity?: Date | null
}

export interface AgentConfiguration {
  welcomeMessage?: string | null
  maxMessageLength?: number | null
  supportedFileTypes?: string[]
  customCommands?: AgentCommand[]
}

export interface AgentCommand {
  name: string
  description: string
  parameters?: Record<string, unknown> | null
  enabled: boolean
}

// ============================================================================
// NOTIFICATION DOMAIN MODELS
// ============================================================================

export interface Notification {
  id: string
  type: NotificationType
  title: string
  message: string
  data?: unknown
  read: boolean
  createdAt: Date
  expiresAt?: Date | null
  actions?: NotificationAction[]
}

export enum NotificationType {
  NEW_MESSAGE = 'new_message',
  SESSION_INVITATION = 'session_invitation',
  AGENT_STATUS = 'agent_status',
  SYSTEM = 'system',
  ERROR = 'error'
}

export interface NotificationAction {
  label: string
  action: string
  data?: unknown
  primary?: boolean
}

// ============================================================================
// CONNECTION DOMAIN MODELS
// ============================================================================

export interface ConnectionInfo {
  state: ConnectionState
  isConnected: boolean
  isConnecting: boolean
  isReconnecting: boolean
  lastConnectedAt?: Date | null
  reconnectAttempts: number
  lastError?: string | null
  latency?: number | null
}

// ============================================================================
// SEARCH AND FILTERING MODELS
// ============================================================================

export interface SearchFilters {
  query?: string
  agents?: number[]
  dateRange?: {
    start: Date
    end: Date
  }
  hasUnreadMessages?: boolean
  isActive?: boolean
  tags?: string[]
}

export interface SearchResult<T> {
  items: T[]
  totalCount: number
  currentPage: number
  totalPages: number
  hasMore: boolean
  searchTime: number
}

// ============================================================================
// CONFIGURATION DOMAIN MODELS
// ============================================================================

export interface AppConfig {
  api: ApiConfig
  features: FeatureFlags
  limits: AppConfigLimits
  ui: UIConfig
  signalR: SignalRConfig
}

export interface ApiConfig {
  baseUrl: string
  version: string
  timeout: number
  retryAttempts: number
  retryDelay: number
}

export interface FeatureFlags {
  fileUpload: boolean
  reactions: boolean
  typingIndicators: boolean
  publicChat: boolean
  sessionSharing: boolean
  messageEditing: boolean
  messageDeletion: boolean
}

export interface AppConfigLimits {
  maxMessageLength: number
  maxFileSize: number
  maxSessionMembers: number
  maxSessionsPerUser: number
  maxAttachmentCount: number
}

export interface UIConfig {
  theme: {
    default: ThemeMode
    allowCustom: boolean
  }
  layout: {
    sidebarCollapsible: boolean
    showAgentAvatars: boolean
    showTimestamps: boolean
    showMessageStatus: boolean
  }
  pagination: {
    defaultPageSize: number
    maxPageSize: number
  }
}

export interface SignalRConfig {
  hubUrl: string
  reconnectDelays: number[]
  enableLogging: boolean
  connectionTimeout: number
}

// ============================================================================
// CACHE DOMAIN MODELS
// ============================================================================

export interface CacheConfig {
  strategy: CacheStrategy
  ttl: number
  maxSize: number
  enabled: boolean
}

export interface CacheEntry<T> {
  key: string
  value: T
  timestamp: Date
  expiresAt: Date
  accessCount: number
  lastAccessed: Date
  tags: string[]
}

// ============================================================================
// ERROR DOMAIN MODELS
// ============================================================================

export interface AppError {
  code: string
  message: string
  statusCode?: number | null
  details?: unknown
  validationErrors?: ValidationError[] | null
  timestamp: Date
  requestId?: string | null
  userFriendly: boolean
}

export interface ValidationError {
  field: string
  message: string
  code?: string | null
}

// ============================================================================
// AUDIT MODELS
// ============================================================================

export interface AuditEvent {
  id: string
  type: string
  action: string
  userId?: string | null
  sessionId?: string | null
  resource: string
  resourceId?: string | null
  metadata?: Record<string, unknown> | null
  timestamp: Date
  ipAddress?: string | null
  userAgent?: string | null
}

// ============================================================================
// UTILITY TYPES
// ============================================================================

export type Optional<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>
export type RequiredFields<T, K extends keyof T> = T & Required<Pick<T, K>>
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P]
}

// Generic API result wrapper for our domain models
export interface DomainResult<T> {
  data?: T | null
  success: boolean
  error?: AppError | null
  metadata?: {
    requestId: string
    timestamp: Date
    duration: number
  } | null
}