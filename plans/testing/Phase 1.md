# Phase 1 — Foundation: MSW Network-Boundary Harness + Testability Seams

> Part 1 of 3. See `Phase 2.md` (backfill waves) and `Phase 3.md` (E2E + CI).
> Prerequisite for everything else. One PR (or two: F1–F4 infra, F5–F7 proof + docs).

## 1. Context & Goal

Current unit tests mock `apiClient` with `vi.mock('@/lib/api/client')` — whitebox, brittle, and the interceptor chain (401 → refresh → retry queue, rate limiting, retry backoff, response caching) is **never exercised end-to-end**. MSW 2 (`msw ^2.11.6`) is installed and documented in CLAUDE.md but wired nowhere.

Goal of this phase: after it lands, a test can express *"the sessions endpoint returns 401 once, then 200"* in two lines and assert what the **user sees**, while real axios + real interceptors + real Pinia + real Vue Query run underneath.

**Verified baseline**: 410 passing tests, 0 failing (`npx vitest run`, 2026-07-06). Every step below must keep that green.

**Risk #1 pre-verified**: axios under happy-dom picks the XHR adapter (`adapter: ['xhr','http','fetch']`); `msw/node`'s `setupServer` installs `XMLHttpRequestInterceptor` (see `node_modules/msw/lib/node/index.mjs:151-153`), so interception works with **zero axios config and zero app change**. Escape hatch if a happy-dom XHR quirk surfaces (blob/FormData edge cases): one line in `tests/setup.ts` only — `apiClient.defaults.adapter = 'fetch'` (happy-dom fetch is also intercepted). Never change app code for this.

**URL mechanics**: happy-dom origin defaults to `http://localhost:3000`; `apiClient` baseURL resolves to `''` under Vitest (`import.meta.dev` undefined, `window.__NUXT__` absent) → axios resolves relative URLs against `location` → **register all MSW handlers with relative paths** (`http.post('/api/authentication/login', …)`); MSW resolves them against `location` too.

---

## 2. Step F1 — vitest.config.ts hygiene

File: `vitest.config.ts`

### F1.1 Fix silently-ignored env block (real bug)
The current config has `env: { NODE_ENV: 'test', NUXT_PUBLIC_API_BASE_URL: 'http://localhost:3000' }` at the **config root** (line ~104). Vitest only reads `test.env`. It has been a no-op the whole time. Fix:

```ts
test: {
  // ...
  env: {
    NODE_ENV: 'test',
    NUXT_PUBLIC_API_BASE_URL: 'http://localhost:3000',
  },
  environmentOptions: {
    happyDOM: { url: 'http://localhost:3000' },   // make origin explicit, don't rely on default
  },
}
```
Delete the root-level `env` block.

### F1.2 Delete dead tests + their exclude
`tests/unit/components/chats/{ChatsSidebar,UserListItem,UsersExpandableTile}.test.ts` import `@/app/components/chats/*.vue`. **That directory does not exist** — components were superseded by `app/components/chat/ChatListPanel.vue` / `ManageSessionUsers.vue` (both already tested). Git history preserves them.

- `rm tests/unit/components/chats/*.test.ts` (3 files), remove empty dir.
- Remove `'tests/unit/components/chats/**'` from `test.exclude` and the "components that don't exist yet" comment.

### F1.3 Remove dead option
`watchExclude` was removed in Vitest 3 — silently ignored. Delete it.

### Checkpoint F1
`npx vitest run` → 410 pass (test count unchanged; deleted files were excluded already).

---

## 3. Step F2 — MSW infrastructure

New directory `tests/msw/`:

```
tests/msw/
├── server.ts
├── http.ts
└── handlers/
    ├── index.ts
    ├── auth.ts
    ├── chat.ts
    ├── config.ts
    ├── user.ts
    └── log.ts
```

### F2.1 `tests/msw/http.ts` — backend envelope helpers
Every backend response is wrapped in `ApiResponse<T>`: `{ data, success: null, warning: null, error: null }`. Tests fail silently without it (documented in vonno-testing skill). Centralize:

```ts
import { HttpResponse } from 'msw'

/** Wrap payload in the backend ApiResponse<T> envelope. */
export function apiOk<T>(data: T, init?: ResponseInit) {
  return HttpResponse.json(
    { data, success: null, warning: null, error: null },
    init,
  )
}

/** Error response with envelope + HTTP status. */
export function apiError(status: number, code?: string, message?: string) {
  return HttpResponse.json(
    { data: null, success: null, warning: null, error: code ? { code, message } : null },
    { status },
  )
}

/** Bare non-envelope error (for endpoints that return raw problem details). */
export function httpError(status: number) {
  return new HttpResponse(null, { status })
}
```

