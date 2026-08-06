# Tasks: ECharts Code Blocks

**Input**: Design documents from `/specs/001-echarts-code-blocks/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: INCLUDED. The spec, plan and quickstart specify 53 automated scenarios and
15 manual ones, and constitution Principle III (Network-Boundary Testing) is
NON-NEGOTIABLE. Test tasks are written before the implementation they cover.

**Organization**: Tasks are grouped by user story. Each story phase is an
independently testable increment.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1–US5)
- Scenario numbers (S1–S51) refer to the table in `quickstart.md`; M1–M15 refer to
  its manual section.

## Path Conventions

Nuxt 4 SPA, single project. `@` → repo root (`lib/`, `types/`), `~` → `app/`.

**Corrected test paths** — `plan.md` and `quickstart.md` list
`tests/unit/stores/chat.test.ts` and `tests/unit/utils/sanitize.test.ts`. Neither
exists. The repo mirrors the source layout including the `app/` segment, and both
files already exist at:

- `tests/unit/app/stores/chat.test.ts` (EDIT, not new)
- `tests/unit/app/utils/sanitize.test.ts` (EDIT, not new)

Creating the paths as written would produce orphan duplicates. The tasks below use
the real paths.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Add the runtime dependency and pin the pre-change baseline.

- [X] T001 Add `"echarts": "^6.1.0"` to the `dependencies` block (NOT `devDependencies` — it ships to the browser) in `package.json`, then run `npm install` and confirm the lockfile updates
- [X] T002 Capture the pre-change baseline by running `npm run typecheck && npm run lint && npm run test:run` and recording that all three are green; this is the reference for the US2 no-regression claim

**Checkpoint**: Dependency available, baseline green.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The shared spine every story renders through — validator, engine
lifecycle, sanitiser allowlist, base i18n keys — plus the regression guard that
must pin current behaviour *before* any shared file is edited.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

**⚠️ T006 must land before T014 or T019 touch `MarkdownContent.vue`** — quickstart
states scenario 29 is written first precisely so it pins pre-change behaviour.

### Tests (write first — these fail until the implementation tasks land)

- [X] T003 [P] Create `tests/unit/lib/validation/echarts.test.ts` covering S1–S9: valid definition returns `ok` with output identical to `JSON.parse` (S1); >50 000 chars returns `oversize` **and the size check runs before parsing** (S2); truncated JSON returns `unparseable` (S3); `"{}"`, `"[]"`, `"null"`, `"3"`, `'""'` return `not-an-object` (S4); `image://` nested at `series[0].markPoint.data[0].symbol` returns `external-reference` (S5); `https:`, `//cdn…`, `data:image/svg+xml`, `javascript:` return `external-reference` (S6); `title.link` and a nested `sublink` return `navigation-target` (S7); a sankey with `links[{source,target}]` returns `ok` — `target` must NOT be treated as navigation (S8); `"Revenue < 100k"`, `"<script>alert(1)</script>"`, `"see http://wiki for detail"` all return `ok` (S9)
- [X] T004 [P] Create `tests/unit/composables/useECharts.test.ts` covering S10–S14, mocking the `echarts` module (jsdom has no canvas) following the `FakeChart` precedent in `tests/unit/composables/useChartJs.test.ts`: concurrent `loadECharts()` calls import exactly once (S10); `initChart` passes `{ renderer: 'canvas' }` (S11); `applyOption` forces `renderMode: 'richText'` on a top-level tooltip **and** one nested in `media[].option` (S12); an explicit colour in the definition survives the theme-base merge (S13); a throwing `setOption` returns `false` and the logger call contains no option content and no error object (S14)
- [X] T005 [P] Add S28 to the existing `tests/unit/app/utils/sanitize.test.ts`: `data-echart-id` survives `sanitizeHTML`, while an arbitrary unlisted `data-*` attribute is still stripped
- [X] T006 Add the S29 regression guard to `tests/unit/components/chat/MarkdownContent.test.ts`: a stored `chart.js`-only message renders byte-identically to a snapshot captured now, before any edit to that component

### Implementation

