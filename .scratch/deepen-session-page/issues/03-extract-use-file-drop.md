# 03 — Extract useFileDrop composable

**What to build:** A new `useFileDrop(onDrop)` composable in `app/composables/` that owns drag-and-drop state and event handlers. `[sessionId].vue` and `new/[userId].vue` rewired to use it. Additionally, `new/[userId].vue` adopts `useChatAutoScroll` instead of its manual `scrollTop = scrollHeight` approach. Behavior identical before and after.

**Blocked by:** 02 — Extract useTrimmedWelcomeMessage (both modify overlapping page files)

**Status:** ready-for-agent

## Interface

```ts
useFileDrop(
  onFilesDropped: (files: FileList) => void,
) → {
  isDraggingOver: Ref<boolean>
  onDragEnter: (event: DragEvent) => void
  onDragLeave: () => void
  onDragOver: (event: DragEvent) => void
  onDrop: (event: DragEvent) => void
}
```

## Design decisions

- **Callback-based** — the composable receives an `onFilesDropped` callback and doesn't know about `MessageInput`. The page wires the callback: `useFileDrop((files) => messageInputRef.value?.handleDroppedFiles(files))`. This keeps the composable free of component knowledge.
- **Manages `dragEnterCounter` internally** — the enter/leave counter pattern (needed because `dragenter`/`dragleave` fire on child elements) is an implementation detail, not exposed.
- **The current logic is copy-pasted identically** between `[sessionId].vue` (lines 454-486) and `new/[userId].vue` (lines 334-366). Only difference: `messageInputRef` type includes `focus` in one but not the other — irrelevant to the composable since it uses a callback.

## Opportunistic fix: scroll behavior in `new/[userId].vue`

`new/[userId].vue` currently uses a manual `scrollTop = scrollHeight` function (lines 368-374) instead of the `useChatAutoScroll` composable that `[sessionId].vue` already uses. Since we're modifying the file anyway, adopt `useChatAutoScroll` here too. No options needed — defaults are fine for a new-chat page.

## Acceptance criteria

- [ ] `useFileDrop` composable created with callback-based interface
- [ ] `[sessionId].vue` uses `useFileDrop` instead of inline drag-and-drop logic
- [ ] `new/[userId].vue` uses `useFileDrop` instead of inline drag-and-drop logic
- [ ] `new/[userId].vue` uses `useChatAutoScroll` instead of manual `scrollTop` hack
- [ ] Typecheck passes
- [ ] Existing tests pass
- [ ] Unit tests for `useFileDrop` covering drag state transitions and file forwarding
