# InnoChat Frontend - Comprehensive API Endpoints Documentation

## Overview

This document lists all API endpoints used by the InnoChat frontend application. The app uses **Axios** as the HTTP client with a centralized instance, **TanStack Vue Query** for data fetching/caching, and **Zod** for runtime type validation.

- **Base URL**: Dynamically loaded from `/api/settings/config.json` → `config.backendUrl`
- **Default Timeout**: 30,000ms (configurable via `config.axiosTimeout`)
- **Authentication**: Bearer token in Authorization header

---

## 1. Configuration Endpoints

### GET `/api/settings/config.json`

**Purpose**: Load application configuration at startup (base URL, styling, public mode settings)

**When Used**:
- App initialization in `src/config.ts`
- Runtime config refresh in `ChatView.vue` and `PublicChatView.vue`

**Payload**: None (GET request)

**Response Type**: `InnoChatConfig`
```typescript
{
  mainColor: string
  backgroundColor: string
  watermarkEnabled: boolean
  partnerMessageBackgroundColor: string
  ownMessageBackgroundColor: string
  messageBorderThickness: number
  messageBorderColor: string
  messageBorderStyle: 'dotted' | 'solid' | 'dashed' | 'double'
  messageBorderRounded: number
  messageTextOwnItalic: boolean
  messageTextOwnBold: boolean
  messageTextOwnSize: number
  messageTextPartnerItalic: boolean
  messageTextPartnerBold: boolean
  messageTextPartnerSize: number
  backendUrl: string  // Backend API base URL
  baseUrl: string     // App base path (e.g., "/innochat")
  axiosTimeout: number
  publicMode: 0 | 1
  publicLoginEmail: string
  publicLoginPassword: string
  publicAgent: -1 | number
}
```

**File Location**: `src/config.ts:8`, `src/views/ChatView.vue:1288`

---

## 2. Authentication Endpoints

### POST `/api/authentication/login`

**Purpose**: Authenticate user with email and password

**When Used**: User login from `LoginView.vue`

**Payload Type**: `LoginRequestDTO`
```typescript
{
  mode: AuthenticationMode  // 0 = Basic, 1 = IBSystem
  email: string
  password: string          // Hashed password
}
```

**Response Type**: `ApiResponse<LoginResponseDTO>`
```typescript
{
  data: {
    accessToken: string
    refreshToken: string
    user: {
      id: number
      name: string
      email: string
      roles: ('admin' | 'user')[]
      image: string | null
      darkImage: string | null
    }
  } | null
  success?: string
  warning?: string
  error?: AppError
}
```

**File Location**: `src/stores/authenticationStore.ts:130`

---

### GET `/api/authentication/profile`

**Purpose**: Fetch authenticated user's profile data

**When Used**: After login or app initialization to restore user session

**Payload**: Query parameter `?email={userEmail}`

**Response Type**: `ApiResponse<User>`
```typescript
{
  data: {
    id: number
    name: string
    email: string
    roles: ('admin' | 'user')[]
    image: string | null
    darkImage: string | null
  } | null
  success?: string
  warning?: string
  error?: AppError
}
```

**File Location**: `src/stores/authenticationStore.ts:163`

---

### POST `/api/authentication/refresh-token`

**Purpose**: Refresh expired access token using refresh token

**When Used**: Automatically when a 401 response is received (via axios interceptor)

**Payload Type**: `RefreshTokenRequestDTO`
```typescript
{
  refreshToken: string
  accessToken: string
}
```

**Response Type**: `ApiResponse<RefreshTokenResponseDTO>`
```typescript
{
  data: {
    refreshToken: string
    accessToken: string
  } | null
  success?: string
  warning?: string
  error?: AppError
}
```

**File Location**: `src/stores/authenticationStore.ts:208`

---

### PATCH `/api/authentication/forgotten-password`

**Purpose**: Request password reset for forgotten password

**When Used**: Forgotten password flow from login screen

**Payload Type**: `ForgottenPasswordRequestDTO`
```typescript
{
  email: string
  password: string
  passwordAgain: string
}
```

**Response Type**: `ApiResponse<null>`