- [X] T007 [P] Create `lib/validation/echarts.ts` exporting `EChartsOption`, `EChartsRejectionReason` (all six codes), `EChartsRejection`, a locally-declared `MAX_OPTION_JSON_SIZE = 50_000` (NOT imported from `lib/validation/chart.ts` — the two paths stay independent per FR-020), and `parseEChartsOption(json): Result<EChartsOption, EChartsRejection>` implementing data-model rules 1–5 with rules 4 and 5 sharing **one** recursive walk; must not throw, log, mutate, inspect any string for markup, require `series`, validate chart kind, or cap data-point counts
- [X] T008 [P] Create `app/composables/useECharts.ts` as a module-level singleton shaped like `useChartJs`/`useShiki`, exposing `isLoading`, `isLoaded`, `loadECharts` (idempotent, one `await import('echarts')` per page load, concurrent callers share the in-flight promise, never throws), `initChart(el)` (calls `echarts.init(el, null, { renderer: 'canvas' })`, returns `null` on failure), and `applyOption(instance, option, isDark)` (plain merge — no `notMerge`, no `replaceMerge`; forces `renderMode: 'richText'` on every `tooltip` at any depth including `media[].option`, `baseOption` and `options[]`; merges the CSS-custom-property theme base *under* the definition; on engine throw returns `false` and logs `{ blockIndex }` only, never the caught error object); must NOT import `echarts` statically or read CSS custom properties at module scope
- [X] T009 [P] Add `'data-echart-id'` to the `ALLOWED_ATTR` array in `app/utils/sanitize.ts` (`ALLOW_DATA_ATTR` is `false` at line 85, so an unlisted `data-*` is stripped and the Teleport target would silently never exist)
- [X] T010 Add `chat.echart.loading` ("Loading chart…" / "Diagram betöltése…") and `chat.echart.renderFailed` ("This chart could not be displayed." / "Ezt a diagramot nem sikerült megjeleníteni.") to **both** `i18n/locales/en.json` and `i18n/locales/hu.json`

**Checkpoint**: Validator, engine composable, allowlist and base strings ready.
S1–S14, S28, S29 green. User stories can now begin.

---

## Phase 3: User Story 1 - Assistant renders a chart from an `echarts` block (Priority: P1) 🎯 MVP

**Goal**: A fenced ```` ```echarts ```` block in message content renders as a live,
theme-aware, resizing chart in place of the code block.

**Independent Test**: Send a message containing one `echarts` block with a valid
bar-chart definition; confirm a rendered chart appears where the code block was, in
both light and dark theme, at desktop and mobile widths.

### Tests for User Story 1

- [X] T011 [P] [US1] Create `tests/unit/components/chat/ChatEChart.test.ts` covering S15–S21: mount with engine unloaded shows the loading indicator via the i18n key, not a literal (S15); `source` prop changes → `setOption` called again while `init` and `dispose` are **not** (S16); re-render with `source` unchanged → **zero** further engine calls (S17); `useColorMode` flip → `setOption` called, no `init`/`dispose` (S18); container resize → `instance.resize()` (S19); unmount → `dispose()` exactly once with no call after it (S20); engine load failure → localized error with surrounding content intact (S21)
- [X] T012 [P] [US1] Add S22, S23, S26, S27 to `tests/unit/components/chat/MarkdownContent.test.ts`: one `echarts` block emits a placeholder and the raw definition is absent (S22); three blocks produce three entries with distinct ids (S23); an unterminated fence leaves `hasEChartsBlocks` false with no placeholder (S26); content with no `echarts` block never calls `loadECharts` (S27)

### Implementation for User Story 1

- [X] T013 [US1] Create `app/components/chat/ChatEChart.vue` taking props `{ option: EChartsOption; blockIndex: number; source: string }` and rendering exactly one of loading indicator / localized error / chart container; `initChart` + `applyOption` once when the engine becomes available, `applyOption` on the **existing** instance when `source` changes, no engine call at all when `source` is unchanged, theme re-merge on `useColorMode()` change with no re-init, `instance.resize()` via `useResizeObserver` on the container (not `window`), and `dispose()` exactly once in `onBeforeUnmount`; no hardcoded English string anywhere
- [X] T014 [US1] Add the additive extraction pass to `app/components/chat/MarkdownContent.vue`: `hasEChartsBlocks(content)` requiring both an opening ```` ```echarts ```` fence and a closing fence (mirroring `hasChartBlocks` at line 94); `extractEChartsBlocks(html)` matching `/<pre><code\s+class="language-echarts">([\s\S]*?)<\/code><\/pre>/g`, decoding with the existing `decodeHtmlEntities`, replacing each `ok` match with `<div class="echart-placeholder" data-echart-id="{id}"></div>` where `id` is `` `${instancePrefix}-echart-${index}` ``, and returning `match` unchanged on `err`; call it inside `renderContent()` alongside the existing table/pivot/chart passes and **before** Shiki and `sanitizeHTML`; add a `<Teleport :to="`[data-echart-id='${e.id}']`" :defer="true">` block keyed by `e.id`; call `loadECharts()` in `onMounted` only when `hasEChartsBlocks(props.content)`; add a `watch(echartsLoaded)` that re-runs `renderContent()` only when `echartEntries.value.length > 0`, mirroring the existing `chartJsLoaded` watch at line 268. Must not alter, reorder or share code with the `chart.js`, `rows`, `h-rows` or `pivot` passes

