# 01 — Extract useChatMessages composable

**What to build:** A new `useChatMessages(sessionId, sessionData)` composable in `app/composables/` that consolidates duplicated message-list logic from 3 chat pages into one shared module.

**Blocked by:** None — can start immediately

**Status:** ready-for-agent

## Interface

```ts
useChatMessages(
  sessionId: MaybeRefOrGetter<string>,
  sessionData: Ref<AISessionDTO | undefined>,
) → {
  messages: ComputedRef<AISessionMessageDTO[]>
  typingUsers: ComputedRef<...>
  thinkingAgents: ComputedRef<...>
  lastUnansweredOptionsMessageId: ComputedRef<string | undefined>
  isOptionsMode: ComputedRef<boolean>
}
```

## Design decisions

- **`sessionId` is `MaybeRefOrGetter<string>`** because pages pass both plain strings (`[sessionId].vue`) and refs (`new/[userId].vue`). Use `toValue()` internally.
- **`sessionData` is the ref from `useChatSession`**, not raw messages. The composable reads `.messages` from it. Pages already call `useChatSession` for metadata (title, members, agentId), so passing the result is natural — no duplicate queries.
- **Pending messages always included** — no config flag. Public pages never write pending messages, so `getUnconfirmedPendingMessages` returns `[]` harmlessly. One code path, zero config.
- **Options mode lives inside this composable**, not as a separate `useOptionsMode`. It's tightly coupled to the message list (scans backward to find the last unanswered `AIAnswerType.Options` message, then checks if any user message follows it). The composable needs `authStore.user?.email` internally for this check.
- **`handleOptionSubmitted` stays in the page** — it depends on page-specific state (different agentId sources, different members) that shouldn't leak into this composable.
- **`isMessagesReady` stays in `[sessionId].vue`** — only that page does stale-while-revalidate with `placeholderData`, so this concern is page-specific orchestration.

## Current duplication being eliminated

| Logic | `[sessionId].vue` | `new/[userId].vue` | `public/new/[agentId].vue` |
|---|---|---|---|
| Message assembly (query + pending + failed) | lines 574-579 | lines 230-235 | lines 138-142 |
| Typing users computed | line 582 | line 296 | line 158 |
| Thinking agents computed | line 583 | line 297 | line 159 |
| Options mode detection | lines 616-629 | lines 260-273 | not present |

## Acceptance criteria

- [ ] `useChatMessages` composable created with correct types and reactive behavior
- [ ] `[sessionId].vue` uses `useChatMessages` instead of inline message assembly, typing/thinking computeds, and options-mode detection
- [ ] `new/[userId].vue` uses `useChatMessages` instead of inline equivalents
- [ ] `public/new/[agentId].vue` uses `useChatMessages` instead of inline equivalents
- [ ] `handleOptionSubmitted` remains in each page (not extracted)
- [ ] `isMessagesReady` remains in `[sessionId].vue` (not extracted)
- [ ] Typecheck passes
- [ ] Existing tests pass without modification (or with minimal import-path updates)
- [ ] Unit tests for `useChatMessages` covering message merging, options-mode detection, and typing/thinking
