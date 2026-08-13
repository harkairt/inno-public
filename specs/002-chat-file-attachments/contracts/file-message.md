# Contract: File Message (Received)

**Direction**: Server → Client (via history fetch or real-time SignalR delivery)
**Message type**: `AIAnswerType.File` = `16` (string `"file"` in Zod parser)

## Message Shape

A file message arrives as an `AISessionMessageDTO` where:
- `messageType` is `"file"` (maps to `AIAnswerType.File = 16`)
- `messageText` is a **JSON-encoded string** (not a JSON object — it must be parsed)

## Payload (inside `messageText`)

```json
{
  "text": "itt a szerződés",
  "files": [
    {
      "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      "fileName": "szerzodes.pdf",
      "mimeType": "application/pdf",
      "url": "https://example.com/api/storage/a1b2c3d4"
    }
  ]
}
```

| Field | Type | Required | Notes |
|---|---|---|---|
| `text` | `string` | Yes | Accompanying text; may be `""` |
| `files` | `ReceivedFile[]` | Yes | Ordered file list; should be ≥1 but must tolerate 0 |

### ReceivedFile

| Field | Type | Required | Notes |
|---|---|---|---|
| `id` | `string` | Yes | File identifier |
| `fileName` | `string` | Yes | Display name; **untrusted** — sanitize before rendering |
| `mimeType` | `string` | Yes | Server-determined; used for image-vs-document UI decision |
| `url` | `string` | Yes | Absolute URL; **no auth token needed**; **untrusted** — validate protocol |

## Rendering Rules

| Condition | Behavior |
|---|---|
| `text` is non-empty | Render as markdown (same rules as regular messages) above/before files |
| `text` is empty | Do not render an empty text block |
| `mimeType` starts with `image/` | Show inline image preview + download link |
| Other `mimeType` | Show file icon + filename + download link |
| `url` is unreachable | Show filename with an error state; do not silently hide the file |
| `files` is empty or missing | Render `text` only; if both empty, render fallback message |
| `messageText` is not valid JSON | Render raw `messageText` as plain text (FR-018 fallback) |

## Zod Schemas

```
ReceivedFileSchema = z.object({
  id: z.string(),
  fileName: z.string(),
  mimeType: z.string(),
  url: z.string().url(),
})

FileMessagePayloadSchema = z.object({
  text: z.string(),
  files: z.array(ReceivedFileSchema),
})
```

## Send-Side Extension

When sending a message with attachments, the existing `AiQuestionRequestDTO` gains:

| Field | Type | Default | Notes |
|---|---|---|---|
| `files` | `string[]` | `[]` | Array of GUID strings from upload responses |

The `pquestionType` remains `Text` (0). A file-bearing message is distinguished by a non-empty
`files` array, not by a different question type.

```
AiQuestionRequestDTOSchema = z.object({
  ...existing fields...,
  files: z.array(z.string()).default([]),   // NEW
})
```