**Checkpoint**: US1 fully functional. A valid `echarts` block renders, themes,
resizes and tears down cleanly. This is the MVP — but see the Implementation
Strategy note on why it does not ship without the Phase 2 safety walk.

---

## Phase 4: User Story 2 - Existing `chart.js` blocks keep working unchanged (Priority: P1)

**Goal**: Prove the `chart.js` path is behaviourally and textually untouched.

**Independent Test**: Replay a stored conversation containing `chart.js` blocks
before and after the change and confirm the rendered output is unchanged.

- [X] T015 [US2] Add S24 to `tests/unit/components/chat/MarkdownContent.test.ts`: one message mixing `echarts`, `chart.js`, `rows`, `pivot`, math and a `ts` code block renders every block type correctly and independently
- [X] T016 [US2] Verify the no-diff proof by running `git diff --stat app/composables/useChartJs.ts app/components/chat/ChatChart.vue lib/validation/chart.ts` and confirming empty output — this is the cheapest available evidence for FR-020 and SC-002
- [ ] T017 [US2] Run manual scenario M9 from `specs/001-echarts-code-blocks/quickstart.md`: open a stored conversation containing `chart.js` blocks, plus a message containing both a `chart.js` and an `echarts` block, and confirm the `chart.js` charts look and behave exactly as before

**Checkpoint**: US1 and US2 both hold. Backward compatibility evidenced by a green
S29 snapshot and an empty diff.

---

## Phase 5: User Story 3 - Malformed or unsupported chart definitions fail safely (Priority: P2)

**Goal**: Every rejection and draw failure degrades visibly and is diagnosable from
logs alone, with zero definition content in any record.

**Independent Test**: Send messages containing invalid JSON, an oversized payload,
an undrawable chart kind, and each class of unsafe value, and confirm every one
degrades without breaking the surrounding message — while markup-shaped text does
*not* degrade.

**Note**: the rejection rules and the error UI already exist from Phases 2–3. This
phase wires the diagnostic call sites and proves the degradation paths end to end.

- [X] T018 [P] [US3] Add S25 to `tests/unit/components/chat/MarkdownContent.test.ts`: a rejected `echarts` block survives as a plain code block with its definition text still visible, sibling blocks still render, and `{ reason, index }` is logged
- [X] T019 [US3] Wire the rejection log call in `extractEChartsBlocks` in `app/components/chat/MarkdownContent.vue` using `createLogger` from `lib/utils/logger.ts`, emitting `{ reason, index }` on the `err` branch and nothing else — the block index is the only identifier the pure validator cannot know, which is why the caller owns the record
- [X] T020 [US3] Audit both diagnostic call sites — the rejection log in `app/components/chat/MarkdownContent.vue` and the draw-failure log in `app/composables/useECharts.ts` — and confirm neither passes an option key, label, series name, data value, or the caught engine error object (FR-022, SC-012)
- [ ] T021 [US3] Run manual scenarios M2, M4 and M10 from `specs/001-echarts-code-blocks/quickstart.md`: zero third-party requests with DevTools filtered (M2); an undrawable chart kind surfaces a localized error, not a blank gap (M4); four diagnostic records read line by line, each carrying a reason and a block index and nothing more (M10)

**Checkpoint**: US1, US2 and US3 hold independently.

---

## Phase 6: User Story 5 - Clicking a data point offers a follow-up question (Priority: P2)

**Goal**: Clicking a data item the assistant marked appends its follow-up question
to the composer and focuses it — never replacing, never clearing, never sending.

**Independent Test**: Send a pie-chart definition where one data item carries a
follow-up question and another does not. Click each and confirm the first fills the
composer while the second does nothing, and that no message is sent in either case.

### Tests for User Story 5

