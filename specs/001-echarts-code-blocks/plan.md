# Implementation Plan: ECharts Code Blocks

**Branch**: `001-echarts-code-blocks` | **Date**: 2026-08-04 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/001-echarts-code-blocks/spec.md`

## Summary

Render fenced ```` ```echarts ```` blocks in message content as live Apache ECharts
charts, alongside the existing ```` ```chart.js ```` path which is left byte-for-byte
untouched. Data items the assistant marks with a follow-up question become
clickable, appending that question to the message composer so the chart becomes
the start of the next turn — never sending on the user's behalf.

The technical approach, in one line per decision (full reasoning in
[research.md](./research.md)):

- **Engine**: full `echarts@^6.1.0`, loaded by one dynamic `import()` inside a
  singleton composable. The full build rather than the tree-shaken one is forced
  by FR-019's ban on a chart-kind allowlist (R1).
- **Injection defence**: remove the sink rather than filter it — canvas renderer
  plus `tooltip.renderMode: 'richText'` forced at every depth, so chart-drawn text
  is pixels and can never be markup. Nothing inspects strings for markup, which is
  what lets ordinary labels containing `<` render as written (R2).
- **Safety validation**: one recursive walk rejecting external-resource values
  (`image://`, absolute schemes, protocol-relative) and navigation values (`link`,
  `sublink`) anywhere in the definition. `target` is deliberately *not* rejected —
  it is a sankey/graph edge endpoint (R4).
- **Structural validation**: size guard, `JSON.parse`, non-empty plain object.
  Nothing else — no chart kind check, no `series` requirement, no data caps, per
  FR-004/FR-019 (R5).
- **Update in place**: plain `setOption` on the same instance, gated on raw block
  text equality. `notMerge` and `replaceMerge` were both checked and rejected:
  each removes and recreates components, replaying entry animations (R7).
- **Theme**: merge colour options read from the app's existing CSS custom
  properties, re-applied on `useColorMode()` change — never an ECharts theme
  object, which would force a re-init per theme toggle (R8).
- **Independence**: three new files; existing files receive additive edits only.
  No shared code with the `chart.js` path (R12).
- **Click → composer**: an actionable data item carries a `prompt` key, read from
  the click params with no option transformation, validated in the same walk as
  the safety checks so a rendered chart's prompts are known good. It travels to
  `MessageInput` through a non-persisted, sequence-numbered one-shot value in the
  chat store, and is **appended and focused, never sent** (R15, R16). The click
  handler is bound once per instance, not per `setOption` — the alternative makes
  one click insert N times (R17).
- **Derive, don't report**: the parser returns the option alone. Whether a
  definition has actionable items is derived from it by an exported
  `hasActionableItems`, memoized in a `computed` — not returned alongside the
  parse and threaded through as a prop, which would let the claim drift from the
  option it describes. One exported `isValidPrompt` predicate serves the
  validator, that query, and the click handler, so the three cannot disagree (R18).

## Technical Context

**Language/Version**: TypeScript 5.x (strict), Vue 3.5 SFC / `<script setup>`,
Nuxt 4 SPA (`ssr: false`)

**Primary Dependencies**: new — `echarts@^6.1.0` (runtime dependency, dynamically
imported). Existing and reused — `zod` (structural check), `neverthrow`
(`Result`), `@vueuse/core` v14 (`useResizeObserver`), `markdown-it` (fence →
`language-echarts`), `dompurify` via `app/utils/sanitize.ts`, `@nuxtjs/color-mode`
via `@nuxt/ui` (`useColorMode`), `lib/utils/logger.ts`

**Storage**: No persisted state, no server state, no Vue Query cache entry.
Charts exist only for the lifetime of a rendered message. One piece of
**non-persisted** Pinia state is added — the composer request (`app/stores/chat.ts`,
deliberately outside `persist.pick`), which is the only thing that outlives a
chart instance, and only until the composer consumes it.