**File Location**: `src/stores/authenticationStore.ts:247`

---

### PATCH `/api/authentication/set-password`

**Purpose**: Set initial password for pending registration

**When Used**: First-time password setup for new users

**Payload Type**: `PasswordForPendingRegistrationRequestDTO`
```typescript
{
  email: string
  password: string
  passwordAgain: string
}
```

**Response Type**: `ApiResponse<null>`

**File Location**: `src/stores/authenticationStore.ts:281`

---

## 3. AI Chat Session Endpoints

### POST `/api/AIWebAPI/GetSessionHeadersByUserId`

**Purpose**: Get list of chat session headers for sidebar navigation

**When Used**: Loading chat history sidebar in `ChatView.vue`

**Payload Type**: `GetSessionHeadersByUserCodeRequestDTO`
```typescript
{
  userCode: string           // User's email
  agents: number[]           // Array of agent IDs to filter by
  filterText: string | null  // Search filter for session names
}
```

**Response Type**: `ApiResponse<SelectableAISessionListItem[]>`
```typescript
{
  data: Array<{
    sessionId: string
    sessionName: string
    userCode: string
    insertDate: string      // Formatted: "YYYY. MM. DD. HH:MM"
    messages: AISessionMessageDTO[]
    agentId: number
    agentImage: string
    agentDarkImage: string
    members: string[]
    memberDetails: SessionMember[]
    // UI state (added by frontend):
    isMenuOpen: boolean
    isNameEdited: boolean
    isActive: boolean
    unreadMessagesCount: number
  }> | null
  success?: string
  warning?: string
  error?: AppError
}
```

**File Location**: `src/views/ChatView.vue:711`

---

### POST `/api/AIWebAPI/GetSessionById`

**Purpose**: Get full session details including all messages

**When Used**: When user selects a chat session from sidebar

**Payload Type**: `GetSessionByIdRequestDTO`
```typescript
{
  sessionId: string
  agentId: number
}
```

**Response Type**: `ApiResponse<AISession>`
```typescript
{
  data: {
    sessionId: string
    sessionName: string
    userCode: string
    insertDate: string
    messages: AISessionMessageDTO[]  // All messages in session
    agentId: number
    agentImage: string
    agentDarkImage: string
    members: string[]
    memberDetails: Array<{
      email: string
      name: string
      isVirtual: boolean
    }>
  } | null
  success?: string
  warning?: string
  error?: AppError
}
```

**File Location**: `src/views/ChatView.vue:750`

---

### POST `/api/AIWebAPI/question/text`

**Purpose**: Send a question/message to the AI agent

**When Used**: When user submits a message in chat

**Payload Type**: `AiQuestionRequestDTO`
```typescript
{
  userCode: string                    // User's email
  sessionId: string                   // Current session ID (empty for new session)
  members: string[]                   // Session member emails
  agentId: number                     // Target AI agent ID
  question: string                    // User's question text
  group?: string                      // Optional group identifier
  pquestionType: AIQuestionType       // 0 = Text, 1 = Option
  options?: Array<{                   // Required when pquestionType = Option
    column: string
    orginalValue: string
    selectedValue: string
  }>
}
```

**Response Type**: `ApiResponse<AiQuestionResponseDTO>`
```typescript
{
  data: {
    question: string
    group: string
    type: AIQuestionType
    options?: Array<{
      column: string
      orginalValue: string
      selectedValue: string
    }>
  } | null
  success?: string
  warning?: string
  error?: AppError
}
```

**File Location**: `src/views/ChatView.vue:823`, `src/views/PublicChatView.vue:505`

---

### POST `/api/AIWebAPI/welcomeText`

**Purpose**: Get AI agent's welcome message

**When Used**: When starting a new chat session

**Payload**: Query parameter `?agentId={agentId}`

**Response Type**: `ApiResponse<AIWelcomeMessageDTO>`
```typescript
{
  data: {
    message: string
  } | null
  success?: string
  warning?: string
  error?: AppError
}
```

**File Location**: `src/views/ChatView.vue:873`, `src/views/PublicChatView.vue:352`

---

### POST `/api/AIWebAPI/DeleteSessionById`

