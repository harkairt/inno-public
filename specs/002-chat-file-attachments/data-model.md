# Data Model: Chat File Attachments

**Date**: 2026-08-05 | **Spec**: [spec.md](spec.md) | **Plan**: [plan.md](plan.md)

## Entities

### StagedAttachment (client-only, ephemeral)

The in-memory representation of a file the person has selected but not yet sent. Lives in the
`useFileUpload` composable's reactive state. Not persisted — lost on navigation or reload.

| Field | Type | Source | Notes |
|---|---|---|---|
| `id` | `string` | Client-generated (nanoid/crypto) | Unique within the composer session; used as Vue list key |
| `file` | `File` | Browser File API | The original File object; used for preview + upload |
| `fileName` | `string` | `file.name` | Display name; treated as untrusted for rendering (FR-019) |
| `fileSize` | `number` | `file.size` | Bytes; validated against limits at attach time |
| `mimeType` | `string` | `file.type` | Browser's guess; used only for client-side type check (FR-010b) |
| `status` | `UploadStatus` | State machine | `'pending'` → `'uploading'` → `'ready'` \| `'failed'` |
| `progress` | `number` | Axios `onUploadProgress` | 0–100; meaningful only while `status === 'uploading'` |
| `serverFileId` | `string \| null` | Upload response | GUID returned by server; null until `status === 'ready'` |
| `serverMimeType` | `string \| null` | Upload response | Server's determined MIME type; may differ from `mimeType` |
| `error` | `AppError \| null` | Upload failure | Non-null only when `status === 'failed'` |

**State transitions**:

```
attach → [validate] → pending → uploading → ready
                   ↘ rejected (not added)    ↘ failed → (retry) → uploading
```

- `attach`: Person selects/drops a file. Validation runs synchronously (size, type, count limits).
  If rejected, the file is never added and an error toast is shown.
- `pending`: File passed validation, added to the list, waiting for a concurrency slot.
- `uploading`: Active upload in flight. `progress` updates as bytes transfer.
- `ready`: Server returned a `serverFileId`. The attachment can be referenced by the message.
- `failed`: Upload request errored. `error` holds the reason. Retryable.

**Uniqueness**: Duplicate detection by `file.name + file.size + file.lastModified`. If a duplicate
is detected, the file is not added (FR edge case: same file attached twice).

### UploadFileResponse (server → client)

The server's response to `POST /api/AIWebAPI/uploadFile`, inside the standard `ApiResponse<T>`
envelope.

| Field | Type | Notes |
|---|---|---|
| `id` | `string` | GUID; the reference used in the `files` array of the send request |
| `mimeType` | `string` | Server-determined MIME type (authoritative) |
| `thumbnailUrl` | `string` | Currently always `""`; future thumbnail URL |

### FileMessagePayload (server → client, inside `messageText`)

When `messageType === File` (16), `messageText` is a JSON-encoded string with this shape.

| Field | Type | Notes |
|---|---|---|
| `text` | `string` | Accompanying message text; may be empty |
| `files` | `ReceivedFile[]` | Ordered list of files; may be empty on malformed messages |

### ReceivedFile (inside FileMessagePayload)

One file entry in a received file message.

| Field | Type | Notes |
|---|---|---|
| `id` | `string` | File identifier |
| `fileName` | `string` | Display name; untrusted, must be sanitized before rendering |
| `mimeType` | `string` | Server-determined MIME type; used for preview vs. icon decision |
| `url` | `string` | Absolute retrieval URL; unauthenticated; untrusted (FR-019) |

### AiQuestionRequestDTO (extended)

The existing send-message request body, extended with one optional field.

| Field | Type | Change | Notes |
|---|---|---|---|
| `files` | `string[]` | **New** | Array of server file GUIDs. Empty or omitted for text-only messages. |

All other fields (`userCode`, `sessionId`, `agentId`, `members`, `question`, `group`,
`pquestionType`, `options`) remain unchanged.

### AIAnswerType (extended)

| Value | Name | Change |
|---|---|---|
| `16` | `File` | **New** |

## Validation Constants (FR-010a)

All limits defined once in `lib/validation/fileAttachment.ts`:

| Constant | Value | Used by |
|---|---|---|
| `MAX_FILE_SIZE_BYTES` | `10 * 1024 * 1024` (10 MB) | FR-008 |
| `MAX_FILES_PER_MESSAGE` | `10` | FR-009 |
| `MAX_TOTAL_SIZE_BYTES` | `20 * 1024 * 1024` (20 MB) | FR-009 |
| `MAX_CONCURRENT_UPLOADS` | `3` | FR-007h |
| `ALLOWED_EXTENSIONS` | See type list below | FR-010 |
| `ALLOWED_MIME_TYPES` | See type list below | FR-010 |

**Permitted type list** (FR-010):

| Category | Extensions | MIME types |
|---|---|---|
| Images | `.jpg`, `.jpeg`, `.png`, `.gif`, `.webp`, `.heic` | `image/jpeg`, `image/png`, `image/gif`, `image/webp`, `image/heic` |
| Documents | `.pdf`, `.doc`, `.docx`, `.xls`, `.xlsx`, `.ppt`, `.pptx` | `application/pdf`, `application/msword`, `application/vnd.openxmlformats-officedocument.*` |
| Plain text | `.txt`, `.csv`, `.md` | `text/plain`, `text/csv`, `text/markdown` |

## Relationships

```
MessageInput (component)
  └─ useFileUpload (composable) ──manages──▶ StagedAttachment[]
       └─ chatService.uploadFile() ──returns──▶ UploadFileResponse
       └─ chatService.sendQuestion() ──includes──▶ files: string[] (serverFileId references)

ChatMessages (component)
  └─ FileMessage (component) ──parses──▶ FileMessagePayload
       └─ FileEntry (component) ──renders──▶ ReceivedFile
```
