# Deepen the session page

Extract composables from the 974-line `[sessionId].vue` and its sibling chat pages to reduce each page to orchestration, eliminate duplication, and make each concern independently testable.

## Scope

3 pages: `[sessionId].vue`, `new/[userId].vue`, `public/new/[agentId].vue`.
`public/[sessionId].vue` is out of scope.

## Composables to extract

### `useChatMessages(sessionId, sessionData)`

Returns `{ messages, typingUsers, thinkingAgents, lastUnansweredOptionsMessageId, isOptionsMode }`.

- Takes the session data ref from `useChatSession`
- Merges query messages + pending (always included, harmless for public pages) + failed
- Includes typing/thinking indicators (sessionId is the only input for all three)
- Includes options mode detection (scans messages backward for last unanswered options message)
- `handleOptionSubmitted` stays in the page (page-specific agent/members wiring)
- `isMessagesReady` stays in `[sessionId].vue` (page-specific orchestration)

### `useTrimmedWelcomeMessage(agentId, opts)`

Returns `{ trimmedWelcomeMessage, isLoading }`.

Options: `{ enabled, sessionId, cacheScope?, showOnlyWhen? }`.

- Wraps `useWelcomeMessage` + quote-trimming
- `showOnlyWhen` gates the returned value even when cached data exists (handles `isFreshlyCreatedSession` on session page)
- Each page provides its own config (enabled conditions, sessionId, cacheScope vary per page)

### `useFileDrop(onDrop: (files: FileList) => void)`

Returns `{ isDraggingOver, onDragEnter, onDragLeave, onDragOver, onDrop }`.

- Callback-based — doesn't know about MessageInput
- Page wires the callback to `messageInputRef.handleDroppedFiles`

### `useTitleEdit(sessionId, { canEdit, sessionName })`

Returns `{ isEditingTitle, editedTitle, isUpdatingTitle, startEditingTitle, saveTitle, handleTitleKeydown, titleInputRef }`.

- Owns the `useUpdateSessionName` mutation
- `canEdit` is a ref input (page computes from `isPrimarySession`)
- Single consumer: `[sessionId].vue`

## Placement

All composables in `app/composables/` (flat, matching existing convention).
