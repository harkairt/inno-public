# Feature Specification: Chat File Attachments

**Feature Branch**: `feat/chat-file-attachments`

**Created**: 2026-08-04

**Status**: Draft

**Supersedes**: Contract v1 (single-request base64 array of `{fileName, contentBase64}` objects)
and contract v2 (two-step but JSON body with `contentBase64` and `agentName`). Both are dead.
This spec is written against contract v3 below — multipart upload, `agentId` as a number.

**Input**: Client request (Hungarian), translated summary of contract v3:

> The flow has two steps.
>
> 1. `POST /api/AIWebAPI/uploadFile` (authenticated, multipart/form-data):
>    - `agentId`: number
>    - `file`: binary (the file itself, as a multipart part)
>    → `{ "data": { "id": "<guid>", "mimeType": "image/png", "thumbnailUrl": "" } }`
>
> 2. `POST /api/AIWebAPI/question/text` (JSON, unchanged): the usual fields plus
>    `files: ["<guid>", "<guid>"]` — **strings, not objects**.
>
> One call = one file. For multiple attachments, call N times and collect the returned ids
> into the `files` array — this way each file has its own progress and error handling.
>
> `questionType` stays `Text` (0). A file-bearing message is distinguished by a non-empty
> `files` array, not by a different question type.
>
> **Upload details**:
> - `contentBase64` no longer exists — the file goes as a binary multipart part.
> - Do not send a separate filename — the server reads it from the multipart part's `filename`.
> - Do not send a MIME type — the server determines it from the filename **and the actual
>   content**, intentionally overriding the browser's `Content-Type`. Tested: a PNG lying as
>   `application/octet-stream` still comes back as `image/png`. The response `mimeType` field
>   is always the server's decision.
> - `thumbnailUrl` is always `""` for now. Thumbnails already exist for images (max 256 px,
>   JPEG) and are stored — only the serving endpoint is missing. Do not build on it, but expect
>   it to be populated later.
>
> **Axios trap** (implementation note, not a contract detail): The shared API client sets a
> global `Content-Type: application/json` header. Axios 1.13, seeing a JSON content type with
> FormData, silently serializes the FormData to JSON (`hasJSONContentType && isFormData →
> JSON.stringify(formDataToJSON(data))`). The file content is lost and the server returns an
> opaque error. The upload call MUST override the header to `undefined` so axios uses the
> browser's auto-generated multipart boundary. This is recorded here as a known hazard rather
> than a requirement.
>
> The returned message is unchanged: `messageType` is `"file"` (numerically 16) and
> `messageText` is a JSON string:
> `{ "text": "itt a szerződés", "files": [{ "id": "...", "fileName": "szerzodes.pdf", "mimeType": "application/pdf", "url": "https://.../api/storage/..." }] }`
>
> The `url` is absolute and requires no token.

## Clarifications

### Session 2026-08-05

- Q: How should multiple file uploads be executed — sequentially or concurrently? → A: Concurrent with a limit (e.g. 3 at a time).
- Q: Should drag-and-drop be supported as a file attachment method? → A: Yes, drag-and-drop onto the composer area.
- Q: Should the composer show a visual drop zone indicator when dragging files? → A: Yes, covering the entire thread area (message list + composer), but not the sidebar or other chrome.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Attach files to a message and send them (Priority: P1)

A person in a chat conversation wants the assistant to look at a document they have on their
device. They pick one or more files, optionally type an accompanying message explaining what the
files are, and send. From their point of view this is one action, even though the system stores
each file before the message goes out.

**Why this priority**: This is the entire point of the feature. Without sending, there is nothing
to display.

**Independent Test**: Open a conversation, attach a file, add text, send, and confirm the message
is accepted and appears in the conversation with the file on it.

**Acceptance Scenarios**:

1. **Given** an open conversation, **When** the person attaches one file, types accompanying text,
   and sends, **Then** the file is stored, the message is submitted referencing it, and the
   conversation shows the sent message with the file.