### F2.2 `tests/msw/handlers/auth.ts`
Payload shapes MUST match the Zod schemas (`types/api/schemas.ts`) and `extractTokensFromResponse` in `lib/api/utils/tokens.ts` — those are the source of truth; open both while writing. Note `tokens.ts` accepts both camelCase and other casing variants — default handlers use camelCase; a dedicated B1 test covers the alternate casing.

```ts
import { http } from 'msw'
import { apiOk } from '../http'
import { makeUser } from '../../utils/factories'

export const authHandlers = [
  http.post('/api/authentication/login', () =>
    apiOk({ user: makeUser(), accessToken: 'access-token-1', refreshToken: 'refresh-token-1' })),
  http.post('/api/authentication/refresh-token', () =>
    apiOk({ accessToken: 'access-token-2', refreshToken: 'refresh-token-2' })),
  http.get('/api/authentication/profile', () => apiOk(makeUser())),
  http.patch('/api/authentication/forgotten-password', () => apiOk(null)),
  http.patch('/api/authentication/set-password', () => apiOk(null)),
]
```

### F2.3 `tests/msw/handlers/chat.ts`
Enumerate the real endpoints from `lib/api/services/ChatService.ts` (verify each path + method against the service before writing — the E2E suite already rotted from URL drift). Known set under `/api/AIWebAPI/`:
- `question/text` (send message), `welcomeText`, `GetSessionHeadersByUserId`, `GetSessionById`, `SetSessionName`, `DeleteSessionById`, `SetSessionMessageRating`, `Set_SessionMessagesRead`, `GetUnreadMessages`, `GetSessionUnreadMessages`, `react`, `addUserToSession`, `removeUserFromSession`, `getMessage`, `startPublicChat`.

Default happy-path handlers return small consistent fixtures built from `makeSession()` / `makeMessage()` (`tests/utils/factories.ts`). Keep default dataset tiny (1–2 sessions, 2–3 messages) — per-test overrides supply scenario data.

### F2.4 `tests/msw/handlers/config.ts`
```ts
import { http } from 'msw'
import { apiOk } from '../http'
import { DEFAULT_CONFIG } from '@/lib/config/defaults'

export const configHandlers = [
  // ConfigService.ts:35 — GET /api/settings/config.json
  http.get('/api/settings/config.json', () => apiOk({ ...DEFAULT_CONFIG })),
]
```
(Confirm whether config.json responses are enveloped or raw by reading `ConfigService.loadConfig` — adjust `apiOk` vs `HttpResponse.json` accordingly. Do this during implementation, not by memory.)

### F2.5 `tests/msw/handlers/user.ts` + `log.ts`
- `POST/GET /api/user/get-selectable-users` (verify method in `UserService.ts`) → `apiOk([makeUser(), makeUser()])`.
- `POST /api/Log/log` → 200 sink (`apiOk(null)`), so fire-and-forget logging never trips `onUnhandledRequest: 'error'`.

### F2.6 `tests/msw/handlers/index.ts` + `server.ts`
```ts
// handlers/index.ts
export const handlers = [...authHandlers, ...chatHandlers, ...configHandlers, ...userHandlers, ...logHandlers]

// server.ts
import { setupServer } from 'msw/node'
import { handlers } from './handlers'
export const server = setupServer(...handlers)
export { http, HttpResponse } from 'msw'
```

### F2.7 Wire lifecycle into `tests/setup.ts`
```ts
import { server } from './msw/server'

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())
```
`onUnhandledRequest: 'error'` is safe **today**: all 410 tests mock apiClient/services, zero real HTTP happens. From now on, any unhandled request = a leaking test, surfaced loudly. If one appears later: add a handler, never downgrade the policy.

### Per-test override convention (goes into docs, F7)
```ts
import { server, http } from '@/tests/msw/server'
import { apiError, apiOk } from '@/tests/msw/http'

// single 401 then default happy path resumes:
server.use(http.get('/api/AIWebAPI/GetSessionHeadersByUserId', () => apiError(401), { once: true }))

// spy on request body:
const bodies: unknown[] = []
server.use(http.post('/api/authentication/refresh-token', async ({ request }) => {
  bodies.push(await request.json())
  return apiOk({ accessToken: 'a2', refreshToken: 'r2' })
}))
```

