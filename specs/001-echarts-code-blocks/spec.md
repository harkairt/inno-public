# Feature Specification: ECharts Code Blocks

**Feature Branch**: `001-echarts-code-blocks`

**Created**: 2026-08-04

**Status**: Draft

**Input**: User description: "lets add support for https://echarts.apache.org/en/index.html — it should work similarly how ```chart.js blocks work, support should be added for a new ```echarts block (and keep chart.js for backward compatibility)"

## Clarifications

### Session 2026-08-04

- Q: When a chart's definition changes after the chart has already been drawn, what should happen? → A: Update the existing chart in place — no re-initialization, no re-run of entry animations (Option B).
- Q: Do assistant replies arrive incrementally (token-by-token) or as one complete message? → A: One complete message; there is no response streaming.
- Q: When a text value in a chart definition contains markup, reject the definition or render it inertly? → A: Render inertly — configure the engine so chart-drawn text can never become markup, so no scanning or rejection is needed and ordinary labels containing `<` are unaffected (Option B). External references (FR-016) and navigation targets (FR-017) still reject, having no inert equivalent.
- Q: Should rejected and failed chart definitions be logged for diagnosis, and how much? → A: Log every rejection and draw failure with its reason and the block's position, but never the definition body — assistant-generated content may contain customer data, and public/embedded mode runs on third-party sites (Option B).

### Session 2026-08-04 (chart interaction)

Added after the initial draft, superseding the assumption that chart interaction
drives nothing outside the chart.

- Q: Where should the text that a chart click puts in the message composer come from? → A: From the definition, attached to individual data items by the assistant — per-item, so only the items the agent marked are actionable (Option A).
- Q: What should a click do to the composer? → A: Append to whatever the user has already typed and focus the composer. Never replace, never clear, never send (Option A).
- Q: How does a user know which parts of a chart are actionable? → A: A localized hint beneath the chart, shown only when the definition contains at least one actionable item (Option A).
- Q: Does this apply to `chart.js` blocks too? → A: No. `echarts` only — FR-002 and FR-020 require the `chart.js` path to stay behaviourally unchanged.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Assistant renders a chart from an `echarts` block (Priority: P1)

A user asks the assistant a question whose answer is best shown visually ("show me last quarter's revenue by region"). The assistant replies with a fenced code block tagged `echarts` containing a chart definition. Instead of seeing raw JSON, the user sees a finished, readable chart inline in the message — sized to the message width, styled to match the current light or dark theme, and legible on both a desktop screen and a phone.

**Why this priority**: This is the entire feature. Without it nothing else has value, and it alone is a complete, shippable improvement.

**Independent Test**: Send a message containing a single `echarts` block with a valid bar-chart definition and confirm a rendered chart appears in place of the code block, in both light and dark theme, on desktop and mobile viewport widths.

**Acceptance Scenarios**:

1. **Given** an assistant message containing one fenced `echarts` block with a valid chart definition, **When** the message is displayed, **Then** a rendered chart appears in the position the code block occupied and the raw definition text is not shown.
2. **Given** a rendered `echarts` chart, **When** the user switches the application between light and dark theme, **Then** the chart's text, axes, and gridlines remain legible against the new background.
3. **Given** a rendered `echarts` chart, **When** the browser window or containing panel is resized, **Then** the chart redraws to fit the new width without clipping or overflowing the message bubble.
4. **Given** an assistant message containing several `echarts` blocks, **When** the message is displayed, **Then** each block renders as its own independent chart.
5. **Given** a chart that has already been drawn, **When** the message it belongs to is re-rendered without its definition changing, **Then** the chart is left alone — it is not re-created and its entry animation does not run again.
6. **Given** a chart that has already been drawn, **When** its definition changes, **Then** the existing chart updates in place to reflect the new definition rather than being torn down and rebuilt.

---

### User Story 2 - Existing `chart.js` blocks keep working unchanged (Priority: P1)