2. **Given** an open conversation, **When** the person attaches a file and sends **without** typing
   any text, **Then** the send is allowed and the message is submitted with empty text.
3. **Given** an open conversation, **When** the person attaches several files and sends, **Then**
   all of them are stored and all are referenced by that single message, in the order shown.
4. **Given** an open conversation with no attachments, **When** the person types text and sends,
   **Then** the message is submitted exactly as it is today, with no additional steps and no change
   in behavior.
5. **Given** only whitespace text and no attachments, **When** the person tries to send, **Then**
   sending remains blocked, as it is today.

---

### User Story 2 - Review attachments and their readiness before sending (Priority: P1)

Before committing to a send, the person needs to see what they have attached, confirm it is the
right file, watch it become ready, and remove anything attached by mistake.

**Why this priority**: Sending the wrong document to a conversation is not undoable — the file
leaves the device and becomes retrievable by anyone holding its link. A pre-send review step is
what makes attaching safe, so it ships with P1. The two-step contract also means "attached" and
"ready to send" are now different states the person can observe.

**Independent Test**: Attach three files, watch each become ready, remove one, confirm only the
remaining two are referenced by the sent message.

**Acceptance Scenarios**:

1. **Given** a file has been attached but not sent, **When** the person looks at the composer,
   **Then** it is listed with its filename and a way to remove it.
2. **Given** an image has been attached but not sent, **When** the person looks at the composer,
   **Then** a visual preview of that image is shown alongside its filename, so the right file can
   be confirmed before an irreversible send.
3. **Given** a file is attached, **When** the person continues typing their accompanying text,
   **Then** the file is already being stored in the background, and its progress toward being ready
   is visible and distinguishable from a file that is ready and from one that failed.
3a. **Given** an attached file has finished storing, **When** the person then switches the target
   agent and sends, **Then** the file is not stored a second time and the message still references
   it.
4. **Given** two attached files, **When** the person removes one, **Then** only the remaining file
   is referenced by the sent message.
5. **Given** all attachments have been removed and the text is empty, **When** the person tries to
   send, **Then** sending is blocked.
6. **Given** a message with attachments was sent successfully, **When** the send completes, **Then**
   the composer is cleared of both text and attachments.
7. **Given** a file is rejected because it exceeds the allowed size, is of a disallowed type, or
   would exceed the per-message file count, **When** the person attaches it, **Then** it is not
   added to the message and the person is told, in their language, which rule it violated.

---

### User Story 3 - See files in received and sent messages (Priority: P1)

Once a message carrying files is part of the conversation, everyone in it needs to recognize it as
carrying files, read any accompanying text, and open or download each file.

**Why this priority**: A file that cannot be retrieved afterwards has no value. This is the
receiving half of the same round trip.

**Independent Test**: Load a conversation whose history contains a file-type message and confirm the
accompanying text and each file are shown, and that each file opens.

**Acceptance Scenarios**:

1. **Given** a conversation containing a file-type message, **When** it is displayed, **Then** the
   accompanying text is rendered the same way ordinary message text is rendered, and each file is
   listed with its filename.
2. **Given** a displayed file entry, **When** the person activates it, **Then** the file opens or
   downloads from the location supplied with the message.
3. **Given** a file-type message whose accompanying text is empty, **When** it is displayed, **Then**
   the files are shown without an empty text block.
4. **Given** an image file in a file-type message, **When** it is displayed, **Then** a visual
   preview of the image is shown inline in addition to being openable at full size.
5. **Given** a non-image file in a file-type message, **When** it is displayed, **Then** it is shown
   as a named, openable entry with an indication of its kind, without a preview.
6. **Given** a public/embedded conversation, **When** it contains a file message, **Then** the files
   are displayed and openable there too, even though attaching is disabled in that mode.

---

### User Story 4 - Recover from a failure without losing work (Priority: P2)

Storing files is slower and more failure-prone than sending text, and there are now two distinct
places it can fail: storing an individual file, and sending the message that references them. The
person needs to know which one failed and be able to recover without starting over.

