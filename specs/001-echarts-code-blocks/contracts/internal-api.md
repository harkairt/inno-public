# Contract: internal module surfaces

**Feature**: `001-echarts-code-blocks`

Signatures the implementation must expose, so tasks can be written and tested
against them independently. Layer placement follows the constitution's
Layered Architecture principle: validation in `lib/`, engine lifecycle in a
composable, rendering in a component, cross-component UI state in the existing
Pinia store. No service and no query — this feature touches no server state.

---

## `lib/validation/echarts.ts`

```ts
import { type Result } from 'neverthrow'

export type EChartsOption = Record<string, unknown>

export type EChartsRejectionReason =
  | 'oversize'
  | 'unparseable'
  | 'not-an-object'
  | 'external-reference'
  | 'navigation-target'
  | 'invalid-prompt'

export interface EChartsRejection {
  reason: EChartsRejectionReason
}

export const MAX_PROMPT_LENGTH = 500

/**
 * The single definition of "an actionable item's follow-up question".
 * Exported because three call sites must agree on it and must not each decide.
 */
export const isValidPrompt = (value: unknown) => value is string

/** Derives the FR-028 hint's visibility. Pure; safe to memoize on the option. */
export const hasActionableItems = (option: EChartsOption) => boolean

/**
 * Pure. No side effects, no logging — the caller owns the log record so that the
 * block index (which this function cannot know) travels with the reason.
 */
export const parseEChartsOption = (
  json: string,
) => Result<EChartsOption, EChartsRejection>
```

`isValidPrompt` is `typeof value === 'string' && value.trim().length > 0 &&
value.length <= MAX_PROMPT_LENGTH`. It is the **only** place that predicate is
written. `parseEChartsOption` uses it to reject (rule 6), `hasActionableItems`
uses it to count, and the click handler uses it to guard — so the three can never
disagree about what an actionable item is.

**Behavioural contract**

| Input | Result |
|---|---|
| body > 50 000 chars | `err({ reason: 'oversize' })` — checked *before* parsing |
| not valid JSON | `err({ reason: 'unparseable' })` |
| `"[]"`, `"3"`, `"null"`, `"{}"`, `'""'` | `err({ reason: 'not-an-object' })` |
| contains `"image://…"` at any depth | `err({ reason: 'external-reference' })` |
| contains `{ "link": "…" }` or `{ "sublink": "…" }` at any depth | `err({ reason: 'navigation-target' })` |
| contains a `prompt` failing `isValidPrompt` | `err({ reason: 'invalid-prompt' })` |
| anything else | `ok(parsed)` — byte-identical to `JSON.parse` output |

The prompt check rides on the **same recursive walk** as the external-reference
and navigation checks — one traversal, three predicates. A `prompt` whose value
starts with a URL is caught by the external-reference predicate first; that
ordering is fine (research.md R16).

`parseEChartsOption` returns the option and nothing else. Whether the definition
*has* actionable items is not a fact about the parse — it is a fact about the
option, so it is derived from the option where it is needed via
`hasActionableItems`, not reported alongside it (research.md R18).

**Must NOT**: throw; log; mutate the parsed object; inspect any string for
markup; require `series`; validate chart kind; cap data-point counts; strip,
rewrite or normalize a `prompt` value (normalization happens in the store — the
option handed to the engine keeps the authored text).

`MAX_OPTION_JSON_SIZE = 50_000` is declared locally, **not** imported from
`lib/validation/chart.ts` — the two paths stay independent (FR-020).

---

## `app/composables/useECharts.ts`

Module-level singleton, shaped exactly like `useChartJs` / `useShiki`.

```ts
export const useECharts: () => {
  isLoading: Ref<boolean>
  isLoaded: Ref<boolean>

  /** Idempotent; concurrent callers share one in-flight promise. */
  loadECharts: () => Promise<boolean>

  /** null if the module is not loaded or init throws. */
  initChart: (el: HTMLElement) => EChartsInstance | null

  /**
   * Merges the theme colour base, then the hardened definition.
   * Plain merge — no notMerge, no replaceMerge (research.md R7).
   * Returns false if the engine threw.
   */
  applyOption: (
    instance: EChartsInstance,
    option: EChartsOption,
    isDark: boolean,
  ) => boolean
}
```

**Behavioural contract**

- `loadECharts()` performs exactly one `await import('echarts')` per page load.
  Returns `true` when the module is available, `false` on failure; never throws;
  never rejects.
