# 02 — Extract useTrimmedWelcomeMessage composable

**What to build:** A new `useTrimmedWelcomeMessage(agentId, opts)` composable in `app/composables/` that wraps the existing `useWelcomeMessage` query composable, adds quote-trimming, and provides a `showOnlyWhen` guard. All 3 pages rewired to use it. Behavior identical before and after.

**Blocked by:** 01 — Extract useChatMessages (both modify the same 3 page files)

**Status:** ready-for-agent

## Interface

```ts
useTrimmedWelcomeMessage(
  agentId: MaybeRefOrGetter<number>,
  options?: {
    enabled?: MaybeRefOrGetter<boolean>
    sessionId?: string
    cacheScope?: MaybeRefOrGetter<string>
    showOnlyWhen?: MaybeRefOrGetter<boolean>
  },
) → {
  trimmedWelcomeMessage: ComputedRef<string | undefined>
  isLoading: Ref<boolean>
}
```

## Design decisions

- **Separate composable, not inside `useChatMessages`** — the welcome message has its own TanStack Query with enabled/staleTime/cacheScope config that varies heavily per page. Stuffing it into `useChatMessages` would widen that interface considerably.
- **`showOnlyWhen` gates the return value** even when the query has cached data. This handles the `[sessionId].vue` case: `useWelcomeMessage` has a 30-minute `gcTime`, so revisiting a session within that window would show a stale greeting without this guard. When `showOnlyWhen` resolves to `false`, `trimmedWelcomeMessage` returns `undefined` regardless of cache state.
- **Quote-trimming** is the shared mechanical logic: strip surrounding `"` characters from the backend response. Currently copy-pasted identically in all 3 pages.
- **Each page still provides its own config** — the enabled conditions, agentId sources, sessionId values, and cacheScope vary per page and represent per-page policy, not shared logic.

## Current page-specific configs (preserve these)

| Page | agentId source | enabled condition | sessionId | cacheScope | showOnlyWhen |
|---|---|---|---|---|---|
| `[sessionId].vue` | `resolveWelcomeAgent()` | virtualAgent exists AND isFreshlyCreated | real sessionId | defaults | `isFreshlyCreatedSession` |
| `new/[userId].vue` | `selectedUser.id` | user exists AND isVirtual | `''` | client UUID | not needed |
| `public/new/[agentId].vue` | route param / config | agentId truthy AND isAuthenticated | `''` | client UUID | not needed |

## Acceptance criteria

- [ ] `useTrimmedWelcomeMessage` composable created with `showOnlyWhen` option
- [ ] `[sessionId].vue` uses it with `showOnlyWhen` guard for `isFreshlyCreatedSession`
- [ ] `new/[userId].vue` uses it with virtual-agent enabled condition and cacheScope
- [ ] `public/new/[agentId].vue` uses it with authenticated enabled condition and cacheScope
- [ ] Quote-trimming logic removed from all 3 pages (no inline duplication remains)
- [ ] Typecheck passes
- [ ] Existing tests pass
- [ ] Unit tests for `useTrimmedWelcomeMessage` covering trimming and `showOnlyWhen` gating
