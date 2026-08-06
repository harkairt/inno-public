# Phase 1 Data Model: ECharts Code Blocks

**Feature**: `001-echarts-code-blocks` | **Date**: 2026-08-04

No persisted data and no server state are introduced. Every entity below is
client-side and lives only for as long as its message is rendered. Entity names
map 1:1 onto the Key Entities in [spec.md](./spec.md).

---

## `EChartsBlock`

A fenced ```` ```echarts ```` code block found in one message's content.

| Field | Type | Notes |
|---|---|---|
| `id` | `string` | `` `${instancePrefix}-echart-${index}` `` where `instancePrefix` comes from Vue's `useId()`. Stable across re-renders of the same component instance, unique across sibling messages. Used as the `Teleport` target selector and as the `blockIndex` in logs. |
| `index` | `number` | 0-based position among the `echarts` blocks of this message. The content-free block identifier required by FR-021. |
| `source` | `string` | The raw, entity-decoded block body. Retained solely as the change-detection key for FR-012a (R7): `setOption` is called only when `source` differs from the value last applied. |
| `option` | `EChartsOption` | The validated definition. Present only on the success path. |

There is deliberately **no** `hasPrompts` field. Whether a definition has
actionable items is a function of `option`, so it is derived where it is needed
rather than stored beside the thing it describes (research.md R18).

**Lifecycle**: created during `renderContent()` in `MarkdownContent.vue`;
discarded wholesale when `props.content` changes or the component unmounts. A
block whose validation fails produces **no** `EChartsBlock` — its markup is left
in place so it degrades to a plain code block (FR-006).

**Invariant**: `id` is derived from `useId()` and never from message content, so
two messages containing byte-identical chart blocks cannot collide on a
`Teleport` target.

---

## `EChartsOption`

The validated chart definition, passed to the engine unmodified apart from the
FR-015 hardening.

```ts
type EChartsOption = Record<string, unknown>
```

**Deliberately opaque.** FR-004 forbids enumerating, restricting or transforming
presentation options, and FR-019 forbids an allowlist of chart kinds, so there is
no field-level schema to write. `Record<string, unknown>` is the honest type: it
states "an object whose keys we do not model", which is exactly the contract.

### Validation rules (in evaluation order)

| # | Rule | Rejection reason | Requirement |
|---|---|---|---|
| 1 | `source.length <= 50_000` | `oversize` | FR-005 |
| 2 | `JSON.parse(source)` does not throw | `unparseable` | FR-004 |
| 3 | result is a non-null, non-array object with ≥1 key | `not-an-object` | FR-004, edge case "empty block" |
| 4 | no external resource reference anywhere (see `UnsafeValue`) | `external-reference` | FR-016 |
| 5 | no navigation target anywhere (see `UnsafeValue`) | `navigation-target` | FR-017 |
| 6 | every `prompt` key satisfies `isValidPrompt` (see `ActionableItem`) | `invalid-prompt` | FR-026 |

Rules 4, 5 and 6 are evaluated by one recursive walk; the first hit wins and
reports its own reason. Because rule 4 tests every string value regardless of
key, a `prompt` beginning with a URL is reported as `external-reference` rather
than `invalid-prompt` — either way the definition is refused, and reason codes
are diagnostic only (research.md R16).

**Explicitly not validated**: chart kind, presence of `series`, presence of axes,
data-point counts, colour formats, or any other option key. An option that
passes rules 1–5 but cannot be drawn is the engine's problem and surfaces as a
localized error (FR-007, FR-019).

### Hardening applied after validation, before drawing

| Applied | Value | Overridable by the definition? | Requirement |
|---|---|---|---|
| Renderer | `'canvas'`, set at `init` | No | FR-015 |
| `renderMode` on every `tooltip` object, at any depth | `'richText'` | No | FR-015 |
| Theme colour base (text, axis, split-line, background) | from CSS custom properties | Yes — merged *under* the definition | FR-009, FR-004 |

The recursion for `tooltip` mirrors the safety walk's recursion so that
`media[].option`, `baseOption` and `options[]` (timeline) are covered — a tooltip
nested inside a responsive breakpoint is hardened identically to a top-level one.

---

## `UnsafeValue`

Not a runtime type — the predicate that rules 4 and 5 apply to every node of the
parsed definition. Recorded here because its exact shape is the feature's
security boundary.

### External resource (`external-reference`)

A **string** value that, after `trim()`, starts with any of:

| Pattern | Why | Verified sink |
|---|---|---|
| `image://` | ECharts' documented external-resource prefix | `series.symbol`, `markPoint.data[].symbol`, `itemStyle.decal.symbol`, `toolbox.feature.*.icon` |
| `http:` `https:` `ftp:` `ftps:` `ws:` `wss:` `file:` `blob:` | absolute remote reference | `textStyle.backgroundColor.image`, `graphic` `type: 'image'` → `style.image` |
| `data:` | not third-party, but an SVG data URI drawn as an image is an execution vector; FR-017 names script-bearing schemes | same as above |
| `javascript:` `vbscript:` | script-bearing scheme | any value reaching a resource or link resolver |
| `//` | protocol-relative URL | same as the absolute schemes |