### Checkpoint F2
Full run green — proves no existing test leaks real HTTP.

---

## 4. Step F3 — App-code seam refactors (minimal, behavior-preserving)

Convention: mirror the existing `setAuthStore` / `setRedirectToLogin` DI pattern already in `lib/api/interceptors/response.ts`. Every item below is small; each verified by suite + typecheck + lint + dev-server smoke.

### F3.1 `lib/api/interceptors/response.ts` (~15 lines)
1. Export reset:
```ts
export function resetResponseInterceptorState(): void {
  isRefreshing = false
  failedQueue = []
  authStoreInstance = null
  redirectToLoginFn = null
  responseCache.clear()
}
```
2. **Delete the import-time side effect** at ~line 403: `setInterval(clearExpiredCache, 60000)` runs on *import*, leaking a timer into every test file that touches this module. Replace with:
```ts
export function startCacheCleanup(intervalMs = 60_000): () => void {
  const id = setInterval(clearExpiredCache, intervalMs)
  return () => clearInterval(id)
}
```
Call `startCacheCleanup()` from `app/plugins/api-interceptors.client.ts` (production behavior identical: plugin runs once at startup).

### F3.2 `lib/api/interceptors/request.ts` (~6 lines)
`RateLimiter` singleton keyed by `Date.now()` persists across tests. Add `reset()` clearing the internal requests map; export `resetRateLimiter()` delegating to the singleton.

### F3.3 NEW `lib/api/interceptors/setup.ts` (move ~50 lines)
Extract the interceptor-wiring body of `app/plugins/api-interceptors.client.ts` (which already contains `clearApiInterceptors()` at line ~100 — wrong layer for test reuse) into:
```ts
export function configureApiInterceptors(deps: {
  authStore: AuthStoreLike
  redirectToLogin: () => void
}): void { /* setAuthStore, setRedirectToLogin, attach request+response interceptors, guard with configured flag */ }

export function clearApiInterceptors(): void { /* eject all, reset configured flag */ }
```
Plugin becomes a thin caller: `configureApiInterceptors({ authStore, redirectToLogin: () => void navigateTo('/login', { replace: true }) })` + `startCacheCleanup()`. **This is the seam that makes per-test real interceptor chains possible.**

Note: working tree currently has uncommitted changes in this plugin + response.ts (the `setRedirectToLogin` work) — land/commit those first, then refactor on top.

### F3.4 `lib/signalr/SignalRService.ts` (~8 lines)
Hard singleton, `private constructor`, no reset. Add:
```ts
static resetInstance(): void { SignalRService.instance = null as unknown as SignalRService }
static setInstanceForTests(instance: SignalRService): void { SignalRService.instance = instance }
```
(Exact null-handling per the current `instance` field type; keep constructor private — the test fake is duck-typed and installed via `setInstanceForTests(fake as unknown as SignalRService)`.)

### F3.5 `lib/queryClientSingleton.ts` (~3 lines)
`auth.ts:151` calls `getQueryClient().clear()` — tests need the singleton to point at the per-test client:
```ts
export function setQueryClient(client: QueryClient | null): void { _queryClient = client }
```

### F3.6 `app/composables/useChatQueries.ts` (~3 lines)
Module-level `agentsWithoutWelcomeMessage = new Set<number>()` (line ~173) leaks. Add:
```ts
export function resetWelcomeMessageTracking(): void { agentsWithoutWelcomeMessage.clear() }
```

### F3.7 No app change needed (already exist — use as-is)
- `configService.clearCache()` (ConfigService)
- `setStorageMode('localStorage')` (app/stores/auth.ts — resets the module-level storage-mode global)
- `globalErrorTracker.reset()` (lib/errors/utils.ts:254)

### Checkpoint F3
Full run + `npm run typecheck` + `npm run lint` green; `npm run dev` smoke: app boots, network tab shows interceptor behavior (auth header on requests), no console errors about cache cleanup.

---

## 5. Step F4 — Test-utils layer

New files under `tests/utils/`. Decision: **exported reset functions, NOT `vi.resetModules`** — module re-eval would duplicate the `apiClient` singleton the interceptors close over, break `instanceof` and Pinia identity, and slow the suite. Explicit resets are boring and auditable.

