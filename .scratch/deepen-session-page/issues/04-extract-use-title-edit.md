# 04 — Extract useTitleEdit composable

**What to build:** A new `useTitleEdit(sessionId, opts)` composable in `app/composables/` that owns the `useUpdateSessionName` mutation and all inline-editing state/handlers. `[sessionId].vue` rewired to use it. Behavior identical before and after.

**Blocked by:** 03 — Extract useFileDrop (modifies `[sessionId].vue`)

**Status:** ready-for-agent

## Interface

```ts
useTitleEdit(
  sessionId: string,
  options: {
    canEdit: MaybeRefOrGetter<boolean>
    sessionName: MaybeRefOrGetter<string | undefined>
  },
) → {
  isEditingTitle: Ref<boolean>
  editedTitle: Ref<string>
  isUpdatingTitle: Ref<boolean>
  startEditingTitle: () => void
  saveTitle: () => void
  handleTitleKeydown: (event: KeyboardEvent) => void
  titleInputRef: Ref<HTMLInputElement | null>
}
```

## Design decisions

- **Owns the mutation** — `useUpdateSessionName()` is called internally, making the composable testable end-to-end with MSW. No mutation wiring in the page.
- **`canEdit` is an input ref, not computed internally** — primary session detection (`isPrimarySession`) is a separate domain concept computed from `allSessions` + `selectableUsers`. That logic shouldn't leak into title editing. The page computes `canEdit` from `!isPrimarySession && !!session.sessionName` and passes it in.
- **`sessionName` is an input** — used to pre-fill `editedTitle` on start and to detect "unchanged" on save (skip the mutation if the user didn't actually change the name).
- **`cancelEditingTitle` is internal** — only called from `handleTitleKeydown` on Escape, not exposed.
- **`startEditingTitle` focuses the input** via `titleInputRef` after a `nextTick`. The page binds `titleInputRef` to the template `ref`.
- **`saveTitle` guards against double-fire** — the `@blur` handler fires even when Enter already saved. The composable checks `isEditingTitle` before proceeding and trims whitespace.
- **Single consumer** — only `[sessionId].vue` has title editing. The extraction is for testability (the page's 0.39:1 test ratio), not for sharing.

## Acceptance criteria

- [ ] `useTitleEdit` composable created, owns `useUpdateSessionName` mutation
- [ ] `[sessionId].vue` uses `useTitleEdit` instead of inline title-editing state and handlers
- [ ] `canEditTitle` computed remains in the page and is passed as `canEdit` ref
- [ ] Typecheck passes
- [ ] Existing tests pass
- [ ] Unit tests for `useTitleEdit` covering: start (pre-fills name, focuses input), save (calls mutation, trims, skips unchanged), cancel via Escape, Enter key saves, blur saves, double-fire guard
