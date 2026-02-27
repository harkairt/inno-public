# Vonno Test Examples — Full Working Code

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
