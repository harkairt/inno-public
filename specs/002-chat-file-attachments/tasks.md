# Tasks: Chat File Attachments

**Input**: Design documents from `/specs/002-chat-file-attachments/`

**Prerequisites**: plan.md, spec.md, data-model.md, research.md, contracts/, quickstart.md

**Tests**: Included — the plan and spec explicitly define test files and quickstart validation scenarios.

**Organization**: Tasks are grouped by user story. US1/US2 share infrastructure (`useFileUpload`, `MessageInput`) but are independently testable. US3 (display) is fully independent. US4 (error recovery) layers on top of US1/US2.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Type definitions, validation constants, error codes, and Zod schemas that every user story depends on

- [x] T001 [P] Add `File = 16` to `AIAnswerType` enum and its Zod mapping in `types/enums/index.ts` — remove the commented-out `File = 3` (R2)
- [x] T002 [P] Create validation constants module `lib/validation/fileAttachment.ts` with `MAX_FILE_SIZE_BYTES`, `MAX_FILES_PER_MESSAGE`, `MAX_TOTAL_SIZE_BYTES`, `MAX_CONCURRENT_UPLOADS`, `ALLOWED_EXTENSIONS`, `ALLOWED_MIME_TYPES` (FR-010a, data-model)
- [x] T003 [P] Add upload-specific error codes (`FILE_TOO_LARGE`, `FILE_TYPE_NOT_ALLOWED`, `FILE_COUNT_EXCEEDED`, `FILE_TOTAL_SIZE_EXCEEDED`) to `ErrorCode` enum in `lib/errors/enums.ts` (R8)
- [x] T004 [P] Define `UploadFileResponseDTOSchema` and `UploadFileResponseDTO` type in `types/api/schemas.ts` per upload-file contract
- [x] T005 [P] Define `ReceivedFileSchema`, `FileMessagePayloadSchema`, and their TypeScript types in `types/api/schemas.ts` per file-message contract
- [x] T006 [P] Define `StagedAttachment` type and `UploadStatus` union type in a new `types/fileAttachment.ts` (data-model)
- [x] T007 Extend `AiQuestionRequestDTO` schema in `types/api/schemas.ts` with optional `files: z.array(z.string()).default([])` field (file-message contract send-side)
- [x] T008 [P] Add i18n keys for file attachment strings to both `i18n/locales/en.json` and `i18n/locales/hu.json` — validation errors, upload states, progress, labels (FR-025)

**Checkpoint**: All shared types, schemas, constants, and i18n keys are in place. No runtime code yet.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Service method and MSW handler that upload and display tasks both need

**⚠️ CRITICAL**: US1/US2 cannot start without the service method; tests across all stories need the MSW handler.

- [x] T009 Add `uploadFile(agentId: number, file: File, onProgress: (percent: number) => void): ResultAsync<UploadFileResponseDTO, AppError>` method to `ChatService` in `lib/api/services/ChatService.ts` — construct `FormData` per upload-file contract, validate response with `UploadFileResponseDTOSchema` (R1, R3)
- [x] T010 [P] Create MSW handler for `POST /api/AIWebAPI/uploadFile` in `tests/msw/handlers/fileUpload.ts` — return valid `UploadFileResponseDTO` in `ApiResponse<T>` envelope, support error simulation (Constitution III)

**Checkpoint**: Foundation ready — user story implementation can now begin.

---

## Phase 3: User Story 1 — Attach files to a message and send them (Priority: P1) 🎯 MVP

**Goal**: A person attaches one or more files, optionally types text, sends, and the message is accepted with all files referenced.

**Independent Test**: Open a conversation, attach a file, add text, send, and confirm the message is accepted and appears in the conversation with the file on it.

### Tests for User Story 1

- [ ] T011 [P] [US1] Create `tests/composables/useFileUpload.test.ts` — test: attach single file triggers upload, `status` transitions pending→uploading→ready, `serverFileId` populated on success; attach without text allowed; send clears attachments; text-only send unchanged (FR-001/002/004/005/006/012)
- [ ] T012 [P] [US1] Create `tests/components/chat/MessageInput.file.test.ts` — test: attach button visible when `disableFileUpload=false`, hidden when `true`; clicking attach adds file to staged list; sending with files includes `files[]` in request body; sending text-only omits `files` field (FR-001/006/026/027)

### Implementation for User Story 1