### F4.1 `tests/utils/resetAllState.ts`
```ts
import { vi } from 'vitest'
import { focusManager, onlineManager } from '@tanstack/vue-query'
import { clearApiInterceptors } from '@/lib/api/interceptors/setup'
import { resetResponseInterceptorState } from '@/lib/api/interceptors/response'
import { resetRateLimiter } from '@/lib/api/interceptors/request'
import { configService } from '@/lib/api/services/ConfigService'
import { globalErrorTracker } from '@/lib/errors/utils'
import { SignalRService } from '@/lib/signalr/SignalRService'
import { setStorageMode } from '@/app/stores/auth'
import { resetWelcomeMessageTracking } from '@/app/composables/useChatQueries'
import { setQueryClient } from '@/lib/queryClientSingleton'

export function resetAllState(): void {
  clearApiInterceptors()          // singleton apiClient must not accumulate chains
  resetResponseInterceptorState()
  resetRateLimiter()
  configService.clearCache()
  globalErrorTracker.reset()
  SignalRService.resetInstance()
  setQueryClient(null)
  setStorageMode('localStorage')
  localStorage.clear()
  sessionStorage.clear()
  resetWelcomeMessageTracking()
  focusManager.setFocused(undefined)
  onlineManager.setOnline(undefined)
  vi.useRealTimers()              // defensive backstop
}
```

### F4.2 `tests/setup.ts` changes
- Replace the `beforeAll` global-Pinia pattern with per-test isolation:
```ts
beforeEach(() => {
  setActivePinia(createPinia())   // fresh store graph per test
  resetAllState()
})
```
Existing tests that call `setActivePinia` in their own `beforeEach` simply win (theirs runs after) — unaffected.
- Add `global.defineNuxtPlugin = (p: unknown) => p` stub (needed for plugin tests in Phase 2; harmless now).
- Keep existing global stubs unchanged (surgical change rule).
- Known debt to note in docs, NOT fix now: `global.console.error = vi.fn()` can hide real failures; revisit after foundation.

### F4.3 `tests/utils/render.ts`
```ts
import { render, type RenderOptions } from '@testing-library/vue'
import { createPinia, setActivePinia } from 'pinia'
import { VueQueryPlugin, QueryClient } from '@tanstack/vue-query'
import type { Component } from 'vue'
import { setQueryClient } from '@/lib/queryClientSingleton'
import { configureApiInterceptors } from '@/lib/api/interceptors/setup'
import { useAuthStore } from '~/stores/auth'

export function createTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity, staleTime: 0 },
      mutations: { retry: false },
    },
  })
}

export function renderWithProviders(component: Component, options: RenderOptions<Component> = {}) {
  const pinia = createPinia()
  setActivePinia(pinia)
  const queryClient = createTestQueryClient()
  setQueryClient(queryClient)

  const result = render(component, {
    ...options,
    global: {
      ...options.global,
      plugins: [pinia, [VueQueryPlugin, { queryClient }], ...(options.global?.plugins ?? [])],
    },
  })

  const authStore = useAuthStore()
  const redirectToLogin = vi.fn()
  configureApiInterceptors({ authStore, redirectToLogin })  // real chain per test

  return { ...result, pinia, queryClient, authStore, redirectToLogin }
}
```

### F4.4 `tests/utils/authSeed.ts`
The auth store hydrates from storage **during `defineStore` setup** — seed BEFORE first `useAuthStore()` call:
```ts
export function seedAuthStorage(opts: {
  user?: UserDTO
  accessToken?: string
  refreshToken?: string
  mode?: 'localStorage' | 'sessionStorage'
} = {}): void {
  const storage = opts.mode === 'sessionStorage' ? sessionStorage : localStorage
  storage.setItem('innochat-auth', JSON.stringify({
    user: opts.user ?? makeUser(),
    accessToken: opts.accessToken ?? 'seeded-access-token',
    refreshToken: opts.refreshToken ?? 'seeded-refresh-token',
    timestamp: 1_700_000_000_000,   // fixed, deterministic
  }))
  if (opts.mode === 'sessionStorage') setStorageMode('sessionStorage')
}

export function seedRememberedEmail(email: string): void {
  localStorage.setItem('innochat-remembered-email', email)  // always localStorage, even in public mode
}

export function enablePublicMode(): void {
  setStorageMode('sessionStorage')
}
```
(Verify exact `innochat-auth` JSON shape against `loadAuthStateFromStorage` in `app/stores/auth.ts` when implementing.)

