# API Services

## Overview

Type-safe service classes for backend API communication with comprehensive error handling using the Result<T, AppError> pattern from neverthrow.

## Services

### AuthService (`/lib/api/services/AuthService.ts`)

Handles authentication and user management operations.

**Key Methods:**

- `login(credentials)` - User login with email/password
- `logout()` - Clear authentication state
- `refreshToken()` - Refresh access token using httpOnly cookies
- `getProfile(email)` - Get user profile information
- `updateProfile(email, updates)` - Update user profile
- `changePassword(email, currentPassword, newPassword)` - Change user password
- `requestPasswordReset(email)` - Request password reset email
- `resetPassword(token, newPassword)` - Reset password with token
- `verifyEmail(token)` - Verify email address
- `checkAuth()` - Validate current authentication session

**Usage:**

```typescript
import { authService } from '@/lib/api/services/AuthService'

const result = await authService.login({
  email: 'user@example.com',
  password: 'password',
  mode: AuthenticationMode.Basic,
})

if (result.isOk()) {
  console.log('Logged in:', result.value.user)
} else {
  console.error('Login failed:', result.error)
}
```

### ChatService (`/lib/api/services/ChatService.ts`)

Manages chat sessions, messages, and AI interactions.

**Key Methods:**

- `sendQuestion(request)` - Send text question to AI
- `sendOption(request)` - Send option selection to AI
- `getWelcomeMessage(request)` - Get welcome message for agent
- `getSessionHeaders(request)` - Get all sessions for user
- `getSessionById(request)` - Get session with all messages
- `updateSessionName(request)` - Update session name
- `deleteSession(request)` - Delete session
- `rateMessage(request)` - Rate message (thumbs up/down)
- `markMessagesRead(sessionId, agentId, userCode)` - Mark messages as read
- `getUnreadMessages(request)` - Get unread message counts
- `reactToMessage(sessionId, messageId, agentId, reaction)` - Add reaction to message
- `addUserToSession(request)` - Add user to session
- `removeUserFromSession(request)` - Remove user from session
- `searchMessages(sessionId, agentId, query, limit)` - Search messages in session
- `forwardMessage(fromSessionId, fromAgentId, toSessionId, toAgentId, messageId)` - Forward message

**Usage:**

```typescript
import { chatService } from '@/lib/api/services/ChatService'

const result = await chatService.sendQuestion({
  userCode: 'user@example.com',
  sessionId: 'session-1',
  agentId: 1,
  members: [],
  question: 'Hello, how can you help me?',
  group: 'default',
  pquestionType: AIQuestionType.Text,
  options: [],
})
```

### UserService (`/lib/api/services/UserService.ts`)

Handles user management and profile operations.

**Key Methods:**

- `getSelectableUsers(email)` - Get all selectable users (agents + real users)
- `getUserById(userId)` - Get user by ID
- `getUserByEmail(email)` - Get user by email
- `searchUsers(query, limit)` - Search users by name or email
- `updateUser(userId, updates)` - Update user profile
- `updateUserAvailability(userId, isAvailable)` - Update availability status
- `uploadAvatar(userId, avatarFile, isDarkMode)` - Upload user avatar
- `getUserStats(userId)` - Get user statistics
- `getUserActivity(userId, limit)` - Get user's recent activity
- `getUsersByRole(role)` - Get users by role
- `getOnlineUsers()` - Get online users
- `deactivateUser(userId)` - Deactivate user account
- `reactivateUser(userId)` - Reactivate user account

**Usage:**

```typescript
import { userService } from '@/lib/api/services/UserService'

const result = await userService.getSelectableUsers('user@example.com')
if (result.isOk()) {
  const users = result.value
  console.log('Available users:', users.length)
}
```

### AdminService (`/lib/api/services/AdminService.ts`)

Administrative operations for system management.

**Key Methods:**

- `getAllUsers(page, pageSize, search, role)` - Get all users with pagination
- `createUser(userData)` - Create new user
- `deleteUser(userId)` - Delete user
- `getSystemStats()` - Get system statistics
- `getSystemLogs(level, page, pageSize, startDate, endDate)` - Get system logs
- `getActiveSessions()` - Get active sessions
- `updateUserRoles(userId, roles)` - Manage user roles
- `resetUserPassword(userId, newPassword)` - Reset user password
- `forceLogoutUser(userId)` - Force logout user
- `getUserSessions(userId, page, pageSize)` - Get user sessions
- `getAgentsConfig()` - Get AI agents configuration
- `updateAgentConfig(agentId, config)` - Update AI agent configuration
- `getSystemHealth()` - Get system health status
- `exportSystemData(type, format, startDate, endDate)` - Export system data
- `getApiUsageStats(period)` - Get API usage statistics
- `setUserBanStatus(userId, isBanned, reason)` - Ban/unban user

**Usage:**