**Why this priority**: The core round trip works without it, but with per-file storage the failure
surface is genuinely larger than for text, and losing a large upload to an unexplained error is the
most likely real-world frustration.

**Independent Test**: Force one file's storage to fail while others succeed, confirm only that file
is marked failed and can be retried on its own without re-selecting the others.

**Acceptance Scenarios**:

1. **Given** several files are being stored, **When** one fails, **Then** only that file is marked
   failed, the others keep their ready state, and the person is told which file failed and why.
2. **Given** a file failed to store, **When** the person retries it, **Then** only that file is
   retried; the others are not re-sent.
3. **Given** at least one attachment is not ready, **When** the person tries to send, **Then**
   sending is blocked or clearly deferred, and the person is told what is still outstanding — a
   message is never sent silently omitting an attachment the person believes is included.
4. **Given** all attachments are ready, **When** the message send itself fails, **Then** the person
   is told the send failed, and both the text and the already-ready attachments are retained so a
   retry does not re-store the files.
5. **Given** a file cannot be read from the device, **When** the person attaches it, **Then** they
   are told that file could not be read, and the rest of the message is unaffected.
6. **Given** a file was accepted by the composer's own checks but rejected by the server, **When**
   the rejection comes back, **Then** the server's reason is surfaced to the person rather than a
   generic failure.

---

### Edge Cases

- **Abandoned attachments**: A file is stored, then the person removes it or navigates away without
  sending. The file remains on the server referenced by nothing. This is accepted for this release
  (FR-007g); the person sees the attachment disappear from their message, which is all they need.
- **Target agent changes mid-compose**: A file is stored while one agent is the target, then the
  person switches the target agent before sending. The file is not re-stored (FR-007f). This assumes
  the recorded agent identifier does not restrict which message may reference the file — see the
  relayed question below.
- **No agent identifier available**: No virtual agent is selected, so there is no selected agent
  identifier to record. The conversation's own agent identifier is used instead (FR-007f).
- **Send arrives before storage finishes**: The person attaches a large file and immediately presses
  send. Storage is still in flight, so the send must wait or be refused with an explanation, never
  proceed without the file (FR-022).
- **Lying extension**: A file named `.txt` that is actually an image. The server decides from
  content, so what the composer displays as a text file may come back as an image. The client's own
  type check cannot be treated as authoritative.
- **Send succeeds, one reference is stale**: A message references a stored file the server no longer
  recognizes.
- A person attaches the same file twice — the message must not silently carry it twice.
- A file has no extension at all.
- A zero-byte file is attached.
- A filename contains characters unsafe to render as-is — filenames arriving from a remote message
  are untrusted display content.
- A file-type message arrives whose text payload is malformed, missing its file list, or has entries
  without a location — the message must still render something meaningful.
- The conversation contains a message type this client does not recognize — this must never prevent
  the rest of the conversation from loading.
- A file's location is no longer reachable when activated — this must fail visibly, not silently.
- A large attachment set on a slow or mobile connection.

## Requirements *(mandatory)*

### Composing and attaching

- **FR-001**: People MUST be able to attach one or more files from their device to a message before
  sending it, using a pointer/keyboard interaction (file picker), drag-and-drop onto the thread
  area, and a touchscreen interaction.
- **FR-001a**: When a file is being dragged over the thread area (message list and composer), the
  system MUST show a visual drop zone indicator scoped to that area. The indicator MUST NOT extend
  to the sidebar or other chrome. Dropping anywhere within the thread area MUST attach the file(s)
  to the current message.
- **FR-002**: Attaching and sending MUST be presented as one continuous action from the person's
  point of view, even though the system stores each file before submitting the message.
- **FR-003**: The system MUST submit each file as a binary multipart part whose `filename` carries
  the original name, and MUST NOT submit a declared MIME type — the server determines the type from
  the filename and the file's actual content, with content taking precedence.
- **FR-004**: The system MUST allow sending a message that has at least one attachment and empty
  accompanying text.
