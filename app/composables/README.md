# Composables Layer - Phase 5 Implementation

This directory contains all Vue Query composables that wrap the API services and provide reactive data fetching, caching, and state management for the InnoChat application.

## Architecture Overview

The composables layer sits between the UI components and the API services, providing:

- **Reactive Data Fetching**: Automatic caching, background updates, and cache invalidation
- **Optimistic Updates**: Immediate UI feedback with rollback on errors
- **Error Handling**: Consistent error boundaries and retry logic
- **Real-time Integration**: Seamless SignalR + Vue Query integration
- **Type Safety**: Full TypeScript support with proper error handling
- **Performance**: Efficient caching, pagination, and background updates

## Composables Categories

### 📱 Authentication (`useAuth.ts`)
Handles user authentication and profile management.

- `useLogin()` - Login with credentials
- `useLogout()` - Logout and cleanup
- `useCurrentUser()` - Get current authenticated user
- `useRefreshToken()` - Refresh access tokens
- `useUserProfile()` - Get user profile by email
- `useUpdateProfile()` - Update user profile
- `useChangePassword()` - Change password
- `useRequestPasswordReset()` - Request password reset
- `useResetPassword()` - Reset password with token
- `useVerifyEmail()` - Verify email address

**Example Usage:**
```vue
<script setup>
import { useLogin, useLogout, useCurrentUser } from '@/composables'

const { mutate: login, isPending: isLoggingIn } = useLogin()
const { mutate: logout } = useLogout()
const { data: user, isLoading, error } = useCurrentUser()

const handleLogin = async (credentials) => {
  await login(credentials)
}
</script>
```

### 💬 Chat Queries (`useChatQueries.ts`)
Handles fetching chat-related data with caching.

- `useChatSessions()` - Get user's chat sessions
- `useChatSession()` - Get specific session with messages
- `useUnreadMessageCounts()` - Get unread message counts
- `useWelcomeMessage()` - Get agent welcome message
- `useSearchMessages()` - Search messages across sessions
- `useSessionStats()` - Get session statistics
- `useSessionExport()` - Generate session export

**Example Usage:**
```vue
<script setup>
import { useChatSessions, useChatSession } from '@/composables'

const { data: sessions, isLoading } = useChatSessions({
  refetchInterval: 30000
})

const { data: session } = useChatSession('session-123')
</script>
```

### 🔄 Chat Mutations (`useChatMutations.ts`)
Handles chat-related operations with optimistic updates.

- `useSendMessage()` - Send text messages
- `useUpdateSessionName()` - Update session name
- `useDeleteSession()` - Delete chat session
- `useRateMessage()` - Rate messages (thumbs up/down)
- `useMarkMessagesRead()` - Mark messages as read
- `useReactToMessage()` - React to messages
- `useAddUserToSession()` - Add user to session
- `useRemoveUserFromSession()` - Remove user from session
- `useForwardMessage()` - Forward messages

**Example Usage:**
```vue
<script setup>
import { useSendMessage, useRateMessage } from '@/composables'

const { mutate: sendMessage, isPending } = useSendMessage()
const { mutate: rateMessage } = useRateMessage()

const handleSendMessage = (content) => {
  sendMessage({
    userCode: 'user@example.com',
    sessionId: 'session-123',
    agentId: 1,
    members: [],
    question: content,
    group: 'default',
    pquestionType: 0,
    options: [],
  })
}
</script>
```

### ⚡ SignalR Integration (`useSignalRChat.ts`)
Real-time chat functionality with automatic query invalidation.

- `useSignalRChat()` - Main SignalR chat integration
- `useSignalRChatEvents()` - Type-safe event subscriptions
- `useSignalRChatMonitor()` - Connection monitoring UI

**Features:**
- Automatic connection management
- Real-time message handling
- Typing indicators
- User presence
- Query invalidation on events
- Connection status monitoring

**Example Usage:**
```vue
<script setup>
import { useSignalRChat, useSignalRChatMonitor } from '@/composables'

const {
  isConnected,
  sendTypingIndicator,
  markMessageAsRead
} = useSignalRChat()

const {
  statusMessage,
  statusColor,
  canInteract
} = useSignalRChatMonitor()

const handleTyping = (sessionId) => {
  if (isConnected.value) {
    sendTypingIndicator(sessionId)
  }
}
</script>
```

### 👥 Users (`useUsers.ts`)
User management and profile operations.

- `useSelectableUsers()` - Get users for session invitations
- `useUserSearch()` - Search users by name/email
- `useUserById()` - Get user by ID
- `useUserByEmail()` - Get user by email
- `useUsersByRole()` - Get users by role
- `useOnlineUsers()` - Get currently online users
- `useUserStats()` - Get user statistics
- `useUserActivity()` - Get user activity (paginated)

**Mutations:**
- `useUpdateUser()` - Update user profile
- `useUpdateUserAvailability()` - Update availability status
- `useUploadAvatar()` - Upload avatar image
- `useDeactivateUser()` - Deactivate user account
- `useReactivateUser()` - Reactivate user account