**Testing**: Vitest + Testing Library via `renderWithProviders`; `echarts` mocked
as a third-party rendering library (jsdom has no canvas), following the
`FakeChart` precedent in `tests/unit/composables/useChartJs.test.ts`. No MSW
handler changes — this feature adds no HTTP call.

**Target Platform**: Browsers, desktop and mobile, 320 px–2560 px; both
Authenticated and Public/iframe operating modes.

**Project Type**: Nuxt 4 SPA frontend (single project)

**Performance Goals**: chart visible within 2 s of its message appearing on a
mid-range mobile once the engine chunk is cached; first-ever chart within 5 s on
typical broadband, with the loading indicator immediate (SC-003). Zero added
bytes for conversations with no chart blocks (SC-004).

**Constraints**: 50 000-character cap per definition; 500-character cap per
follow-up question; zero third-party network requests (SC-009); no chart
re-initialization on re-render or theme change (SC-008a); no definition content in
any log record (FR-022); no message ever sent by a chart interaction (SC-013).

**Scale/Scope**: 3 new files, 6 additive edits (2 of them one-liners), 7 test
files, 3 i18n keys × 2 locales. Up to ~50 concurrent chart-bearing messages per
conversation.

No `NEEDS CLARIFICATION` remains — the spec's clarification session resolved the
four open questions, and research.md resolved the rest.

## Constitution Check

*GATE: evaluated before Phase 0, re-checked after Phase 1 design. Both passes
recorded below.*

- **I. Layered Architecture** — **PASS**. No server state is introduced, so no
  query/mutation composable or service is involved and none is bypassed.
  Validation is a pure helper in `lib/validation/` beside the existing
  `chart.ts` / `table.ts`; engine lifecycle is a composable in
  `app/composables/`; rendering is a component in `app/components/chat/`. No
  component imports a service or `apiClient`. Placement mirrors the existing
  `chart.js` path exactly, which is the "Where to Put New Code" answer for this
  shape of feature. The composer request is cross-component UI state shared
  between two components with no ancestor relationship, which is exactly what the
  layer diagram assigns to a Pinia store (`Pinia Stores ↔ Composables + Pages`);
  it extends the existing `chat` store rather than adding one, and `MessageInput`
  already consumes that store directly (`MessageInput.vue:174`). No new layer, no
  layer skipped.

- **II. Typed Result Error Handling** — **PASS with one recorded deviation**.
  `parseEChartsOption` returns `Result<EChartsOption, EChartsRejection>` and never
  throws; the boundary is validated with Zod; nothing fails silently — every
  rejection and every draw failure is logged (FR-021), and the user always sees
  either a code block or a localized error, never a blank gap. `npm run typecheck`
  must pass. **Deviation**: the error type is a closed union of reason codes, not
  an `AppError`. Justified in Complexity Tracking.

- **III. Network-Boundary Testing** — **PASS**. No store, service or `apiClient`
  is mocked anywhere — notably the composer-request tests exercise the **real**
  chat store through `renderWithProviders` and assert on the rendered textarea,
  not on store internals. The only mock is the `echarts` module itself — a
  third-party renderer needing a real canvas, the same category as the
  already-mocked `chart.js` and `shiki`. Because the feature adds no HTTP call,
  the MSW boundary is untouched and `onUnhandledRequest: 'error'` continues to
  hold. Coverage thresholds hold or rise; the plan adds five new test files and
  edits two existing ones.

- **IV. Bilingual by Default** — **PASS**. Three new keys
  (`chat.echart.loading`, `chat.echart.renderFailed`, `chat.echart.clickHint`)
  added to `en.json` and `hu.json` in the same change. No user-facing literal in
  any component. The error string is deliberately generic so it cannot leak an
  engine message (FR-022). `clickHint` is worded device-neutrally ("select", not
  "click"/"tap") so one string serves both input models. The follow-up question
  text itself is **not** an i18n concern — it arrives in the message, authored in
  the conversation's own language. Pre-existing hardcoded English in
  `ChatChart.vue` is out of scope per spec Assumptions and per FR-020's
  don't-touch rule.