- [x] T013 [US1] Create `useFileUpload` composable in `app/composables/useFileUpload.ts` — manage `StagedAttachment[]` reactive state; on attach: validate (size/type/count via `lib/validation/fileAttachment.ts`), add to list, start eager upload via `ChatService.uploadFile` with concurrency limiter (max 3); expose `attachFiles(files: FileList, agentId: number)`, `removeAttachment(id: string)`, `retryAttachment(id: string, agentId: number)`, `clearAttachments()`, `stagedAttachments` (readonly ref), `hasReadyFiles`, `hasPendingUploads`, `canSend` (FR-001/007/007a–h/008/009/010/010a)
- [x] T014 [US1] Extend `MessageInput.vue` in `app/components/chat/MessageInput.vue` — add `disableFileUpload` boolean prop; when false: render attach button, wire to file input (accept filter from constants), call `useFileUpload.attachFiles` on selection; pass `files[]` (ready serverFileIds) in the existing send-message flow via `useChatMutations`; block send if uploads pending (FR-001/002/005/022/027a)
- [x] T015 [US1] Extend `useChatMutations` composable to accept optional `files: string[]` and include it in `AiQuestionRequestDTO` body when sending — no change to mutation logic otherwise (plan.md layer: query/mutation composable)
- [x] T016 [US1] Wire `disableFileUpload=false` on authenticated page `app/pages/chats/[sessionId].vue` and `disableFileUpload=true` on public pages `app/pages/chats/public/new/[agentId].vue` and `app/pages/chats/public/[sessionId].vue` (FR-026/027/027a, R4)

**Checkpoint**: Attach + send works end-to-end. A file can be selected, uploaded eagerly, and referenced in a sent message. Text-only send is unchanged.

---

## Phase 4: User Story 2 — Review attachments and their readiness before sending (Priority: P1)

**Goal**: The person sees staged attachments with upload progress, can confirm images visually, and can remove individual attachments before sending.

**Independent Test**: Attach three files, watch each become ready, remove one, confirm only the remaining two are referenced by the sent message.

### Tests for User Story 2

- [ ] T017 [P] [US2] Create `tests/components/chat/FileAttachmentList.test.ts` — test: renders each staged attachment with filename; shows progress bar during upload; shows ready state; shows failed state with retry; image attachments show thumbnail preview; remove button removes from list; empty list renders nothing (FR-007a/011/012/017/017a/020/021)

### Implementation for User Story 2

- [x] T018 [US2] Create `FileAttachmentList.vue` component in `app/components/chat/FileAttachmentList.vue` — receives `StagedAttachment[]` as prop; for each: show filename, upload progress (pending/uploading/ready/failed states), remove button; for image types: show local preview via `URL.createObjectURL(file)` (FR-011/017/017a/020); for failed: show error message and retry button (FR-021)
- [x] T019 [US2] Integrate `FileAttachmentList` into `MessageInput.vue` — render above the text input when `stagedAttachments.length > 0`; wire remove to `useFileUpload.removeAttachment`, retry to `useFileUpload.retryAttachment` (FR-011)
- [x] T020 [US2] Add duplicate detection in `useFileUpload.attachFiles` — skip files where `file.name + file.size + file.lastModified` matches an already-staged attachment (data-model edge case)
- [x] T021 [US2] Implement validation rejection toasts in `useFileUpload` — when a file is rejected (size/type/count/total), show an i18n toast with the specific reason; rejected files are never added to the list (FR-008/009/010)

**Checkpoint**: Full pre-send review experience. The person sees what's staged, its readiness, can confirm images, remove mistakes, and gets clear feedback on rejections.

---

## Phase 5: User Story 3 — See files in received and sent messages (Priority: P1)

**Goal**: File-type messages in conversation history render with text, file entries (icon + name + download), and inline image previews.

**Independent Test**: Load a conversation whose history contains a file-type message and confirm the accompanying text and each file are shown, and that each file opens.

### Tests for User Story 3

- [ ] T022 [P] [US3] Create `tests/components/chat/FileMessage.test.ts` — test: renders accompanying text as markdown; renders file entries with filenames; image files show inline preview; non-image files show icon + filename; empty text renders no text block; malformed `messageText` renders fallback plain text; missing files array renders text only (FR-013/015/016/017/018/019)

### Implementation for User Story 3

- [x] T023 [P] [US3] Create `FileEntry.vue` component in `app/components/chat/FileEntry.vue` — receives `ReceivedFile` prop; render filename + file-type icon + download/open link; for image mimeTypes: render inline `<img>` preview with link to full-size URL; sanitize filename for display, validate URL protocol (FR-016/017/019)
- [x] T024 [US3] Create `FileMessage.vue` component in `app/components/chat/FileMessage.vue` — parse `messageText` with `FileMessagePayloadSchema`; on success: render `text` via existing text rendering (markdown), render `files` as `FileEntry` list; on Zod parse failure: render raw `messageText` as plain text fallback (FR-013/015/018, R7)
- [x] T025 [US3] Extend `ChatMessages.vue` in `app/components/chat/ChatMessages.vue` — route messages with `messageType === AIAnswerType.File` to the new `FileMessage` component; ensure unrecognized message types render a generic fallback, not a crash (FR-013/014)

**Checkpoint**: File messages display correctly in all conversation surfaces (authenticated and public). This phase has no dependency on the upload composable.

---

## Phase 6: User Story 4 — Recover from a failure without losing work (Priority: P2)

**Goal**: Per-file failure is visible and retryable without re-selecting other files; a failed message send preserves text and ready attachments.

**Independent Test**: Force one file's storage to fail while others succeed, confirm only that file is marked failed and can be retried on its own without re-selecting the others.

### Tests for User Story 4

