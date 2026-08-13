# Implementation Plan: Chat File Attachments

**Branch**: `feat/chat-file-attachments` | **Date**: 2026-08-05 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/002-chat-file-attachments/spec.md`

## Summary

Add file attachment support to InnoChat conversations: upload files via multipart POST, reference
them in sent messages, and display file messages (including images with inline preview) in the
conversation thread. The upload is a two-step flow — store each file independently, then send a
message referencing the stored file IDs. Attach is authenticated-mode only; display works everywhere.

## Technical Context

**Language/Version**: TypeScript 5 / Vue 3.5 / Nuxt 4 (SPA mode, `ssr: false`)

**Primary Dependencies**: TanStack Vue Query (server state), Pinia (UI state), Axios 1.13
(HTTP client), Nuxt UI (component library), VueUse (composables), neverthrow (Result types),
Zod (validation)

**Storage**: N/A (no client-side persistence for attachments; backend handles file storage)

**Testing**: Vitest + Testing Library + MSW 2 (network-boundary mocking)

**Target Platform**: Web — desktop (keyboard/pointer) and mobile (touchscreen) first-class

**Project Type**: SPA frontend (Nuxt 4 client to C# backend API)

**Performance Goals**: Eager upload overlapping with typing; concurrent uploads (bounded at 3);
send latency for pre-stored files equivalent to text-only messages (SC-010)

**Constraints**: 10 MB per file, 10 files per message, 20 MB total per message. Permitted types:
JPEG, PNG, GIF, WebP, HEIC, PDF, DOC/DOCX, XLS/XLSX, PPT/PPTX, TXT, CSV, MD.

**Scale/Scope**: Single-user composer state (no cross-tab sync needed), N files per message where
N ≤ 10

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **I. Layered Architecture**: **PASS**. Upload service in `lib/api/services/`, upload state in a
  composable (`useFileUpload`), pages consume composables only. No page imports a service directly.
- **II. Typed Result Error Handling**: **PASS**. Upload service returns `Result<T, AppError>`.
  Upload response validated with Zod. Per-file errors surfaced, not swallowed.
- **III. Network-Boundary Testing**: **PASS**. Tests will mock `POST /api/AIWebAPI/uploadFile` with
  MSW handlers. Components rendered via `renderWithProviders`. Coverage thresholds only raised.
- **IV. Bilingual by Default**: **PASS**. All validation messages, progress text, and error strings
  are i18n keys in both `en.json` and `hu.json`.
- **V. Dual-Mode & Cross-Device**: **PASS**. Attach restricted to authenticated mode via a single
  `disableFileUpload` prop on `MessageInput` (FR-027a). Public pages pass `true`; private pages
  pass `false`. Display works everywhere via shared `ChatMessages.vue`. Desktop and mobile both
  supported (file picker + drag-and-drop + touch).

## Project Structure

### Documentation (this feature)

```text
specs/002-chat-file-attachments/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   ├── upload-file.md
│   └── file-message.md
└── tasks.md             # Phase 2 output (/speckit-tasks command)
```

### Source Code (repository root)

```text
lib/
├── api/
│   └── services/
│       └── ChatService.ts          # Extended: uploadFile method
├── validation/
│   └── fileAttachment.ts           # New: limits, types, validation (FR-010a)
└── errors/
    └── types.ts                    # Extended: upload-specific AppError variants

types/
└── api/
    └── schemas.ts                  # Extended: UploadFileResponseDTO, AiQuestionRequestDTO + files,
                                    #   AIAnswerType.File, FileMessagePayload schemas

app/
├── composables/
│   ├── useFileUpload.ts            # New: staged attachment state, eager upload, concurrency
│   └── useChatMutations.ts         # Extended: pass files[] in send request
├── components/
│   └── chat/
│       ├── MessageInput.vue        # Extended: attach button, drop zone, staged attachment list
│       ├── FileAttachmentList.vue   # New: staged attachment preview/status/remove
│       ├── FileMessage.vue          # New: render received file messages
│       ├── FileEntry.vue            # New: single file display (icon + name + download)
│       └── ChatMessages.vue         # Extended: route file-type messages to FileMessage
└── pages/
    └── chats/
        ├── [sessionId].vue          # Extended: pass disableFileUpload=false
        └── public/
            ├── new/[agentId].vue    # Extended: pass disableFileUpload=true
            └── [sessionId].vue      # Extended: pass disableFileUpload=true

i18n/locales/
├── en.json                          # Extended: file attachment keys
└── hu.json                          # Extended: file attachment keys

tests/
├── composables/
│   └── useFileUpload.test.ts        # New: upload lifecycle, concurrency, validation
├── components/chat/
│   ├── FileAttachmentList.test.ts   # New: render states, remove action
│   ├── FileMessage.test.ts          # New: received file rendering, malformed payload fallback
│   └── MessageInput.file.test.ts    # New: attach trigger, send-with-files, public-mode gating
└── msw/handlers/
    └── fileUpload.ts                # New: MSW handler for POST /api/AIWebAPI/uploadFile
```

**Structure Decision**: All new code lands in existing layer-prescribed locations. One new
validation module (`lib/validation/fileAttachment.ts`) for centralized limits (FR-010a). The
upload service method lives on the existing `ChatService` since the upload endpoint is part of
the same API domain. A dedicated `useFileUpload` composable owns the staged-attachment lifecycle,
consumed by `MessageInput`. Three new display components under `chat/` for the rendering side.

## Complexity Tracking

> No Constitution Check violations. Table left empty.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| (none)    |            |                                     |