- [X] T022 [P] [US5] Add S30–S36 to `tests/unit/lib/validation/echarts.test.ts`: a valid `prompt` returns `ok` with `option.series[0].data[0].prompt` present unmodified (S30); `hasActionableItems` is `true` with a valid prompt, `false` without, `false` for `{}` (S31); `hasActionableItems` is `false` when the word only appears inside a label or series name such as `"name": "prompt latency"` — guards against a substring shortcut (S31a); a `prompt` that is a number, `null`, an object, `""` or `"   "` returns `invalid-prompt` (S32); 501 characters returns `invalid-prompt` and exactly 500 returns `ok` (S33); prompts nested in `series[0].data[3]` and `series[1].markPoint.data[0]` are both accepted (S34); a `prompt` of `"https://x"` returns `external-reference`, not `invalid-prompt` (S35); a `prompt` containing `"<b>why</b>"` returns `ok` untouched (S36)
- [X] T023 [P] [US5] Add S37–S40 to the existing `tests/unit/app/stores/chat.test.ts`: `requestComposerText('a  b\n\nc')` yields `composerRequest.text === 'a b c'` (S37); two calls with identical text produce two distinct `seq` values (S38); `clearComposerRequest()` sets it to `null` (S39); `composerRequest` is absent from the persisted payload after a request is raised (S40)
- [X] T024 [P] [US5] Add S46–S51 to `tests/unit/components/chat/MessageInput.test.ts`, driving the **real** store through `renderWithProviders` and asserting on the rendered textarea rather than store internals: `seq` increments with empty `messageText` → textarea holds exactly the request text and `focus()` is called (S46); `'existing'` becomes `'existing <text>'` with nothing removed (S47); two increments append both, in order (S48); applying a request calls `clearComposerRequest()` and invokes no send function (S49); `disabled: true` still appends (S50); mounting with a `composerRequest` already in the store performs **no** insertion (S51)
- [X] T025 [P] [US5] Add S41–S45a to `tests/unit/components/chat/ChatEChart.test.ts`: a click on an item with a `prompt` calls `requestComposerText` once with that exact string (S41); clicks where `params.data` is a bare number, `null` or an array do not call it (S42); click params with no `data` at all do not call it and do not throw (S43); the `source` prop updated twice followed by **one** click calls it **exactly once** (S44 — fails if the handler is bound per `setOption`); an option containing a valid prompt renders the hint from `chat.echart.clickHint` and one without renders no hint (S45); replacing the `option` prop with one that has no prompts makes the hint disappear without a re-mount (S45a — fails if the flag is passed in rather than derived)

### Implementation for User Story 5

- [X] T026 [US5] Extend `lib/validation/echarts.ts` additively: export `MAX_PROMPT_LENGTH = 500` and `isValidPrompt = (value: unknown): value is string` implemented as `typeof value === 'string' && value.trim().length > 0 && value.length <= MAX_PROMPT_LENGTH` — the **only** place that predicate is written; add rule 6 as a third predicate on the **existing** recursive walk (not a second traversal) rejecting with `invalid-prompt`; export `hasActionableItems(option): boolean` deriving the FR-028 hint's visibility by walking for `prompt` keys satisfying `isValidPrompt`, never by substring match. Must not strip, rewrite or normalize a `prompt` value — the option handed to the engine keeps the authored text
- [X] T027 [US5] Extend `app/stores/chat.ts` additively: add `const composerRequest = ref<ComposerRequest | null>(null)` where `ComposerRequest` is `{ text: string; seq: number }`, plus `requestComposerText(text)` (collapses newlines and whitespace runs to single spaces, no-ops on whitespace-only input, sets `composerRequest` with a **strictly increasing** `seq` so two identical texts still produce two distinct values) and `clearComposerRequest()`; reset it in the existing `resetUserData` at line 208; **must NOT** be added to `persist.pick` at line 243, and must not touch `draftMessages`, `failedMessages` or `activeSessionId`, or reuse the existing `saveDraft`/`getDraft`/`clearDraft` actions
- [X] T028 [US5] Add one watcher to `app/components/chat/MessageInput.vue` watching `chatStore.composerRequest?.seq` (the `seq`, **not** the object or its `text`) that appends the request text to `messageText` using the same `trim()`-then-space join as the voice-transcription append at line 269-270, calls `chatStore.clearComposerRequest()`, then calls the existing `focus()` at line 463; it must fire even while `props.disabled` is true, and must never send, replace or clear existing content
- [X] T029 [US5] Add the click handler and hint to `app/components/chat/ChatEChart.vue`: register `instance.on('click', …)` **once**, immediately after `initChart` and never in the `applyOption` path (handlers survive `setOption`, so re-registering per update makes one click raise N requests); the handler returns early unless `params.data` is a non-null non-array object whose `prompt` satisfies the imported `isValidPrompt`, then calls `chatStore.requestComposerText(prompt)`; add `const hasPrompts = computed(() => hasActionableItems(props.option))` **derived from the prop**, not passed in, and render the `chat.echart.clickHint` line beneath the container only when it is true. No `componentType` check — legend and axis clicks carry no `data` and must keep their native behaviour
- [X] T030 [US5] Add `chat.echart.clickHint` ("Select a data point to ask about it" / "Válassz egy adatpontot a kérdéshez") to **both** `i18n/locales/en.json` and `i18n/locales/hu.json`, worded device-neutrally — "select", never "click" or "tap", since one string serves pointer and touch
- [ ] T031 [US5] Run manual scenarios M12, M13, M14 and M15 from `specs/001-echarts-code-blocks/quickstart.md`, confirming **M12 step 3** (a second click on the same slice appends a second time) and **M14** (one click after a re-render inserts exactly once) specifically — these two distinguish a correct implementation from a plausible broken one