A user opens an older conversation, or receives a reply from an agent still configured to emit `chart.js` blocks. Those charts render exactly as they did before this feature shipped — same appearance, same behaviour, no regression and no migration required of the user or of agent configuration.

**Why this priority**: Equal to P1 because "add without breaking" is an explicit constraint of the request. Historical conversations are persisted server-side and cannot be rewritten.

**Independent Test**: Replay a stored conversation containing `chart.js` blocks before and after the change and confirm the rendered output is unchanged.

**Acceptance Scenarios**:

1. **Given** a message containing a fenced `chart.js` block, **When** the message is displayed after this feature ships, **Then** the chart renders with the same appearance and behaviour as before.
2. **Given** a single message containing both a `chart.js` block and an `echarts` block, **When** the message is displayed, **Then** both charts render correctly and independently.

---

### User Story 3 - Malformed or unsupported chart definitions fail safely (Priority: P2)

An assistant emits an `echarts` block whose content is not valid — truncated JSON, a missing required field, an unreasonably large payload, a chart kind the engine cannot draw, or a definition carrying something unsafe. The user is not shown a blank space, a crash, or a broken message: the block degrades to readable text or a clear error, and the rest of the message renders normally.

**Why this priority**: Assistant output is generated text and will sometimes be malformed. Because chart definitions are passed through rather than enumerated, this degradation path is also the feature's safety boundary — it carries more weight here than it would under a restrictive allowlist.

**Independent Test**: Send messages containing (a) invalid JSON, (b) a definition missing required fields, (c) an oversized payload, (d) an undrawable chart kind, and (e) each class of unsafe value, and confirm every one degrades visibly without breaking the surrounding message. Separately confirm that markup-shaped text does *not* degrade — it renders inertly.

**Acceptance Scenarios**:

1. **Given** an `echarts` block containing content that cannot be parsed as a chart definition, **When** the message is displayed, **Then** the block is shown as a plain code block and all other content in the message renders normally.
2. **Given** an `echarts` block whose definition exceeds the maximum accepted payload size, **When** the message is displayed, **Then** the block is shown as a plain code block rather than being rendered.
3. **Given** a chart definition that parses but fails during drawing — including one requesting a chart kind the engine cannot draw — **When** the message is displayed, **Then** the user sees a localized error message in place of the chart and the rest of the message is unaffected.
4. **Given** an `echarts` block whose definition carries markup in a text-bearing value, **When** the message is displayed, **Then** the chart still renders, that value appears as visible inert text, and no injected markup or script executes — including in hover detail, labels, and titles the chart draws itself.
5. **Given** a definition with an ordinary label containing a comparison character, such as `Revenue < 100k`, **When** the message is displayed, **Then** the chart renders and the label reads exactly as written.
6. **Given** an `echarts` block whose definition references an externally-hosted image, icon, or geography file, **When** the message is displayed, **Then** the definition is rejected and no request to a third-party origin is made.
7. **Given** an `echarts` block whose definition would turn chart text into a hyperlink, **When** the message is displayed and the user activates that text, **Then** no navigation occurs.
8. **Given** any rejected definition or draw failure, **When** it occurs, **Then** a diagnostic record identifies the reason and the originating block, and contains no part of the definition itself.

---

### User Story 4 - Charts work in embedded/public mode (Priority: P3)

A visitor uses the product through a public embedded widget on a third-party site (no user account). Charts in assistant replies render there identically to the signed-in application.

**Why this priority**: Required by the project's dual-mode rule, but it is a verification concern layered on top of P1 rather than separate functionality.

**Independent Test**: Open a public/embedded conversation, trigger a reply containing an `echarts` block, and confirm the chart renders.

**Acceptance Scenarios**:

1. **Given** a public/embedded conversation, **When** an assistant reply contains an `echarts` block, **Then** the chart renders with the same appearance as in the signed-in application.

---

### User Story 5 - Clicking a data point offers a follow-up question (Priority: P2)

