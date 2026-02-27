---
name: vonno-implementation
description: Use when writing code for vonno/InnoChat — adding components, composables, API calls, Pinia stores, handling errors, or following naming conventions. Triggers on "implement feature", "add component", "create composable", "add API call", "call backend", "create service", "pinia store", "vue query", "handle error", "naming convention", "result type", "zod validation".
---

# Vonno Implementation Patterns

## Naming Conventions

| Layer | Convention | Example |
|---|---|---|
| Components | PascalCase `.vue` | `ChatMessages.vue` |
| Composables | camelCase, `use` prefix, `.ts` | `useChatQueries.ts` |
| Pinia stores | camelCase file, exports `useXxxStore()` | `stores/auth.ts` → `useAuthStore()` |
| Services | PascalCase class + singleton export | `class ChatService` → `export const chatService` |
| Types/interfaces | PascalCase, suffix `DTO`/`RequestDTO` | `AISessionMessageDTO`, `GetSessionByIdRequestDTO` |
| Enums | PascalCase | `AIAnswerType`, `ErrorCode` |
| Test files | Mirror source path, `.test.ts` suffix | `AuthService.test.ts` |

---

## Component Pattern

Verified from `app/components/chat/ChatMessages.vue`:

```vue
<script setup lang="ts">
import type { AISessionMessageDTO } from '@/types/api/schemas'
import { useAuthStore } from '@/app/stores/auth'

// Composables auto-imported by Nuxt — no import needed for useI18n, useRouter, navigateTo, etc.
const { t, locale } = useI18n()

interface Props {
  messages?: AISessionMessageDTO[]
  hideSenderNames?: boolean
  activeOptionsMessageId?: string
}

// withDefaults for optional props with defaults
const props = withDefaults(defineProps<Props>(), {
  messages: () => [],
  hideSenderNames: false,
  activeOptionsMessageId: undefined,
})

// Typed emits
const emit = defineEmits<{
  optionSubmitted: [answer: string]
}>()

// Store access inside setup
const authStore = useAuthStore()

// computed, methods follow...
</script>
```

Key rules:
- Always `<script setup lang="ts">`
- `withDefaults(defineProps<Props>(), {...})` for optional props
- Typed emits: `defineEmits<{ eventName: [payload: Type] }>()`
- Store access inside setup via `useXxxStore()`
- Add `data-testid` attributes on interactive/key elements for testing

---

## Composable / Vue Query Pattern

Verified from `app/composables/useChatQueries.ts` + `useChatMutations.ts`:

```typescript
// Query key factory — always use this pattern
export const chatQueryKeys = {
  all: ['chat'] as const,
  sessions: () => [...chatQueryKeys.all, 'sessions'] as const,
  session: (id: string) => [...chatQueryKeys.sessions(), id] as const,
}

// Query composable
export function useChatSession(sessionId: string) {
  return useQuery({
    queryKey: chatQueryKeys.session(sessionId),
    queryFn: async () => {
      const result = await chatService.getSessionById(sessionId)
      if (result.isErr()) throw result.error  // Vue Query catches and sets isError
      return result.value
    },
    enabled: authStore.isAuthenticated && !!sessionId,
    staleTime: 10 * 1000,
  })
}

// Mutation composable
export function useDeleteSession() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (sessionId: string) => chatService.deleteSession({ sessionId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: chatQueryKeys.sessions() })
    },
  })
}
```

**Component usage:**
```typescript
// Queries: destructure reactive state
const { data: session, isLoading, isError } = useChatSession(sessionId)

// Mutations: destructure mutate + status
const { mutate: deleteSession, isPending } = useDeleteSession()
```

---

## Pinia Store Pattern

Verified from `app/stores/auth.ts` + `app/stores/chat.ts`:

```typescript
export const useAuthStore = defineStore(
  'auth',
  () => {
    // State — use ref()
    const user = ref<UserDTO | null>(null)
    const isLoading = ref(false)

    // Computed — use computed()
    const isAuthenticated = computed(() => user.value !== null)
    const isAdmin = computed(() => user.value?.roles.includes('admin') ?? false)

    // Actions — async functions
    async function login(credentials: LoginRequestDTO): Promise<Result<UserDTO, AppError>> {
      // ...
    }

    // ALWAYS explicit return
    return { user, isLoading, isAuthenticated, isAdmin, login }
  },
  {
    // Persistence config (only if needed)
    persist: {
      key: 'innochat-auth',
      pick: ['user', 'accessToken', 'refreshToken'],
    },
  }
)
```

**Auth store note:** Uses manual localStorage/sessionStorage management (not purely relying on pinia-plugin-persistedstate) to support runtime storage mode switching between authenticated mode (`localStorage`) and public mode (`sessionStorage`). See `setStorageMode()` in `stores/auth.ts`.