```typescript
import { adminService } from '@/lib/api/services/AdminService'

const result = await adminService.getSystemStats()
if (result.isOk()) {
  console.log('Total users:', result.value.totalUsers)
  console.log('Active sessions:', result.value.activeSessions)
}
```

### LogService (`/lib/api/services/LogService.ts`)

Client-side logging service with fire-and-forget semantics.

**Key Methods:**

- `log(logInfo)` - Send client log to backend
- `debug(message, data, context)` - Log debug message
- `info(message, data, context)` - Log info message
- `warn(message, data, context)` - Log warning message
- `error(message, error, context)` - Log error message
- `logUserAction(action, userId, data, context)` - Log user action
- `logApiRequest(method, url, statusCode, duration, error)` - Log API request
- `logPerformance(metric, value, unit, context)` - Log performance metrics
- `logChatInteraction(sessionId, action, data)` - Log chat interaction
- `logAuthEvent(event, userId, data)` - Log authentication event
- `logSignalREvent(event, data)` - Log SignalR event
- `logErrorBoundary(error, errorInfo, context)` - Log React error boundary
- `logFeatureUsage(feature, action, data, context)` - Log feature usage
- `logSystemInfo(info, context)` - Log system information
- `logBatch(events)` - Batch log multiple events
- `createChild(context)` - Create child logger with additional context

**Usage:**

```typescript
import { logService } from '@/lib/api/services/LogService'

// Log user action
await logService.logUserAction('login', userId, { provider: 'email' })

// Log error
await logService.error('Login failed', error, { userId, attempt: 3 })

// Log performance
await logService.logPerformance('page_load', 1500, 'ms', { page: '/dashboard' })
```

### ConfigService (`/lib/api/services/ConfigService.ts`)

Runtime configuration management with caching and validation.

**Key Methods:**

- `getConfig()` - Load runtime configuration from backend
- `getCachedConfig()` - Get cached configuration
- `refreshConfig()` - Force refresh configuration
- `getConfigValue(path)` - Get specific configuration value by path
- `getAgentConfig(agentId)` - Get agent configuration by ID
- `getAvailableAgents()` - Get all available agents
- `getUIConfig()` - Get UI configuration
- `getFeatureFlags()` - Get feature flags
- `isFeatureEnabled(featureName)` - Check if feature is enabled
- `updateConfig(updates)` - Update configuration (admin only)
- `updateAgentConfig(agentId, agentConfig)` - Update agent configuration
- `updateFeatureFlags(flags)` - Update feature flags
- `exportConfig(format)` - Export configuration
- `importConfig(configFile, format)` - Import configuration
- `resetConfig()` - Reset configuration to defaults
- `validateConfig(config)` - Validate configuration
- `getConfigHistory(page, pageSize)` - Get configuration history
- `restoreConfigVersion(versionId)` - Restore configuration version

**Usage:**

```typescript
import { configService } from '@/lib/api/services/ConfigService'

// Get configuration
const result = await configService.getConfig()
if (result.isOk()) {
  const config = result.value
  console.log('Available agents:', config.agents.length)
}

// Check feature flag
const isFeatureEnabled = await configService.isFeatureEnabled('new_ui')
if (isFeatureEnabled) {
  // Enable new UI features
}
```

## Error Handling

All services use the Result<T, AppError> pattern for explicit error handling:

```typescript
const result = await authService.login(credentials)

if (result.isOk()) {
  // Success case
  const data = result.value
  console.log('Login successful:', data)
} else {
  // Error case
  const error = result.error
  console.error('Login failed:', error.message)

  // Handle specific error types
  switch (error.code) {
    case 'UNAUTHORIZED':
      // Handle authentication error
      break
    case 'NETWORK_ERROR':
      // Handle network error
      break
    default:
      // Handle other errors
      break
  }
}
```

## Singleton Pattern

All services use the singleton pattern for consistent instances:

```typescript
// Use the singleton instances directly
import { authService, chatService, userService } from '@/lib/api/services'

// No need to create new instances
const result = await authService.login(credentials)
```

## Type Safety

- All DTOs are validated with Zod schemas
- Full TypeScript support with proper typing
- Runtime validation ensures data integrity
- Compile-time type checking catches errors early

## Testing

Each service has comprehensive unit tests using MSW for API mocking:

```bash
# Run all service tests
npm test lib/api/services

# Run specific service tests
npm test lib/api/services/__tests__/AuthService.test.ts
```

## Best Practices

1. **Always handle Result types** - Check `isOk()` or `isErr()` before accessing values
2. **Use specific error handling** - Handle different error codes appropriately
3. **Leverage caching** - Use cached methods where available to avoid redundant requests
4. **Log operations** - Use LogService for debugging and monitoring
5. **Validate inputs** - Services handle validation, but validate on client side too
6. **Use singleton instances** - Import service instances, don't create new ones

## HTTP Only Cookies

Authentication tokens are handled automatically via httpOnly cookies:

- No manual token management required
- Automatic token refresh handled by interceptors
- Secure by default (not accessible via JavaScript)