A user looking at a revenue-by-region pie chart wants to dig into one slice. They
click it, and a follow-up question the assistant prepared for that slice appears
in the message composer, ready to read, edit, and send. The user stays in control:
nothing is sent on their behalf, and nothing they had already typed is lost.

**Why this priority**: It converts a chart from a static answer into the start of
the next question, which is the whole reason charts appear in a conversation.
It is P2 rather than P1 because charts are useful without it — User Story 1 ships
and is valuable on its own — and because it depends on the render path existing.

**Independent Test**: Send a message with a pie-chart definition in which one data
item carries a follow-up question and another does not. Click each and confirm
the first fills the composer while the second does nothing, and that no message is
sent in either case.

**Acceptance Scenarios**:

1. **Given** a rendered chart whose clicked data item carries a follow-up question, **When** the user clicks that item, **Then** the question text is appended to the message composer, the composer receives focus, and no message is sent.
2. **Given** a composer already containing text the user typed, **When** the user clicks an actionable data item, **Then** the question is appended after the existing text and nothing the user typed is removed.
3. **Given** a rendered chart with at least one actionable data item, **When** the message is displayed, **Then** a localized hint indicates that data points can be selected to ask about them.
4. **Given** a rendered chart in which no data item carries a follow-up question, **When** the message is displayed, **Then** no hint is shown, and clicking any data point leaves the composer untouched.
5. **Given** a rendered chart with an actionable data item, **When** the user clicks that item twice, **Then** the question is appended twice — the second click is not swallowed.
6. **Given** a chart whose message has re-rendered several times, **When** the user clicks an actionable data item once, **Then** the question is appended exactly once.
7. **Given** a chart with a legend, **When** the user clicks a legend entry, **Then** the series toggles as the chart normally would and the composer is not touched.
8. **Given** a definition in which a data item's follow-up question is not a string, or is longer than the maximum accepted length, **When** the message is displayed, **Then** the whole definition is rejected per FR-006 and the rejection is logged.
9. **Given** the user clicked an actionable data item and then reloaded without sending, **When** the conversation is reopened, **Then** the composer shows whatever the ordinary draft behaviour would show for text the user had typed, and no *further* insertion happens on its own — the click is not replayed.

---

### Edge Cases

