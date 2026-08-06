# Contract: the `echarts` message block

**Feature**: `001-echarts-code-blocks` | **Consumers**: agent authors (backend /
prompt side), QA, anyone diagnosing a chart that did not appear.

This is the feature's only externally-visible interface. The client does not
produce these blocks — it renders what arrives in message content (spec
Assumptions). This document is what an agent must satisfy to get a chart drawn,
and what the client guarantees in return.

---

## Producer contract

A chart is requested with a fenced code block whose info string is exactly
`echarts`:

````markdown
```echarts
{ "xAxis": { "type": "category", "data": ["Q1","Q2","Q3","Q4"] },
  "yAxis": { "type": "value" },
  "series": [{ "type": "bar", "data": [820, 932, 901, 1290] }] }
```
````

| Rule | Value |
|---|---|
| Info string | `echarts`, lowercase, no suffix |
| Body format | a single JSON object — an Apache ECharts `option` |
| Max body size | 50 000 characters |
| Blocks per message | unlimited; each renders independently |
| Coexistence | may appear in any order alongside `chart.js`, `rows`, `h-rows`, `pivot`, math and ordinary code blocks |
| Fence | must be closed; an unterminated block is not treated as a chart |

The body is passed to the engine **unmodified** apart from the hardening listed
below. No option key is enumerated, restricted or rewritten, and there is no
allowlist of chart kinds — any chart kind the engine supports is accepted, so a
new chart kind needs no client release (FR-004, FR-019, SC-011).

`chart.js` remains a fully independent block tag with unchanged behaviour. The
two are never translated into one another (FR-002, FR-020).

---

## Attaching a follow-up question to a data item

A data item may carry a `prompt`. When the user selects that item, its text is
**appended to the message composer** and the composer is focused. The user then
reads, edits if they like, and sends — or does not.

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

| Rule | Value |
|---|---|
| Key | `prompt`, on an individual data item |
| Type | text |
| Max length | 500 characters |
| Empty or whitespace-only | not allowed |
| Items per definition | any number, including none |
| Granularity | per item — there is no chart-level or series-level form |

**Array-form data cannot carry a prompt.** `"data": [820, 932, 901]` leaves
nowhere to put the key, so a bar or line series wanting actionable items must use
object-form items:

```json
{ "type": "bar", "data": [
  { "value": 820, "prompt": "Show the North breakdown" },
  { "value": 932 }
] }
```

**What agent authors need to know:**

- **An invalid prompt rejects the whole definition** — no chart at all, just a
  code block. A prompt that is not text, is empty, or exceeds 500 characters is
  the same class of failure as malformed JSON. Reason code `invalid-prompt`.
- **A prompt beginning with a URL rejects the definition** as
  `external-reference`, because the safety rules above test every text value in
  the definition regardless of its key. Write the question, not a link.
- **Write a question, not an instruction.** The text lands in the user's own
  composer, so first person reads correctly: "Break down North revenue by
  product", not "The user wants a breakdown".
- **Keep it short and self-contained.** It will sit in a single-line input next to
  whatever the user was already typing. Newlines are collapsed to spaces.
- **Marking is opt-in and partial.** Items without a `prompt` are inert — clicking
  them does nothing. A definition with no prompts behaves exactly as one written
  before this capability existed.
- **The text is a suggestion, never a message.** Nothing is sent. A prompt cannot
  cause a conversation turn on its own; only the user pressing send can.

When a definition contains at least one valid prompt, the client shows a
localized hint beneath the chart telling the user data points can be selected.
When it contains none, no hint appears (FR-028).

---

## Rejected definitions

A rejected block is **left as a plain, syntax-highlighted code block**; the rest
of the message renders normally. Nothing is shown to the user to explain the
rejection — the log record is the only signal (FR-006, FR-021).