### F4.5 `tests/utils/timers.ts` — prescribed pattern (document + tiny helpers)
Rules (these interact badly if done wrong — MSW response resolution and Vue Query retries await real microtasks/timers):
1. **Real timers by default.** Fake timers only in dedicated tests (retry backoff 429/503, 30s `refetchInterval` polling, cache TTL, SignalR connection timeout, signalr-init 500ms delay).
2. When faking alongside MSW/`waitFor`: `vi.useFakeTimers({ shouldAdvanceTime: true })`.
3. **Never sync-advance.** Always `await vi.advanceTimersByTimeAsync(ms)` so pending promises settle.
4. `vi.useRealTimers()` in the test's `afterEach`; `resetAllState()` backstops.

### F4.6 `tests/utils/focus.ts`
```ts
import { focusManager, onlineManager } from '@tanstack/vue-query'
export function simulateWindowFocus(): void {
  focusManager.setFocused(false)
  focusManager.setFocused(true)   // triggers refetchOnWindowFocus queries
}
export function simulateOffline(): void { onlineManager.setOnline(false) }
export function simulateReconnect(): void { onlineManager.setOnline(true) }  // triggers refetchOnReconnect
```

### F4.7 `tests/utils/fakeSignalR.ts`
Duck-typed fake of the surface actually used by `useSignalR` / `useSignalRChat` / `signalr-init.client.ts` (read those to finalize the method list): `connect`, `disconnect`, `on`, `off?`, `invoke`, `send`, `getState`, `getConnectionInfo`, `clearAllEventHandlers`, `forceReconnect`, `onStateChange`-equivalent.
```ts
export function createFakeSignalR() {
  const handlers = new Map<string, Set<(...args: unknown[]) => void>>()
  let state: SignalRState = 'disconnected'
  const invocations: Array<{ method: string; args: unknown[] }> = []

  const fake = {
    connect: vi.fn(async () => { state = 'connected'; emitState() }),
    disconnect: vi.fn(async () => { state = 'disconnected'; emitState() }),
    on: (event: string, cb: (...a: unknown[]) => void) => {
      if (!handlers.has(event)) handlers.set(event, new Set())
      handlers.get(event)!.add(cb)
    },
    invoke: vi.fn(async (method: string, ...args: unknown[]) => { invocations.push({ method, args }) }),
    send: vi.fn(async (method: string, ...args: unknown[]) => { invocations.push({ method, args }) }),
    getState: () => state,
    clearAllEventHandlers: () => handlers.clear(),
    forceReconnect: vi.fn(),
    // ── test-only surface ──
    emitFromServer: (event: string, ...args: unknown[]) => { handlers.get(event)?.forEach(cb => cb(...args)) },
    setState: (s: SignalRState) => { state = s; emitState() },
    invocations,
  }
  function emitState() { handlers.get('stateChange')?.forEach(cb => cb(state)) }
  return fake
}

export function installFakeSignalR() {
  const fake = createFakeSignalR()
  SignalRService.setInstanceForTests(fake as unknown as SignalRService)
  return fake
}
```

### Checkpoint F4
Full run green (410 tests unaffected by fresh-Pinia beforeEach — verify explicitly).

---

## 6. Step F5 — Proof-of-life integration test

New `tests/integration/auth-token-lifecycle.test.ts`. Real store → AuthService → axios → interceptors, HTTP faked by MSW. This test IS the acceptance criterion of the whole phase.

Test cases:
1. **Login happy path**: `authStore.performLogin(email, pw)` → MSW login handler asserts SHA-512-hashed password in body → tokens land in store + storage, `isAuthenticated` true.
2. **Token expiry, silent recovery (the flagship)**:
   - Seed authenticated state.
   - `server.use(http.get('/api/AIWebAPI/GetSessionHeadersByUserId', () => apiError(401), { once: true }))`.
   - Handler spy on `/api/authentication/refresh-token` captures the refresh request; sessions handler spy captures the retried request's `Authorization` header.
   - Call `chatService.getSessionHeaders(...)` (or the query composable) → assert final result `isOk()`, refresh called exactly once, retried request carried `Bearer access-token-2`.
3. **Concurrent 401s, single refresh**: three simultaneous requests each 401 once → refresh handler spy called exactly **once** (failedQueue behavior), all three succeed after retry.
4. **Refresh failure → logout + redirect**: refresh handler returns 401 → `authStore` cleared (`isAuthenticated` false, storage empty), injected `redirectToLogin` mock called once.