- **FR-005**: The system MUST continue to block sending when there is neither text nor any
  attachment.
- **FR-006**: The system MUST leave the behavior of messages without attachments unchanged,
  including existing draft-text, typing-indicator, and retry behavior, and MUST NOT introduce an
  extra step for them.

### Storage lifecycle

- **FR-007**: Each attached file MUST be stored independently of the others, so that one file's
  outcome never determines another's.
- **FR-007a**: Each attached file MUST carry an observable readiness state — at minimum: being
  stored, ready, and failed — and the composer MUST reflect it.
- **FR-007b**: The system MUST retain the reference the server returns for each stored file and MUST
  submit those references with the message, in the order the person arranged them.
- **FR-007c**: The system MUST NOT depend on the thumbnail location returned alongside a stored
  file's reference; it is currently always empty. The system MUST tolerate it becoming populated
  later without breaking.
- **FR-007d**: The system MUST NOT re-store a file that is already stored when a failed message send
  is retried.
- **FR-007e**: The system MUST begin storing a file as soon as the person attaches it, not when they
  send, so that transfer overlaps with the time the person spends typing.
- **FR-007f**: The system MUST record, with each stored file, the identifier of the agent the
  message is targeted at when the file is attached. Where no virtual agent is selected, it MUST use
  the conversation's own agent identifier. The system MUST NOT re-store an already-stored file when
  the target agent changes before sending.
- **FR-007g**: The system MUST NOT attempt to withdraw or clean up a stored file that ends up
  referenced by no message. Removing a staged attachment after it has been stored MUST remove it
  from the message only.
- **FR-007h**: When multiple files are attached, the system MUST upload them concurrently up to a
  bounded limit per message, not sequentially. Excess files MUST queue and start as earlier uploads
  finish. The limit MUST be defined alongside the other attachment limits (FR-010a).

### Pre-send validation and review

- **FR-008**: The system MUST reject an attachment larger than **10 MB**, and MUST tell the person
  which file was rejected and why.
- **FR-009**: The system MUST reject an attachment set exceeding **10 files** or **20 MB in total**
  per message, and MUST explain which limit was hit.
- **FR-010**: The system MUST reject attachments outside the permitted type list — images (JPEG,
  PNG, GIF, WebP, HEIC), documents (PDF, DOC/DOCX, XLS/XLSX, PPT/PPTX), and plain text (TXT, CSV,
  MD) — and MUST tell the person which types are accepted.
- **FR-010a**: The limits in FR-008/FR-009 and the type list in FR-010 MUST be defined in one place
  and MUST NOT be duplicated per conversation surface, so a limit change is a single-value edit.
- **FR-010b**: The system MUST treat its own type check as a convenience for the person, not as an
  enforcement boundary, and MUST surface the server's decision when the two disagree.
- **FR-011**: The system MUST show every staged attachment with its filename and MUST allow each one
  to be removed individually before sending.
- **FR-012**: The system MUST clear staged attachments after a successful send, and MUST retain them
  after a failed send so the person can retry without re-selecting.

### Receiving and displaying

- **FR-013**: The system MUST recognize the file message type in received conversation history and
  in real-time message delivery.
- **FR-014**: The system MUST NOT fail to load or render a conversation because it contains a
  message type it does not recognize; an unrecognized type MUST degrade to a readable fallback for
  that one message only.
- **FR-015**: The system MUST render the accompanying text of a file message using the same text
  rendering rules as ordinary messages.
- **FR-016**: The system MUST list every file in a received file message with its filename and MUST
  let the person open or download each one from the location supplied with the message.
- **FR-017**: The system MUST show an inline preview for files whose kind is an image, and MUST show
  a non-preview named entry for every other kind. This applies both to files in received messages
  and to files staged in the composer before sending.
- **FR-017a**: Previews of staged, not-yet-sent files MUST be produced from the file on the person's
  own device, and MUST NOT wait on or depend on anything the server returns.
- **FR-018**: The system MUST render a file message whose payload is malformed or incomplete as a
  readable fallback rather than an empty or broken message.