- [ ] T026 [P] [US4] Extend `tests/composables/useFileUpload.test.ts` — test: one upload fails while others succeed → only failed file has error state; retry on failed file re-uploads only that file; file read error (e.g. 0-byte) surfaces per-file error; server rejection surfaces server message (FR-007/021/024/010b)
- [ ] T027 [P] [US4] Extend `tests/components/chat/MessageInput.file.test.ts` — test: send blocked when any file is not ready; after send failure, text and ready attachments retained; retry send does not re-upload already-ready files (FR-022/023/007d)

### Implementation for User Story 4

- [x] T028 [US4] Enhance `useFileUpload` error handling — on upload failure: set `status='failed'`, store `AppError` with server message when available (FR-010b/021/025); on file read error: surface per-file `AppError` (FR-024); on retry: only re-upload the failed file (FR-021)
- [x] T029 [US4] Block send in `MessageInput` when `hasPendingUploads` is true or any file is `'failed'` — show i18n message explaining what's outstanding (FR-022)
- [x] T030 [US4] Preserve composer state after failed send — `clearAttachments` only called on send success, not on failure; retained attachments keep their `serverFileId` so retry doesn't re-upload (FR-007d/012/023)

**Checkpoint**: Full error recovery for per-file failures and message-send failures. No data loss on retry.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Drag-and-drop, cross-cutting UX, and validation

- [ ] T031 [P] Implement drag-and-drop file attachment — add `dragenter`/`dragover`/`drop` listeners on the thread container (message list + composer area) in the chat page; show a visual drop zone overlay scoped to the thread area, not the sidebar; on drop, call `useFileUpload.attachFiles` (FR-001/001a, R9)
- [ ] T032 [P] Add `accept` attribute filter on the file input in `MessageInput.vue` using `ALLOWED_EXTENSIONS` from validation constants — pre-filter the OS file picker (FR-010)
- [ ] T033 Run `npm run typecheck` and fix any type errors introduced by the feature
- [ ] T034 Run `npm run lint:fix` and resolve any lint violations
- [ ] T035 Run `npm run test:run` and verify all new and existing tests pass with no regressions
- [ ] T036 Run quickstart.md validation scenarios VS-1 through VS-10 against the dev server

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **Foundational (Phase 2)**: Depends on Phase 1 (schemas/types must exist for the service method)
- **US1 (Phase 3)**: Depends on Phase 2 (needs `ChatService.uploadFile` and MSW handler)
- **US2 (Phase 4)**: Depends on Phase 3 (needs `useFileUpload` composable and `MessageInput` integration)
- **US3 (Phase 5)**: Depends on Phase 1 only (needs `AIAnswerType.File` and `FileMessagePayloadSchema`) — **can run in parallel with US1/US2**
- **US4 (Phase 6)**: Depends on Phase 3 and Phase 4 (extends the upload composable and `MessageInput`)
- **Polish (Phase 7)**: Depends on Phases 3–6 being complete

### User Story Dependencies

```
Phase 1 (Setup)
  ├──▶ Phase 2 (Foundational)
  │       ├──▶ Phase 3 (US1: Attach + Send)
  │       │       └──▶ Phase 4 (US2: Review + Remove)
  │       │               └──▶ Phase 6 (US4: Error Recovery)
  │       │                       └──▶ Phase 7 (Polish)
  └──▶ Phase 5 (US3: Display) ────────────────────┘
```

### Parallel Opportunities

**Within Phase 1**: All 8 tasks are [P] — run all in parallel (different files)

**Within Phase 2**: T009 and T010 are independent (service vs. test handler)

**US3 parallel with US1/US2**: Phase 5 (display) only needs Phase 1 schemas. It can be built and tested while upload infrastructure is being implemented.

**Within each user story**: Tasks marked [P] (tests, models) can run in parallel before sequential service/integration tasks.

### Parallel Example: Maximum Parallelism After Phase 1

```
After Phase 1 completes, launch simultaneously:

Stream A (Upload path):
  T009 → T010 → T011+T012 → T013 → T014 → T015 → T016

Stream B (Display path):
  T022+T023 → T024 → T025
```

---

## Implementation Strategy

### MVP First (User Story 1 + User Story 3)

1. Complete Phase 1: Setup (all types, schemas, constants, i18n)
2. Complete Phase 2: Foundational (service + MSW handler)
3. Complete Phase 3: User Story 1 (attach + send)
4. Complete Phase 5: User Story 3 (display received files)
5. **STOP and VALIDATE**: VS-1, VS-6, VS-9, VS-10 from quickstart.md
6. The core round trip (attach → send → display) works end-to-end

### Incremental Delivery

1. **MVP**: Setup + Foundational + US1 + US3 → files can be sent and displayed
2. **+US2**: Staged attachment review, progress, remove → safe pre-send experience
3. **+US4**: Error recovery and retry → production-grade resilience
4. **+Polish**: Drag-and-drop, type filter, full validation pass

### Parallel Team Strategy

With two developers:
- **Developer A**: Phase 1 → Phase 2 → Phase 3 (US1) → Phase 4 (US2) → Phase 6 (US4)
- **Developer B**: Phase 1 (shared) → Phase 5 (US3) → Phase 7 (Polish, after A finishes US4)
