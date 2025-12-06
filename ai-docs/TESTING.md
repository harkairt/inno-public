# Testing Guide

This document provides comprehensive documentation of the testing infrastructure, including unit tests, E2E tests, and mocking.

---

## 1. Unit Testing (Vitest)

### 1.1 Configuration

**File:** `vitest.config.ts`

| Setting | Value |
|---------|-------|
| Environment | `happy-dom` |
| Globals | `true` |
| Threads | `true` |
| Isolation | `true` |
| Timeout | 10,000ms |

### 1.2 Test File Patterns

```
tests/**/*.{test,spec}.{js,ts,jsx,tsx}
lib/**/__tests__/**/*.{test,spec}.{js,ts,jsx,tsx}
stores/**/__tests__/**/*.{test,spec}.{js,ts,jsx,tsx}
composables/**/__tests__/**/*.{test,spec}.{js,ts,jsx,tsx}
types/**/__tests__/**/*.{test,spec}.{js,ts,jsx,tsx}
```

### 1.3 Coverage Requirements

| Metric | Threshold |
|--------|-----------|
| Branches | 80% |
| Functions | 80% |
| Lines | 80% |
| Statements | 80% |

### 1.4 Setup File

**File:** `tests/setup.ts`

```typescript
import { setupServer } from 'msw/node'
import { handlers } from './mocks/handlers'

// MSW server setup
export const server = setupServer(...handlers)

beforeAll(() => server.listen())
afterEach(() => server.resetHandlers())
afterAll(() => server.close())
```

### 1.5 NPM Scripts

| Script | Command | Description |
|--------|---------|-------------|
| `test` | `vitest` | Watch mode |
| `test:ui` | `vitest --ui` | Vitest UI |
| `test:run` | `vitest run` | CI mode (single run) |
| `test:coverage` | `vitest run --coverage` | With coverage report |

### 1.6 Example Unit Test

```typescript
import { describe, it, expect, vi } from 'vitest'
import { useAuthStore } from '@/app/stores/auth'
import { createPinia, setActivePinia } from 'pinia'

describe('AuthStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('should be unauthenticated initially', () => {
    const store = useAuthStore()
    expect(store.isAuthenticated).toBe(false)
  })

  it('should login successfully', async () => {
    const store = useAuthStore()
    const result = await store.login('test@example.com', 'password', false)
    expect(result.isOk()).toBe(true)
    expect(store.isAuthenticated).toBe(true)
  })
})
```

---

## 2. E2E Testing (Playwright)

### 2.1 Configuration

**File:** `playwright.config.ts`

| Setting | Value |
|---------|-------|
| Test directory | `./tests/e2e` |
| Parallel | Yes |
| Retries (CI) | 2 |
| Workers (CI) | 1 |

### 2.2 Browser Matrix

| Browser | Device |
|---------|--------|
| Chromium | Desktop Chrome |
| Firefox | Desktop Firefox |
| WebKit | Desktop Safari |

### 2.3 Capture Settings

| Setting | Value |
|---------|-------|
| Screenshots | On failure |
| Video | Retain on failure |
| Trace | On first retry |

### 2.4 NPM Scripts

| Script | Command | Description |
|--------|---------|-------------|
| `test:e2e` | `playwright test` | Run all E2E tests |
| `test:e2e:ui` | `playwright test --ui` | Playwright UI |
| `test:e2e:debug` | `playwright test --debug` | Debug mode |
| `test:e2e:headed` | `playwright test --headed` | Headed mode |
| `test:e2e:chrome` | `playwright test --project=chromium` | Chrome only |
| `test:e2e:report` | `playwright show-report` | View HTML report |
| `test:e2e:codegen` | `playwright codegen` | Record tests |

### 2.5 Example E2E Test

```typescript
import { test, expect } from '@playwright/test'

test.describe('Login', () => {
  test('should login successfully', async ({ page }) => {
    await page.goto('/login')

    await page.fill('[data-testid="email-input"]', 'test@example.com')
    await page.fill('[data-testid="password-input"]', 'password')
    await page.click('[data-testid="login-button"]')

    await expect(page).toHaveURL('/chats')
  })

  test('should show error for invalid credentials', async ({ page }) => {
    await page.goto('/login')

    await page.fill('[data-testid="email-input"]', 'wrong@example.com')
    await page.fill('[data-testid="password-input"]', 'wrongpassword')
    await page.click('[data-testid="login-button"]')

    await expect(page.locator('[data-testid="error-message"]')).toBeVisible()
  })
})
```

