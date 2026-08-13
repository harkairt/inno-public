# Research: Chat File Attachments

**Date**: 2026-08-05 | **Feature**: [spec.md](spec.md) | **Plan**: [plan.md](plan.md)

## R1: Axios multipart handling with shared JSON client

**Decision**: No change needed — the existing `transformRequestInterceptor` already handles this.

**Rationale**: The interceptor at `lib/api/interceptors/request.ts:183-189` detects `FormData`
instances and deletes the `Content-Type` header, letting the browser set `multipart/form-data`
with the correct boundary. This was wired in at `lib/api/interceptors/setup.ts:79` and is active
on the `apiClient` singleton. The spec's "axios trap" warning is pre-solved by existing
infrastructure. The upload service can post `FormData` through the standard `apiClient` with no
special headers override.

**Alternatives considered**: Manual `{ headers: { 'Content-Type': undefined } }` per-call — 
rejected because the interceptor already does this globally and doing it per-call would be
redundant.

## R2: Message type enum — File type value

**Decision**: Add `File = 16` to `AIAnswerType` enum and the Zod parser.

**Rationale**: The current enum in `types/enums/index.ts` has a commented-out `File = 3`.
The backend contract v3 specifies `messageType: "file"` which maps to numeric 16. The Zod
schema `AIAnswerTypeSchema` in `types/api/schemas.ts` needs a new `file → AIAnswerType.File`
mapping. The existing `File = 3` comment should be removed to avoid confusion.

**Alternatives considered**: Reusing the commented `File = 3` — rejected because the backend
documentation explicitly states the value is 16.

## R3: Upload response shape and request DTO extension

**Decision**: Define `UploadFileResponseDTO` (Zod + type) and extend `AiQuestionRequestDTO` with
an optional `files` field.

**Rationale**: The upload returns `{ data: { id: string, mimeType: string, thumbnailUrl: string } }`
in the standard `ApiResponse<T>` envelope. The send request gains `files: string[]` (GUID array,
optional, defaults to empty). Both need Zod schemas for boundary validation (Constitution II).

**Alternatives considered**: Unvalidated response — rejected because Constitution II requires Zod
at the boundary.

## R4: Public mode feature gating pattern

**Decision**: Add a `disableFileUpload` boolean prop to `MessageInput.vue`, following the
established `disableSignalR` / `disableVoice` pattern.

**Rationale**: Public chat pages (`chats/public/new/[agentId].vue`, `chats/public/[sessionId].vue`)
already pass `disable-signal-r` and `disable-voice` to the shared `MessageInput` component.
Adding `disable-file-upload` follows the same convention. The public pages pass `true`; the
private pages pass `false` (or omit, defaulting to `false`). This satisfies FR-027a's single-switch
requirement.

**Alternatives considered**: `usePublicMode().isPublicMode` check inside the composable — rejected
because it would scatter mode detection into internal logic rather than keeping it at the prop
boundary (Constitution V).

## R5: Agent ID resolution for upload

**Decision**: Use the same `targetAgentId` resolution that `MessageInput.handleSubmit` uses:
`props.selectedAgentId ?? props.agentId`.

**Rationale**: The upload endpoint requires `agentId: number`. The composer already resolves this
as `props.selectedAgentId ?? props.agentId` when building the send request. The upload composable
should accept this as a parameter, resolved at attach time (FR-007f). Since `agentId` is a prop
on `MessageInput` and is always available (the page provides a fallback), this resolution always
produces a valid number.

**Alternatives considered**: Passing agent name and looking up the ID — rejected because v3
already uses numeric `agentId` and the ID is directly available.

## R6: Concurrent upload strategy

**Decision**: Use a semaphore-style concurrency limiter (max 3 concurrent uploads per message).

**Rationale**: With up to 10 files per message, firing all simultaneously would create 10
concurrent HTTP requests. A limit of 3 balances perceived speed (multiple progress bars advancing)
with not overwhelming the browser's connection pool or the server. Excess files queue and start
as earlier uploads complete. The limit is defined alongside other attachment constants in
`lib/validation/fileAttachment.ts` (FR-010a).

**Alternatives considered**: Sequential (too slow for the user), fully concurrent (too many
connections), browser-managed (no control over ordering or progress).

## R7: File message payload parsing

**Decision**: Parse `messageText` as JSON with a Zod schema; fall back to raw text display on
parse failure.

**Rationale**: For `messageType === File`, `messageText` is a JSON string:
`{ text: string, files: [{ id, fileName, mimeType, url }] }`. This must be validated because
it arrives from the server and could be malformed (FR-018). A `FileMessagePayloadSchema` Zod
schema validates the structure; on failure, the raw `messageText` is rendered as plain text,
satisfying the fallback requirement.

**Alternatives considered**: No validation (trust the server) — rejected per Constitution II.

## R8: Existing error infrastructure

**Decision**: Extend `ErrorCode` enum with upload-specific codes; `AppError` hierarchy already
supports this.

**Rationale**: `ErrorCode` in `lib/errors/enums.ts` already has `UPLOAD_ERROR`. Additional codes
like `FILE_TOO_LARGE`, `FILE_TYPE_NOT_ALLOWED`, `FILE_COUNT_EXCEEDED`, `FILE_TOTAL_SIZE_EXCEEDED`
will be added for client-side validation errors (these are caught before any server call). Server
upload failures map to the existing `UPLOAD_ERROR` code with the server's message attached.

**Alternatives considered**: Reusing generic `VALIDATION_ERROR` — rejected because per-file error
reporting (FR-021) needs distinguishable error types for the UI to render specific messages.

## R9: Drop zone scope

**Decision**: The drag-and-drop drop zone covers the entire thread area (message list + composer),
not just the composer and not the full window.

**Rationale**: Per clarification, the drop zone indicator should react to the entire thread area
since it's the majority of the screen. This means `dragenter`/`dragover`/`drop` listeners on the
thread container element (the parent of both `ChatMessages` and `MessageInput`). The sidebar and
other chrome do not participate. This requires the thread container in the page to have a ref and
pass it to the upload composable or handle the events at the page level.

**Alternatives considered**: Composer-only (too small a target), full-window (would cover sidebar).
