---
name: vonno-testing
description: Use when writing tests for vonno/InnoChat — unit tests, component tests, service tests, integration tests, API mocking with MSW, Pinia store testing, or Playwright E2E. Triggers on "write test", "unit test", "test component", "mock API", "mock endpoint", "msw handler", "vitest", "testing library", "mock store", "coverage", "playwright", "e2e test".
---

# Vonno Testing Guide

## Test Stack

| Tool | Purpose | Status |
|---|---|---|
| Vitest | Test runner, mocking (`vi.mock`, `vi.fn`, `vi.mocked`) | |
| `@testing-library/vue` | Component rendering + DOM assertions | |
| happy-dom | Lightweight DOM environment | |
| MSW 2 | API mocking at the network boundary (`http.*`, `HttpResponse`) | **WIRED** into `tests/setup.ts` |
| Pinia (test instance) | Fresh `createPinia()` per test (global `beforeEach`) | |
| Playwright | E2E browser tests | |

**Coverage:** thresholds live in `vitest.config.ts` and are ratcheted upward (raise the floor to `floor(actual − 2)`, never lower) — that file is the source of truth (do not hardcode numbers here, they drift). 80% is the long-term goal, not a flat enforced gate. The include list covers `lib/`, `app/stores/`, `app/composables/`, `app/utils/`, `types/`, and (since 2026-07-06) `app/components/`, `app/pages/`, `app/plugins/`, `app/middleware/`.

---

## Test File Locations

Mirror source structure under `tests/`:

```
lib/api/services/ChatService.ts          →  tests/unit/lib/api/services/ChatService.test.ts
app/composables/useAuth.ts               →  tests/unit/composables/useAuth.test.ts
app/components/chat/ChatMessages.vue     →  tests/unit/components/chat/ChatMessages.test.ts
app/pages/chats/[sessionId].vue          →  tests/unit/pages/chats/sessionId.test.ts
cross-layer flows (store→service→axios)  →  tests/integration/*.test.ts
```

---

## Global Test Setup (`tests/setup.ts`)

Already configured globally — do not repeat this in tests:

- **MSW is wired**: `beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))`, `afterEach(server.resetHandlers)`, `afterAll(server.close)`. Any HTTP a test leaks with no matching handler **fails the test** — add a handler, never downgrade the policy.
- **Fresh state per test**: a global `beforeEach` calls `setActivePinia(createPinia())` and then `resetAllState()` (from `tests/utils/resetAllState.ts`), which resets the interceptor chain, rate limiter, config cache, SignalR singleton, query-client singleton, storage mode, `localStorage`/`sessionStorage`, TanStack `focusManager`/`onlineManager`, and calls `vi.useRealTimers()`.
- Vue reactivity APIs (`ref`, `computed`, `watch`, etc.) stubbed as globals.
- Leaf-composable stubs (override per test with `vi.mocked(...).mockReturnValue`):
  - `useI18n` → `{ t: (key) => key, locale: ref('en'), d, n }`
  - `useToast` → `{ add, remove, clear }` (all `vi.fn()`)
  - `useWindowSize` → `{ width: ref(1280), height: ref(800) }`
  - `useRouter` / `useRoute` / `navigateTo` / `useRuntimeConfig` — Nuxt auto-import stubs.
- `VueQueryPlugin` installed on a throwaway test app in `beforeAll`.

---

## Mocking Decision Ladder

Pick the **lowest-fidelity mock that still exercises the code under test**. Default to MSW.

| Test kind | What to mock | What NOT to mock |
|---|---|---|
| Component / page / **integration** | MSW at the network boundary only | Never mock Pinia stores, services, or `apiClient` |
| Service + store tests | MSW (drives real axios + interceptor chain) | Don't mock `apiClient` — let it hit MSW |
| Pure composable / util unit tests | `vi.mock` of the **service** is acceptable when the composable's own logic (not I/O) is under test; MSW still preferred | — |
| SignalR (consumers) | `installFakeSignalR()` — swaps the singleton for a duck-typed fake | Don't spin a real hub connection |
| SignalR (`SignalRService` itself) | `vi.mock('@microsoft/signalr')` | — |
| Sentry | Leave real — `captureException` is a no-op when Sentry isn't initialized in tests | — |
| Leaf deps (i18n, toast, router) | Use the global stubs from `tests/setup.ts`; override per test as needed | — |

New tests bias to MSW so the real store → service → axios → interceptor chain is exercised. See `tests/integration/auth-token-lifecycle.test.ts` for the reference integration test.

---

## Rendering Components (`tests/utils/render.ts`)

`renderWithProviders(component, options?)` gives a fresh Pinia, a deterministic
test `QueryClient` (no retries, `gcTime: Infinity`, wired into the singleton),
and API interceptors armed against the store. It returns everything `render`
returns plus `{ pinia, queryClient, authStore, redirectToLogin }`.