**Purpose**: Delete a chat session

**When Used**: User deletes a session from sidebar menu

**Payload Type**: `DeleteSessionByIdrequestDTO`
```typescript
{
  sessionId: string
  agentId: number
}
```

**Response Type**: `ApiResponse<null>`

**File Location**: `src/views/ChatView.vue:911`

---

### POST `/api/AIWebAPI/SetSessionName`

**Purpose**: Rename a chat session

**When Used**: User edits session name in sidebar

**Payload Type**: `SetSessionNameRequestDTO`
```typescript
{
  sessionId: string
  sessionName: string
  agentId: number
}
```

**Response Type**: `ApiResponse<null>`

**File Location**: `src/views/ChatView.vue:938`

---

### POST `/api/AIWebAPI/getMessage`

**Purpose**: Get a specific message by ID (for lazy loading or refresh)

**When Used**: Fetching individual message content, especially for long/streaming messages

**Payload Type**: `GetMessageRequestDTO`
```typescript
{
  messageID: string
  agentId: number
}
```

**Response Type**: `ApiResponse<AISessionMessageDTO>`

**AISessionMessageDTO** is a discriminated union based on `messageType`:
```typescript
// Base fields for all message types:
{
  sendDate: string            // Formatted: "YYYY. MM. DD. HH:MM"
  senderUserCode: string
  senderName: string
  messageType: AIAnswerType   // Discriminator
  messageText: string | null
  isRated: boolean
  rating: number | null
  messageID: string
  readByUsers: string[]
  sessionId: string
}

// messageType variants:
// - 'text': Plain text message
// - 'dataTable': Has additional `dataTable` field with table structure
// - 'options': Has additional `options` field with selectable options
// - 'command': Command execution result
// - 'file': File download link
// - 'question': Follow-up question from AI
// - 'url': URL link message
// - 'errorText': Error message
// - 'serverTask': Server task status
// - 'empty': Empty/placeholder message
```

**File Location**: `src/views/ChatView.vue:969`, `src/views/PublicChatView.vue:404`

---

### POST `/api/AIWebAPI/SetSessionMessageRating`

**Purpose**: Rate a message as helpful or not helpful

**When Used**: User clicks thumbs up/down on an AI response

**Payload Type**: `SetSessionMessageRatingRequestDTO`
```typescript
{
  sessionId: string
  messageID: string
  rating: boolean    // true = helpful, false = not helpful
  agentId: number
}
```

**Response Type**: `ApiResponse<string>`

**File Location**: `src/composables/useAiChatHandler.ts:20`

---

### POST `/api/AIWebAPI/addUserToSession`

**Purpose**: Add another user to a shared chat session

**When Used**: Sharing a session with other users

**Payload Type**: `AddUserToSessionRequestDTO`
```typescript
{
  sessionId: string
  agentId: number
  userCode: string   // Email of user to add
}
```

**Response Type**: `ApiResponse<null>`

**File Location**: `src/views/ChatView.vue:1103`

---

### POST `/api/AIWebAPI/removeUserFromSession`

**Purpose**: Remove a user from a shared chat session

**When Used**: Removing a user from shared session

**Payload Type**:
```typescript
{
  sessionId: string
  agentId: number
  userCode: string   // Email of user to remove
}
```

**Response Type**: `ApiResponse<null>`

**File Location**: `src/views/ChatView.vue:1133`

---

### POST `/api/AIWebAPI/GetUnreadMessages`

**Purpose**: Get unread message counts for all sessions

**When Used**: Loading sidebar to show unread badges

**Payload Type**: `GetUnreadMessagesRequestDTO`
```typescript
{
  userCode: string
}
```

**Response Type**: `ApiResponse<GetUnreadMessagesDTO[]>`
```typescript
{
  data: Array<{
    sessionId: string
    unreadMessageCount: number
  }> | null
  success?: string
  warning?: string
  error?: AppError
}
```

**File Location**: `src/views/ChatView.vue:1156`

---

### POST `/api/AIWebAPI/GetSessionUnreadMessages`

**Purpose**: Get unread message count for a specific session