### Checkpoint F5
New tests pass; full suite green.

---

## 7. Step F6 — Coverage widen + ratchet

`vitest.config.ts` `coverage.include` add:
```ts
'app/components/**/*.{vue,ts}',
'app/pages/**/*.vue',
'app/plugins/**/*.ts',
'app/middleware/**/*.ts',
```
Then run `npm run test:coverage`, read actuals, set `thresholds.global` to `floor(actual − 2)` with a dated comment:
```ts
// Ratcheted (2026-07-XX): coverage include widened to components/pages/plugins/middleware.
// Numbers DROPPED vs the 2026-05-12 ratchet because the denominator grew — this is the
// honest baseline, not a regression. Raised per backfill wave (see plans/testing/Phase 2.md).
```

## 8. Step F7 — Docs reconciliation

### CLAUDE.md testing section — replace aspirational lines with reality:
- MSW 2 wired in `tests/setup.ts` (`onUnhandledRequest: 'error'`); handlers in `tests/msw/handlers/` matching real endpoints.
- State reset: `tests/utils/resetAllState.ts` runs in global beforeEach; fresh Pinia per test.
- Components/pages: `renderWithProviders` from `tests/utils/render.ts`.
- Remove/replace the false "80% threshold enforced" claim with "ratcheted thresholds in vitest.config.ts, raised per backfill wave".

### `.claude/skills/vonno-testing/SKILL.md` rewrite outline:
1. Stack table — MSW marked as wired.
2. **Mocking decision ladder** (resolves the CLAUDE.md "never mock Pinia" vs practice contradiction):
   - Component/page/integration tests → **MSW only**; never mock Pinia stores, services, or apiClient.
   - Service + store tests → MSW (real axios + interceptors).
   - Pure composable/util unit tests → `vi.mock` of *services* acceptable when the composable's own logic (not I/O) is under test; MSW preferred.
   - SignalR → `installFakeSignalR()`; unit tests of SignalRService itself → `vi.mock('@microsoft/signalr')`.
   - Sentry → leave real (`captureException` is a no-op without init).
   - Leaf stubs (i18n, toast, router) → global stubs from setup.ts, override per test.
3. Handler-override cookbook (once-401, body spies, delayed responses, network error via `HttpResponse.error()`).
4. Fake-timer pattern (§F4.5 rules verbatim).
5. Focus/online simulation.
6. `seedAuthStorage` / public-mode setup.
7. Legacy note: existing `vi.mock('@/lib/api/client')` tests are grandfathered; **new tests must use MSW**; migration schedule in Phase 2.
8. Delete the false "MSW handlers in tests/msw/ exist but are not connected" paragraph; update `references/test-examples.md` with the F5 login+refresh example.

---

## 9. Execution order + checkpoints (summary)

| # | Work | Gate |
|---|------|------|
| 0 | Commit the in-flight `setRedirectToLogin` working-tree changes first | suite green |
| 1 | F1 config hygiene + dead-test deletion | `npx vitest run` 410 pass |
| 2 | F2 MSW infra + lifecycle in setup.ts | full run green (no HTTP leaks) |
| 3 | F3 seam refactors | run + typecheck + lint + dev smoke |
| 4 | F4 test-utils + resetAllState + fresh Pinia | full run green |
| 5 | F5 proof-of-life integration test | new tests pass |
| 6 | F6 coverage widen + ratchet | `npm run test:coverage` green |
| 7 | F7 docs | n/a |

## 10. Risks & mitigations
1. **axios+MSW+happy-dom** — pre-verified working. Residual blob/FormData quirks → `apiClient.defaults.adapter = 'fetch'` in setup.ts only.
2. **Interceptor accumulation** on singleton apiClient across tests → `clearApiInterceptors()` is the first line of `resetAllState()`; `configureApiInterceptors` keeps a configured-flag guard.
3. **Fake timers deadlocking MSW/Vue Query** → real timers default; `shouldAdvanceTime: true` + async advance only.
4. **Fresh-Pinia beforeEach vs tests that build their own Pinia** — their later `setActivePinia` wins; verified at gate 4.
5. **Threshold drop at F6 reads as regression** → dated comment explains denominator growth.
6. **Working-tree conflict**: uncommitted `setRedirectToLogin` changes overlap F3.3 — commit them before starting.
