# Phase 2 — Backfill Waves: From 41% to Near-Total Meaningful Coverage

> Part 2 of 3. Requires `Phase 1.md` (foundation harness) fully landed.
> Six waves, **one PR each**, risk-value ranked. Every wave's exit gate: `npm run test:coverage` green with thresholds raised in that PR to `floor(actual − 2)`, plus `npm run typecheck` and `npm run lint`.

## 0. Ground rules for every wave

- **New tests use MSW + real collaborators** per the mocking decision ladder (Phase 1 §F7). `vi.mock` only for: `@microsoft/signalr` (SignalRService unit), heavy libs happy-dom can't run (shiki/chart.js), and leaf stubs (i18n/toast).
- **Assert user-visible behavior** where a UI exists (Testing Library queries, `data-testid`), state/Result values where it doesn't.
- Reuse `tests/utils/factories.ts`; extend it rather than creating local factories (existing local `makeMessage` duplicates get consolidated when their file is touched).
- Test file location mirrors source: `lib/api/services/ConfigService.ts` → `tests/unit/lib/api/services/ConfigService.test.ts`; integration flows → `tests/integration/<flow>.test.ts`.
- Per-glob coverage thresholds (introduced in Phase 3 CI, but raised per-wave here) keep `lib/**` strictness from masking `app/**` gaps.

## Wave B0 — Done in Phase 1
Dead-test deletion + config hygiene landed with foundation. Nothing here.

---

## Wave B1 — Auth/Token Lifecycle + Services over MSW (highest value)

