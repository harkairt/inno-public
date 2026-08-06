# Quickstart: validating ECharts Code Blocks

**Feature**: `001-echarts-code-blocks` | **Date**: 2026-08-04

How to prove the feature works end to end. Scenario numbers map to the
acceptance scenarios and success criteria in [spec.md](./spec.md); the interfaces
under test are defined in [contracts/](./contracts/) and
[data-model.md](./data-model.md).

---

## Prerequisites

```bash
npm install
```

`echarts` must be present in `dependencies` (not `devDependencies`) — it ships to
the browser.

```bash
npm run typecheck && npm run lint && npm run test:run
```

All three must be green before and after the change (constitution: Development
Workflow & Quality Gates).

---

## Automated validation

### Full gate

```bash
npm run typecheck && npm run lint && npm run test:run
```

### Just this feature's suites

```bash
npx vitest run tests/unit/lib/validation/echarts.test.ts tests/unit/composables/useECharts.test.ts tests/unit/components/chat/ChatEChart.test.ts tests/unit/components/chat/MarkdownContent.test.ts tests/unit/components/chat/MessageInput.test.ts tests/unit/stores/chat.test.ts tests/unit/utils/sanitize.test.ts
```

### Coverage — must not fall below the ratcheted thresholds

```bash
npm run test:coverage
```

Thresholds in `vitest.config.ts` may be raised after this change, never lowered
(constitution III).

---

## What the automated suites must cover

| # | Scenario | Where | Proves |
|---|---|---|---|
| 1 | valid bar-chart definition → `ok`, output identical to `JSON.parse` | `lib/validation/echarts.test.ts` | FR-004 |
| 2 | body > 50 000 chars → `oversize`, and the size check runs *before* parsing | same | FR-005 |
| 3 | truncated JSON → `unparseable` | same | FR-006, "unterminated block" |
| 4 | `"{}"`, `"[]"`, `"null"`, `"3"` → `not-an-object` | same | FR-004, "empty block" |
| 5 | `image://…` nested deep inside `series[0].markPoint.data[0].symbol` → `external-reference` | same | FR-016, SC-010, "unusual position" |
| 6 | `https://`, `//cdn…`, `data:image/svg+xml`, `javascript:` → `external-reference` | same | FR-016, FR-017 |
| 7 | `{ "title": { "link": "/x" } }` and a nested `sublink` → `navigation-target` | same | FR-017 |
| 8 | a sankey definition with `links[{source,target}]` → `ok` | same | FR-019 — `target` must not be treated as navigation |
| 9 | labels `"Revenue < 100k"`, `"<script>alert(1)</script>"`, `"see http://wiki for detail"` → **all `ok`** | same | FR-015, SC-010a — no string is scanned for markup, patterns anchor at start |
| 10 | `loadECharts()` imports the module exactly once under concurrent calls | `useECharts.test.ts` | FR-013 |
| 11 | `initChart` passes `{ renderer: 'canvas' }` | same | FR-015 |
| 12 | `applyOption` forces `renderMode: 'richText'` on a top-level tooltip **and** on one nested in `media[].option` | same | FR-015 |
| 13 | an explicit colour in the definition survives the theme base merge | same | FR-004, FR-009 |
| 14 | a throwing `setOption` → returns `false`, and the logger call contains no option content and no error object | same | FR-007, FR-022 |
| 15 | mount with engine unloaded → loading indicator, i18n key not a literal | `ChatEChart.test.ts` | FR-014, FR-008 |
| 16 | `source` changes → `setOption` called again, `init` and `dispose` **not** called | same | FR-012a, SC-008a |
| 17 | re-render with `source` unchanged → **zero** further engine calls | same | FR-012a, "repeated re-render" |
| 18 | `useColorMode` flips → `setOption` called, `init`/`dispose` not called | same | FR-009 |
| 19 | container resize → `instance.resize()` | same | FR-010 |
| 20 | unmount → `dispose()` exactly once, and no call after it | same | FR-012, SC-008 |
| 21 | engine load failure → localized error, surrounding content intact | same | FR-007 |
| 22 | one message, one `echarts` block → placeholder emitted, raw definition absent | `MarkdownContent.test.ts` | FR-001 |
| 23 | three `echarts` blocks → three independent entries with distinct ids | same | FR-003 |
| 24 | one message with `echarts` + `chart.js` + `rows` + `pivot` + math + a `ts` block → every type renders | same | FR-003, FR-020, "interleaving" |
| 25 | rejected `echarts` block → survives as a code block, siblings still render, `{reason, index}` logged | same | FR-006, FR-021 |
| 26 | unterminated fence → `hasEChartsBlocks` false, no placeholder | same | "unterminated block" |
| 27 | no `echarts` block in content → `loadECharts` never called | same | FR-013, SC-004 |
| 28 | `data-echart-id` survives `sanitizeHTML`; an arbitrary `data-*` attribute still does not | `sanitize.test.ts` | FR-001 + allowlist audit |
| 29 | a stored `chart.js`-only message renders byte-identically to the pre-change snapshot | `MarkdownContent.test.ts` | FR-002, SC-002 |
| 30 | a data item with a valid `prompt` → `ok`, and `option.series[0].data[0].prompt` still present unmodified | `lib/validation/echarts.test.ts` | FR-023, FR-026 |
| 31 | `hasActionableItems` → `true` for an option with a valid `prompt`, `false` for one without, `false` for `{}` | same | FR-028, R18 |
| 31a | `hasActionableItems` → `false` for an option whose only occurrence of the word is in a label or a series name (e.g. `"name": "prompt latency"`) | same | R18 — guards against a substring shortcut |
| 32 | `prompt` that is a number, `null`, an object, `""`, or `"   "` → `invalid-prompt` | same | FR-026 |
| 33 | `prompt` of 501 characters → `invalid-prompt`; 500 exactly → `ok` | same | FR-026 (boundary) |
| 34 | `prompt` nested in `series[0].data[3]` and in `series[1].markPoint.data[0]` → both accepted; `hasActionableItems` is `true` | same | FR-023 |
| 35 | `prompt` whose value is `"https://x"` → `external-reference` (not `invalid-prompt`) | same | FR-016 precedence, R16 |
| 36 | `prompt` containing `"<b>why</b>"` → `ok`; the string is untouched | same | FR-015, SC-010a |
| 37 | `requestComposerText('a  b\n\nc')` → `composerRequest.text === 'a b c'` | `stores/chat.test.ts` | R15 |
| 38 | two `requestComposerText` calls with **identical** text → two distinct `seq` values | same | FR-029, SC-015 |
| 39 | `clearComposerRequest()` → `composerRequest === null` | same | FR-030 |
| 40 | `composerRequest` is absent from the persisted payload after a request is raised | same | FR-030, SC-017 |
| 41 | click on an item with a `prompt` → `requestComposerText` called once with that exact string | `ChatEChart.test.ts` | FR-023 |
| 42 | click where `params.data` is a bare number, `null`, or an array → `requestComposerText` **not** called | same | FR-027 |
| 43 | click params with no `data` at all (legend/axis shape) → not called, no throw | same | FR-027 |
| 44 | `source` prop updated twice, then **one** click → `requestComposerText` called **exactly once** | same | FR-029, SC-015, R17 — fails if the handler is bound per `setOption` |
| 45 | an `option` prop containing a valid `prompt` → hint rendered from `chat.echart.clickHint`, not a literal; an `option` without one → no hint | same | FR-028, FR-008, SC-016 |
| 45a | `option` prop replaced with one that has no prompts → the hint disappears without a re-mount | same | R18 — fails if the flag is passed in rather than derived |
| 46 | `seq` increments with empty `messageText` → textarea holds exactly the request text, `focus()` called | `MessageInput.test.ts` | FR-024 |
| 47 | `messageText` is `'existing'` → becomes `'existing <text>'`; nothing removed | same | FR-024, SC-014 |
| 48 | two increments in sequence → both appended, in order | same | FR-029 |
| 49 | a request applied → `clearComposerRequest()` called, and no send function is invoked | same | FR-025, SC-013, FR-030 |
| 50 | `disabled: true` → the text is still appended | same | edge case "actionable click while sending" |
| 51 | mount with a `composerRequest` already in the store → **no** insertion (it was cleared on consumption; a stale one must not replay) | same | SC-017 |

