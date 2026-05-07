---
name: vonno-testing
description: Use when writing tests for vonno/InnoChat — unit tests, component tests, service tests, API mocking, Pinia store mocking, or Playwright E2E. Triggers on "write test", "unit test", "test component", "mock API", "mock endpoint", "msw handler", "vitest", "testing library", "mock store", "coverage", "playwright", "e2e test".
---

# Vonno Testing Guide

## Test Stack

| Tool | Purpose |
|---|---|
| Vitest | Test runner, mocking (`vi.mock`, `vi.fn`, `vi.mocked`) |
| `@testing-library/vue` | Component rendering + DOM assertions |
| happy-dom | Lightweight DOM environment |
| MSW 2 | API endpoint mocking (`http.get/post`, `HttpResponse.json`) |
| Pinia (test instance) | Store setup via `createPinia()` / `setActivePinia()` |
| Playwright | E2E browser tests |

**Coverage target:** 80% branches/functions/lines/statements (goal). Current enforced thresholds in `vitest.config.ts` are lower: 66% branches, 42% functions, 33% lines, 33% statements — the project is below target.

---

## Test File Locations

Mirror source structure under `tests/unit/`:

```
lib/api/services/ChatService.ts          →  tests/unit/lib/api/services/ChatService.test.ts
app/composables/useAuth.ts               →  tests/unit/composables/useAuth.test.ts
app/components/chat/ChatMessages.vue     →  tests/unit/components/chat/ChatMessages.test.ts
app/pages/chats/[sessionId].vue          →  tests/unit/pages/chats/sessionId.test.ts
```

---

## Global Test Setup (`tests/setup.ts`)

Already configured globally — you don't need to repeat this in tests:

- Vue reactivity APIs (`ref`, `computed`, `watch`, etc.) stubbed as globals
- `useI18n` → `{ t: (key) => key, locale: ref('en') }`
- `useToast` → `{ add: vi.fn(), remove: vi.fn() }`
- `useWindowSize` → `{ width: ref(1280), height: ref(800) }`
- Nuxt globals: `definePageMeta`, `navigateTo`, `defineNuxtRouteMiddleware`
- Pinia: `setActivePinia(createPinia())` called in `beforeAll`
- VueQueryPlugin installed on a test app in `beforeAll`
- **MSW is NOT wired into the global setup.** Tests mock `apiClient` directly with `vi.mock('@/lib/api/client', ...)`. MSW handlers in `tests/msw/` exist but are not connected to Vitest. Do not rely on MSW for unit/component tests — mock `apiClient` instead.

---

## Service Test Pattern

Verified from `tests/unit/lib/api/services/AuthService.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { authService } from '@/lib/api/services/AuthService'
import { apiClient } from '@/lib/api/client'
import { ErrorCode } from '@/types/enums'

// Mock the Axios client — must come before imports that use it
vi.mock('@/lib/api/client', () => ({
  apiClient: {
    post: vi.fn(),
    get: vi.fn(),
  }
}))

describe('AuthService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should successfully refresh tokens', async () => {
    vi.mocked(apiClient.post).mockResolvedValue({
      data: {
        data: { AccessToken: 'new-access', RefreshToken: 'new-refresh' }
      }
    })

    const result = await authService.refreshToken('old-access', 'old-refresh')

    // Assert Result type first
    expect(result.isOk()).toBe(true)
    if (result.isOk()) {
      expect(result.value.AccessToken).toBe('new-access')
    }

    // Assert API was called correctly
    expect(apiClient.post).toHaveBeenCalledWith(
      '/api/authentication/refresh-token',
      { accessToken: 'old-access', refreshToken: 'old-refresh' }
    )
  })

  it('should return error when response has no data', async () => {
    vi.mocked(apiClient.post).mockResolvedValue({ data: { data: null } })

    const result = await authService.refreshToken('access', 'refresh')

    expect(result.isErr()).toBe(true)
    if (result.isErr()) {
      expect(result.error.code).toBe(ErrorCode.UNAUTHORIZED)
    }
  })
})
```

---

## Component Test Pattern

Verified from `tests/unit/components/chat/ChatMessages.test.ts`:

```typescript
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/vue'
import ChatMessages from '~/components/chat/ChatMessages.vue'
import type { AISessionMessageDTO } from '@/types/api/schemas'

// Mock the auth store
vi.mock('@/app/stores/auth', () => ({
  useAuthStore: vi.fn(() => ({
    user: { email: 'user@test.com' }
  }))
}))

// Factory helper for test data
function makeMessage(overrides: Partial<AISessionMessageDTO> = {}): AISessionMessageDTO {
  return {
    messageID: 'msg-1',
    messageText: 'Hello world',
    messageType: 0,  // AIAnswerType.Text
    senderUserCode: 'user@test.com',
    senderName: 'Test User',
    sendDate: new Date().toISOString(),
    isRated: false,
    rating: null,
    readByUsers: [],
    sessionId: 'session-1',
    ...overrides,
  }
}

describe('ChatMessages', () => {
  it('renders messages', () => {
    const messages = [makeMessage({ messageText: 'Hello!' })]

    render(ChatMessages, {
      props: { messages },
      global: {
        // Stub heavy components to avoid rendering them in unit tests
        stubs: {
          MarkdownContent: { template: '<div>{{ content }}</div>', props: ['content'] },
          OptionsMessage: true,
        }
      }
    })

    expect(screen.getByText('Hello!')).toBeTruthy()
    expect(screen.getByTestId('messages-container')).toBeTruthy()
  })

  it('shows empty state when no messages', () => {
    const { container } = render(ChatMessages, {
      props: { messages: [] },
      global: { stubs: { UEmpty: true } }
    })
    // Use queryByRole for elements that may or may not exist
    expect(container.querySelector('[data-testid="messages-container"]')).toBeTruthy()
  })
})
```

