# InnoChat Test Examples — Full Working Code

## Mutation Composable Test

Testing `useSendMessage` with optimistic update verification:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/vue'
import { useSendMessage } from '~/composables/useChatMutations'
import { chatService } from '@/lib/api/services/ChatService'
import { useAuthStore } from '@/app/stores/auth'
import type { AiQuestionRequestDTO } from '@/types/api/schemas'

vi.mock('@/lib/api/services/ChatService', () => ({
  chatService: { sendQuestion: vi.fn() }
}))

vi.mock('@/app/stores/auth', () => ({
  useAuthStore: vi.fn()
}))

const mockRequest: AiQuestionRequestDTO = {
  sessionId: 'sess-1',
  question: 'Hello AI',
  userCode: 'user@test.com',
  agentId: 1,
  members: [],
  group: 'default',
  pquestionType: 0,
  options: [],
}

describe('useSendMessage', () => {
  beforeEach(() => {
    vi.mocked(useAuthStore).mockReturnValue({
      user: { email: 'user@test.com', name: 'Test User', id: 1 },
      isAuthenticated: true,
    } as any)
  })

  it('calls chatService.sendQuestion with correct params', async () => {
    vi.mocked(chatService.sendQuestion).mockResolvedValue({
      isOk: () => true,
      isErr: () => false,
      value: { messageID: 'msg-1', messageText: 'AI response', messageType: 0 } as any
    } as any)

    const { result } = renderHook(() => useSendMessage())
    result.current.mutate(mockRequest)

    await waitFor(() => {
      expect(chatService.sendQuestion).toHaveBeenCalledWith(mockRequest)
    })
  })
})
```

## Page-Level Component Test

Testing `app/pages/chats/[sessionId].vue`:

```typescript
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/vue'
import SessionPage from '~/pages/chats/[sessionId].vue'

// Mock the composables used by the page
vi.mock('~/composables/useChatQueries', () => ({
  useChatSession: vi.fn(() => ({
    data: ref({
      sessionId: 'sess-1',
      sessionName: 'Test Chat',
      messages: [
        {
          messageID: 'msg-1',
          messageText: 'Hello!',
          messageType: 0,
          senderUserCode: 'user@test.com',
          senderName: 'User',
          sendDate: new Date().toISOString(),
          isRated: false,
          rating: null,
          readByUsers: [],
          sessionId: 'sess-1',
        }
      ],
    }),
    isLoading: ref(false),
    isError: ref(false),
  }))
}))

vi.mock('@/app/stores/auth', () => ({
  useAuthStore: vi.fn(() => ({
    user: { email: 'user@test.com', name: 'User', id: 1 },
    isAuthenticated: true,
  }))
}))

// Mock useRoute (Nuxt auto-imported)
vi.stubGlobal('useRoute', () => ({
  params: { sessionId: 'sess-1' }
}))

describe('Session Page', () => {
  it('renders session messages', async () => {
    render(SessionPage, {
      global: {
        stubs: {
          ChatMessages: { template: '<div data-testid="chat-messages"><slot /></div>' },
          MessageInput: true,
          NuxtLayout: { template: '<div><slot /></div>' },
        }
      }
    })

    await waitFor(() => {
      expect(screen.getByTestId('chat-messages')).toBeTruthy()
    })
  })
})
```

## MSW Handler with Error Response

```typescript
// tests/msw/handlers/chat.ts
import { http, HttpResponse } from 'msw'

export const chatHandlers = [
  // Success handler
  http.post('*/api/AIWebAPI/GetSessionById', ({ request }) => {
    return HttpResponse.json({
      data: {
        sessionId: 'sess-1',
        sessionName: 'Mock Session',
        messages: [],
        agentId: 1,
        agentName: 'Test Agent',
        userCode: 'user@test.com',
      },
      error: null,
      success: null,
      warning: null,
    })
  }),

  // 404 response
  http.post('*/api/AIWebAPI/GetSessionById', () => {
    return HttpResponse.json(
      { data: null, error: { code: 'NOT_FOUND', message: 'Session not found', statusCode: 404 }, success: null, warning: null },
      { status: 404 }
    )
  }),
]
```

**Override per-test with server.use:**

```typescript
import { server } from '../../../msw/server'

it('handles 404 gracefully', async () => {
  server.use(
    http.post('*/api/AIWebAPI/GetSessionById', () =>
      HttpResponse.json({ data: null, error: null, success: null, warning: null }, { status: 404 })
    )
  )

  const result = await chatService.getSessionById('nonexistent')
  expect(result.isErr()).toBe(true)
  expect(result.error.code).toBe('NOT_FOUND')
})
```

## Playwright E2E Test

```typescript
// tests/e2e/chat.spec.ts
import { test, expect } from '@playwright/test'

test.describe('Chat Session', () => {
  test.beforeEach(async ({ page }) => {
    // Login before each test
    await page.goto('/login')
    await page.fill('[data-testid="email-input"]', 'test@example.com')
    await page.fill('[data-testid="password-input"]', 'password')
    await page.click('[data-testid="login-button"]')
    await page.waitForURL('/')
  })

  test('can send a message', async ({ page }) => {
    await page.goto('/chats/sess-1')
    await page.waitForSelector('[data-testid="messages-container"]')

    await page.fill('[data-testid="message-input"]', 'Hello AI!')
    await page.click('[data-testid="send-button"]')

    // Wait for optimistic message to appear
    await expect(page.locator('[data-testid="messages-container"]'))
      .toContainText('Hello AI!')
  })
})
```

## Testing Vue Query with Real Cache

When you need to test cache interactions:

```typescript
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } }
})