**When Used**: Checking unread count for individual session

**Payload Type**: `GetSessionUnreadMessagesRequestDTO`
```typescript
{
  userEmail: string
  sessionId: string
  agentId: number
}
```

**Response Type**: `ApiResponse<number>`

**File Location**: `src/views/ChatView.vue:1203`

---

### POST `/api/AIWebAPI/Set_SessionMessagesRead`

**Purpose**: Mark all messages in a session as read

**When Used**: When user opens/views a session

**Payload Type**: `SetSessionMessagesUnreadRequestDTO`
```typescript
{
  sessionID: string
  agent: number
  userCode: string
}
```

**Response Type**: `ApiResponse<null>`

**File Location**: `src/composables/useAiChatHandler.ts:43`

---

### POST `/api/AIWebAPI/react`

**Purpose**: Add a reaction/emoji to a message

**When Used**: User reacts to a message

**Payload Type**: `ReactDTO`
```typescript
{
  sessionId: string
  messageId: string
  agentId: number
}
```

**Response Type**: Not specified (generic response)

**File Location**: `src/views/ChatView.vue:1273`

---

### POST `/api/AIWebAPI/startPublicChat`

**Purpose**: Initialize a public (unauthenticated) chat session

**When Used**: Starting a chat in public mode

**Payload Type**: `StartPublicChatrequestDTO`
```typescript
{
  userEmail: string
  agentId: number
}
```

**Response Type**: `ApiResponse<AIPublicChatStartDTO>`
```typescript
{
  data: {
    user: SelectableUserResponseDTO
    agent: SelectableUserResponseDTO
  } | null
  success?: string
  warning?: string
  error?: AppError
}

// SelectableUserResponseDTO:
{
  id: number
  name: string
  email: string
  roles: ('admin' | 'user')[]
  image: string
  darkImage: string
  isVirtual: boolean
  url: string
  isAvailable: boolean
  isActive: boolean      // UI state
  isModified: boolean    // UI state
}
```

**File Location**: `src/views/PublicChatView.vue:670`

---

## 4. User Endpoints

### GET `/api/user/get-selectable-users`

**Purpose**: Get list of users that can be added to sessions

**When Used**: When sharing a session with other users

**Payload**: Query parameter `?email={currentUserEmail}`

**Response Type**: `ApiResponse<SelectableUserListResponseDTO>`
```typescript
{
  data: Array<{
    id: number
    name: string
    email: string
    roles: ('admin' | 'user')[]
    image: string
    darkImage: string
    isVirtual: boolean
    url: string
    isAvailable: boolean
    isActive: boolean
    isModified: boolean
  }> | null
  success?: string
  warning?: string
  error?: AppError
}
```

**File Location**: `src/composables/useUserQueries.ts:19`

---

## 5. Logging Endpoints

### POST `/api/Log/log`

**Purpose**: Send application logs to backend for monitoring/debugging

**When Used**: Throughout the app for error tracking, debugging, and audit logging

**Payload Type**: `LogInfoDTO`
```typescript
{
  source: string           // Component/file name
  title: string            // Log title/summary
  description: string      // Detailed description
  loglevel: LogLevel       // 'debug' | 'info' | 'warning' | 'error'
  user: string             // User email
  details: {
    stack: {
      minifiedTrace?: string
      cause: unknown
      name: string
    }
    validationIssues?: ZodIssue[]
    chatDetails?: {
      sessionId: string
      userDetails: {
        id: number
        email: string
      }
    }
  }
}
```

**Response Type**: Generic response

**File Location**: `src/composables/useLogQueries.ts:9`

**Helper Functions**:
- `saveLogInfo()` - Log level: Info
- `saveLogWarning()` - Log level: Warning
- `saveLogDebug()` - Log level: Debug
- `saveLogErrorFromComposable()` - Log level: Error

---

## 6. Enums Reference

### AuthenticationMode
```typescript
enum AuthenticationMode {
  Basic = 0,
  IBSystem = 1
}
```

### UserRole
```typescript
enum UserRole {
  Admin = 'admin',
  User = 'user'
}
```

