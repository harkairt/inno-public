# TypeScript Reference

This document provides comprehensive documentation of all TypeScript types, interfaces, enums, and Zod schemas.

---

## 1. API DTOs

### 1.1 Authentication DTOs

```typescript
interface LoginRequestDTO {
  email: string
  password: string  // SHA512 hashed
}

interface LoginResponseDTO {
  accessToken: string
  refreshToken: string
  user: UserDTO
}

interface UserDTO {
  id: string
  email: string
  fullName: string
  displayName?: string
  avatarUrl?: string
  isVirtual: boolean
  role: 'User' | 'Agent' | 'Admin'
}
```

### 1.2 Chat DTOs

```typescript
interface AISessionDTO {
  id: string
  name: string
  isPrimary: boolean
  members: UserDTO[]
  messages: AISessionMessageDTO[]
  createdAt: string
  updatedAt: string
}

interface AISessionHeaderDTO {
  id: string
  name: string
  isPrimary: boolean
  memberCount: number
  lastMessageAt: string
  lastMessagePreview?: string
}

interface AISessionMessageDTO {
  id: string
  sessionId: string
  senderId: string
  senderName: string
  content: string
  answerType: AIAnswerType
  createdAt: string
  rating?: number
}

interface AiQuestionRequestDTO {
  sessionId: string
  agentId: string
  questionText: string
  questionType: AIQuestionType
}

interface AIWelcomeMessageDTO {
  message: string
  agentId: string
}

interface GetUnreadMessagesDTO {
  sessionCounts: Record<string, number>
  totalCount: number
}

interface AIPublicChatStartDTO {
  sessionId: string
  isNew: boolean
}
```

### 1.3 Configuration DTOs

```typescript
interface InnoChatConfig {
  version: string
  features: {
    messageRating: boolean
    groupChats: boolean
    fileUpload: boolean
  }
  limits: {
    maxMessageLength: number
    maxSessionMembers: number
  }
}
```

### 1.4 Logging DTOs

```typescript
interface LogInfoDTO {
  level: LogLevel
  message: string
  timestamp: string
  context?: Record<string, unknown>
  error?: {
    name: string
    message: string
    stack?: string
  }
  userId?: string
  sessionId?: string
}
```

---

## 2. Enums

**File:** `types/enums/index.ts`

### 2.1 AIAnswerType

```typescript
enum AIAnswerType {
  Text = 'text',
  Command = 'command',
  DataTable = 'datatable',
  Options = 'options',
  URL = 'url',
  Question = 'question',
  ErrorText = 'errortext',
  ServerTask = 'servertask',
  Empty = 'empty'
}
```

### 2.2 AIQuestionType

```typescript
enum AIQuestionType {
  Text = 'text',
  Options = 'options'
}
```

### 2.3 AuthenticationMode

```typescript
enum AuthenticationMode {
  Basic = 'basic',
  IBSystem = 'ibsystem'
}
```

### 2.4 LogLevel

```typescript
enum LogLevel {
  Debug = 'debug',
  Info = 'info',
  Warning = 'warning',
  Error = 'error'
}
```

### 2.5 ErrorCode

```typescript
enum ErrorCode {
  UNKNOWN = 'UNKNOWN',
  NETWORK_ERROR = 'NETWORK_ERROR',
  TIMEOUT = 'TIMEOUT',
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',
  NOT_FOUND = 'NOT_FOUND',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  SERVER_ERROR = 'SERVER_ERROR',
  TOKEN_EXPIRED = 'TOKEN_EXPIRED',
  SIGNALR_ERROR = 'SIGNALR_ERROR'
}
```

### 2.6 MessageStatus

```typescript
enum MessageStatus {
  Sending = 'sending',
  Sent = 'sent',
  Delivered = 'delivered',
  Read = 'read',
  Failed = 'failed'
}
```

### 2.7 ConnectionState

```typescript
enum ConnectionState {
  Disconnected = 'disconnected',
  Connecting = 'connecting',
  Connected = 'connected',
  Reconnecting = 'reconnecting',
  Failed = 'failed'
}
```

---

## 3. Zod Schemas

**File:** `types/api/schemas.ts`

All DTOs have corresponding Zod schemas for runtime validation.

### 3.1 Schema Features

- Lowercase enum transformation (backend sends lowercase)
- Optional field handling
- Date string validation

### 3.2 Example Schema

```typescript
import { z } from 'zod'

const UserDTOSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  fullName: z.string(),
  displayName: z.string().optional(),
  avatarUrl: z.string().url().optional(),
  isVirtual: z.boolean(),
  role: z.enum(['User', 'Agent', 'Admin'])
})

const AISessionMessageSchema = z.object({
  id: z.string().uuid(),
  sessionId: z.string().uuid(),
  senderId: z.string().uuid(),
  senderName: z.string(),
  content: z.string(),
  answerType: z.nativeEnum(AIAnswerType),
  createdAt: z.string().datetime(),
  rating: z.number().optional()
})
```