render(MyComponent, {
  global: {
    plugins: [[VueQueryPlugin, { queryClient }]]
  }
})

// Pre-populate cache
queryClient.setQueryData(['chat', 'sessions'], mockSessions)

// After mutation, verify cache was updated
await waitFor(() => {
  const sessions = queryClient.getQueryData(['chat', 'sessions'])
  expect(sessions).toHaveLength(2)
})
```

## Integration Test — Login + Silent Token Refresh (MSW at the boundary)

The reference integration test (`tests/integration/auth-token-lifecycle.test.ts`)
exercises the **real** stack end-to-end: real Pinia auth store → real
`AuthService` / `ChatService` → real axios → real interceptor chain
(401 → refresh → retry queue). Nothing mocks `apiClient`, a service, or a store —
HTTP is faked only at the network boundary by MSW.

```typescript
import { describe, it, expect, vi } from 'vitest'
import { sha512 } from 'js-sha512'
import { server, http } from '@/tests/msw/server'
import { apiOk, apiError } from '@/tests/msw/http'
import { makeUser, makeSession } from '@/tests/utils/factories'
import { seedAuthStorage } from '@/tests/utils/authSeed'
import { installFakeSignalR } from '@/tests/utils/fakeSignalR'
import { useAuthStore } from '@/app/stores/auth'
import { chatService } from '@/lib/api/services/ChatService'
import { configureApiInterceptors } from '@/lib/api/interceptors/setup'
import { AuthenticationMode } from '@/types/enums'
import type { GetSessionHeadersByUserIdRequestDTO } from '@/types/api/schemas'

const SESSIONS_PATH = '/api/AIWebAPI/GetSessionHeadersByUserId'
const REFRESH_PATH = '/api/authentication/refresh-token'

const sessionsRequest: GetSessionHeadersByUserIdRequestDTO = {
  userCode: 'testuser',
  agents: [1],
  filterText: '',
}

/** Arm the real interceptor chain against the real auth store. */
function armInterceptors() {
  const authStore = useAuthStore()
  const redirectToLogin = vi.fn()
  configureApiInterceptors({ authStore, redirectToLogin })
  return { authStore, redirectToLogin }
}

describe('auth token lifecycle (real stack, MSW at the boundary)', () => {
  it('logs in, hashes the password (SHA-512), and persists tokens + user', async () => {
    installFakeSignalR() // avoid a real /chatHub negotiate on login
    const { authStore } = armInterceptors()

    const rawPassword = 'my-Secret-Password-123'
    let capturedPassword: unknown
    server.use(
      http.post('/api/authentication/login', async ({ request }) => {
        const body = (await request.json()) as { password?: unknown }
        capturedPassword = body.password
        return apiOk({
          user: makeUser({ email: 'agent@example.com' }),
          accessToken: 'access-token-1',
          refreshToken: 'refresh-token-1',
        })
      }),
    )

    const result = await authStore.login({
      email: 'agent@example.com',
      password: rawPassword,
      mode: AuthenticationMode.Basic,
    })

    expect(result.isOk()).toBe(true)
    // Password reached the wire hashed, never as plaintext.
    expect(capturedPassword).toBe(sha512(rawPassword))
    expect(authStore.isAuthenticated).toBe(true)
    expect(authStore.accessToken).toBe('access-token-1')
  })

  it('recovers silently from a 401: refreshes once and retries with the new token', async () => {
    // Seed BEFORE the first useAuthStore() so the store hydrates as logged-in.
    seedAuthStorage({ accessToken: 'seeded-access-token', refreshToken: 'seeded-refresh-token' })
    const { authStore } = armInterceptors()

    let refreshCount = 0
    let retriedAuthHeader: string | null = null

    // Registration order matters: last-registered matches first. The success
    // handler is the fallback; the { once: true } 401 fires on the initial
    // request, is consumed, and the retry falls through to success.
    server.use(
      http.post(SESSIONS_PATH, ({ request }) => {
        retriedAuthHeader = request.headers.get('Authorization')
        return apiOk([makeSession()])
      }),
    )
    server.use(http.post(SESSIONS_PATH, () => apiError(401), { once: true }))
    server.use(
      http.post(REFRESH_PATH, () => {
        refreshCount++
        return apiOk({ accessToken: 'access-token-2', refreshToken: 'refresh-token-2' })
      }),
    )

    const result = await chatService.getSessionHeaders(sessionsRequest)

    expect(result.isOk()).toBe(true)
    expect(refreshCount).toBe(1)
    expect(retriedAuthHeader).toBe('Bearer access-token-2')
    expect(authStore.accessToken).toBe('access-token-2') // new token persisted
  })

  it('clears auth and redirects to login when the refresh itself fails', async () => {
    seedAuthStorage({ accessToken: 'seeded-access-token', refreshToken: 'seeded-refresh-token' })
    const { authStore, redirectToLogin } = armInterceptors()

    server.use(http.post(SESSIONS_PATH, () => apiError(401)))
    server.use(http.post(REFRESH_PATH, () => apiError(401)))

    const result = await chatService.getSessionHeaders(sessionsRequest)

    expect(result.isErr()).toBe(true)
    expect(authStore.isAuthenticated).toBe(false)
    expect(authStore.accessToken).toBeNull()
    expect(redirectToLogin).toHaveBeenCalledTimes(1)
  })
})
```