Scenario 29 is the regression guard for User Story 2 and should be written
**before** any edit to `MarkdownContent.vue`, so it pins current behaviour.

Scenario 44 is the one most likely to be skipped and most likely to break. It is
the only scenario that distinguishes a correct single binding from a handler
re-registered on every definition update, and the broken version passes every
other click scenario above.

`MessageInput.test.ts` and `stores/chat.test.ts` render and exercise the real
store — no store is mocked (Principle III). Scenarios 46–51 drive the store action
and assert on the rendered textarea, not on internals.

---

## Manual validation

Only for what jsdom cannot prove: real pixels, real network, real touch.

```bash
npm run dev
```

Then paste each definition below into a conversation (or seed it through the
agent) and check the stated outcome.

### M1 — chart renders, both themes, both viewports (US1, SC-001, SC-007)

````markdown
```echarts
{ "title": { "text": "Revenue by region" },
  "tooltip": {},
  "legend": {},
  "xAxis": { "type": "category", "data": ["North","South","East","West"] },
  "yAxis": { "type": "value" },
  "series": [{ "name": "Q4", "type": "bar", "data": [820, 932, 901, 1290] }] }
```
````

Expect: a rendered bar chart, no raw JSON. Toggle the theme from the profile page
— text, axes and gridlines stay legible **without** the chart flickering or
replaying its entry animation. Resize from 320 px to 2560 px — the chart reflows,
no horizontal overflow of the message bubble.

### M2 — no third-party requests (SC-009)