**Checkpoint**: US1, US2, US3 and US5 all hold independently.

---

## Phase 7: User Story 4 - Charts work in embedded/public mode (Priority: P3)

**Goal**: Charts render in public/iframe mode identically to the signed-in app.

**Independent Test**: Open a public/embedded conversation, trigger a reply
containing an `echarts` block, and confirm the chart renders.

- [ ] T032 [US4] Run manual scenario M8 from `specs/001-echarts-code-blocks/quickstart.md`: open a public conversation (`/chats/public/new/[agentId]` with `config.json` carrying `publicAgentId`) and render the M1 definition, confirming identical appearance to the authenticated app; no code change is expected, since the render path reads no token, storage or transport

**Checkpoint**: All user stories independently functional.

---

## Phase 8: Polish & Cross-Cutting Concerns

- [ ] T033 [P] Run the remaining manual scenarios M1, M3, M5, M6, M7 and M11 from `specs/001-echarts-code-blocks/quickstart.md`: render in both themes at 320 px–2560 px (M1); markup inert and `<` literal (M3); touch input (M5); lazy load and caching (M6); no instance accumulation across ~50 chart-bearing messages (M7); print preview (M11)
- [X] T034 Raise the ratcheted coverage thresholds in `vitest.config.ts` after running `npm run test:coverage`, using the established `floor(actual − 2)` rule; they may be raised, never lowered
- [X] T035 Run the full gate `npm run typecheck && npm run lint && npm run test:run` and confirm all three are green, matching the T002 baseline with no new failures
- [ ] T036 Walk the "Done when" checklist at the end of `specs/001-echarts-code-blocks/quickstart.md` and confirm every item, including the empty-diff check on `useChartJs.ts`, `ChatChart.vue` and `lib/validation/chart.ts`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately.
- **Foundational (Phase 2)**: Depends on T001. **BLOCKS all user stories.**
- **US1 (Phase 3)**: Depends on Phase 2. The MVP core.
- **US2 (Phase 4)**: Depends on Phase 3 for T015 (needs the `echarts` pass to exist).
  Its guard, T006, is already in Phase 2 by necessity.
- **US3 (Phase 5)**: Depends on Phase 3 (needs the extraction pass and error UI).
- **US5 (Phase 6)**: Depends on Phase 3 (needs a rendered chart to click).
- **US4 (Phase 7)**: Depends on Phase 3. Verification only, no code.
- **Polish (Phase 8)**: Depends on all desired stories.

### Critical Ordering Constraints

1. **T006 before T014 and T019.** The S29 snapshot must pin `MarkdownContent.vue`'s
   behaviour before that file is edited, or it pins the post-change behaviour and
   proves nothing.
2. **T007 before T026.** Rule 6 is added to an existing walk, not a new one.
3. **T013 before T029.** The click handler binds immediately after `initChart`, so
   the instance lifecycle must exist first.
4. **T027 before T028.** The composer watcher reads the store action.
5. **T029 must not touch the `applyOption` path.** This is the single most
   consequential ordering rule in the feature — S44 and M14 are the only checks that
   catch violating it.

### Within Each User Story

- Tests are written before the implementation they cover, and must fail first.
- Validation (`lib/`) before composable (`app/composables/`) before component
  (`app/components/`) — the constitution's layer order.
- i18n keys land in the same change as the component that reads them.

### Parallel Opportunities

- **Phase 2 tests**: T003, T004, T005 are three different files — fully parallel.
  T006 edits `MarkdownContent.test.ts`, also independent.