### Navigation target (`navigation-target`)

An object carrying key `link` or `sublink` whose value is a non-empty string
(documented on `title`: `link`, `target`, `sublink`, `subtarget`).

`target` and `subtarget` are **not** rejected on key name: `target` is also an
edge endpoint in `series-sankey` and `series-graph` (`links[].target`), so
rejecting the key would reject those chart kinds outright, breaking FR-019.
Neither can navigate without an accompanying `link`.

### Traversal rules

- Recurses through plain objects and arrays; every string value is tested,
  whatever its key or depth (FR-016's "unusual position" edge case).
- Patterns are anchored at the **start** of the value. A resource reference is
  always the entire value, so anchoring loses no coverage while keeping FR-015's
  promise for prose: `Revenue < 100k` and `see http://wiki for detail` are both
  untouched.
- Cycles are impossible — the input is always fresh `JSON.parse` output.

### Deliberately not an `UnsafeValue`

**Markup.** Per FR-015 and the clarification session, markup is disarmed by *how*
text renders (canvas + `richText`), never by detection. No string is ever
inspected for `<`, and no definition is ever rejected for containing
markup-shaped text (SC-010a).

**Accepted false positive**: a label whose entire text is a URL rejects the
definition. FR-016 is unconditional and SC-010 tolerates over-rejection but not
under-rejection, so this is the correct direction to err; the rejection is logged
(FR-021) and therefore discoverable.

---

## `ActionableItem`

Not a runtime type either — a data item inside the definition that carries a
follow-up question. Recognised by one key:

```json
{ "name": "North", "value": 820, "prompt": "Break down North revenue by product" }
```

| Aspect | Rule |
|---|---|
| Key | `prompt`, on a data item object at any depth |
| Type | `string`; anything else rejects the definition (`invalid-prompt`) |
| Max length | 500 characters; longer rejects the definition (`invalid-prompt`) |
| Empty / whitespace-only | rejects the definition (`invalid-prompt`) — an item that looks actionable but does nothing is worse than an inert one |
| Transformation | none at parse time; whitespace is collapsed when the request is raised (research.md R15) |
| Read at click time as | `params.data.prompt`, guarded for the array-form case where `params.data` is a bare number |

The three rows above are one predicate, `isValidPrompt`, written once and used by
the validator, by `hasActionableItems`, and by the click handler. Recorded as a
single definition on purpose: three independent transcriptions of "a non-empty
string of at most 500 characters" would eventually disagree, and the disagreement
would show up as an item that renders a hint but does nothing when clicked.

**Not markup, not a link.** A prompt is plain text placed in a text field. It is
never rendered as HTML and never navigated to, so a prompt containing `<b>` or a
question mark is unremarkable — it arrives in the composer as those literal
characters.

**Array-form data cannot carry a prompt.** `"data": [820, 932]` has no object to
hang the key on, so a bar or line series wanting actionable items must use
object-form items (`{ "value": 820, "prompt": "…" }`). This is an ECharts fact,
not a client restriction, and belongs in the producer contract.

**Bounded by construction**: because rule 6 runs before render, a drawn chart is
one whose every prompt is a usable string. The click handler still applies
`isValidPrompt` — not because it might fail, but because reusing the predicate is
cheaper than justifying its absence, and it supplies the `string` narrowing the
handler needs anyway (research.md R16).

---

## `ComposerRequest`

The one-shot channel carrying text from an `ActionableItem` to the message
composer.

```ts
interface ComposerRequest {
  text: string
  seq: number
}
```

| Field | Notes |
|---|---|
| `text` | The prompt with whitespace collapsed. Already length-bounded by rule 6. |
| `seq` | A monotonically increasing number, unique per activation. |

**Why `seq` exists**: activating the same item twice must append twice (FR-029,
SC-015). Without a changing field the second write would be value-identical, the
watcher would not fire, and the second click would silently do nothing.
`seq` — not `text` — is what the composer watches.

**Lifecycle**

```text
(none) ──item activated──▶ { text, seq: n }
{ text, seq: n } ──composer appends + focuses──▶ (none)
{ text, seq: n } ──item activated again──▶ { text, seq: n+1 }
```

**Invariants**

- Lives in the chat store, **outside** `persist.pick`, and is consumed exactly
  once — the composer clears it after applying (FR-030, SC-017). Together these
  mean a request cannot be replayed: not by a re-render, not by a composer
  mounting later, not by a reload.
- What FR-030 protects is the **channel**, not the composer's contents. Once the
  text is on screen it is ordinary composer content: the existing debounced draft
  save persists it exactly as it would text the user typed, and that is correct —
  the user can see it, edit it, or clear it. The failure mode being excluded is
  text reaching persisted storage *without ever having been shown*, which is
  precisely what using the draft store as the channel would have caused
  (research.md R15).
- Carries no `sessionId`, because one composer is mounted per view (spec
  Assumptions). A split-view layout would require addressing.
- Carries no send instruction and cannot cause one (FR-025, SC-013). Appending to
  the composer is the entire effect.
- Never derived from chart data or user input — only from a `prompt` the assistant
  authored.

---

## `EChartsRejection`

The content-free reason a definition was refused.

```ts
type EChartsRejectionReason =
  | 'oversize'
  | 'unparseable'
  | 'not-an-object'
  | 'external-reference'
  | 'navigation-target'
  | 'invalid-prompt'

interface EChartsRejection {
  reason: EChartsRejectionReason
}
```

**Invariant (FR-022)**: the type has no free-form field. There is no `message`,
no `details`, no `path`, no offending value — so no label, series name or data
value can travel into a log record even by mistake. This is why the rejection
type is not an `AppError` (see research.md R6 and plan.md Complexity Tracking).

A rejection is paired with the block's `index` at the log call site, giving
FR-021 its two required facts — the reason and which block — and nothing else.

---

## `RenderedEChart`

The live engine instance bound to one `EChartsBlock`.

| State | Meaning | User sees |
|---|---|---|
| `loading` | the engine module is still downloading | localized loading indicator, container holding its height (FR-014) |
| `drawn` | `setOption` succeeded | the chart |
| `failed` | `init` or `setOption` threw | localized error message (FR-007) |

**Transitions**

```text
loading ──engine loaded, setOption ok──▶ drawn
loading ──engine load failed, or init/setOption threw──▶ failed
drawn   ──block.source changed──▶ drawn        (setOption on the SAME instance)
drawn   ──block.source unchanged──▶ drawn      (no call at all — FR-012a)
drawn   ──theme changed──▶ drawn               (colour base re-merged, no re-init)
drawn   ──container resized──▶ drawn           (instance.resize())
drawn   ──actionable item clicked──▶ drawn     (raises a ComposerRequest)
drawn   ──inert item or legend clicked──▶ drawn (native behaviour only)
any     ──unmount──▶ (disposed)
```

**Invariants**

- At most one engine instance exists per `EChartsBlock` at any time (FR-012,
  SC-008).
- No transition out of `drawn` calls `dispose()` except unmount. A definition
  change, a theme change and a resize all operate on the existing instance
  (FR-012a, SC-008a).
- `dispose()` is called exactly once, from `onBeforeUnmount`. After it, the
  instance is permanently invalid per the ECharts docs and is never touched
  again — the resize callback must therefore be torn down with the component
  scope, which `useResizeObserver` guarantees.
- `failed` renders an i18n key, never an engine message (FR-008, FR-022).
- The click handler is bound **once**, right after `init`, never in the
  `setOption` path. Handlers survive `setOption`, so re-binding per update would
  make one click raise N requests (research.md R17, FR-029). No explicit `off()`
  is needed: `dispose()` takes the handlers with the instance.

---

## Relationships

```text
message content (string)
   │  markdown-it → HTML, then extraction pass
   ▼
EChartsBlock[]  ──1:0..1──▶  EChartsOption   (absent ⇒ rejected ⇒ plain code block)
   │                              │  hardening + theme base
   │                              ▼
   └──────1:1─────────────▶  RenderedEChart  (Teleported into data-echart-id="{id}")
                                  │  click on an ActionableItem
                                  ▼
                             ComposerRequest ──chat store (not persisted)──▶ MessageInput
                                                                              │ append + focus
                                                                              ▼
                                                                        user edits, then sends

EChartsBlock ──on rejection──▶ EChartsRejection ──{reason, index}──▶ logger
```

The `ComposerRequest` arrow is the only one leaving the chart subtree. Everything
else in this model is confined to the rendered message.

`chart.js` blocks flow through their own, untouched pipeline in parallel; the two
share no entity, no validator and no component (FR-020, R12).