- **FR-019**: The system MUST treat filenames and file locations arriving from the server as
  untrusted content and MUST neutralize them before display or activation.

### Feedback and failure

- **FR-020**: The system MUST show per-file progress while a file is being stored, and MUST prevent
  the same message from being submitted twice while a send is in flight.
- **FR-021**: The system MUST report a per-file storage failure against that file specifically,
  MUST leave other files unaffected, and MUST offer a retry limited to the failed file.
- **FR-022**: The system MUST NOT send a message that silently omits an attachment the person
  believes is included; if any attachment is not ready, the person MUST be told before or instead
  of the send proceeding.
- **FR-023**: The system MUST report a failed message send distinctly from a failed file storage,
  and MUST offer a retry that preserves the text and the already-stored attachments.
- **FR-024**: The system MUST report, per file, when a file could not be read from the device,
  without discarding the rest of the message.
- **FR-025**: All text this feature shows to people MUST be available in both Hungarian and English.

### Scope of availability

- **FR-026**: File attachment MUST be available in authenticated conversations.
- **FR-027**: File attachment MUST NOT be available in public/embedded conversations in this
  release. The composer in that mode MUST NOT offer any way to attach a file.
- **FR-027a**: The public/embedded restriction MUST be expressed as a single switch on the composer,
  not as a mode check repeated across conversation surfaces, so enabling public uploads later is a
  one-value change rather than a re-implementation.
- **FR-028**: Displaying received file messages MUST work in both authenticated and public/embedded
  conversations, regardless of whether attaching is enabled there.

## Key Entities

- **Staged Attachment**: A file the person has selected but not yet sent. Lives on the device until
  the message is sent or abandoned. Attributes: filename, size, kind derived from the filename,
  readable content, a validity state (accepted / rejected with a reason), a readiness state (being
  stored / ready / failed), and — once stored — its server reference. Not persisted across
  navigation.
- **Stored File Reference**: What the server hands back after accepting a file: an identifier that a
  message can point at, the server-determined MIME type of the file, and a thumbnail location that
  is currently always empty and must not be relied on. The identifier, not the file's content, is
  what travels with the message. The MIME type may differ from the browser's guess.
- **Received File Message**: A message whose kind is "file". Holds accompanying text (possibly
  empty) and an ordered list of Received Files.
- **Received File**: One file inside a Received File Message. Attributes: an identifier, a filename,
  a server-determined kind, and a directly usable retrieval location. That location is
  unauthenticated — anyone holding it can retrieve the file.

## Success Criteria

### Measurable Outcomes

- **SC-001**: A person can go from "I want to share this document" to a sent message carrying it in
  under 20 seconds, in no more than three interactions (attach, optionally type, send).
- **SC-002**: 100% of attachments that violate a size, count, or type rule are refused before the
  person sends, with a reason stated in their language.
- **SC-003**: When one file among several fails to store, 100% of the others still reach the sent
  message, and the failed one can be retried without re-selecting any file.
- **SC-004**: Zero messages are ever sent carrying fewer files than the person saw staged, without
  the person being told first.
- **SC-005**: Every file in a received file message can be opened by the recipient on the first
  attempt, on both desktop and mobile.
- **SC-006**: A conversation containing a file message loads and displays completely, with no
  message missing and no error state, in 100% of cases — including when a file payload is malformed.
- **SC-007**: After a failed message send with attachments already stored, retrying re-transfers
  zero file content.
- **SC-008**: Sending a message with no attachments takes the same number of interactions and the
  same time as it does today.
- **SC-009**: The feature introduces zero conversations that fail to load due to an unrecognized
  message type.
- **SC-010**: For a file that finished storing before the person pressed send, pressing send costs
  no additional file-transfer wait — the message goes out as quickly as a text-only message.

## Assumptions

- **Contract v3 is authoritative**: Contracts v1 (inline base64 array) and v2 (two-step JSON with
  base64) are both dead. Nothing in this spec should be read against either.