---

## 3. Mocking (MSW)

### 3.1 Setup

**Directory:** `tests/mocks/`

### 3.2 Handler Structure

```typescript
import { rest } from 'msw'

export const handlers = [
  // Auth handlers
  rest.post('/api/authentication/login', (req, res, ctx) => {
    return res(
      ctx.json({
        accessToken: 'mock-access-token',
        refreshToken: 'mock-refresh-token',
        user: {
          id: '123',
          email: 'test@example.com',
          fullName: 'Test User'
        }
      })
    )
  }),

  // Chat handlers
  rest.post('/api/AIWebAPI/GetSessionHeadersByUserId', (req, res, ctx) => {
    return res(
      ctx.json([
        {
          id: 'session-1',
          name: 'Test Session',
          isPrimary: false
        }
      ])
    )
  })
]
```

### 3.3 Override Handler in Test

```typescript
import { server } from './setup'
import { rest } from 'msw'

it('should handle login error', async () => {
  server.use(
    rest.post('/api/authentication/login', (req, res, ctx) => {
      return res(ctx.status(401), ctx.json({ message: 'Invalid credentials' }))
    })
  )

  // Test error handling...
})
```

---

## 4. Testing Utilities

**File:** `tests/utils.ts`

### 4.1 renderWithProviders

```typescript
import { render } from '@testing-library/vue'
import { createPinia } from 'pinia'
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'

export function renderWithProviders(component: any, options = {}) {
  const pinia = createPinia()
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false }
    }
  })

  return render(component, {
    global: {
      plugins: [pinia, [VueQueryPlugin, { queryClient }]]
    },
    ...options
  })
}
```

### 4.2 Factory Functions

```typescript
export function createMockUser(overrides = {}): UserDTO {
  return {
    id: 'user-123',
    email: 'test@example.com',
    fullName: 'Test User',
    displayName: 'Test',
    avatarUrl: undefined,
    isVirtual: false,
    role: 'User',
    ...overrides
  }
}

export function createMockSession(overrides = {}): AISessionDTO {
  return {
    id: 'session-123',
    name: 'Test Session',
    isPrimary: false,
    members: [createMockUser()],
    messages: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides
  }
}

export function createMockMessage(overrides = {}): AISessionMessageDTO {
  return {
    id: 'message-123',
    sessionId: 'session-123',
    senderId: 'user-123',
    senderName: 'Test User',
    content: 'Hello, world!',
    answerType: AIAnswerType.Text,
    createdAt: new Date().toISOString(),
    ...overrides
  }
}
```

---

## 5. Test Organization

### 5.1 Directory Structure

```
tests/
├── e2e/
│   ├── auth.spec.ts
│   ├── chat.spec.ts
│   └── session.spec.ts
├── unit/
│   ├── stores/
│   │   ├── auth.test.ts
│   │   └── chat.test.ts
│   └── composables/
│       └── useChatQueries.test.ts
├── mocks/
│   ├── handlers.ts
│   └── data.ts
├── setup.ts
└── utils.ts
```

### 5.2 Colocated Tests

Tests can also be colocated with source code:

```
lib/
├── api/
│   ├── services/
│   │   ├── AuthService.ts
│   │   └── __tests__/
│   │       └── AuthService.test.ts
```

---

## 6. CI Configuration

### 6.1 Unit Tests in CI

```yaml
- name: Run unit tests
  run: npm run test:run

- name: Upload coverage
  uses: codecov/codecov-action@v3
```

### 6.2 E2E Tests in CI

```yaml
- name: Install Playwright
  run: npx playwright install --with-deps

- name: Run E2E tests
  run: npm run test:e2e

- name: Upload E2E report
  uses: actions/upload-artifact@v3
  if: always()
  with:
    name: playwright-report
    path: playwright-report/
```

---

## 7. Best Practices

### 7.1 Unit Tests

- Test one thing per test
- Use descriptive test names
- Mock external dependencies
- Test edge cases

### 7.2 E2E Tests

- Focus on critical user flows
- Use data-testid for selectors
- Handle async operations properly
- Clean up test data

### 7.3 General

- Keep tests fast
- Make tests independent
- Use factories for test data
- Test behavior, not implementation

---

## Related Documentation

- [DEVOPS.md](./DEVOPS.md) - CI/CD configuration
- [CONVENTIONS.md](./CONVENTIONS.md) - Testing patterns