### ⚙️ Configuration (`useConfig.ts`)
Application configuration and feature flags.

- `useConfig()` - Get complete configuration
- `useConfigValue()` - Get specific config value by path
- `useAgentConfig()` - Get agent configuration
- `useAvailableAgents()` - Get available agents
- `useUIConfig()` - Get UI configuration
- `useFeatureFlags()` - Get all feature flags
- `useFeatureFlag()` - Check specific feature flag
- `useConfigHistory()` - Get configuration history

**Admin Mutations:**
- `useUpdateConfig()` - Update configuration
- `useUpdateAgentConfig()` - Update agent config
- `useUpdateFeatureFlags()` - Update feature flags
- `useExportConfig()` - Export configuration
- `useImportConfig()` - Import configuration
- `useResetConfig()` - Reset to defaults
- `useRestoreConfigVersion()` - Restore version

## Key Features

### 🔄 Automatic Cache Invalidation
Composables automatically invalidate related queries when mutations succeed:

```typescript
// Sending a message automatically invalidates:
// - Chat messages query
// - Chat session query
// - Chat sessions list
// - Unread counts
```

### ⚡ Optimistic Updates
Mutations provide immediate UI feedback:

```typescript
// Message appears immediately with "sending" status
// Rolls back on error, replaces with server response on success
const { mutate: sendMessage } = useSendMessage()
```

### 🔁 Real-time Integration
SignalR events automatically update Vue Query cache:

```typescript
// New message from SignalR invalidates related queries
// Updates Pinia store
// Triggers UI updates
```

### 🛡️ Error Handling
Comprehensive error handling with user-friendly messages:

```typescript
const { data, error, isLoading, isError } = useChatSessions()

// Error contains user-friendly message
// Automatic retry with exponential backoff
// Proper error boundaries
```

### 📱 Smart Caching
Different caching strategies for different data types:

```typescript
// User data: 5 minutes cache
// Config data: 30 minutes cache
// Unread counts: 15 seconds cache
// Search results: 2 minutes cache
```

## Usage Patterns

### Basic Query Usage
```vue
<script setup>
import { useChatSessions } from '@/composables'

const {
  data: sessions,
  isLoading,
  error,
  refetch
} = useChatSessions({
  refetchInterval: 60000 // Refresh every minute
})
</script>

<template>
  <div v-if="isLoading">Loading sessions...</div>
  <div v-else-if="error">Error: {{ error.message }}</div>
  <div v-else>
    <div v-for="session in sessions" :key="session.id">
      {{ session.name }}
    </div>
  </div>
</template>
```

### Mutation with Error Handling
```vue
<script setup>
import { useSendMessage } from '@/composables'

const {
  mutate: sendMessage,
  isPending,
  error,
  reset
} = useSendMessage()

const handleSend = async (content) => {
  try {
    await sendMessage({
      // ... message data
    })
    // Success handled by composable
  } catch (err) {
    // Error already handled by composable
    console.error('Send failed:', err)
  }
}
</script>
```

### SignalR Integration
```vue
<script setup>
import { useSignalRChat } from '@/composables'

const {
  isConnected,
  statusMessage,
  sendTypingIndicator
} = useSignalRChat()

watch(isConnected, (connected) => {
  console.log('SignalR connection:', connected)
})
</script>
```

## Performance Optimizations

1. **Query Deduplication**: Identical queries share the same network request
2. **Background Refetching**: Data stays fresh without blocking UI
3. **Pagination**: Infinite scroll for large datasets
4. **Selective Invalidation**: Only invalidate affected queries
5. **Error Recovery**: Automatic retry with exponential backoff
6. **Memory Management**: Proper garbage collection of unused data

## Testing

Composables are designed to be easily testable with Vitest and Vue Test Utils:

```typescript
import { useChatSessions } from '@/composables'
import { setupTestPinia } from '@/tests/utils'

describe('useChatSessions', () => {
  it('fetches chat sessions', async () => {
    setupTestPinia()

    const { data, isLoading } = useChatSessions()

    expect(isLoading.value).toBe(true)
    // ... test implementation
  })
})
```

## Migration from Direct Service Calls

Replace direct service calls with composables:

**Before:**
```typescript
const authStore = useAuthStore()
await authStore.login(credentials)
```

**After:**
```typescript
const { mutate: login } = useLogin()
await login(credentials)
```

This provides automatic caching, error handling, loading states, and UI updates.

## Best Practices

1. **Use Composables in `<script setup>`**: Leverage auto-imports and reactivity
2. **Destructure Return Values**: Get only what you need
3. **Handle Loading States**: Show appropriate loading indicators
4. **Handle Errors**: Display user-friendly error messages
5. **Use Query Keys**: Reference query keys for manual invalidation
6. **Optimize Cache Times**: Set appropriate cache durations for data types
7. **Use Enabled Option**: Conditionally enable queries based on auth state
8. **Background Refetching**: Use for data that changes frequently
9. **Pagination**: Use infinite scroll for large datasets
10. **Optimistic Updates**: Provide immediate feedback for mutations