---

## Service / API Call Pattern

Verified from `lib/api/services/AuthService.ts` + `lib/api/services/ChatService.ts`:

```typescript
export class ChatService {
  async getSessionById(sessionId: string): Promise<Result<AISessionDTO, AppError>> {
    try {
      const response = await apiClient.post<ApiResponse<AISessionDTO>>(
        '/api/AIWebAPI/GetSessionById',  // ← REAL backend path
        { sessionId, agentId: 1 },
      )

      if (!response.data.data) {
        return err(new AppError(ErrorCode.NOT_FOUND, 'Session not found'))
      }

      // ALWAYS validate response with Zod
      const parseResult = AISessionDTOSchema.safeParse(response.data.data)
      if (!parseResult.success) {
        return err(new AppError(ErrorCode.VALIDATION_ERROR, 'Invalid session data format',
          undefined, parseResult.error))
      }

      return ok(parseResult.data)
    } catch (error) {
      return err(normalizeApiError(error))  // Axios error → AppError
    }
  }
}

// ALWAYS export a singleton
export const chatService = new ChatService()
```

**All methods must:**
1. Return `Promise<Result<T, AppError>>`
2. Validate responses with Zod `Schema.safeParse()`
3. Return `ok(parsed.data)` on success
4. Return `err(new AppError(...))` on validation/logic failures
5. Catch exceptions and return `err(normalizeApiError(error))`

---

## Real API Endpoints (source-verified from `ChatService.ts`)

| Method | Endpoint | Service method |
|---|---|---|
| POST | `/api/AIWebAPI/question/text` | `sendQuestion()` |
| POST | `/api/AIWebAPI/welcomeText` | `getWelcomeMessage()` |
| POST | `/api/AIWebAPI/GetSessionHeadersByUserId` | `getSessionHeaders()` |
| POST | `/api/AIWebAPI/GetSessionById` | `getSessionById()` |
| POST | `/api/AIWebAPI/SetSessionName` | `updateSessionName()` |
| POST | `/api/AIWebAPI/DeleteSessionById` | `deleteSession()` |
| POST | `/api/AIWebAPI/GetUnreadMessages` | `getUnreadMessages()` |
| POST | `/api/AIWebAPI/GetSessionUnreadMessages` | `getSessionUnreadMessages()` |
| POST | `/api/AIWebAPI/startPublicChat` | `startPublicChat()` |
| POST | `/api/authentication/login` | `authService.login()` |
| POST | `/api/authentication/refresh-token` | `authService.refreshToken()` |
| GET  | `/api/authentication/profile` | `authService.getProfile()` |

---

## Error Handling

```typescript
// Call site pattern
const result = await chatService.getSessionById(id)
if (result.isErr()) {
  console.error(result.error.code, result.error.message)
  return
}
const session = result.value  // TypeScript knows this is AISessionDTO

// Type guards (from lib/errors/types.ts)
if (isValidationError(result.error)) { /* ... */ }
if (isUnauthorizedError(result.error)) { /* redirect to login */ }
if (isNetworkError(result.error)) { /* show offline message */ }
```

`AppError` properties: `.code` (`ErrorCode` enum), `.message`, `.statusCode`, `.details`

Error subclasses (use for specific cases):
- `ValidationError` — field-level validation failures, has `.validationErrors[]`
- `UnauthorizedError` / `AuthenticationError` / `InvalidCredentialsError` — auth chain
- `NetworkError` / `ConnectionError` — connectivity issues
- `TimeoutError` — request timeouts
- `ServerError` — 5xx responses
- `NotFoundError` — 404 responses

---

## Core DTOs to Know

Defined in `types/api/schemas.ts` (Zod-inferred):

| Type | Description |
|---|---|
| `UserDTO` | Users AND AI agents share this type — distinguish by `.isVirtual` and `.roles` |
| `AISessionHeaderDTO` | Session list item (no messages, just metadata) |
| `AISessionDTO` | Full session with `.messages: AISessionMessageDTO[]` |
| `AISessionMessageDTO` | Single message; `.messageType` is `AIAnswerType` enum |
| `AIWelcomeMessageDTO` | Agent's welcome message |
| `InnoChatConfig` | Runtime config from `/api/settings/config.json` |

`AIAnswerType` enum values (from `types/enums.ts`): `Text`, `Command`, `DataTable`, `Options`, `URL`, `Question`, `ErrorText`, `ServerTask`, `Empty`

---

See `references/patterns.md` for extended code examples of optimistic updates, public mode patterns, and SignalR cache integration.