```typescript
import { renderWithProviders } from '@/tests/utils/render'
import { screen } from '@testing-library/vue'

const { authStore, queryClient } = renderWithProviders(MyComponent, {
  props: { foo: 'bar' },
  global: { stubs: { HeavyChild: true } },
})
```

`createTestQueryClient()` is exported separately for tests that render manually.

---

## Service Test Pattern

MSW only — no client mock, hit the boundary and let the real axios + interceptor chain run (see "No client mocks"):

```typescript
import { describe, it, expect } from 'vitest'
import { server, http } from '@/tests/msw/server'
import { apiOk, apiError } from '@/tests/msw/http'
import { authService } from '@/lib/api/services/AuthService'
import { ErrorCode } from '@/types/enums'

describe('AuthService.refreshToken', () => {
  it('returns new tokens', async () => {
    server.use(
      http.post('/api/authentication/refresh-token', () =>
        apiOk({ accessToken: 'new-access', refreshToken: 'new-refresh' }),
      ),
    )

    const result = await authService.refreshToken('old-access', 'old-refresh')

    expect(result.isOk()).toBe(true)
    if (result.isOk()) expect(result.value.AccessToken).toBe('new-access')
  })

  it('maps a 401 to UNAUTHORIZED', async () => {
    server.use(http.post('/api/authentication/refresh-token', () => apiError(401)))

    const result = await authService.refreshToken('access', 'refresh')

    expect(result.isErr()).toBe(true)
    if (result.isErr()) expect(result.error.code).toBe(ErrorCode.UNAUTHORIZED)
  })
})
```

---

## Component Test Pattern

Verified shape from `tests/unit/components/chat/ChatMessages.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { screen } from '@testing-library/vue'
import { renderWithProviders } from '@/tests/utils/render'
import ChatMessages from '~/components/chat/ChatMessages.vue'
import { makeMessage } from '@/tests/utils/factories'

describe('ChatMessages', () => {
  it('renders messages', () => {
    renderWithProviders(ChatMessages, {
      props: { messages: [makeMessage({ messageText: 'Hello!' })] },
      global: {
        // Stub heavy children so the unit test stays focused.
        stubs: {
          MarkdownContent: { template: '<div>{{ content }}</div>', props: ['content'] },
          OptionsMessage: true,
        },
      },
    })

    expect(screen.getByText('Hello!')).toBeTruthy()
    expect(screen.getByTestId('messages-container')).toBeTruthy()
  })
})
```

---

## MSW Handlers

Default handlers live in `tests/msw/handlers/` per domain and use **real backend
paths**. `tests/msw/server.ts` aggregates them and re-exports `server`, `http`,
and `HttpResponse`. Envelope helpers are in `tests/msw/http.ts`.

Real endpoint families (verified against services):

| Domain | Handler file | Example path |
|---|---|---|
| Auth | `handlers/auth.ts` | `POST /api/authentication/login`, `/refresh-token`, `GET /profile` |
| Chat | `handlers/chat.ts` | `POST /api/AIWebAPI/GetSessionHeadersByUserId`, `/GetSessionById`, `/question/text` |
| Config | `handlers/config.ts` | `GET /api/settings/config.json` |
| User | `handlers/user.ts` | `GET /api/user/get-selectable-users` |
| Log | `handlers/log.ts` | `POST /api/Log/log` |

Envelope helpers (`tests/msw/http.ts`) — the backend wraps every payload in `ApiResponse<T>`:

```typescript
apiOk(data, init?)                 // → { data, success:null, warning:null, error:null }
apiError(status, code?, message?)  // → { data:null, ..., error:{code,message} } + HTTP status
httpError(status)                  // → bare non-envelope error body (raw problem details)
mutationOk()                       // → apiOk(JSON.stringify({ message: 'kész.' }))  (SetSessionName/DeleteSessionById)
```

### Handler-override cookbook (`server.use(...)`)

`resetHandlers()` runs in `afterEach`, so per-test overrides are automatically torn down.

```typescript
import { server, http, HttpResponse } from '@/tests/msw/server'
import { apiOk, apiError } from '@/tests/msw/http'

// Once-401 then fall through to the default success handler (order matters:
// last-registered matches first; { once: true } is consumed by the first hit).
server.use(http.post('/api/AIWebAPI/GetSessionById', () => apiError(401), { once: true }))

// Request-body spy — capture what reached the wire.
let captured: unknown
server.use(
  http.post('/api/authentication/login', async ({ request }) => {
    captured = await request.json()
    return apiOk({ user: makeUser(), accessToken: 'a', refreshToken: 'r' })
  }),
)

// Delayed response (pair with fake timers when asserting timeout/backoff).
import { delay } from 'msw'
server.use(
  http.post('/api/AIWebAPI/GetSessionById', async () => {
    await delay(5000)
    return apiOk({ /* ... */ })
  }),
)

// Network error (connection failure, not an HTTP status).
server.use(http.post('/api/AIWebAPI/GetSessionById', () => HttpResponse.error()))
```