- **Phase 2 implementation**: T007, T008, T009 touch three different files — fully
  parallel. T010 edits both locale files and is independent of all three.
- **Phase 3 tests**: T011 (new file) and T012 (existing file) are parallel.
- **Phase 6 tests**: T022, T023, T024, T025 touch four different files — fully
  parallel, the widest fan-out in the feature.
- **Cross-story**: once Phase 3 completes, Phases 4, 5, 6 and 7 can proceed in
  parallel by different developers — they share only `MarkdownContent.vue` (T015,
  T018, T019), which must be serialized.

### Serialization Warnings

- `app/components/chat/MarkdownContent.vue` is touched by T014 and T019 — never in
  parallel.
- `tests/unit/components/chat/MarkdownContent.test.ts` is touched by T006, T012,
  T015 and T018 — serialize or expect conflicts.
- `tests/unit/components/chat/ChatEChart.test.ts` is touched by T011 and T025.
- `i18n/locales/{en,hu}.json` are touched by T010 and T030.

---

## Parallel Example: Phase 2 Foundational

```bash
# All three implementation files are independent — launch together:
Task: "Create lib/validation/echarts.ts with rules 1-5 in one recursive walk"
Task: "Create app/composables/useECharts.ts singleton with lazy import"
Task: "Add data-echart-id to ALLOWED_ATTR in app/utils/sanitize.ts"
```

## Parallel Example: User Story 5 tests

```bash
# Four different test files — the widest parallel opportunity in the feature:
Task: "Add S30-S36 to tests/unit/lib/validation/echarts.test.ts"
Task: "Add S37-S40 to tests/unit/app/stores/chat.test.ts"
Task: "Add S46-S51 to tests/unit/components/chat/MessageInput.test.ts"
Task: "Add S41-S45a to tests/unit/components/chat/ChatEChart.test.ts"
```

---

## Implementation Strategy

### The MVP is Phases 1–4, not Phase 3 alone

US1 renders charts, but a render path without the Phase 2 safety walk would let a
definition reference `image://https://…` and issue a third-party request, violating
FR-016 and SC-009. The walk is in Foundational rather than US3 precisely so this
cannot be deferred: US3 owns the *degradation and diagnostics* behaviour, which is
genuinely deferrable, while the safety boundary is not.

The shippable MVP is therefore **Phases 1 + 2 + 3 + 4** — charts render, unsafe
definitions are refused, and `chart.js` is proven untouched.

### Incremental Delivery

1. Phase 1 + 2 → foundation ready, S1–S14/S28/S29 green
2. + Phase 3 → charts render (US1)
3. + Phase 4 → backward compatibility evidenced (US2) — **deployable MVP**
4. + Phase 5 → failures diagnosable (US3)
5. + Phase 6 → charts start the next question (US5)
6. + Phase 7 → public mode confirmed (US4)
7. + Phase 8 → coverage ratcheted, full gate green

### Parallel Team Strategy

1. Everyone completes Phases 1–2 together (the widest [P] fan-out is here).
2. One developer takes Phase 3 — it is the critical path and touches the two files
   every later phase depends on.
3. Once Phase 3 lands: Developer A takes Phase 5, Developer B takes Phase 6 (the
   largest remaining phase), Developer C takes Phases 4 and 7 (verification-heavy).
4. Coordinate on `MarkdownContent.vue` and the locale files — see Serialization
   Warnings.

---

## Notes

- **Two test paths in `plan.md` and `quickstart.md` are wrong.** See Path
  Conventions above; the tasks use the real ones.
- Rejected `echarts` blocks reach Shiki, unlike `chart.js` blocks — `chart.js`
  escapes the `language-(\w+)` regex only because of its dot. `highlightCode` falls
  back to `'text'` for unloaded languages (`app/composables/useShiki.ts:78`), so a
  rejected block degrades safely, but S25 should assert the definition text is still
  visible rather than assuming it.
- `echarts` is mocked in tests as a third-party renderer needing real canvas — the
  same category as the already-mocked `chart.js` and `shiki`. No store, service or
  `apiClient` is mocked anywhere (constitution III).
- This feature adds no HTTP call, so no MSW handler changes are needed and
  `onUnhandledRequest: 'error'` continues to hold.
- S44 and M14 are the two checks most likely to be skipped and most likely to break.
  The broken implementation passes every other click scenario.
- Commit after each task or logical group. Stop at any checkpoint to validate a
  story independently.