### AIAnswerType (Message Types)
```typescript
enum AIAnswerType {
  Text = 'text',
  Command = 'command',
  DataTable = 'dataTable',
  File = 'file',
  Options = 'options',
  Question = 'question',
  URL = 'url',
  ErrorText = 'errorText',
  ServerTask = 'serverTask',
  Empty = 'empty'
}
```

### AIQuestionType
```typescript
enum AIQuestionType {
  Text = 0,
  Option = 1
}
```

### LogLevel
```typescript
enum LogLevel {
  Debug = 'debug',
  Info = 'info',
  Warning = 'warning',
  Error = 'error'
}
```

---

## 7. Common Response Wrapper

All API responses are wrapped in `ApiResponse<T>`:

```typescript
type ApiResponse<T> = {
  data: T | null          // The actual response data
  success?: string        // Success message (shown as notification)
  warning?: string        // Warning message (shown as notification)
  error?: AppError        // Error details if request failed
}

type AppError = {
  id: number
  code: ErrorCode
  message: string
  details: LogDetails
  severity: 'error' | 'warning' | 'info' | 'success'
  needsModal?: boolean
}
```

---

## 8. Summary Table

| # | Method | Endpoint | Purpose | Primary Usage |
|---|--------|----------|---------|---------------|
| 1 | GET | `/api/settings/config.json` | Load app configuration | App init |
| 2 | POST | `/api/authentication/login` | User login | LoginView |
| 3 | GET | `/api/authentication/profile` | Get user profile | Session restore |
| 4 | POST | `/api/authentication/refresh-token` | Refresh auth token | Axios interceptor |
| 5 | PATCH | `/api/authentication/forgotten-password` | Password reset | LoginView |
| 6 | PATCH | `/api/authentication/set-password` | Set initial password | First login |
| 7 | POST | `/api/AIWebAPI/GetSessionHeadersByUserId` | Get session list | Sidebar |
| 8 | POST | `/api/AIWebAPI/GetSessionById` | Get session details | Session selection |
| 9 | POST | `/api/AIWebAPI/question/text` | Send message to AI | Chat input |
| 10 | POST | `/api/AIWebAPI/welcomeText` | Get welcome message | New session |
| 11 | POST | `/api/AIWebAPI/DeleteSessionById` | Delete session | Sidebar menu |
| 12 | POST | `/api/AIWebAPI/SetSessionName` | Rename session | Sidebar edit |
| 13 | POST | `/api/AIWebAPI/getMessage` | Get single message | Message refresh |
| 14 | POST | `/api/AIWebAPI/SetSessionMessageRating` | Rate message | Thumbs up/down |
| 15 | POST | `/api/AIWebAPI/addUserToSession` | Share session | Session sharing |
| 16 | POST | `/api/AIWebAPI/removeUserFromSession` | Unshare session | Session sharing |
| 17 | POST | `/api/AIWebAPI/GetUnreadMessages` | Get unread counts | Sidebar badges |
| 18 | POST | `/api/AIWebAPI/GetSessionUnreadMessages` | Get session unreads | Session badge |
| 19 | POST | `/api/AIWebAPI/Set_SessionMessagesRead` | Mark as read | Session open |
| 20 | POST | `/api/AIWebAPI/react` | React to message | Message reaction |
| 21 | POST | `/api/AIWebAPI/startPublicChat` | Start public chat | PublicChatView |
| 22 | GET | `/api/user/get-selectable-users` | Get user list | Session sharing |
| 23 | POST | `/api/Log/log` | Send logs | Error tracking |

**Total: 23 unique API endpoints**

---

## 9. Key Source Files

- **HTTP Client**: `src/api/axiosInstance.ts`, `src/api/axiosSetup.ts`
- **Type Definitions**: `src/types/index.ts`, `src/types/validationSchemas.ts`
- **Auth Store**: `src/stores/authenticationStore.ts`
- **Chat Views**: `src/views/ChatView.vue`, `src/views/PublicChatView.vue`
- **Composables**: `src/composables/useAiChatHandler.ts`, `src/composables/useLogQueries.ts`, `src/composables/useUserQueries.ts`
- **Enums**: `src/enums/index.ts`