---

## MSW Handler Pattern

Handlers live in `tests/msw/handlers/` per domain:

```typescript
// tests/msw/handlers/chat.ts
import { http, HttpResponse } from 'msw'

export const chatHandlers = [
  // ⚠️ Use real backend URLs — NOT simplified paths
  // Real: POST /api/AIWebAPI/GetSessionHeadersByUserId (from ChatService.ts)
  http.post('*/api/AIWebAPI/GetSessionHeadersByUserId', () =>
    HttpResponse.json({
      data: [{ sessionId: 'sess-1', sessionName: 'Test Chat', /* ... */ }],
      error: null,
      success: null,
      warning: null
    })
  ),

  http.post('*/api/AIWebAPI/GetSessionById', () =>
    HttpResponse.json({
      data: {
        sessionId: 'sess-1',
        messages: [],
        // ...
      },
      error: null,
      success: null,
      warning: null
    })
  ),
]
```

Register in `tests/msw/server.ts` (already wired to Vitest global setup):

```typescript
import { setupServer } from 'msw/node'
import { chatHandlers } from './handlers/chat'
import { authHandlers } from './handlers/auth'

export const server = setupServer(...chatHandlers, ...authHandlers)
```

**Warning:** The existing handlers in `tests/msw/handlers/chat.ts` use simplified paths (`/api/chat/sessions`) that don't match the real backend paths. When writing new handlers, use the actual paths from `ChatService.ts`.

---

## Store Mock Pattern (in composable tests)

```typescript
import { vi } from 'vitest'
import { useAuthStore } from '@/app/stores/auth'

vi.mock('@/app/stores/auth', () => ({
  useAuthStore: vi.fn()
}))

beforeEach(() => {
  vi.mocked(useAuthStore).mockReturnValue({
    user: { email: 'test@example.com', name: 'Test User', id: 1 },
    isAuthenticated: true,
    accessToken: 'mock-token',
  } as any)
})
```

---

## Run Commands

```bash
npm run test           # Vitest unit tests (watch mode)
npm run test:coverage  # With coverage report (must hit 80%)
npm run test:e2e       # Playwright E2E
npm run lint           # ESLint
npm run typecheck      # vue-tsc type check
```

---

## Common Mistakes

| Mistake | Fix |
|---|---|
| MSW handler with simplified path (`/api/chat/sessions`) | Use real path from service file (`/api/AIWebAPI/GetSessionHeadersByUserId`) |
| Not wrapping response in `{ data: ..., error: null, success: null, warning: null }` | Backend always wraps in `ApiResponse<T>` — mock must match |
| Asserting `result.value` without checking `result.isOk()` first | Always check `isOk()` / `isErr()` before accessing `.value` / `.error` |
| Importing Nuxt auto-imports (`useI18n`, `useRouter`) | These are global stubs — no import needed in test files |
| Not using `data-testid` in component | Add to component, query with `getByTestId` in tests |

---

## Factory Functions (`tests/utils/factories.ts`)

```typescript
import { makeUser, makeSession, makeMessage, makeApiResponse, makeAxiosError, resetUserIdCounter } from '@/tests/utils/factories'

// Wrap any response data in the backend's ApiResponse<T> envelope
makeApiResponse(data)  // → { data: { data, success: null, warning: null, error: null } }

// Typed entity factories with auto-incrementing IDs
makeUser(overrides?)      // → UserDTO
makeSession(overrides?)   // → AISessionHeaderDTO
makeMessage(overrides?)   // → AISessionMessageDTO

// Rejection testing
makeAxiosError(404)       // → Error & { response: { status: 404 } }

// Reset auto-incrementing counters in beforeEach when stable IDs matter
resetUserIdCounter()
```

Always use `makeApiResponse()` when mocking `apiClient` responses — tests fail silently if the wrapper is missing.

---

## Coverage Measured Paths

Coverage is measured on:
- `lib/**/*.{js,ts}`
- `stores/**/*.{js,ts}`
- `composables/**/*.{js,ts}`
- `utils/**/*.{js,ts}`
- `types/**/*.ts`

**`app/components/**` and `app/pages/**` are NOT in the coverage include list.** Component and page tests still run, but they don't count toward coverage thresholds.

---

See `references/test-examples.md` for full, runnable examples of page tests, mutation tests, and Playwright E2E.