---

## Fake Timers (`tests/utils/timers.ts`)

Rules (F4.5), verbatim:

1. **Real timers by default.** Only fake in dedicated timing tests (retry backoff, polling `refetchInterval`, cache TTL, SignalR timeouts).
2. Alongside MSW / `waitFor`: `vi.useFakeTimers({ shouldAdvanceTime: true })`.
3. **Never sync-advance** — always `await vi.advanceTimersByTimeAsync(ms)`.
4. `vi.useRealTimers()` in the test's `afterEach`; `resetAllState()` backstops it.

Helpers wrap exactly these:

```typescript
import { useFakeTimersSafe, advance, useRealTimers } from '@/tests/utils/timers'

useFakeTimersSafe()             // vi.useFakeTimers({ shouldAdvanceTime: true })
await advance(1000)             // await vi.advanceTimersByTimeAsync(1000)
useRealTimers()                 // vi.useRealTimers()  (in afterEach)
```

**Pin the clock** for date/time-relative logic (relative-time formatting,
date-boundary grouping). `freezeClock` wraps `vi.setSystemTime`, so fake timers
must already be active — call `useFakeTimersSafe()` first (it throws otherwise):

```typescript
import { useFakeTimersSafe, freezeClock, useRealTimers } from '@/tests/utils/timers'

useFakeTimersSafe()
freezeClock('2026-07-08T12:00:00Z')   // vi.setSystemTime — now deterministic
// ... assert useRelativeDate buckets / groupMessages date boundaries ...
useRealTimers()                        // in afterEach (resetAllState backstops)
```

---

## Storage Simulation (`tests/utils/storage.ts`)

Simulate a hostile browser `Storage` — blocked (Safari private mode /
third-party iframe → `SecurityError`) or quota-full (`QuotaExceededError`). Both
swap the whole `window[name]` for a Proxy that delegates to the real Storage but
throws from the chosen methods; both return `restore()` (call in `afterEach`;
`resetAllState()` backstops it). Target defaults to `'localStorage'`; pass
`'sessionStorage'` or `'both'`.

```typescript
import { installBlockedStorage, installQuotaFullStorage } from '@/tests/utils/storage'

const restore = installBlockedStorage()               // getItem/setItem/removeItem all throw SecurityError
const restore = installBlockedStorage('sessionStorage')// public/iframe-mode storage
const restore = installQuotaFullStorage()             // setItem throws QuotaExceededError; get/remove still work
// ... assert user-visible degradation (in-memory auth survives, no crash) ...
restore()                                              // in afterEach
```

App-code guards driven by these: `app/stores/auth.ts` (remembered-email +
`saveAuthStateToStorage` degrade silently), `app/components/chat/ChatListPanel.vue`
(scroll-position `sessionStorage` guarded).

---

## Focus / Online Simulation (`tests/utils/focus.ts`)

Drive TanStack Query's `refetchOnWindowFocus` / `refetchOnReconnect`:

```typescript
import { simulateWindowFocus, simulateOffline, simulateReconnect } from '@/tests/utils/focus'

simulateWindowFocus()   // focusManager: blur → focus  (triggers refetchOnWindowFocus)
simulateOffline()       // onlineManager.setOnline(false)
simulateReconnect()     // onlineManager.setOnline(true) (triggers refetchOnReconnect)
```

`resetAllState()` restores focus/online to a clean online state after each test.

---

## Auth Seeding & Public Mode (`tests/utils/authSeed.ts`)

Seed persisted auth **before the first `useAuthStore()`** — the store hydrates
from storage on creation, so seeding after it exists has no effect.

```typescript
import { seedAuthStorage, seedRememberedEmail, enablePublicMode } from '@/tests/utils/authSeed'

// Logged-in store on next useAuthStore() (writes the 'innochat-auth' key).
seedAuthStorage({ accessToken: 'seeded-access-token', refreshToken: 'seeded-refresh-token' })

// Public/iframe mode → sessionStorage-backed store.
seedAuthStorage({ mode: 'sessionStorage' })   // or enablePublicMode() before seeding

// "Remember me" email (always localStorage: 'innochat-remembered-email').
seedRememberedEmail('user@example.com')
```

`seedAuthStorage` defaults: `makeUser()`, `'seeded-access-token'`, `'seeded-refresh-token'`.

---

## SignalR (`tests/utils/fakeSignalR.ts`)

For consumers (components/composables that use `useSignalR`): install a fake singleton.