- **Per-file multipart resolves all earlier size concerns**: Each file travels as a binary multipart
  part in its own request — no base64 inflation at all. A 10 MB file produces a ~10 MB request.
  The 20 MB per-message total in FR-009 is therefore a product decision, not a wire constraint.
- **The server is the authority on file type**: The client sends no type; the server derives it from
  filename and content, with content winning. The client's type list is a convenience that catches
  obvious mistakes early, and is not a security boundary — see FR-010b.
- **Two different locations, not one**: The `thumbnailUrl` returned when a file is stored is a
  future thumbnail address (currently always empty). The `url` on a received message's file is the
  full file's retrieval location. They are unrelated and must not be conflated.
- **Thumbnails are a later concern**: Server-side thumbnails already exist for images but have no
  serving endpoint. This release generates its own previews locally (FR-017a) and does not attempt
  to consume server thumbnails. When the endpoint arrives, adopting it should not require reworking
  the display path.
- **File locations are unauthenticated by design**: Retrieval links need no token and rely on the
  unguessability of an identifier. The client does not attach credentials to them and does not treat
  them as private. This is the backend's stated model; this feature neither strengthens nor works
  around it.
- **Storage is authenticated**: Storing a file requires an authenticated caller, which is consistent
  with restricting attachment to authenticated conversations (FR-027).
- **No attachment drafts**: Unlike draft text, staged attachments are not persisted across
  navigation or reload.
- **No editing after send**: Removing, replacing, or re-sending an already-sent attachment is out of
  scope.
- **No client-side transformation**: Compression, resizing, format conversion, and virus scanning on
  the device are out of scope; files are sent as selected.
- **Existing send path is reused**: The message submission itself extends the existing single
  send path used by every conversation surface, so retry, optimistic display, and real-time echo
  behave as they do for text messages.

## Resolved Decisions

- **Limits** (2026-08-04): 10 MB per file, 10 files per message, 20 MB total, with an allowlist
  covering images, common office documents, and plain text. Encoded in FR-008/FR-009/FR-010.
- **Public/embedded mode** (2026-08-04): Attaching is restricted to authenticated conversations for
  this release; display works everywhere. Implemented as a single composer-level switch (FR-027a).
- **Image previews** (2026-08-04): Images preview inline both in received messages and in the
  composer before sending; non-images render as named, openable entries. Encoded in FR-017.
- **Transport** (2026-08-05, updated to contract v3): Two-phase upload, now multipart/form-data
  instead of JSON+base64. Per-file binary requests eliminate base64 inflation entirely. The
  `agentId` field is a number (was `agentName` string in v2). No further backend decision needed.
- **Storage timing** (2026-08-04): Files are stored eagerly, the moment they are attached, so
  transfer overlaps with typing and the send itself stays fast. The agent identifier recorded is the
  one targeted at attach time; changing the target agent afterwards does not re-store the file.
  Encoded in FR-007e/FR-007f.
- **Unreferenced files** (2026-08-04): Accepted for this release. The client makes no attempt to
  withdraw or clean up a stored file that no message ends up referencing. Encoded in FR-007g. See
  the revisit trigger below.

## Relayed to the Backend Author (non-blocking)

Neither of these blocks planning or implementation. Both are things the backend author should
confirm or watch, because the chosen behavior assumes a particular answer.

- **Does the recorded agent identifier restrict which message may reference a stored file?** FR-007f
  assumes it does not — that the identifier is informational, so a file stored while agent A was
  targeted can still be referenced by a message sent to agent B. If that assumption is wrong, the
  fix is contained: re-store on target change, at the cost of a redundant transfer per agent toggle.
- **Unreferenced files will accumulate.** This is the accepted cost of the two-phase design, chosen
  deliberately over building cleanup now. At a 10 MB per-file cap the growth rate is bounded, but it
  is unbounded over time. The natural revisit trigger is storage growth becoming visible in
  operations; the cheapest fix at that point is a server-side expiry for files that no message
  references within a fixed window, which needs no client change at all.