- `initChart(el)` calls `echarts.init(el, null, { renderer: 'canvas' })`. The
  canvas renderer is non-negotiable (FR-015).
- `applyOption(...)` forces `renderMode: 'richText'` onto every `tooltip` object
  at any depth of the definition, including inside `media[].option`,
  `baseOption` and `options[]`. It merges the theme colour base **under** the
  definition, so an explicit colour in the definition wins (FR-004).
- On an engine throw, `applyOption` returns `false` and logs `{ blockIndex }`
  only. **The caught error object is never passed to the logger** — ECharts
  messages embed offending option values (FR-022, research.md R14).

**Must NOT**: import `echarts` statically at module top level (that would defeat
FR-013 / SC-004); read CSS custom properties once at module scope (the bug
`useChartJs` has — see research.md R8); mutate the caller's option object.

---

## `app/components/chat/ChatEChart.vue`

```ts
interface Props {
  option: EChartsOption
  /** 0-based position of the block in its message; the only log identifier. */
  blockIndex: number
  /** Raw block body; change-detection key for FR-012a. */
  source: string
}

const hasPrompts = computed(() => hasActionableItems(props.option))
```

Renders exactly one of three states: loading indicator, localized error, or the
chart container — plus, when `hasPrompts` is true, the `chat.echart.clickHint`
line beneath the container.

`hasPrompts` is **derived from `props.option`**, not passed in. It is a function of
the very object being rendered, so it cannot drift out of step with it, and
`MarkdownContent` has nothing extra to thread through. `computed` memoizes it, so
the traversal runs once per distinct option rather than once per render.

**Behavioural contract**

| Trigger | Behaviour |
|---|---|
| mount, engine not loaded | show loading indicator, `await loadECharts()` |
| engine becomes available | `initChart` + `applyOption` once |
| `source` changes | `applyOption` on the **existing** instance |
| `source` unchanged (message re-renders) | **no engine call at all** |
| `useColorMode().value` changes | re-merge the theme base on the existing instance — no re-init |
| container resizes (`useResizeObserver`) | `instance.resize()` |
| `onBeforeUnmount` | `instance.dispose()`, exactly once |
| `loadECharts` returns false, or `init`/`applyOption` fails | show localized error |
| click on a data item carrying a `prompt` | `chatStore.requestComposerText(prompt)` |
| click on any other part of the chart | nothing — native behaviour only |

The click handler is registered **once**, immediately after `initChart`:

```ts
instance.on('click', (params) => {
  const item = params.data
  if (typeof item !== 'object' || item === null || Array.isArray(item)) return
  const prompt = (item as Record<string, unknown>).prompt
  if (!isValidPrompt(prompt)) return
  chatStore.requestComposerText(prompt)
})
```

No `componentType` check: legend and axis clicks carry no `data`, so they fall
through and keep their native behaviour (FR-027).

The guard uses the same `isValidPrompt` the validator used, so it is defence in
depth at zero duplication cost — `parseEChartsOption` already guaranteed validity
(FR-026), and this cannot disagree with it. It also gives the handler its
narrowing to `string` for free.

**Must NOT**: call `dispose()` anywhere except `onBeforeUnmount`; call `init()`
more than once per mount; render a hardcoded English string; touch the instance
after `dispose()`; register the click handler anywhere in the `applyOption` path
— handlers survive `setOption`, so re-registering per update makes one click
raise N requests (research.md R17, FR-029).

---

## `app/stores/chat.ts` (additive edit)

```ts
interface ComposerRequest { text: string, seq: number }

const composerRequest = ref<ComposerRequest | null>(null)

/** Appends `text` to the message composer. Never sends. */
function requestComposerText(text: string): void

/** Called by the composer once it has applied a request. */
function clearComposerRequest(): void
```

**Behavioural contract**

- `requestComposerText` collapses newlines and runs of whitespace to single
  spaces, then sets `composerRequest` with a **strictly increasing** `seq`. Two
  calls with identical text produce two distinct values — this is what makes a
  repeat click append a second time (FR-029, SC-015).
- A whitespace-only argument is a no-op. `parseEChartsOption` already rejects
  those, so this is defence in depth, not a reachable path.
- No length cap here — rule 6 in data-model.md already bounds it.

**Must NOT**: appear in `persist.pick` (FR-030, SC-017); touch `draftMessages`,
`failedMessages` or `activeSessionId`; send anything; know that charts exist —
the action's contract is "put this text in the composer", and the caller happens
to be a chart.