| Condition | Reason code |
|---|---|
| body longer than 50 000 characters | `oversize` |
| body is not parseable JSON (includes truncated output) | `unparseable` |
| body parses to a non-object, an array, or an empty object | `not-an-object` |
| any string value anywhere starts with `image://`, `//`, or a `http https ftp ftps ws wss file blob data javascript vbscript` scheme | `external-reference` |
| any object anywhere has a non-empty string `link` or `sublink` | `navigation-target` |
| any `prompt` is not text, is empty/whitespace-only, or exceeds 500 characters | `invalid-prompt` |

Two consequences agent authors should know:

- **No external assets.** Image symbols, remote icons, pattern-image backgrounds
  and externally-hosted geography files all reject the whole definition. Map and
  geo chart kinds are not blocked by kind, but in practice cannot draw, so they
  surface as an error rather than a chart (FR-016, spec Assumptions).
- **A label whose entire text is a URL rejects the definition.** Put the URL
  mid-sentence, or omit it. A URL appearing anywhere other than the start of a
  value is unaffected.

---

## Accepted-but-undrawable definitions

A definition that passes validation and still cannot be drawn — a misspelled or
unsupported chart kind, a missing `series`, mutually inconsistent options —
produces a **localized error message** in the chart's position, never a blank gap
and never an uncaught failure (FR-007, FR-019).

---

## Client guarantees

| Guarantee | Requirement |
|---|---|
| The rendered chart replaces the code block; the raw definition is not shown | FR-001 |
| Text, axes, gridlines and background follow the active light/dark theme, and update on a live theme switch | FR-009 |
| The chart resizes to its container and does not overflow at 320 px–2560 px | FR-010, SC-007 |
| Every interaction the definition declares is reachable by touch as well as pointer | FR-011 |
| Renders identically in authenticated and public/iframe mode | FR-018, SC-002 |
| Loading and error text exist in Hungarian and English | FR-008, SC-006 |
| Zero requests to third-party origins are made while rendering | FR-016, SC-009 |
| A definition change updates the chart in place; entry animations do not replay | FR-012a, SC-008a |
| Resources are released when the message leaves the view | FR-012, SC-008 |
| The engine is downloaded only for conversations that contain a chart block | FR-013, SC-004 |
| Selecting an item with a `prompt` appends its text to the composer and focuses it; existing composer content is preserved | FR-023, FR-024, SC-014 |
| No chart interaction ever sends a message, navigates, filters or issues a request | FR-025, SC-013 |
| Items without a `prompt`, and native interactions such as legend toggling, are unaffected | FR-027 |
| N selections append exactly N times, whatever happened to the chart in between | FR-029, SC-015 |
| The selection hint appears exactly when the definition has at least one prompt | FR-028, SC-016 |
| A selection is never replayed — no insertion happens without a fresh activation | FR-030, SC-017 |

### Text handling

All chart-drawn text — labels, axis ticks, legend entries, titles, hover detail —
is drawn as pixels, never as page markup. A value containing `<script>` appears
as visible, inert characters; a value containing `<` renders exactly as written
and is never a reason for rejection (FR-015, SC-010a).

The cost of that guarantee: hover detail is drawn inside the chart. It cannot be
richly styled and stays within the chart's bounds instead of floating over the
page (spec Assumptions, research.md R3).

---

## Diagnostics contract

Every rejection and every draw failure produces one log record through the
application's existing logger, containing the **reason** and the **0-based index
of the block within its message** — and nothing else.

No log record contains any part of a definition: no option key, no label, no
series name, no data value, and no engine error message (FR-021, FR-022,
SC-012). Assistant-generated content may contain customer data, and public mode
runs inside third-party sites.

---

## Not in this contract (v1)

Out of scope per spec Assumptions: user-authored chart definitions, chart-level
actions (export, download, fullscreen, copy-definition), locally bundled
geography data, and accessibility beyond parity with the existing `chart.js`
blocks.

Also out of scope: any chart interaction that reaches further than the composer.
There is no form of `prompt` that navigates, filters, calls an endpoint, or sends
— appending text a human must then act on is the entire mechanism, deliberately
(FR-025). `prompt` is an `echarts`-only key; `chart.js` blocks gain nothing here
(FR-002, FR-020).