**Why first**: protects the token-expiry story end-to-end (the user's flagship scenario) and kills the URL-drift bug class (mocked clients never notice endpoint renames — the E2E suite already rotted this way).

### B1.1 Migrate service tests from `vi.mock('@/lib/api/client')` to MSW
Files: `tests/unit/lib/api/services/{AuthService,ChatService,UserService}.test.ts`.
Mechanical recipe per test:
1. Delete the `vi.mock('@/lib/api/client')` block.
2. Replace `vi.mocked(apiClient.post).mockResolvedValue({ data: makeApiResponse(x) })` with `server.use(http.post('<real path>', () => apiOk(x)))`.
3. Replace `mockRejectedValue(makeAxiosError(500))` with `server.use(http.post('<real path>', () => apiError(500)))`.
4. Assertions on `result.isOk()/isErr()` stay identical.
5. Request-shape assertions move from `expect(apiClient.post).toHaveBeenCalledWith(...)` to handler body/param spies.

Expected wins surfaced by migration: Zod-validation paths now actually run (a handler returning a wrong shape fails the test — previously invisible); wrong URL = unhandled-request error immediately.

### B1.2 Migrate interceptor tests
Files: `tests/unit/lib/api/interceptors/{request,response}.test.ts`.
- `response.test.ts` currently hand-constructs `AxiosError` objects and mocks `apiClient.post` for refresh. Rewrite as MSW integration through the real client: real request → handler returns 401 → real interceptor refreshes → retried. Keep a thin unit layer only for pure helpers (`extractTokensFromResponse` variants).
- `request.test.ts`: auth-header injection asserted via handler header spy; rate-limiter tests keep unit style but use `resetRateLimiter()` + fake timers (async advance).

### B1.3 New service tests
| File | Cases |
|---|---|
| `ConfigService.test.ts` | happy load; **cache**: second `loadConfig` = zero HTTP (handler call-count spy); **dedupe**: two concurrent loads = one request (`configPromise`); failure → `Result.isErr` and store falls back to `DEFAULT_CONFIG` with `isLoaded=true` + `loadError` set (silent-failure contract pinned); `clearCache()` → refetches |
| `LogService.test.ts` | `POST /api/Log/log` body shape; fire-and-forget: 500 response does NOT throw/propagate |
| `TranscriptionService.test.ts` | happy path; FormData/audio payload (if XHR quirks appear here, this is the file that flips `adapter='fetch'` — see Phase 1 risk 1); error mapping |

### B1.4 Flagship integration scenarios (extend `tests/integration/auth-token-lifecycle.test.ts` from F5)
1. 401 → refresh → retry with new `Authorization` header (F5, keep).
2. 3 concurrent 401s → exactly 1 refresh call → all succeed (queue).
3. Refresh 401 → `clearAuth()` + redirect called; storage emptied.
4. Refresh network error (`HttpResponse.error()`) → same clear+redirect path.
5. Retry backoff on 429/503: fake timers (`shouldAdvanceTime: true`), assert request count and spacing via `advanceTimersByTimeAsync`.
6. Alternate token casing in refresh response (per `extractTokensFromResponse`) still lands tokens.
7. Response cache: two GETs to a cacheable endpoint within TTL = one HTTP call; after `advanceTimersByTimeAsync(TTL)` = two.

### B1 exit
`lib/api/**` ≈ 95% lines. Global thresholds raised. Zero remaining `vi.mock('@/lib/api/client')` in `tests/unit/lib/`.

---

## Wave B2 — SignalR Subsystem (0% today)

### B2.1 `tests/unit/lib/signalr/SignalRService.test.ts` — unit, `vi.mock('@microsoft/signalr')`
Mock surface: `HubConnectionBuilder` chain (`withUrl`, `withAutomaticReconnect`, `configureLogging`, `build`), `HubConnectionState`, connection object with `start/stop/on/invoke/send/onreconnecting/onreconnected/onclose`.
Cases:
- `getInstance` requires config first call, returns same instance after; `resetInstance` clears.
- `connect`: builds connection with hub URL + `accessTokenFactory`; idempotent when already connected/connecting.
- **Connection-timeout race** (`setTimeout` ~line 84-93): fake timers; `start` never resolves → advance past timeout → connect rejects with timeout error, state `disconnected`.
- `onreconnecting`/`onreconnected`/`onclose` → `stateChange` events emitted with right states; reconnect counter increments.
- Event handler map: `on` registers, `clearAllEventHandlers` empties, handlers fire on connection `.on` callback.
- `disconnect` stops connection, state transitions, safe when never connected.
- `invoke`/`send` throw/queue when disconnected (per actual implementation — read first).

### B2.2 `tests/unit/lib/signalr/SignalROperations.test.ts` — unit vs stubbed service
- Each operation calls `invoke` with correct method name + args.
- Empty `userIds` early-return (no invoke).
- Error propagation from invoke.

### B2.3 `tests/unit/composables/useSignalR.test.ts` + `useSignalRChat.test.ts` — integration with `installFakeSignalR()`
`useSignalR`:
- Reactive `state`/`isConnected` track fake `setState()`.
- `connect()` passes `authStore.accessToken`.
- Hub URL: dev → `/chatHub`; prod → `${apiBaseUrl}/chatHub` (drive via `useRuntimeConfig` stub override).

`useSignalRChat`:
- `emitFromServer('SendStartTypingInfo', otherEmail, sessionId)` → `chatStore.typingUsers` contains user; `SendStopTypingInfo` removes.
- **Own-email filter**: typing event with `authStore.user.email` ignored.
- Watchers: token change → `forceReconnect` called; `isAuthenticated` false → disconnect; `isConnected` true → typing listeners registered exactly once.

### B2.4 `tests/unit/plugins/signalr-init.test.ts`
Invoke the plugin's setup with a mocked `nuxtApp` carrying a **real** QueryClient:
- Fake timers: flush the 500ms auto-connect `setTimeout`; authenticated → `connect` called; unauthenticated → not.
- `emitFromServer('ReceiveMessage', sessionId, agentId)` → spy `queryClient.invalidateQueries` called with `chatQueryKeys.session(sessionId)` AND `chatQueryKeys.unread()`.
- Listener dedupe: setup twice → handlers registered once (`listenersRegistered` guard).

### B2.5 `tests/unit/components/chat/SignalRConnectionStatus.test.ts`
`renderWithProviders` + fake states: connected → no banner (or green); reconnecting → visible indicator text (i18n keys); disconnected → error state. Query by `data-testid`/role.

### B2 exit
`lib/signalr/**` ≈ 95%; composables bump. Thresholds raised.

---

## Wave B3 — Plugins + Public/Iframe Mode

### B3.1 `tests/unit/plugins/public-auth.test.ts` (the iframe flow — high value)
Seed config store public-mode (`publicMode: 1`, `publicAgentId`, `publicLoginEmail/Password`), MSW login handler. Cases:
- Public mode → `setStorageMode('sessionStorage')` called, `clearAuth()` called, auto-login fires, tokens land in **sessionStorage** not localStorage.
- Missing credentials → `configStore.setPublicAuthError(true)`, no login attempt.
- Login handler returns 401 → `setPublicAuthError(true)`.
- Login throws (network error) → `setPublicAuthError(true)`.
- Non-public config → early return: no storage-mode switch, no clearAuth, no HTTP.

### B3.2 `tests/unit/plugins/config-init.test.ts`
- Success: MSW config.json → `apiClient.defaults.timeout` set from config; CSS custom properties written to `document.documentElement` (happy-dom supports `style.setProperty` — assert `getPropertyValue`).
- Failure (500): defaults applied, `isLoaded=true`, `loadError` set, no CSS crash.
- `sanitizeCssValue` rejection: config with `background: 'red; } body { display:none'` style injection attempts → property NOT set (assert each regex allow-list branch).

### B3.3 Thin plugins — `vue-query.client`, `pinia-persistence.client`, `buffer.client`, `viewer.client`
Setup-function tests with mocked `nuxtApp` (`vueApp.use` spy): correct plugin installed with expected options. Small; aim is include-in-coverage + crash protection.

### B3.4 Composables: `usePublicMode`, `usePublicChatAgent`, `useConfig`
Drive via seeded config store (no mocking): `isPublicMode` truth table (`publicMode: 1/0/undefined`), `publicAgentId` `-1` sentinel → null, `isValidPublicAgent`, `getPublicChatUrl` shape.

### B3 exit
`app/plugins/**` ≈ 90%. Integration test `tests/integration/public-mode-boot.test.ts`: config(public) → public-auth plugin → auto-login → sessionStorage tokens — the full iframe boot chain.

---

## Wave B4 — Remaining Composables (~10 files)

Per-file browser-API stubs; unit or store-integration level:

| Composable | Approach | Key cases |
|---|---|---|
| `useChatAutoScroll` | stub `navigator.userAgent` per test (vi.stubGlobal / Object.defineProperty) | mobile vs desktop regex branches; scroll threshold behavior with fake element refs |
| `useVoiceRecording` | fake `navigator.mediaDevices.getUserMedia` + `MediaRecorder` class fake (`start/stop/ondataavailable/onstop`) | permission granted → recording lifecycle → blob assembled; **permission denied** → error state, no crash; unsupported browser (no mediaDevices) branch |
| `usePWAUpdate` | fake `navigator.serviceWorker` registration + fake timers | 10-min `setInterval` triggers `registration.update()`; update-found → `needRefresh` reactive flag |
| `useRelativeDate` | `vi.setSystemTime` | boundary matrix: seconds/minutes/hours/days/weeks ago; locale keys |
| `useShiki` | `vi.mock('shiki')` (WASM won't load in happy-dom) | highlighter init once (cache); language fallback; error → plain code |
| `useChartJs` | `vi.mock('chart.js')` (no canvas) | config building from props; theme colors read via `getComputedStyle(document.documentElement)` (seed CSS vars first) |
| `usePrimarySession` | real stores + MSW | selection logic across session list permutations |
| `useUsers` | MSW `/api/user/get-selectable-users` | query enabled-gating on auth; data mapping |
| `useNavigationVisibility` | real store/route stubs | visibility matrix per route/mode |
| `usePivotTable` | pure unit | aggregation/pivot math, table-shape edge cases (empty, single row) |
| `useMarkdown` | unit | rendering pipeline, sanitization handoff |

Also migrate-opportunistically here: `useChatQueries.test.ts` / `useChatMutations.test.ts` if B1/B2 didn't already touch them —
- `useChatMutations` deserves a dedicated integration test: **optimistic send → MSW 500 → rollback + `chatStore.addFailedMessage`**; temp-ID determinism via `vi.setSystemTime`; `notifyMembersViaSignalR` asserted through the fake's `invocations`.
- `useChatQueries`: `refetchOnWindowFocus` via `simulateWindowFocus()`; 30s `refetchInterval` via fake timers; `agentsWithoutWelcomeMessage` 500-tracking behavior + reset.

### B4 exit
`app/composables/**` ≈ 90%.

---

## Wave B5 — Components (~15 files)

All via `renderWithProviders`; MSW where the component (or its composables) fetch; assert DOM the user sees.

| Component | Notes / key cases |
|---|---|
| `MarkdownContent` | **XSS suite**: `<script>`, `onerror=`, `javascript:` hrefs sanitized (via `app/utils/sanitize.ts`); code blocks render; links get expected attrs |
| `ChatTable` | valid table data renders rows; invalid → validation fallback from `lib/validation/table.ts` (assert fallback UI, not crash) |
| `ChatChart` | mocked chart.js; valid config → canvas mount + props wiring; invalid → `lib/validation/chart.ts` fallback |
| `ChatPivotTable` | mocked pivot lib; `window.innerWidth < 768` branch via happy-dom resize |
| `TypingIndicator` | appears with typing users from chatStore; hides on empty; its internal timer with fake timers |
| `UserAvatar` | initials fallback, image path, size variants |
| `AppUpdateBanner` | drive `usePWAUpdate` state → banner visible, refresh button action |
| `PublicChatHeader` | public-mode config → title/agent rendering |
| `navigation/AppRail` + `AppBottomTabBar` | route-active states, visibility per auth/public mode, mobile vs desktop |
| `AgentTile`, `MessageRating`, `OptionsMessage`, `SessionMembers`, `UnreadChatCard` | render + emit contracts; `MessageRating` posts rating via MSW handler spy |

**Early gate (do first in this wave)**: add ONE `.vue` file to coverage and verify v8 SFC coverage numbers are stable across two runs before ratcheting on them. If noisy → ratchet lines-only for `app/components/**`.

### B5 exit
`app/components/**` ≈ 85%.

---

## Wave B6 — Pages + Middleware (the flow-protection wave)

Pages rendered as components via `renderWithProviders` with `useRoute` stub overridden per test (params/query); router `push` spy from the global `useRouter` stub; MSW for all data.

| Page | Flow assertions |
|---|---|
| `login.vue` | submit valid → MSW login → `navigateTo('/chats')`; invalid creds (401) → visible i18n error; remember-me → `innochat-remembered-email` in localStorage; redirect query param honored |
| `chats/index.vue` | session list renders from MSW; empty state; unread badges |
| `chats/[sessionId].vue` | messages render; **optimistic send → 500 → rollback + failed-message banner**; fakeSignalR `emitFromServer('ReceiveMessage', …)` → invalidate → new message appears; typing indicator appears/disappears; scroll composable stubbed if needed |
| `chats/new/[userId].vue` | new-session creation flow → navigate to session |
| `chats/public/new/[agentId].vue` + `chats/public/[sessionId].vue` | public header, no nav rail, agent validation, public-mode error state when `publicAuthError` |
| `users.vue` | user list from MSW; search filtering (drives `useClientSideUserSearch`) |
| `profile.vue` | user data display; SignalR status section |
| `index.vue` | redirect behavior |

Middleware: extend `tests/unit/middleware/auth.test.ts` with the full public-route matrix — public mode × {valid agent URL, invalid agent regex, non-public route} and private mode × {`/chats/public/*` → login, unauthenticated → `?redirect=`, authenticated-on-login → `/chats`}.

### B6 exit
`app/pages/**` ≈ 80%. Final global ratchet. `tests/integration/` now holds the seven protected flows: login→chats, token-expiry silent refresh, refresh-failure→login, public-mode boot, ReceiveMessage→UI, optimistic-send rollback, config-failure→defaults.

---

## Migration policy — all 31 existing unit-test files

| Verdict | Files | Criterion |
|---|---|---|
| **Deleted (Phase 1)** | `tests/unit/components/chats/**` (3) | components never existed |
| **Migrate in B1** | AuthService, ChatService, UserService, interceptors request+response tests | `vi.mock('@/lib/api/client')` hides URL-drift + Zod paths |
| **Migrate opportunistically** (when a wave touches them or they break) | useAuth, useChatQueries, useChatMutations, useChatListData, ChatListPanel and other component tests mocking stores/client | *does the mock replace a collaborator whose contract MSW can enforce?* yes → migrate |
| **Keep as-is forever** | tokens, uuid, groupMessages, `lib/validation/*`, `lib/errors/utils`, store tests on real Pinia | pure units; mocks are leaf-only (i18n/toast) |

## Coverage endgame targets (enforced per-glob in Phase 3)

| Directory | Lines | Notes |
|---|---|---|
| `lib/` | 95–100% | exclude `lib/errors/sentry.ts` (vendor wrapper) |
| `app/stores` | 95% | already strong |
| `app/composables` | 90% | shiki/chart wrappers capped by module mocks |
| `app/plugins`, `app/middleware` | 90% | small, high-leverage |
| `app/components` | 85% | `.vue` v8 caveat above |
| `app/pages` | 80% | visual/layout branches pragmatically excluded |
| Excluded | — | `types/**`, `*.d.ts`, `*.config.*`, `i18n/`, `app/app.vue` |

## Wave-level risks
- **happy-dom gaps** (canvas, WASM, MediaRecorder, ResizeObserver): module mocks + class fakes; if a component is genuinely unrenderable, drop to props/emit unit level — don't fight the DOM.
- **`console.error = vi.fn()` global** hides real render errors — when a wave's test mysteriously passes-but-shouldn't, check this first; consider flipping to assert-no-unexpected-errors during B5.
- **Suite duration creep**: MSW integration tests are slower than pure mocks. Watch wall-clock per wave; if >2 min total, shard by `test.projects` before adding more.
- **Order dependence regressions**: `resetAllState()` should prevent; any flaky test = missing reset in some singleton — add to resetAllState, don't patch the test.

## Errata — the silently-dead global coverage gate (fixed in C1)

Throughout Phase 2 every wave's exit gate reads "`npm run test:coverage` green
with thresholds raised to `floor(actual − 2)`". For the **per-glob** thresholds
that held true. The **global** gate did **not** — it was silently inert until the
Phase 3 CI hardening (commit C1).

Root cause: the config expressed global thresholds under a `thresholds.global`
sub-object. That is **Jest's** shape. Vitest has no `global` key under
`thresholds` — global thresholds are the bare top-level numeric keys
(`branches` / `functions` / `lines` / `statements`) directly under `thresholds`,
and any *string* key is treated as a glob pattern. So `global:` was parsed as a
glob matching **zero files**, contributed nothing, and was dropped without error.

Consequence: for the span of the backfill waves the global coverage floor never
actually failed a run — only the per-glob entries enforced anything. A repo-wide
regression that stayed within every glob's own budget could have slipped through.
C1 fixed it by moving the numbers to the correct top-level keys (see the comment
block in `vitest.config.ts` at `thresholds:` — it now carries this warning inline
so the Jest/Vitest shape mismatch can't be reintroduced). The per-wave ratchet
numbers recorded above were still correct as *measurements*; they simply weren't
being *enforced* globally until C1.