- **V. Dual-Mode & Cross-Device** — **PASS**. The render path reads no token, no
  storage and no transport, so it is mode-agnostic by construction; M8 in
  quickstart.md verifies public/iframe mode explicitly (FR-018). Touch is
  first-class: ECharts handles pointer and touch through ZRender, and forcing
  `richText` keeps hover detail inside the canvas so it cannot run off a narrow
  screen (R10). Resize is driven by `ResizeObserver` on the container, not by
  `window` resize, so a collapsing side panel reflows correctly. `auth.global.ts`
  is not touched — this feature makes no routing or auth decision. The click
  interaction is verified on touch (M13) as well as pointer (M12), and works in
  public mode: `MessageInput`'s `disabled` prop suppresses *sending*, not typing,
  so an activation during a pending public send queues the text rather than
  dropping it (M15).

**Security & Fragile-Area Constraints** — the new `data-echart-id` attribute is an
explicit, audited addition to `ALLOWED_ATTR` in `app/utils/sanitize.ts`
(`ALLOW_DATA_ATTR` is `false`, so unlisted `data-*` is stripped). No client-side
password hashing is involved. None of the four fragile areas listed in
`innochat-concerns` (token-refresh interceptor, `useSendMessage` optimistic cache,
SignalR listener registration, primary-session detection) is touched.

The click interaction adds one path by which assistant-authored text reaches a
user-input surface, so it is called out explicitly rather than left implicit:

- The text is **appended to the composer, never sent** (FR-025). A human sees it
  and presses send, or does not. This is the containment boundary, and no
  configuration or definition value can move it.
- The text is bounded and validated **before** render (FR-026), so the click path
  has no rejection branch and cannot be made to insert something unexpected.
- It reaches a plain text field, not markup and not a link — the existing
  `sanitizeHTML` boundary is not involved because nothing is rendered as HTML.
- The channel is not persisted and is consumed once (FR-030), so nothing can
  replay into a composer the user did not just interact with.
- ECharts click-handler registration is the **same failure class** as the
  `innochat-concerns` SignalR listener-registration entry — handlers accumulate on a
  long-lived object. R17 binds once per instance, and quickstart scenario 44
  asserts the count rather than mere firing, because the accumulating version
  passes every other click test.

**Post-Phase-1 re-check**: all five gates still PASS. The click-action amendment
added Principle I and V surface (a Pinia value; touch and public-mode paths) and
one i18n key, all of which follow existing patterns in the same files. No new
deviation was introduced — the Complexity Tracking table below still has exactly
two rows. The Phase 1 contracts in fact *reduced* risk against Principle II by
making FR-022 structurally unviolatable (the rejection type has no free-form
field at all), and the amendment extended that same closed union with
`invalid-prompt` rather than widening it to carry a message.

## Project Structure

### Documentation (this feature)

```text
specs/001-echarts-code-blocks/
├── spec.md              # Feature specification (/speckit-specify)
├── plan.md              # This file (/speckit-plan)
├── research.md          # Phase 0 output — 18 decisions, all unknowns resolved
├── data-model.md        # Phase 1 output — client-side entities + invariants
├── quickstart.md        # Phase 1 output — 54 automated + 15 manual scenarios
├── contracts/
│   ├── echarts-block.md # Phase 1 — the agent-facing block contract
│   └── internal-api.md  # Phase 1 — module surfaces to implement against
├── checklists/
│   └── requirements.md  # Pre-existing (/speckit-checklist)
└── tasks.md             # Phase 2 (/speckit-tasks — NOT created here)
```

### Source Code (repository root)

