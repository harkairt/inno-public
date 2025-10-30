/**
 * Admin-specific interfaces for system management
 * These interfaces complement the main DTOs with admin-specific data structures
 */

// ============================================================================
// SYSTEM STATISTICS
// ============================================================================

export interface SystemStats {
  totalUsers: number
  activeUsers: number
  totalSessions: number
  activeSessions: number
  totalMessages: number
  messagesToday: number
  averageResponseTime: number
  systemUptime: number
}

// ============================================================================
// SYSTEM LOGS
// ============================================================================

export interface SystemLogEntry {
  id: string
  timestamp: string
  level: string
  message: string
  source: string
  userId?: number
  sessionId?: string
}

export interface SystemLogsResponse {
  logs: SystemLogEntry[]
  total: number
  page: number
  pageSize: number
}

// ============================================================================
// ACTIVE SESSIONS
// ============================================================================

export interface ActiveSession {
  sessionId: string
  userId: number
  userName: string
  agentId: number
  agentName: string
  startTime: string
  lastActivity: string
  messageCount: number
}

// ============================================================================
// USER SESSIONS
// ============================================================================

export interface UserSession {
  sessionId: string
  agentId: number
  agentName: string
  sessionName: string
  startTime: string
  endTime?: string
  messageCount: number
  isActive: boolean
}

export interface UserSessionsResponse {
  sessions: UserSession[]
  total: number
  page: number
  pageSize: number
}

// ============================================================================
// AI AGENT CONFIGURATION
// ============================================================================

export interface AgentConfig {
  id: number
  name: string
  description: string
  isActive: boolean
  capabilities: string[]
  maxTokens: number
  temperature: number
  systemPrompt: string
  welcomeMessage: string
}

// ============================================================================
// SESSION STATISTICS
// ============================================================================

export interface SessionStats {
  sessionId: string
  totalMessages: number
  userMessages: number
  aiMessages: number
  averageResponseTime: number
  sessionDuration: number
  startTime: string
  endTime?: string
  participantCount: number
}

// ============================================================================
// API USAGE STATISTICS
// ============================================================================

export interface ApiUsageStats {
  timestamp: string
  requests: number
  errors: number
  averageResponseTime: number
}

// ============================================================================
// SYSTEM HEALTH STATUS
// ============================================================================

export interface SystemHealth {
  status: 'healthy' | 'degraded' | 'unhealthy'
  database: 'connected' | 'disconnected' | 'error'
  signalr: 'connected' | 'disconnected' | 'error'
  memory: {
    used: number
    total: number
    percentage: number
  }
  cpu: {
    usage: number
  }
  uptime: number
  lastCheck: string
}

// ============================================================================
// CONFIGURATION HISTORY
// ============================================================================

export interface ConfigHistoryEntry {
  id: string
  timestamp: string
  changedBy: string
  changes: Record<string, unknown>
  version: number
}

export interface ConfigHistoryResponse {
  history: ConfigHistoryEntry[]
  total: number
  page: number
  pageSize: number
}

// ============================================================================
// USER STATISTICS AND ACTIVITY
// ============================================================================

export interface UserStats {
  totalSessions: number
  totalMessages: number
  averageSessionDuration: number
  lastActiveDate: string
  joinDate: string
  isActive: boolean
}

export interface UserActivity {
  id: string
  type: 'session_started' | 'session_ended' | 'message_sent' | 'message_received'
  timestamp: string
  sessionId?: string
  data?: Record<string, unknown>
}

// ============================================================================
// AGENT-SPECIFIC CONFIGURATION (extends base InnoChatConfig)
// ============================================================================

export interface AgentInfo {
  id: number
  name: string
  description: string
  isActive: boolean
  image: string
  darkImage: string
  capabilities: string[]
  systemPrompt: string
  welcomeMessage: string
  maxTokens: number
  temperature: number
}

export interface UIConfiguration {
  theme: 'light' | 'dark' | 'auto'
  primaryColor: string
  language: string
  timezone: string
  dateFormat: string
  timeFormat: '12h' | '24h'
}

export interface FeatureFlags {
  fileUpload: boolean
  reactions: boolean
  typingIndicators: boolean
  publicChat: boolean
  exportSessions: boolean
  userManagement: boolean
  analytics: boolean
}

export interface ExtendedInnoChatConfig {
  // Base configuration from InnoChatConfig
  apiVersion?: string
  features?: {
    fileUpload?: boolean
    reactions?: boolean
    typingIndicators?: boolean
    publicChat?: boolean
  }
  limits?: {
    maxMessageLength?: number
    maxFileSize?: number
    maxSessionMembers?: number
  }
  signalR?: {
    hubUrl?: string
    reconnectDelay?: number[]
  }

  // Extended configuration
  agents: AgentInfo[]
  ui: UIConfiguration
  featureFlags: FeatureFlags
  version: string
  environment: 'development' | 'staging' | 'production'
}