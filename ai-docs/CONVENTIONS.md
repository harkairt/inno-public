# Code Conventions

This document provides comprehensive documentation of coding standards, patterns, and best practices used in the Vonno codebase.

---

## 1. File Naming

| Type | Convention | Example |
|------|------------|---------|
| Components | PascalCase | `ChatMessages.vue` |
| Composables | camelCase + `use` | `useChatQueries.ts` |
| Stores | camelCase + `use` | `useAuthStore` (in `auth.ts`) |
| Services | PascalCase + `Service` | `AuthService.ts` |
| Plugins (client) | kebab-case + `.client.ts` | `api-interceptors.client.ts` |
| Middleware (global) | kebab-case + `.global.ts` | `auth.global.ts` |
| Types | PascalCase | `UserDTO` |
| Enums | PascalCase | `AIAnswerType` |

---

## 2. Code Style

### 2.1 TypeScript

- Strict mode enabled
- Explicit return types on public functions
- Interfaces preferred over types for DTOs
- Enums for fixed sets of values

```typescript
// Good: Explicit return type
async function fetchData(): Promise<Result<Data, AppError>> {
  // ...
}

// Good: Interface for DTO
interface UserDTO {
  id: string
  email: string
}

// Good: Enum for fixed values
enum MessageStatus {
  Sending = 'sending',
  Sent = 'sent'
}
```

### 2.2 Vue Components

- Always use `<script setup lang="ts">`
- Props with TypeScript interfaces
- Emits with TypeScript types
- Composables for reusable logic

```vue
<script setup lang="ts">
interface Props {
  user: UserDTO
  size?: 'sm' | 'md' | 'lg'
}

const props = withDefaults(defineProps<Props>(), {
  size: 'md'
})

const emit = defineEmits<{
  (e: 'select', user: UserDTO): void
}>()
</script>

<template>
  <div @click="emit('select', user)">
    <!-- content -->
  </div>
</template>
```

### 2.3 ESLint Rules

**File:** `eslint.config.mjs`

- Vue recommended rules
- TypeScript strict rules
- Tailwind class order

---

## 3. Error Handling Patterns

### 3.1 Service Layer

Always return `Result<T, AppError>`:

```typescript
import { ok, err, Result } from 'neverthrow'
import { normalizeApiError } from '@/lib/errors/normalize'

export class SomeService {
  static async fetchData(): Promise<Result<Data, AppError>> {
    try {
      const response = await apiClient.get('/endpoint')
      return ok(response.data)
    } catch (error) {
      return err(normalizeApiError(error))
    }
  }
}
```

### 3.2 Component Layer

Handle Result at component level:

```typescript
const result = await SomeService.fetchData()

if (result.isErr()) {
  // Show error to user
  toast.error(result.error.message)
  return
}

// Use data
const data = result.value
```

### 3.3 Async/Await

Always use try-catch for async operations:

```typescript
async function doSomething() {
  try {
    const result = await someAsyncOperation()
    return ok(result)
  } catch (error) {
    return err(normalizeApiError(error))
  }
}
```

---

## 4. API Patterns

### 4.1 Service Class Structure

```typescript
export class SomeService {
  private static readonly BASE = '/api/some'

  static async getData(id: string): Promise<Result<Data, AppError>> {
    try {
      const response = await apiClient.get(`${this.BASE}/${id}`)
      return ok(response.data)
    } catch (error) {
      return err(normalizeApiError(error))
    }
  }

  static async createData(data: CreateDTO): Promise<Result<Data, AppError>> {
    try {
      const response = await apiClient.post(this.BASE, data)
      return ok(response.data)
    } catch (error) {
      return err(normalizeApiError(error))
    }
  }
}
```

### 4.2 Zod Validation

Validate API responses:

```typescript
import { z } from 'zod'

const DataSchema = z.object({
  id: z.string(),
  name: z.string()
})

static async getData(): Promise<Result<Data, AppError>> {
  try {
    const response = await apiClient.get('/endpoint')
    const parsed = DataSchema.safeParse(response.data)

    if (!parsed.success) {
      return err(new ValidationError('Invalid response', parsed.error))
    }

    return ok(parsed.data)
  } catch (error) {
    return err(normalizeApiError(error))
  }
}
```

---

## 5. State Patterns

### 5.1 Pinia vs Vue Query

| Use Pinia for | Use Vue Query for |
|---------------|-------------------|
| Local UI state | Server data |
| Auth tokens | API responses |
| User preferences | Cached data |
| Failed message queue | Session/message data |
| Draft messages | Real-time data |

### 5.2 Persistence Configuration