```text
lib/
├── validation/
│   ├── chart.ts            # UNTOUCHED — chart.js path (FR-020)
│   └── echarts.ts          # NEW — parseEChartsOption + safety walk
└── utils/logger.ts         # reused as-is

app/
├── composables/
│   ├── useChartJs.ts       # UNTOUCHED — chart.js path (FR-020)
│   └── useECharts.ts       # NEW — lazy load, init, hardened applyOption
├── components/chat/
│   ├── ChatChart.vue       # UNTOUCHED — chart.js path (FR-020)
│   ├── ChatEChart.vue      # NEW — lifecycle, resize, theme, click, error/loading
│   ├── MarkdownContent.vue # EDIT (additive) — extraction pass + Teleport
│   └── MessageInput.vue    # EDIT (additive) — one watcher: append + focus
├── stores/chat.ts          # EDIT (additive) — composerRequest, NOT in persist.pick
└── utils/sanitize.ts       # EDIT (one line) — data-echart-id in ALLOWED_ATTR

i18n/locales/
├── en.json                 # EDIT — chat.echart.{loading,renderFailed,clickHint}
└── hu.json                 # EDIT — same keys

tests/unit/
├── lib/validation/echarts.test.ts        # NEW
├── composables/useECharts.test.ts        # NEW
├── components/chat/ChatEChart.test.ts    # NEW
├── stores/chat.test.ts                   # NEW or EDIT — composer request channel
├── components/chat/MessageInput.test.ts  # NEW or EDIT — append/focus/no-send
├── components/chat/MarkdownContent.test.ts # EDIT — new cases + regression guard
└── utils/sanitize.test.ts                # EDIT — data-echart-id survives

package.json                # EDIT — echarts ^6.1.0 in dependencies
```

**Structure Decision**: The existing Nuxt 4 single-project layout is used
unchanged. Placement is dictated by the three-layer split the `chart.js` path
already demonstrates — pure validation in `lib/validation/`, engine lifecycle in
`app/composables/`, rendering in `app/components/chat/` — so a reviewer can diff
the new path against the old one file for file. The six edited files receive
strictly additive changes; the three files constituting the `chart.js` path are
listed above explicitly as untouched, because "no diff in those three files" is
the cheapest available proof of FR-020 and SC-002.

The two edits the click action adds are both small and local: a
ref-plus-two-actions addition to `chat.ts` alongside the existing draft actions,
and a single `watch` in `MessageInput.vue` next to the existing
voice-transcription append it mirrors. Neither touches the draft mechanism, the
typing-indicator watcher, or the send path.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| Constitution II: `parseEChartsOption` returns `Result<T, EChartsRejection>` where the error is a closed union of reason codes, not an `AppError` | FR-022 forbids any part of a chart definition reaching a log record. A reason-code union has no free-form field, so the leak is structurally impossible rather than merely avoided by discipline. FR-021 simultaneously requires a *reason*, which the existing `parseChartConfig`'s `T \| null` cannot carry. | `ValidationError extends AppError` carries `message: string` and `details?: unknown` — precisely the two fields into which a label, series name or data value would inevitably drift, especially once a future contributor wants a more helpful log line. `AppError` is also defined as "the error currency crossing the **service** boundary"; this is a pure validation helper in `lib/validation/`, so no service boundary is crossed and no caller expects `AppError`. Returning `T \| null` to match `parseChartConfig` was also rejected: it cannot satisfy FR-021. |
| Full `echarts` bundle instead of the tree-shaken `echarts/core` build | FR-019 forbids an allowlist of chart kinds and SC-011 requires a new chart kind to render with no client release. The tree-shaken build only draws kinds registered at compile time, so it *is* an allowlist. | Not a complexity the plan can remove — the spec's Assumptions section already weighs and accepts this trade ("Accepting every chart kind means shipping the charting capability whole"). Mitigated, not eliminated: the chunk is dynamically imported so it is absent for chart-free conversations (SC-004) and cached after first use (SC-003). |

Recorded for transparency, not as accepted debt: the `chart.js` path's
theme-colour bug — CSS custom properties read once at module load into
`Chart.defaults`, so it never reacts to a theme change — is **not** fixed here.
FR-020 requires that path stay untouched and the constitution requires surgical
changes. The new path must not copy the pattern (research.md R8).