The existing `saveDraft`/`getDraft`/`clearDraft` actions are **not** reused or
modified: the draft mechanism is read only on mount, overwritten by the
composer's own debounced save, and persisted (research.md R15).

---

## `app/components/chat/MessageInput.vue` (additive edit)

```ts
watch(() => chatStore.composerRequest?.seq, () => {
  const request = chatStore.composerRequest
  if (!request) return
  const current = messageText.value.trim()
  messageText.value = current ? `${current} ${request.text}` : request.text
  chatStore.clearComposerRequest()
  focus()
})
```

**Behavioural contract**

- Watches `seq`, **not** the request object or its `text` — see the store contract
  above.
- Append-and-focus mirrors the existing voice-transcription behaviour at
  `MessageInput.vue:269-270` exactly, including the `trim()`-then-space join.
- Fires even while `props.disabled` is true (public mode, send in flight). The
  text is queued in the composer for when sending completes; suppressing it would
  lose the user's click (spec edge case).
- The existing `watchDebounced` draft save and the SignalR typing watcher both
  observe `messageText` and therefore fire as they would for typed text. That is
  correct and needs no special handling — but note the consequence: the appended
  text **is** saved as a draft by the ordinary 500 ms save. FR-030 protects the
  *channel*, not the composer's contents: what must never happen is text reaching
  persisted storage without having been shown. Once it is on screen the user can
  edit or clear it, and a draft save is what any other composer content gets.

**Must NOT**: send; replace or clear existing `messageText`; add a second draft
mechanism; special-case charts (the watcher knows only about text).

---

## `app/components/chat/MarkdownContent.vue` (additive edits only)

```ts
const hasEChartsBlocks: (content: string | null | undefined) => boolean

interface EChartEntry { id: string; index: number; source: string; option: EChartsOption }
const extractEChartsBlocks: (html: string) => { html: string; entries: EChartEntry[] }
```

- `hasEChartsBlocks` requires both an opening ```` ```echarts ```` fence and a
  subsequent closing fence, mirroring `hasChartBlocks` — an unterminated block is
  not a chart (edge case "unterminated block").
- `extractEChartsBlocks` matches
  `/<pre><code\s+class="language-echarts">([\s\S]*?)<\/code><\/pre>/g`, decodes
  entities with the existing `decodeHtmlEntities`, and on `ok` replaces the match
  with `<div class="echart-placeholder" data-echart-id="{id}"></div>`. On `err`
  it returns `match` unchanged **and** logs `{ reason, index }`.
- Runs **before** Shiki highlighting and before `sanitizeHTML`, alongside the
  existing table / pivot / chart passes.
- `id` is `` `${instancePrefix}-echart-${index}` ``, with `instancePrefix` from
  the existing `useId()`.
- A `<Teleport :to="`[data-echart-id='${e.id}']`" :defer="true">` per entry,
  keyed by `e.id`, matching the three existing block types.
- `onMounted` calls `loadECharts()` only when `hasEChartsBlocks(props.content)`.
- `watch(echartsLoaded)` re-runs `renderContent()` only when
  `echartEntries.value.length > 0`, mirroring the existing `chartJsLoaded` watch.

**Must NOT**: alter, reorder or share code with the `chart.js`, `rows`,
`h-rows` or `pivot` passes (FR-020, SC-002).

---

## `app/utils/sanitize.ts` (one-line edit)

Add `'data-echart-id'` to `ALLOWED_ATTR`.

`ALLOW_DATA_ATTR` is `false`, so an unlisted `data-*` attribute is stripped and
the `Teleport` target would silently never exist — the chart would simply never
appear, with no error. This is the deliberate allowlist audit required by the
constitution's security constraints and the spec's Dependencies section.

---

## `i18n/locales/{en,hu}.json`

Added to **both** files, same keys, same nesting (FR-008, SC-006):

| Key | English | Hungarian |
|---|---|---|
| `chat.echart.loading` | Loading chart… | Diagram betöltése… |
| `chat.echart.renderFailed` | This chart could not be displayed. | Ezt a diagramot nem sikerült megjeleníteni. |
| `chat.echart.clickHint` | Select a data point to ask about it | Válassz egy adatpontot a kérdéshez |

The error text is deliberately generic: it must not leak an engine message or any
part of the definition (FR-022). Existing hardcoded English strings in
`ChatChart.vue` are pre-existing and out of scope (spec Assumptions).

`clickHint` is worded **device-neutrally** — "select", not "click" or "tap" — since
the same string serves pointer and touch (Principle V, FR-011).