```typescript
// Pinia store with persistence
export const useAuthStore = defineStore('auth', () => {
  const user = ref<UserDTO | null>(null)
  const accessToken = ref<string | null>(null)

  return { user, accessToken }
}, {
  persist: {
    key: 'app-auth',
    pick: ['user', 'accessToken']
  }
})
```

### 5.3 Optimistic Updates

```typescript
const { mutateAsync } = useMutation({
  mutationFn: sendMessage,
  onMutate: async (variables) => {
    // Cancel outgoing refetches
    await queryClient.cancelQueries({ queryKey })

    // Snapshot previous value
    const previous = queryClient.getQueryData(queryKey)

    // Optimistically update
    queryClient.setQueryData(queryKey, (old) => [...old, newMessage])

    return { previous }
  },
  onError: (err, variables, context) => {
    // Rollback on error
    queryClient.setQueryData(queryKey, context.previous)
  },
  onSettled: () => {
    queryClient.invalidateQueries({ queryKey })
  }
})
```

---

## 6. Component Patterns

### 6.1 Props with Defaults

```typescript
interface Props {
  title: string
  size?: 'sm' | 'md' | 'lg'
  disabled?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  size: 'md',
  disabled: false
})
```

### 6.2 Emits with Types

```typescript
const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void
  (e: 'submit', data: FormData): void
}>()
```

### 6.3 Computed vs Methods

Use computed for derived state, methods for actions:

```typescript
// Good: Computed for derived state
const fullName = computed(() => `${user.firstName} ${user.lastName}`)

// Good: Method for action
function handleSubmit() {
  // ...
}
```

---

## 7. Composable Patterns

### 7.1 Naming

Always prefix with `use`:

```typescript
// Good
export function useChatQueries() { }
export function useAuth() { }

// Bad
export function getChatQueries() { }
export function auth() { }
```

### 7.2 Return Object

Return an object with named properties:

```typescript
export function useAuth() {
  const authStore = useAuthStore()

  const isAuthenticated = computed(() => authStore.isAuthenticated)
  const user = computed(() => authStore.user)

  async function login(email: string, password: string) {
    // ...
  }

  return {
    isAuthenticated,
    user,
    login
  }
}
```

### 7.3 Cleanup

Handle cleanup in composables:

```typescript
export function useEventListener(target: EventTarget, event: string, handler: Function) {
  onMounted(() => {
    target.addEventListener(event, handler)
  })

  onUnmounted(() => {
    target.removeEventListener(event, handler)
  })
}
```

---

## 8. Testing Patterns

### 8.1 Test Organization

```typescript
describe('ComponentName', () => {
  describe('rendering', () => {
    it('should render correctly', () => { })
  })

  describe('interactions', () => {
    it('should handle click', () => { })
  })

  describe('edge cases', () => {
    it('should handle empty data', () => { })
  })
})
```

### 8.2 Mock Patterns

```typescript
// Factory function for test data
function createMockUser(overrides = {}): UserDTO {
  return {
    id: 'user-123',
    email: 'test@example.com',
    fullName: 'Test User',
    ...overrides
  }
}
```

---

## 9. CSS/Styling Patterns

### 9.1 Tailwind Classes

Use Tailwind for all styling:

```vue
<template>
  <div class="flex items-center gap-2 p-4 rounded-lg bg-white dark:bg-gray-800">
    <!-- content -->
  </div>
</template>
```

### 9.2 Dark Mode

Always include dark mode variants:

```vue
<div class="bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100">
```

### 9.3 Responsive Design

Use Tailwind breakpoints:

```vue
<div class="flex flex-col md:flex-row gap-4">
  <div class="w-full md:w-1/2">...</div>
  <div class="w-full md:w-1/2">...</div>
</div>
```

---

## 10. Import Ordering

```typescript
// 1. Node built-ins
import { fileURLToPath } from 'node:url'

// 2. External packages
import { ref, computed } from 'vue'
import { useRoute } from 'vue-router'

// 3. Internal modules (absolute imports)
import { useAuthStore } from '@/app/stores/auth'
import { AuthService } from '@/lib/api/services/AuthService'

// 4. Types
import type { UserDTO } from '@/types/api/schemas'
```

---

## 11. Git Conventions

### 11.1 Commit Messages

```
type(scope): description

feat(chat): add message rating feature
fix(auth): resolve token refresh race condition
refactor(api): simplify error handling
docs: update README
```

### 11.2 Branch Naming

```
feature/add-message-rating
fix/token-refresh-issue
refactor/api-error-handling
```

---

## Related Documentation

- [ARCHITECTURE.md](./ARCHITECTURE.md) - Project structure
- [TYPES.md](./TYPES.md) - Type definitions
- [TESTING.md](./TESTING.md) - Test patterns