```typescript
import { installFakeSignalR } from '@/tests/utils/fakeSignalR'

const fake = installFakeSignalR()   // swaps SignalRService singleton, returns the fake
fake.emitFromServer('ReceiveMessage', payload)   // drive a server push
fake.setState('reconnecting')                    // drive connection state (ConnectionState)
expect(fake.invocations).toContainEqual({ method: 'SendMessage', args: [/* ... */] })
```

The fake's `getState()` returns `ConnectionState` (`'disconnected' | 'connected' | 'reconnecting' | ...`, from `@/lib/signalr/types`). `resetAllState()` calls `SignalRService.resetInstance()` after each test. To test `SignalRService` itself, `vi.mock('@microsoft/signalr')` instead.

---

## No client mocks

**Zero** `vi.mock('@/lib/api/client')` remain in the suite. All
service/interceptor tests hit MSW at the boundary and drive the real axios +
interceptor chain. Do not reintroduce a client mock — mock at the MSW boundary
instead. `resetAllState()` wraps each reset step in a `safe()` try/catch, so it
tolerates any module a leaf-unit test mocks away.

---

## Run Commands

```bash
npm run test           # Vitest (watch mode)
npm run test:run       # Vitest (single run)
npm run test:coverage  # With coverage (thresholds from vitest.config.ts)
npm run test:e2e       # Playwright E2E
npm run test:mutation  # Stryker mutation testing over pure logic (advisory; see stryker.config.json)
npm run verify         # Full local CI mirror: typecheck + lint + coverage + knip + duplication
```

Single file: `npx vitest run tests/path/to/file.test.ts`

### CI gates (all BLOCKING — run `npm run verify` before pushing)

`ci.yml` blocks on `test:coverage` (ratcheted thresholds), `knip` (dead code,
driven to zero), `duplication` (jscpd threshold in `.jscpd.json`), plus
typecheck + lint; `e2e-mocked` (`chromium-mocked`, hermetic) gates PRs while
`e2e-real` (`@real` specs vs `TEST_BASE_URL`) runs on develop + nightly.

**Ratchet rule (process, not tooling):** any PR that moves coverage raises the
affected floor to `floor(actual − 2)` in `vitest.config.ts` with a dated
comment — never lower a floor. `autoUpdate: true` may be used locally to compute
the new floor but is never committed enabled.

---

## Common Mistakes

| Mistake | Fix |
|---|---|
| Unhandled request error from MSW | Add a handler (real path) — `onUnhandledRequest: 'error'` fails the test; never downgrade the policy |
| MSW handler with a simplified/invented path | Use the real backend path from the service (`/api/AIWebAPI/GetSessionHeadersByUserId`, not `/api/chat/sessions`) |
| Mocking `apiClient` / a service / a store in an integration or component test | Mock at the MSW boundary instead |
| Not wrapping response in the envelope | Use `apiOk` / `apiError` — the backend always wraps in `ApiResponse<T>` |
| Asserting `result.value` without checking `result.isOk()` | Always check `isOk()` / `isErr()` first |
| Seeding auth after `useAuthStore()` already ran | Seed before the first store access |
| Sync-advancing fake timers | `await vi.advanceTimersByTimeAsync(ms)` |
| Importing Nuxt auto-imports (`useI18n`, `useRouter`) | These are global stubs — no import needed |
| Nesting global coverage numbers under `thresholds.global` | That is Jest's shape — Vitest reads `global:` as a glob matching zero files and silently drops the gate. Global metrics are **bare top-level keys** under `thresholds` (`branches`/`functions`/`lines`/`statements`); string keys are glob patterns |
| Writing E2E assertions expecting Hungarian UI | Normal mode renders **English** under Playwright, not `hu` — assert English strings in mocked specs |
| Adding a mocked E2E spec without route coverage | Derive `/api` paths from `lib/api/services/*.ts`; keep the `page.on('request')` unrouted-call logger so drift fails loud |

---

## Factory Functions (`tests/utils/factories.ts`)

```typescript
import { makeUser, makeSession, makeMessage, makeApiResponse, makeAxiosError, resetUserIdCounter } from '@/tests/utils/factories'

makeApiResponse(data)   // wrap in { data: { data, success:null, warning:null, error:null } }
makeUser(overrides?)    // → UserDTO
makeSession(overrides?) // → AISessionHeaderDTO
makeMessage(overrides?) // → AISessionMessageDTO
makeAxiosError(404)     // → Error & { response: { status: 404 } }
resetUserIdCounter()    // reset auto-incrementing IDs when stable IDs matter
```

With MSW, prefer the `apiOk` / `apiError` envelope helpers over `makeApiResponse`.

---

See `references/test-examples.md` for full, runnable examples — including the F5 login + refresh integration test, page tests, mutation tests, and Playwright E2E.