- **Empty block**: an `echarts` block with no content, or only whitespace, degrades to a plain code block.
- **Unterminated block**: a block that is never closed — because the reply was truncated — must not be treated as a chart and must degrade to text.
- **Very large data series**: a definition large enough to threaten responsiveness on a low-power mobile device is bounded by the payload size limit rather than by counting data points.
- **Unknown chart kind**: a misspelled or engine-unsupported chart kind reaches the engine (there is no allowlist to catch it) and must surface as a localized error, never a blank space or an uncaught failure.
- **External reference in an unusual position**: an external reference or navigation target nested deep inside presentation options — not just in obvious title or icon fields — must still reject the definition.
- **Markup-shaped label**: a label, series name, or title containing `<`, `>`, or a full markup fragment must render as literal visible text and must never reject the chart.
- **Repeated re-render**: a message re-renders several times for reasons unrelated to its charts — syntax highlighting finishing loading, the charting capability finishing loading, a theme change, a cache update. None of these may accumulate charts, and none may re-create a chart whose definition has not changed.
- **Message removal**: navigating away from or unmounting a conversation must release every chart's resources.
- **Interleaving**: a message mixing `echarts`, `chart.js`, `rows`/`h-rows`, `pivot`, math, and ordinary syntax-highlighted code blocks renders every block type correctly.
- **Externally-referenced resources**: a definition referencing a remote image, font, or map file must not cause the application to fetch from a third-party origin.
- **Print / export**: charts appear in the message when the conversation is printed or captured, or are cleanly absent — never as a torn partial render.
- **Follow-up question that looks like a link**: a follow-up question whose text begins with an address-like value is caught by the same external-reference rule as any other value (FR-016) and rejects the definition. Nothing about being a follow-up question exempts a value from the safety rules.
- **Follow-up question containing markup**: it reaches the composer as literal characters in a plain text field. It is never interpreted, and it is never a reason to reject.
- **Follow-up question on a non-clickable part**: a question attached to something the chart does not make clickable is simply never reachable. It is not an error.
- **Actionable click while sending is blocked**: in public/embedded mode the composer can be temporarily disabled while a send is in flight. The text is still appended, so it is waiting for the user once sending is possible again.
- **Two charts, one composer**: clicking items in two different charts in the same conversation appends to the same composer in click order, without either chart clearing the other's contribution.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST recognise a fenced code block tagged `echarts` inside assistant and user message content and render its contents as a chart in place of the code block.
- **FR-002**: The system MUST continue to recognise and render fenced code blocks tagged `chart.js` with unchanged appearance and behaviour.
- **FR-003**: The system MUST support both block tags within a single message, in any order and in any quantity, each rendering independently.
- **FR-004**: The system MUST confirm that an `echarts` block's contents parse into a structured chart definition before rendering, and MUST reject anything that does not. Beyond that structural check and the safety guards in FR-015 through FR-017, the definition MUST be passed through to the charting engine unmodified — the system MUST NOT enumerate, restrict, or transform the presentation options it contains.
- **FR-005**: The system MUST reject any `echarts` definition whose payload exceeds a maximum size. The size limit is the primary guard against oversized data; no separate per-series data-point limit is imposed, since series shapes vary by chart kind.
- **FR-006**: The system MUST render a rejected or unparseable `echarts` block as a plain code block, leaving the remainder of the message intact.
- **FR-007**: The system MUST display a localized error message in place of the chart when a validated definition fails during drawing, and MUST NOT fail silently or leave blank space.
- **FR-008**: All user-facing text introduced by this feature (loading, error, and any accessibility labels) MUST be available in both Hungarian and English.
- **FR-009**: Charts MUST adapt their text, axis, gridline, and background colours to the application's active light or dark theme, and MUST update when the theme changes while a chart is on screen.
- **FR-010**: Charts MUST resize to fit their container when the viewport or containing panel changes size, and MUST remain legible and non-overflowing at mobile widths.
- **FR-011**: Charts MUST be usable with touch input as well as pointer input; any interaction the chart offers MUST be reachable on a touchscreen.
- **FR-012**: The system MUST release all resources associated with a chart when the message or conversation containing it is removed from view, and MUST NOT accumulate charts across re-renders of the same message.
- **FR-012a**: When a chart's definition changes after the chart has been drawn, the system MUST update the existing chart in place rather than tearing it down and rebuilding it, so that entry animations do not re-run. When a message re-renders without its chart definitions changing, drawn charts MUST be left untouched.
- **FR-013**: The charting capability MUST be loaded only when a message containing a chart block is present, so conversations without charts are not burdened by it.
- **FR-014**: While the charting capability is loading, the system MUST show a loading indicator in the chart's position rather than a blank gap or a layout jump.
- **FR-015**: Chart definitions MUST NOT be able to introduce markup or executable behaviour into the page. Text the chart draws itself — hover detail, labels, titles, legends — does not pass through the message-rendering surface's existing sanitisation step, so the chart MUST be configured such that this text can never be interpreted as markup in the first place. Every text value MUST render as literal characters: a value containing markup MUST appear as visible inert text, and MUST NOT cause the definition to be rejected. The system MUST NOT attempt to detect markup by inspecting string values, so that ordinary labels containing characters such as `<` are unaffected.
- **FR-016**: Chart definitions MUST NOT cause requests to third-party origins. Any value referencing an external resource — a remote image, icon, symbol, font, or geography file — MUST cause the definition to be rejected per FR-006, whatever chart kind requested it.
- **FR-017**: Chart definitions MUST NOT be able to make any part of a chart navigate the browser. Values that would turn chart text into a hyperlink, or that carry a script-bearing address scheme, MUST cause the definition to be rejected per FR-006.
- **FR-018**: The system MUST render charts identically in both authenticated mode and public/embedded mode.
- **FR-019**: The system MUST NOT maintain an allowlist of chart kinds. Any chart kind the engine supports MUST be accepted, so that agents can adopt new chart kinds without requiring a client release. A chart kind the engine cannot draw MUST surface as a localized error per FR-007 rather than a blank space.
- **FR-020**: `chart.js` blocks MUST continue to be rendered by the existing rendering path, unchanged. The two block tags MUST be independent end to end: neither tag's definitions are translated into the other's format, and a fault in one path MUST NOT affect the other.
- **FR-021**: Every rejected chart definition and every draw failure MUST be recorded through the application's existing diagnostic logging, identifying the reason for the rejection or failure and which block in the message it came from. Because rejection is silent to the user by design (FR-006), this record is the only way to discover that an agent has begun emitting definitions that never render.
- **FR-022**: Diagnostic records MUST NOT include the chart definition itself, nor any label, series name, or data value drawn from it. Assistant-generated content may contain customer data, and the public/embedded mode runs inside third-party sites.
- **FR-023**: The system MUST recognise a follow-up question attached by the assistant to an individual data item within an `echarts` definition, and MUST place that question's text into the message composer when the user activates that data item.
- **FR-024**: The question MUST be appended to whatever the composer already contains, and the composer MUST receive focus. The system MUST NOT replace or clear composer content the user authored.
- **FR-025**: The system MUST NOT send a message as a result of a chart interaction, under any circumstance. The user MUST have the opportunity to read and edit the text before it becomes their message. A chart interaction MUST NOT trigger any other application behaviour — no navigation, no filtering, no request — the composer is the only permitted destination.
- **FR-026**: A follow-up question MUST be validated when the definition is checked, not when it is clicked: it MUST be a text value no longer than a maximum length. A definition containing one that is not MUST be rejected per FR-006. This means a definition that renders is one whose every follow-up question is already known to be usable.
- **FR-027**: A data item carrying no follow-up question MUST be inert — activating it MUST leave the composer untouched. Interactions the chart provides natively, such as toggling a series from its legend, MUST continue to behave as they normally would and MUST NOT place text in the composer.
- **FR-028**: When a definition contains at least one valid follow-up question, the system MUST display a localized hint that data points can be selected to ask about them. When it contains none, the hint MUST NOT be displayed.
- **FR-029**: Activating a data item once MUST append its question exactly once, regardless of how many times the message has been re-rendered or how many times the chart's definition has been updated in place.
- **FR-030**: The mechanism carrying text from a chart to the composer MUST NOT be persisted, and MUST be consumed exactly once. Text MUST NOT be able to reach the composer on a later visit without the user activating a data item again. Once text is visible in the composer it is the user's own content and is treated exactly as typed text — including being saved as a draft — because they can see it and edit or clear it.