### 3.3 Enum Transformation

```typescript
// Backend sends lowercase, transform to enum
const answerTypeSchema = z.string().transform((val) => {
  const mapping: Record<string, AIAnswerType> = {
    'text': AIAnswerType.Text,
    'command': AIAnswerType.Command,
    // ...
  }
  return mapping[val.toLowerCase()] ?? AIAnswerType.Text
})
```

---

## 4. Internal Types

### 4.1 Store Types

```typescript
// Auth store state
interface AuthState {
  user: UserDTO | null
  accessToken: string | null
  refreshToken: string | null
  isLoading: boolean
  lastError: AppError | null
}

// Chat store state
interface ChatState {
  activeSessionId: string | null
  isLoading: boolean
  error: string | null
  typingUsers: Map<string, Set<string>>
  failedMessages: Map<string, FailedMessage[]>
  draftMessages: Map<string, string>
}

interface FailedMessage {
  id: string
  text: string
  agentId: string
  timestamp: number
}
```

### 4.2 Error Types

```typescript
class AppError extends Error {
  code: ErrorCode
  statusCode?: number
  details?: Record<string, unknown>

  constructor(message: string, code: ErrorCode, statusCode?: number) {
    super(message)
    this.code = code
    this.statusCode = statusCode
  }
}
```

### 4.3 SignalR Types

```typescript
interface SignalRState {
  isConnected: boolean
  isConnecting: boolean
  isReconnecting: boolean
  connectionId: string | null
  lastError: Error | null
}

interface TypingInfo {
  name: string
  email: string
  sessionId: string
}
```

### 4.4 Query Types

```typescript
// Query key factory
const chatQueryKeys = {
  all: ['chat'] as const,
  sessions: () => [...chatQueryKeys.all, 'sessions'] as const,
  session: (id: string) => [...chatQueryKeys.sessions(), id] as const,
  unread: () => [...chatQueryKeys.all, 'unread'] as const,
  welcome: (agentId: string) => [...chatQueryKeys.all, 'welcome', agentId] as const,
  message: (id: string) => [...chatQueryKeys.all, 'message', id] as const
}
```

---

## 5. Component Props Types

### 5.1 ChatMessages Props

```typescript
interface ChatMessagesProps {
  messages: AISessionMessageDTO[]
  currentUserId: string
}
```

### 5.2 MessageInput Props

```typescript
interface MessageInputProps {
  sessionId: string
  agents: UserDTO[]
}

interface MessageInputEmits {
  (e: 'send', payload: { text: string; agentId: string }): void
}
```

### 5.3 AgentTile Props

```typescript
interface AgentTileProps {
  agent: UserDTO
  selected: boolean
}

interface AgentTileEmits {
  (e: 'select'): void
}
```

---

## 6. Utility Types

### 6.1 Result Type (neverthrow)

```typescript
import { Result, ok, err } from 'neverthrow'

// Function returning Result
async function fetchData(): Promise<Result<Data, AppError>> {
  try {
    const data = await api.get('/endpoint')
    return ok(data)
  } catch (error) {
    return err(normalizeApiError(error))
  }
}

// Using Result
const result = await fetchData()
if (result.isOk()) {
  const data = result.value
} else {
  const error = result.error
}
```

### 6.2 Common Utility Types

```typescript
// Nullable
type Nullable<T> = T | null

// Optional
type Optional<T> = T | undefined

// Record with string keys
type StringRecord<T> = Record<string, T>

// Deep Partial
type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P]
}
```

---

## 7. Type Guards

```typescript
// User type guard
function isVirtualUser(user: UserDTO): boolean {
  return user.isVirtual === true
}

// Admin check
function isAdmin(user: UserDTO): boolean {
  return user.role === 'Admin'
}

// Error type guard
function isAppError(error: unknown): error is AppError {
  return error instanceof AppError
}
```

---

## 8. File Locations

| Type Category | File Path |
|---------------|-----------|
| API DTOs | `types/api/schemas.ts` |
| Enums | `types/enums/index.ts` |
| Base types | `types/api/base.ts` |
| Log types | `types/api/log-types.ts` |
| Error types | `lib/errors/types.ts` |
| SignalR types | `lib/signalr/types.ts` |
| Chat types | `lib/types/chat/` |

---

## Related Documentation

- [API.md](./API.md) - API service definitions
- [STATE.md](./STATE.md) - Store type usage
- [CONVENTIONS.md](./CONVENTIONS.md) - Type naming conventions