With DevTools → Network filtered to third-party origins, render M1 and then a
definition containing `"symbol": "image://https://example.com/a.png"`. Expect:
**zero** third-party requests, and the second block degrades to a code block.

### M3 — markup is inert, `<` is literal (SC-010a)

````markdown
```echarts
{ "tooltip": {},
  "xAxis": { "type": "category", "data": ["<script>alert(1)</script>", "Revenue < 100k"] },
  "yAxis": { "type": "value" },
  "series": [{ "type": "bar", "data": [1, 2] }] }
```
````

Expect: the chart renders. Both labels appear as visible literal text. No dialog.
Hovering a bar shows hover detail **inside** the chart area (plain, canvas-drawn,
clipped to the chart) — this is the intended R3 trade-off, not a defect.

### M4 — undrawable kind (SC-005, FR-019)

Change `"type": "bar"` to `"type": "definitelyNotAChartKind"`. Expect: a localized
error in the chart's position, the rest of the message unaffected, no blank gap.

### M5 — touch (FR-011)

On a real phone or device emulation with touch input: tap a bar (hover detail
appears), tap a legend entry (series toggles). Confirm hover detail never runs off
the edge of the screen.

### M6 — lazy load (FR-013, FR-014, SC-003, SC-004)

Hard-reload a conversation with **no** chart blocks: no `echarts` chunk in the
Network panel. Open a conversation **with** one: a loading indicator appears
immediately with no layout jump, the chunk downloads, the chart follows. Reload —
the chunk is cached and the chart appears within ~2 s.

### M7 — no accumulation (SC-008)

Scroll a conversation with ~50 chart-bearing messages past the viewport. Take a
heap snapshot: live ECharts instances should track what is mounted, not total
messages scrolled. Navigate away from the conversation — instances drop to zero.

### M8 — public/iframe mode (US4, FR-018)

Open a public conversation (`/chats/public/new/[agentId]`, `config.json` carrying
`publicAgentId`) and render M1. Expect: identical appearance to the
authenticated app.

### M9 — backward compatibility (US2, SC-002)

Open a stored conversation containing `chart.js` blocks, and a message containing
both a `chart.js` and an `echarts` block. Expect: the `chart.js` charts look and
behave exactly as before, and both render independently.

### M10 — diagnostics (SC-012)

With the console open, render an oversized definition, one with `image://`, one
with `title.link`, and one that fails to draw. Expect four records, each carrying
a reason and a block index. Read every record: **none** may contain an option key,
a label, a series name, a data value, or an engine error message (FR-022).

### M11 — print (edge case)

Print-preview a conversation containing a chart. Expect the chart present, or
cleanly absent — never a torn partial render.

### M12 — follow-up questions, pointer (US5, SC-013, SC-014, SC-016)

````markdown
```echarts
{ "tooltip": {},
  "series": [{ "type": "pie", "data": [
    { "name": "North", "value": 820, "prompt": "Break down North revenue by product" },
    { "name": "South", "value": 932, "prompt": "Why did South fall short of target?" },
    { "name": "East",  "value": 901 }
  ] }] }
```
````

Expect, in order:

1. The hint line appears beneath the chart, in the active locale.
2. Type `check this:` into the composer. Click the **North** slice — the composer
   reads `check this: Break down North revenue by product`, the caret is in the
   composer, and **nothing has been sent**.
3. Click **North** again — the question is appended a second time. (This is the
   check that catches a missing sequence number; with one, the second click is
   silently swallowed.)
4. Click **East** — the composer does not change.
5. Clear the composer, click **South**, and confirm the text appears with no
   leading space.
6. Then render M1 (which has no prompts): **no hint**, and clicking a bar changes
   nothing.

### M13 — follow-up questions, touch (FR-011, Principle V)

On a real phone, repeat M12 steps 2 and 4 by tapping. Confirm the composer gains
focus and the on-screen keyboard opens, and that the appended text is readable in
the single-line composer. Confirm the hint wording reads correctly for tapping —
it must not say "click".

### M14 — no accumulation across a definition update (SC-015, R17)

Render M12's definition, then have the same message re-render (switch
conversations and back, or toggle the theme, which re-merges the option). Click
**North** exactly once. Expect **one** insertion. Two or more means the click
handler is being re-registered.

### M15 — actionable click while sending (edge case)

In public mode, send a message so the composer is disabled, and click an
actionable slice before the reply arrives. Expect the text appended anyway,
waiting in the composer once sending completes — not dropped.

---

## Done when

- Every automated scenario above passes, and `typecheck` / `lint` / `test:run`
  are green.
- Coverage thresholds hold or are raised.
- M1–M15 confirmed manually, M10 read line by line.
- M12 step 3 and M14 confirmed specifically — they are the two manual checks that
  distinguish a correct implementation from a plausible broken one.
- `useChartJs.ts`, `ChatChart.vue` and `lib/validation/chart.ts` show **no diff**
  (FR-020, research.md R12).