### Key Entities

- **Chart Block**: A fenced code block in message content, identified by its language tag (`echarts` or `chart.js`), whose body is a chart definition. Has a position within the message and an identity stable enough to survive a re-render of that message.
- **Chart Definition**: The structured description of what to draw — the chart kind, the data series, the axis/label configuration, and presentation options. Authored by the assistant, therefore untrusted. Checked for shape, size, and the safety conditions in FR-015 through FR-017, then passed through as-is; its presentation options are deliberately not enumerated.
- **Unsafe Value**: Any value inside a Chart Definition that would reach a third-party origin or navigate the browser. Its presence rejects the whole definition. Independent of chart kind. Markup is deliberately *not* an Unsafe Value — it is disarmed by how the chart renders text rather than by detection, so it never rejects anything.
- **Rendered Chart**: The live on-screen chart bound to one Chart Block, holding resources that must be released when its message goes away.
- **Actionable Item**: A single data item within a Chart Definition to which the assistant has attached a follow-up question. Only items so marked are actionable; every other part of the chart stays inert. Its follow-up question is untrusted text, validated when the definition is checked (FR-026), and is never treated as markup or as a link.
- **Composer Request**: A one-shot request that a piece of text be appended to the message composer, raised by activating an Actionable Item and consumed once by the composer. Each activation raises a distinct request, so activating the same item twice appends twice. It is deliberately not persisted (FR-030) and carries no instruction to send.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of messages containing a well-formed `echarts` block display a rendered chart rather than raw definition text.
- **SC-002**: 100% of stored conversations containing `chart.js` blocks render identically before and after this change — zero visual regressions.
- **SC-003**: Once the charting capability has been fetched, a chart becomes visible within 2 seconds of its message appearing on a mid-range mobile device. On the very first chart of a session — when the capability must still be downloaded — the loading indicator appears immediately and the chart follows within 5 seconds on a typical broadband connection.
- **SC-004**: For conversations containing no chart blocks, the size of what the browser must download to display the conversation is unchanged from today.
- **SC-005**: 100% of malformed, oversized, undrawable, or unsafe chart definitions degrade to readable text or a localized error, with zero cases of a broken message, blank gap, or application crash.
- **SC-006**: Every user-facing string added by this feature exists in both Hungarian and English — zero untranslated keys.
- **SC-007**: Charts remain legible with no horizontal overflow at viewport widths from 320 px to 2560 px, in both light and dark theme.
- **SC-008**: A conversation in which 50 chart-bearing messages are rendered and scrolled past shows no growth in the number of live charts beyond those on screen.
- **SC-008a**: Re-rendering a message whose chart definitions have not changed causes zero chart re-initializations and zero repeated entry animations, however many times it re-renders.
- **SC-009**: Zero third-party network requests are triggered by rendering any chart definition.
- **SC-010**: Zero chart definitions carrying an external resource reference or a navigation target are rendered — each is rejected regardless of which chart kind requested it or how deeply the value is nested.
- **SC-010a**: Zero instances of markup in a chart definition are interpreted as markup, and zero charts are rejected for containing markup-shaped text — every such value renders as visible inert characters.
- **SC-011**: Adopting a chart kind not previously seen in production requires no client release — a new chart kind emitted by an agent renders without a code change.
- **SC-012**: 100% of rejections and draw failures are diagnosable from logs alone — the reason and the originating block are always recoverable without reproducing the conversation, and zero log records contain chart content.
- **SC-013**: Zero messages are sent as a result of a chart interaction — every chart-supplied question passes through the composer, where the user can read and edit it, before it can become a message.
- **SC-014**: Zero characters the user typed are lost to a chart interaction — 100% of activations preserve existing composer content.
- **SC-015**: Activating an actionable item N times appends its question exactly N times, and re-rendering or updating the chart between activations changes that count by zero.
- **SC-016**: 100% of charts containing at least one actionable item display the selection hint, and 0% of charts containing none display it.
- **SC-017**: Zero composer insertions occur without a user activation — a reload, a re-render, or a newly mounted composer produces no insertion by itself, however recently an item was activated.

