---
name: vonno-concerns
description: Use before modifying fragile areas of vonno/InnoChat — interceptors, useSendMessage, SignalR, scroll logic, primary session detection. Also use when investigating tech debt, known bugs, security issues, performance bottlenecks, or test coverage gaps. Triggers on "tech debt", "refactor", "known bug", "fragile", "security", "performance", "interceptor", "signalr reconnect", "token refresh", "scroll", "optimistic update", "coverage gap".
---

# Vonno Codebase Concerns

*Sourced from `.planning/codebase/CONCERNS.md` — analysis date: 2026-04-29*

---

## Fragile Areas — Read Before Touching

### `useSendMessage` optimistic update cache (`app/composables/useChatMutations.ts`)
- Manually builds synthetic `AISessionDTO` objects and injects them into Vue Query cache
- The synthetic shape must exactly match the Zod schema — any schema change in `types/api/schemas.ts` will silently break optimistic updates
- **Before modifying:** run `npm run typecheck`. Add a test that verifies the synthetic object passes `AISessionDTOSchema.safeParse`.
- Known bug: `onMutate` uses `tempMessageId` for the optimistic message, but `onSuccess` generates a new `temp-user-${Date.now()}` ID, causing a flicker for new sessions.

### Token refresh interceptor (`lib/api/interceptors/response.ts`)
- `isRefreshing`, `failedQueue`, and `authStoreInstance` are module-level variables
- In test environments or hot-reload, stale state from a previous cycle can leak into the next
- The `finally` block already resets `isRefreshing = false` and `failedQueue = []` — do not remove this
- **Before modifying:** check `tests/unit/lib/api/interceptors/response.test.ts` coverage first

### SignalR listener registration (`app/plugins/signalr-init.client.ts`)
- `listenersRegistered` flag is local to the plugin closure — resets on hot-reload, causing duplicate `ReceiveMessage` handlers
- Duplicate handlers → double Vue Query invalidations → flickering message list
- **Before modifying:** verify the `SignalRService` singleton's `eventHandlers` Map doesn't already have the handler registered

### Primary session detection (`app/composables/usePrimarySession.ts`)
- Returns `false` while `allSessions` is not yet loaded (no explicit loading state)
- During initial render: "create new session" button and title area are wrong until `useChatSessions` resolves
- **Before touching UI that depends on isPrimarySession:** add a loading guard

---

## Known Bugs

**`scrollToElement` race condition** (`app/composables/useChatAutoScroll.ts` lines 143–194)
- `scrollToElementActive` flag clears after 500ms hardcoded delay; slow devices may see scroll jump mid-animation

**`saveTitle` double-fire on Enter** (`app/pages/chats/[sessionId].vue` lines 567–599)
- Pressing Enter calls `saveTitle()`, then blur fires and calls it again — the `isUpdatingTitle` guard is a race condition, not a real fix

---

## Tech Debt to Know About

**Dead code in interceptors** (`lib/api/interceptors/request.ts`, `response.ts`):
- `debugInterceptor` is registered but its entire body is commented out — runs as no-op on every request
- `transformRequestInterceptor` has an empty branch for `/login`/`/register` that does nothing
- `responseCache` Map in `response.ts` is populated on every GET response but never read — includes a `setInterval` that cleans an always-empty-from-consumer cache every 60s

**Inconsistent camelCase transformation** (`lib/api/interceptors/response.ts` lines 94–97):
- `transformToCamelCase` is applied only to `/login` and `/user` URL paths — all other responses are untransformed

**Unguarded `console.log` in production** — two locations:
- `app/composables/useChatAutoScroll.ts` (lines 85, 88, 92, 109, 111, 113, 119, 131, 160, 162, 164, 168) — fires on every scroll event
- `app/plugins/api-interceptors.client.ts` (lines 31, 35, 80, 101) — fires on every app mount

**`agentId` fallback to hardcoded `1`** (`app/pages/chats/[sessionId].vue` line 173):
- `:agent-id="authStore.user?.id || 1"` — silently sends messages with agent ID `1` if user is momentarily null

**SignalR reconnect uses stale token** (`lib/signalr/SignalRService.ts` lines 50–57):
- `accessTokenFactory` captures `accessToken` at connect time; on reconnect it uses the captured string, not the current token from the auth store
- If JWT expires and is refreshed, SignalR reconnect will fail with 401 silently

**Magic 500ms timeout in SignalR init** (`app/plugins/signalr-init.client.ts` line 44):
- Arbitrary delay to "ensure stores are initialized" — a race condition workaround

---

## Security Considerations

**`v-html` via DOMPurify** (`app/components/chat/MarkdownContent.vue`):
- XSS protection depends entirely on `sanitizeHTML` in `app/utils/sanitize.ts`
- SVG and `style` attributes allowed for KaTeX; a hook strips `url()` and `position: fixed` CSS
- Audit `ALLOWED_TAGS`/`ALLOWED_ATTR` if adding new content rendering features

**JWT/refresh tokens in localStorage/sessionStorage** (`app/stores/auth.ts` lines 69–84):
- Any XSS would expose tokens; DOMPurify reduces but does not eliminate the surface

**Client-side SHA-512 password hashing** (`app/stores/auth.ts` line 167):
- SHA-512 is not a KDF (no salt, no stretching) — hash effectively *is* the password
- Do not add more places where passwords are client-side hashed

---

## Performance Hotspots

**O(n log n) sort in computed** (`app/pages/chats/[sessionId].vue` lines 437–439):
- Sorts all messages by `sendDate` on every computed evaluation to find the second message

**Linear scan for every session in sidebar** (`app/composables/usePrimarySession.ts` lines 44–61):
- `isPrimarySessionCheck` filters and sorts `allSessions` per call — no memoization per session ID

**Shiki highlighter** (`app/composables/useShiki.ts`):
- Each `MarkdownContent` component independently reacts to the shared `isLoaded` ref — all trigger re-renders simultaneously when highlighter finishes loading

---

## Test Coverage Gaps (priority order)

**High priority — no tests at all:**
- `app/pages/chats/[sessionId].vue` — significant orchestration logic (scroll, options mode, primary session, title editing)
- `useSignalR` / `useSignalRChat` / `SignalRService` — connection state, event handler registration/cleanup, reconnect token staleness

**Medium priority:**
- `useChatAutoScroll` — scroll-to-bottom, `scrollToElement` branching, race condition flag
- `usePrimarySession` — primary session detection, `getSessionDisplayName`, edge cases

**Low priority:**
- `useVoiceRecording` — MediaRecorder lifecycle, Safari/iOS MIME type differences
- `lib/api/services/LogService.ts`, `TranscriptionService.ts`, `ConfigService.ts`
