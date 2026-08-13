# Quickstart Validation Guide: Chat File Attachments

**Date**: 2026-08-05 | **Spec**: [spec.md](spec.md) | **Plan**: [plan.md](plan.md)

## Prerequisites

- Node 20+, `npm install` run
- Backend running at `:8082` (or proxied via `npm run dev`)
- An authenticated user session
- Test files: one small PNG (<1 MB), one PDF (<5 MB), one `.exe` (for rejection test)

## Validation Scenarios

### VS-1: Single file attach and send (US-1, FR-001/002/003)

1. `npm run dev` — open an authenticated conversation
2. Click the attach button in the composer
3. Select the test PNG from the file picker
4. Verify: PNG appears in the staged attachment list with a thumbnail preview
5. Type "here's the image" in the composer
6. Click send
7. **Expected**: message appears in the thread with the text and the image inline

### VS-2: Drag-and-drop attach (FR-001/001a)

1. Open an authenticated conversation
2. Drag the test PDF from the OS file manager over the thread area
3. Verify: a drop zone overlay appears covering the message list and composer
4. Drop the file
5. Verify: PDF appears in the staged attachment list (icon + filename, no preview)
6. Send the message
7. **Expected**: message appears with the PDF as a downloadable entry

### VS-3: Multi-file with concurrent upload (FR-007/007e/007h)

1. Attach 5 files at once (via file picker multi-select)
2. Verify: all 5 appear in the staged list
3. Verify: up to 3 show upload progress simultaneously; remaining queue
4. Wait for all to reach "ready" state
5. Send
6. **Expected**: all 5 files referenced in the sent message

### VS-4: Validation rejection (FR-008/009/010)

1. Try attaching the `.exe` file → **Expected**: rejected with type error message (in current locale)
2. Try attaching a file >10 MB → **Expected**: rejected with size error message
3. Attach 10 small files, then try attaching an 11th → **Expected**: rejected with count error
4. Verify: rejected files are never added to the staged list

### VS-5: Upload failure and retry (US-4, FR-021)

1. Attach a file
2. Simulate a server error (disconnect backend or use MSW in dev mode)
3. Verify: the file shows "failed" state with an error message
4. Verify: a retry action is available on the failed file
5. Restore the backend, retry
6. **Expected**: file re-uploads and reaches "ready" state

### VS-6: Received file message rendering (US-3, FR-013/015/016/017)

1. Load a conversation that contains a file-type message (messageType=16) in its history
2. Verify: accompanying text renders as markdown
3. Verify: image files show inline preview
4. Verify: non-image files show icon + filename
5. Click a file entry → **Expected**: file opens/downloads from the server URL

### VS-7: Public mode — attach disabled, display works (FR-027/028)

1. Access a public/embedded conversation URL (`/chats/public/new/{agentId}`)
2. Verify: no attach button or drop zone in the composer
3. If the conversation history contains a file message:
4. Verify: the file message renders and files are openable

### VS-8: Malformed file message fallback (FR-018)

1. Use the dev gallery or a mock to inject a message with `messageType=16` and invalid
   `messageText` (e.g. `"not json"`)
2. **Expected**: the message renders as plain text, not as an error or blank bubble

### VS-9: Empty text with attachment only (FR-004)

1. Attach a file, leave the text input empty
2. Send
3. **Expected**: send succeeds; message shows only the file, no empty text block

### VS-10: No regression — text-only send (FR-006, SC-008)

1. Type a message with no attachments
2. Send
3. **Expected**: behavior is identical to pre-feature behavior (no extra steps, same speed)

## Automated Test Commands

```bash
# Run all file-attachment tests
npx vitest run tests/composables/useFileUpload.test.ts \
  tests/components/chat/FileAttachmentList.test.ts \
  tests/components/chat/FileMessage.test.ts \
  tests/components/chat/MessageInput.file.test.ts

# Run full test suite (verify no regressions)
npm run test:run

# Typecheck
npm run typecheck

# Lint
npm run lint
```