## Assumptions

- **Chart definitions arrive as JSON.** As with `chart.js` blocks today, the body of an `echarts` block is a JSON object. Formats that could carry executable code are out of scope.
- **Producing the blocks is the assistant's job, not the client's.** Teaching agents to emit `echarts` blocks is a backend/prompt concern outside this specification; this feature only renders what arrives.
- **Replies arrive whole, not incrementally.** There is no response streaming, so a chart block is either fully present or absent when a message is rendered — the client never sees a definition grow character by character. Messages still re-render for other reasons (see the re-render edge case), which is what FR-012a governs.
- **No user-authored charts.** Users are not given an editor or UI for composing chart definitions in this scope.
- **No chart-level actions.** Export/download/save-as-image, fullscreen, and copy-definition controls are out of scope for v1; only the interactions the chart definition itself declares (such as hover detail or legend toggling) are available.
- **The message composer is the only place a chart interaction may reach.** Activating an actionable item appends text to the composer and nothing else — no navigation, no filtering, no request, and never a send (FR-025). The composer is chosen precisely because it puts a human between the chart and any effect: nothing happens until the user presses send.
- **A chart may only propose a question the assistant wrote.** Follow-up text comes from the definition, so the set of possible composer insertions is fixed when the message arrives. The chart never composes text from data values or from anything the user did, which is what keeps this from being a way for chart content to author arbitrary user messages.
- **Follow-up questions are opt-in per data item.** An `echarts` definition with no attached questions behaves exactly as it did before this addition: fully inert clicks, no hint. This keeps every existing definition unaffected.
- **Only `echarts` blocks gain this behaviour.** `chart.js` blocks are unchanged, as FR-002 and FR-020 require.
- **One composer is available at a time.** The application mounts a single message composer per view, so a request needs no addressing information to reach the right one. A split-view or multi-pane conversation layout would invalidate this and require the request to name its target.
- **Geographic/map charts are not blocked by kind, but will not draw.** They depend on externally-hosted geography data, which FR-016 rejects, so in practice they surface as a localized error rather than a chart. Bundling geography data locally is separate scope.
- **Accepting every chart kind means shipping the charting capability whole.** Restricting kinds is the only way to ship a smaller subset, and dropping the restriction is a deliberate trade: a larger one-time download in exchange for agents adopting new chart kinds with no client release (SC-011). The download stays isolated to conversations that actually contain charts (SC-004) and is cached thereafter (SC-003).
- **Safety is enforced on how text renders and on what values reference, not on chart kinds.** FR-015 through FR-017 apply uniformly across the whole definition, so accepting a new chart kind never widens the attack surface.
- **Hover detail is drawn inside the chart, and is plainer as a result.** Disarming markup at render time (FR-015) means chart-drawn text is not an HTML element, so hover detail cannot be richly styled and stays within the chart's bounds instead of floating over the page. This is an accepted cost of removing the injection sink outright rather than trying to detect hostile strings; it also sidesteps the tooltip-clipping problems that floating hover detail causes inside a scrolling message list.
- **Errors degrade in place, matching today's behaviour** for `chart.js`: an unparseable block falls back to a plain code block rather than raising a notification.
- **Theme detection reuses the application's existing theme mechanism**; no new theme configuration is introduced.
- **Accessibility parity with today.** This feature matches the existing `chart.js` accessibility level; raising the bar (data tables behind charts, screen-reader summaries) is worthwhile but is separate scope.
- **Existing hardcoded English strings in the current chart component are pre-existing** and are not required to be fixed by this feature, though FR-008 applies to anything newly added.

## Dependencies

- The message-rendering surface that turns message text into displayed content, including its existing markup-sanitisation step, must be extended to permit the new chart placeholder. Any new attribute or element the placeholder needs must be added to the sanitisation allowlist deliberately.
- That existing sanitisation step does **not** cover text a chart draws itself, because charts render into their own container after sanitisation has run. FR-015 is therefore an independent obligation, not something the existing boundary satisfies.
- The existing lazy-loading and teardown behaviour of the current chart path is the reference model for FR-012 through FR-014.
- Both locale files must be updated together per the project's bilingual rule.
- The message composer must accept text raised from outside itself. It already appends text from a non-typed source (voice transcription), which is the reference model for FR-024's append-and-focus behaviour.
- A shared, non-persisted piece of application state is required to carry a Composer Request from a chart to the composer, since the two are not in a parent/child relationship. The existing draft mechanism is explicitly **not** suitable: it is read only when the composer mounts, it is overwritten by the composer's own periodic save, and it is persisted — which FR-030 forbids.
