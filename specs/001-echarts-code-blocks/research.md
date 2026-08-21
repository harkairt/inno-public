# Phase 0 Research: ECharts Code Blocks

**Feature**: `001-echarts-code-blocks` | **Date**: 2026-08-04

All Technical Context unknowns are resolved below. Every decision is anchored to
a requirement in [spec.md](./spec.md) and, where behaviour of Apache ECharts is
asserted, to its official documentation.

---

## R1. Charting engine and how it is loaded

**Decision**: Add `echarts@^6.1.0` as a runtime dependency and load it through a
single dynamic `await import('echarts')` inside a module-level singleton
composable (`useECharts`), mirroring the existing `useChartJs` / `useShiki`
loader shape exactly.

**Rationale**:

- FR-013 / SC-004 require the capability to be absent from the download for
  conversations with no chart blocks. A dynamic `import()` inside a composable
  that is only invoked when `hasEChartsBlocks(content)` is true is precisely the
  mechanism `useChartJs` already uses and Vite already code-splits on.
- FR-019 forbids an allowlist of chart kinds, which forbids the tree-shaken
  `echarts/core` + `echarts.use([...])` build: that build only draws the chart
  kinds explicitly registered at compile time, so a new chart kind would require
  a client release. Importing the full `echarts` package is therefore not
  laziness but the direct consequence of FR-019, and the spec's Assumptions
  already accept the larger one-time download as a deliberate trade.
- The singleton (`loadingPromise`, module-level `isLoaded`) prevents N chart
  blocks in one conversation from triggering N parallel downloads.

**Alternatives considered**:

- `echarts/core` with `use([BarChart, LineChart, ...])` — rejected: violates
  FR-019 / SC-011.
- `vue-echarts` wrapper component — rejected: it adds a dependency whose only
  value is the lifecycle glue we must write anyway, and it does not expose the
  hardening seams FR-015 needs (it merges user options before we can force
  `tooltip.renderMode`).
- A `<script>` tag from a CDN — rejected outright: FR-016 / SC-009 require zero
  third-party requests, and public mode runs inside third-party iframes.

---

## R2. Making chart-drawn text incapable of becoming markup (FR-015)

**Decision**: Two forced settings, applied by us and not overridable by the
definition:

1. `echarts.init(el, null, { renderer: 'canvas' })` — the canvas renderer draws
   every label, axis tick, legend entry and title as pixels, never as DOM.
2. `tooltip.renderMode: 'richText'` forced onto **every** `tooltip` object found
   anywhere in the definition (recursively — see R4 on why "anywhere").

**Rationale**: The ECharts tooltip is the *only* text sink that becomes DOM. Its
documented default is `renderMode: 'html'`, and the official docs are explicit
that a `formatter` must HTML-escape untrusted values or it "may introduce XSS
risks". `renderMode: 'richText'` is documented as rendering "the tooltip inside
Canvas" — the sink is removed rather than filtered. This matches the spec's
chosen Option B exactly: no scanning of string values, no rejection of
markup-shaped text, and ordinary labels containing `<` (FR-015, edge case
"markup-shaped label", SC-010a) pass through untouched because nothing inspects
them.

Because `tooltip` is forced rather than injected, a definition with no `tooltip`
key keeps its current behaviour (no tooltip component → no tooltip), so this
does not add interactivity the definition did not ask for.

**Alternatives considered**:

- Keep `renderMode: 'html'` and pass tooltip content through `sanitizeHTML` —
  rejected: the tooltip is rendered by ECharts into its own DOM node after our
  sanitisation step has already run (see spec Dependencies), so there is no hook
  to interpose. Overriding `formatter` with an escaping function would also be a
  transformation of presentation options that FR-004 forbids.
- Detect markup in string values and reject — rejected by the spec's
  clarification session (Option A was rejected in favour of Option B).
- `renderer: 'svg'` — rejected: the SVG renderer builds real DOM nodes, and
  `<text>` content plus `<foreignObject>` re-open the sink that R2 exists to
  close.

**Residual, accepted**: `toolbox.feature.dataView` and `saveAsImage` build DOM
panels. `dataView` renders the series data into a `<textarea>`, whose content is
inert by definition, and its `optionToContent` hook can only be a function,
which JSON cannot express. No action taken; noted so a future reviewer does not
mistake it for an oversight.

---

## R3. Trade-off accepted for R2: plainer hover detail

**Finding**: `richText` tooltips are drawn inside the canvas, so they cannot be
richly styled and are clipped to the chart's own bounds.

This is already recorded in the spec's Assumptions as an accepted cost. Research
adds one upside worth keeping: because the tooltip no longer escapes its
container, it also cannot be truncated by the `overflow: hidden` ancestors of a
scrolling message list — the problem ECharts added `tooltip.appendTo` (v5.5) to
work around. Choosing `richText` sidesteps that class of bug rather than
inheriting it.

---

## R4. Rejecting external references (FR-016) and navigation targets (FR-017)

**Decision**: One recursive walk over the parsed JSON, rejecting the whole
definition on either of two conditions:

**(a) External resource** — any *string* value that, after trimming, begins with:

- `image://` — ECharts' own external-resource prefix, documented for icons and
  symbols (`'image://http://example.website/a/b.png'`);
- an absolute scheme in `http https ftp ftps ws wss data blob file javascript vbscript`
  followed by `:`;
- `//` (protocol-relative).

**(b) Navigation target** — any object carrying a `link` or `sublink` key whose
value is a non-empty string.

**Rationale**:

- The walk is over the *whole* definition, not a list of known fields, because
  FR-016 and the "external reference in an unusual position" edge case demand
  that a reference nested deep in presentation options still rejects. Verified
  sinks that a field-name allowlist would have missed:
  `series.symbol`, `series.markPoint.data[].symbol`, `itemStyle.decal.symbol`,
  `toolbox.feature.*.icon`, `graphic` elements of `type: 'image'`, and
  `textStyle.backgroundColor: { image: 'xxx/xxx.png' }` — the last is documented
  as accepting "a URL, a dataURI, an HTMLImageElement or an HTMLCanvasElement".
- The same recursion automatically covers `media[].option` (responsive) and
  `baseOption` / `options[]` (timeline), which are full nested option trees.
- `link` / `sublink` are the documented navigation vectors:
  `title: { link, target, sublink, subtarget }`. **`target` and `subtarget` are
  deliberately *not* rejected on key name**, because `target` is also the name of
  an edge endpoint in `series-sankey` and `series-graph` (`links[].target`), so
  rejecting that key would reject every sankey and graph chart. `target` cannot
  navigate without a `link`, so rejecting `link` alone closes the vector.
- `data:` is rejected alongside the remote schemes even though it is not
  third-party: an SVG data URI drawn as an image is an execution vector, and
  FR-017 names "a script-bearing address scheme" explicitly.

**Anchoring matters**: patterns are matched at the *start* of the value only.
This keeps FR-015's promise intact for prose — a label reading
`Revenue < 100k` or `see http://wiki for detail` is untouched — while still
catching every value that ECharts would actually resolve as a resource, since a
resource reference is always the entire value.

**Accepted false positive**: a label whose entire text *is* a URL
(`"https://example.com"`) rejects the definition. FR-016 is unconditional and
SC-010 tolerates over-rejection but not under-rejection, so erring this way is
the correct direction. Logged like any other rejection (FR-021), so it is
discoverable.

**Alternatives considered**:

- Field-name allowlist of resource-bearing keys — rejected: contradicted by
  FR-016's "whatever chart kind requested it" and the deep-nesting edge case.
- Strip the offending value and render the rest — rejected: FR-016 says
  *reject the definition*, and silent mutation would make a chart that differs
  from what the agent authored.
- A Content-Security-Policy `img-src` rule instead of validation — rejected as a
  *replacement*: CSP is enforced by the embedding page in public/iframe mode, so
  it cannot be relied on. Still worth having as defence in depth; out of scope
  here.

---

## R5. Structural validation, and how far it goes (FR-004, FR-005, FR-019)

**Decision**: `parseEChartsOption(json)` performs, in order:

1. size guard — reject if `json.length > 50_000` (same constant as
   `lib/validation/chart.ts`, kept separate per FR-020);
2. `JSON.parse` in a `try` — reject on throw;
3. Zod check that the result is a **non-empty plain object**
   (`z.record(z.string(), z.unknown())` plus a non-empty refinement) — nothing
   more;
4. the R4 safety walk.

**Rationale**: FR-004 permits exactly a structural check plus FR-015–017, and
explicitly forbids enumerating or transforming presentation options. FR-019
forbids an allowlist of chart kinds, so `series` is deliberately **not**
required: an option that is well-formed but undrawable (misspelled `type`,
missing `series`) must reach the engine and surface as a localized error via
FR-007, not be rejected at the door. FR-005 makes the size limit the only bound
on data volume — no per-series point cap, unlike `chart.js`'s `.max(1000)`.

**Alternatives considered**:

- Port `lib/validation/chart.ts`'s shape (typed `series`, `xAxis`, capped data
  arrays) — rejected: it is an enumeration, and it would silently reject every
  chart kind whose series shape differs (candlestick, sankey, treemap, gauge…),
  breaking SC-011.
- Require a `series` key — rejected: same reason, and FR-007/FR-019 already
  define the correct destination for an undrawable option.

---

## R6. Rejection reasons as values (FR-021, FR-022)

**Decision**: `parseEChartsOption` returns neverthrow
`Result<EChartsOption, EChartsRejection>` where
`EChartsRejection = { reason: 'oversize' | 'unparseable' | 'not-an-object' | 'external-reference' | 'navigation-target' }`.
Callers log `{ reason, blockIndex }` and nothing else.

**Rationale**: The existing `parseChartConfig` returns `T | null`, which cannot
satisfy FR-021 — a `null` carries no reason. A closed union of reason codes
satisfies FR-021 while making FR-022 *structurally* impossible to violate: there
is no free-form field in which a label, series name or data value could travel.

**Deliberate deviation from Constitution II**, recorded in plan.md Complexity
Tracking: the error type is not an `AppError`. `AppError` carries `message` and
`details?: unknown`, both of which invite exactly the content leak FR-022
forbids, and this is a pure validation helper in `lib/validation/`, not a
service crossing the service boundary. "Errors are values, not exceptions" is
honoured; only the currency differs, and it differs in the safer direction.

---

## R7. Update-in-place semantics (FR-012a, SC-008a)

**Decision**: On first draw, `instance.setOption(option)`. When the definition
changes, call `instance.setOption(nextOption)` on the **same instance** with **no
merge options** (plain merge). Never `dispose()` + `init()` for a definition
change.

**Rationale**: Plain merge matches components by type and index, so `series[0]`
merges into the existing `series[0]`; ECharts then diffs the data and animates a
*transition* from current values. Entry animations do not replay, which is what
FR-012a and SC-008a require.

Both alternative merge strategies were checked against the docs and rejected for
the same reason:

- `notMerge: true` — documented as "all existing components are removed before
  applying the new options". Removal plus recreation replays entry animation.
- `replaceMerge: [...]` — documented as matching existing components *by `id`*,
  removing unmatched ones and creating new ones. Assistant-authored definitions
  carry no `id`s, so every component would be unmatched → removed → recreated →
  entry animation replays.

**Accepted trade-off**: with plain merge, a key present in the old definition and
absent from the new one retains its old value. This is the standard ECharts
idiom and the direct cost of the clarified Option B; the spec chose "no
re-initialization" over "exact option identity", and the two cannot both hold.

**Change detection**: compare the *raw block text* of the definition, not the
parsed object — string equality is exact, cheap, and immune to key-order and
deep-equality subtleties. A message re-rendering for an unrelated reason
(Shiki finishing loading, the ECharts module finishing loading, a theme change,
a cache update) produces identical block text, so `setOption` is not called at
all and the drawn chart is left completely untouched (FR-012a sentence 2, the
"repeated re-render" edge case).

---

## R8. Theme reactivity (FR-009)

**Decision**: Do **not** use an ECharts theme object. Instead, read the theme
colours from the existing CSS custom properties on `document.documentElement`
and merge them as a low-precedence base `setOption` call, re-applied whenever
`useColorMode().value` changes.

**Rationale**:

- The app's theme mechanism is `@nuxtjs/color-mode` (via `@nuxt/ui`), configured
  in `nuxt.config.ts` with `classSuffix: ''` → a `dark` class on the root
  element, already consumed by `useColorMode()` in `UserAvatar.vue`,
  `AgentTile.vue` and `profile.vue`. Reusing it satisfies the spec's assumption
  that no new theme configuration is introduced.
- An ECharts theme passed to `init(el, theme)` is fixed at construction, so a
  theme switch would force `dispose()` + `init()` — a re-initialization we are
  trying to avoid, and one that would replay entry animations on every theme
  toggle. Merging colour options keeps a single instance for the chart's whole
  life.
- Base-then-definition ordering means an explicit colour in the definition still
  wins, which FR-004 requires (we must not transform presentation options).

**Known limitation being fixed, not inherited**: `useChartJs` reads
`--muted-foreground` / `--border` **once**, at module load, into
`Chart.defaults`. It therefore does not react to a theme change, and its values
leak to every later chart. The new path must not copy that; FR-009 explicitly
requires updating while the chart is on screen. Per FR-020 and the constitution's
surgical-changes rule, `useChartJs` itself is left alone.

---

## R9. Resize (FR-010, SC-007)

**Decision**: `useResizeObserver` from `@vueuse/core` (already a dependency, v14)
on the chart container, calling `instance.resize()`.

**Rationale**: ECharts does not resize itself — the docs state `resize` "should
be called manually when container size changes". A `ResizeObserver` on the
container catches viewport changes, message-list width changes and side-panel
collapse alike, which a `window` resize listener would miss. `@vueuse/core`'s
wrapper ties observer teardown to the component scope, which is half of FR-012
handled for free.

**Alternative considered**: `window.addEventListener('resize')` — rejected: does
not fire when the container changes size without the window changing.

---

## R10. Touch support (FR-011)

**Finding**: No work required. ECharts binds pointer events through ZRender,
which handles touch natively; tooltips trigger on tap and legend entries toggle
on tap. Because R2 forces `richText`, the tooltip is drawn inside the canvas and
so cannot overflow off-screen on a narrow viewport — a common touch failure mode
for HTML tooltips. Verification is a test/QA obligation (quickstart.md), not a
code obligation.

---

## R11. Integration point in the rendering pipeline

**Decision**: Extend `MarkdownContent.vue` with an `echarts` extraction pass
placed alongside the existing table / pivot / chart passes — before Shiki
highlighting and before `sanitizeHTML` — emitting
`<div class="echart-placeholder" data-echart-id="…"></div>` and rendering
`ChatEChart` into it with the same `<Teleport :defer="true">` pattern the three
existing block types use.

**Rationale**: markdown-it (`html: false`, default `langPrefix: 'language-'`)
renders a ```` ```echarts ```` fence as
`<pre><code class="language-echarts">…</code></pre>`, so the extraction regex is
the same shape as the `chart.js` one. Extraction must precede Shiki so a
*rendered* chart is never also highlighted.

Two findings specific to `echarts`:

- Unlike `chart.js`, the tag `echarts` **does** match Shiki's `(\w+)` language
  capture. That is harmless and in fact desirable: a *rejected* block falls
  through to `highlightCodeBlocks`, and `useShiki` loads no `echarts` grammar, so
  `highlightCode` maps the unknown language to `text` and the block degrades to a
  readable plain code block — exactly FR-006.
- `data-echart-id` must be added to `ALLOWED_ATTR` in `app/utils/sanitize.ts`.
  `ALLOW_DATA_ATTR` is `false`, so unlisted `data-*` attributes are stripped and
  the `Teleport` target would silently never exist. This is the deliberate
  allowlist audit the spec's Dependencies section calls for.

**Alternative considered**: a markdown-it plugin / custom fence renderer —
rejected: it would diverge from the three block types already handled in
`MarkdownContent.vue`, and the constitution prefers reusing the established
pattern over introducing a second mechanism.

---

## R12. Independence of the two block paths (FR-020, SC-002)

**Decision**: Zero shared code between the `chart.js` and `echarts` paths. New
files only: `lib/validation/echarts.ts`, `app/composables/useECharts.ts`,
`app/components/chat/ChatEChart.vue`. The only edits to existing files are
purely additive: a new extraction pass and `Teleport` in `MarkdownContent.vue`,
one attribute in `sanitize.ts`, and new i18n keys.

**Rationale**: FR-020 requires the paths be independent end to end and that a
fault in one cannot affect the other; SC-002 requires zero visual regression in
stored `chart.js` conversations. Not touching `useChartJs.ts`, `ChatChart.vue` or
`lib/validation/chart.ts` at all is the cheapest possible proof of both. This
also means resisting the pull to factor out a shared "lazy chart loader" — for
two call sites that is the speculative abstraction the constitution forbids, and
it would create the coupling FR-020 prohibits.

---

## R13. Testing approach

**Decision**:

- Mock the `echarts` module with a fake `init` returning a spy instance
  (`setOption`, `resize`, `dispose`), following the `FakeChart` pattern already
  established in `tests/unit/composables/useChartJs.test.ts`.
- Render components via `renderWithProviders`; stub `useColorMode` with
  `vi.stubGlobal(...)` as `AgentTile.test.ts` and `UserAvatar.test.ts` do.
- `useECharts` holds module-level singleton state (`isLoaded`, `loadingPromise`),
  so its test file re-imports the module after `vi.resetModules()` per test —
  the same technique `useChartJs.test.ts` documents in its header comment.

**Rationale**: Constitution III forbids mocking stores, services and
`apiClient`; `echarts` is none of those — it is a third-party rendering library
that requires a real canvas jsdom does not provide, in the same category as the
already-mocked `chart.js` and `shiki`. This feature adds no HTTP calls, so no
MSW handlers change and the network boundary is untouched.

`resetAllState.ts` is deliberately **not** extended: `useChartJs`'s equivalent
singleton is not registered there either, and `vi.resetModules()` in the one
test file that cares is the narrower fix.

---

## R14. Diagnostics (FR-021, FR-022)

**Decision**: `createLogger('echarts')` from `lib/utils/logger.ts`. Log
`logger.warn('rejected', { reason, blockIndex })` for validation rejections and
`logger.error('draw failed', { blockIndex })` for engine failures.

**Rationale**: Reuses the existing diagnostic surface as FR-021 requires. Note
one care point: the caught `Error` from a failed `setOption` **must not** be
passed to the logger, unlike `useChartJs.renderChart` which logs the raw error
object. ECharts error messages embed offending option values, which would put
chart content into logs and violate FR-022. Log the block index and a fixed
message; the error object itself is dropped.

---

## R15. Carrying a click from a chart to the message composer (FR-023, FR-024, FR-030)

**Decision**: A non-persisted one-shot channel in the existing chat store:

```ts
const composerRequest = ref<{ text: string, seq: number } | null>(null)

function requestComposerText(text: string) {
  composerRequest.value = { text: normalizeWhitespace(text), seq: nextSeq++ }
}
function clearComposerRequest() {
  composerRequest.value = null
}
```

`MessageInput.vue` watches `composerRequest`, applies it, then calls
`clearComposerRequest()`. `composerRequest` is **not** added to
`persist.pick`.

**Rationale**: `ChatEChart` sits inside `MarkdownContent`, inside a message
bubble, inside a virtualized message list; `MessageInput` is a sibling of that
list, several levels up. Emitting an event would require threading it through
every intervening component, three of which have no other reason to know charts
exist. `MessageInput` already reaches into `useChatStore()` directly
(`MessageInput.vue:174`), so store-mediated coupling is the established shape
here, not a new one.

The **sequence number is load-bearing**, not incidental. Clicking the same pie
slice twice must append twice (spec US5 scenario 5). With a plain
`ref<string | null>`, the second click would write an identical value, Vue's
watcher would see no change, and nothing would happen — the feature would
silently work only on alternating clicks. Watching `seq` makes every activation
distinct. `clearComposerRequest()` after applying is belt-and-braces: it keeps a
freshly mounted composer from consuming a stale request.

**Alternatives considered**:

- **The existing draft mechanism** (`saveDraft`/`getDraft`) — rejected on three
  independent counts. It is read *only* in `onMounted`
  (`MessageInput.vue:187-192`), so writing to it while the composer is already
  mounted does nothing. The composer's own `watchDebounced(messageText, …, 500)`
  (`MessageInput.vue:444-450`) would overwrite it. And `draftMessages` **is** in
  `persist.pick`, so injected text would survive a reload — a direct FR-030
  violation, and the worst kind: text the user never wrote reappearing as if
  they had.
- **`provide`/`inject` from the page down** — works, but couples the message-list
  subtree to a page-level contract and is untestable in isolation for
  `ChatEChart`, which is rendered by `MarkdownContent`, not by the page.
- **A DOM `CustomEvent` on `window`** — no typing, no test seam, and it leaks
  across the two operating modes if a page ever mounts twice.

The store precedent for a deliberately non-persisted one-shot flag already
exists: `nextSessionIsFreshlyCreated` (`app/stores/chat.ts:179-188`), documented
in that file as excluded from `persist.pick` on purpose.

**Whitespace normalization** happens in the store action, collapsing newlines and
runs of spaces to single spaces. A multi-line question pasted into the composer
would otherwise look like several paragraphs the user did not write. No second
length cap is applied here — R16 guarantees the text is already within bounds.

---

## R16. Trust model for chart-supplied composer text (FR-025, FR-026)

**Decision**: The follow-up question travels as a `prompt` key on the data item:

```json
{ "series": [{ "type": "pie", "data": [
  { "name": "North", "value": 820, "prompt": "Break down North revenue by product" }
] }] }
```

It is read at click time as `params.data.prompt`, and validated at **parse**
time — inside the recursive walk R4 already performs — as: a string, at most 500
characters. A violation rejects the whole definition with a new reason code
`invalid-prompt`.

**Rationale**: Three properties fall out of this placement.

*No option transformation.* ECharts passes the authored data item through to the
click handler untouched, and ignores keys it does not recognise. So the payload
rides inside the definition with zero rewriting, which keeps FR-004's
"passed through as-is" literally true. Reading it needs the usual narrowing,
since `params.data` may be a bare number for array-form data:

```ts
const item = params.data
if (typeof item !== 'object' || item === null || Array.isArray(item)) return
const prompt = (item as Record<string, unknown>).prompt
if (typeof prompt !== 'string') return
```

*Per-item granularity for free.* Marking is at the level the user actually
clicks. A chart-level or series-level prompt would make every slice actionable
and force the agent to synthesise text from the clicked label — which is exactly
the "chart content authors user messages" shape the spec's trust assumption
rules out.

*Validity is established before render, not at click time.* Because the walk
already visits every value for R4's safety checks, adding the prompt check costs
one branch. The payoff is that a rendered chart is one whose every prompt is
already known usable. The alternative, validating on click, means the user clicks
and *nothing happens*, with no possible explanation, which is a far worse failure
than the definition degrading to a code block.

The predicate itself is exported as `isValidPrompt` and used by all three call
sites — the validator, `hasActionableItems`, and the click handler. What must not
be duplicated here is the *predicate*, not the traversal (R18).

Note the interaction with **FR-016**: a prompt whose text begins with a URL or
`image://` is rejected as `external-reference` by the pre-existing walk, before
the prompt check is reached. That is the correct outcome — reason codes are
diagnostic, and the definition is rejected either way — but it means a
diagnostic reading `external-reference` may originate in a prompt string.

**No `componentType` enumeration.** The handler does not check whether the click
came from a series, a legend, or an axis label — it just looks for a prompt on
`params.data`. Legend and axis clicks carry no `data`, so they fall through and
retain their native behaviour untouched (FR-027).

**Accepted risk**: `prompt` is not a reserved ECharts key today, but nothing
prevents a future version from claiming it. The collision would be visible
immediately (a prompt string appearing as chart text, or ECharts rejecting the
value) rather than silent. A namespaced key such as `innochatPrompt` would be
safer and was rejected as worse for the agent-facing contract, which agents must
be prompted to produce correctly.

**Never auto-send.** The composer is the only destination, and the append-then-
focus behaviour follows the existing voice-transcription precedent at
`MessageInput.vue:269-270`. This is not a UX preference — it is the containment
boundary. Assistant-authored content reaching the composer is a suggestion the
user must act on; assistant-authored content reaching *send* would let a chart
originate turns in the conversation on its own.

---

## R17. Binding the click handler exactly once (FR-029, SC-015)

**Decision**: Call `instance.on('click', handler)` once, immediately after
`initChart`, never inside the `setOption` path. No explicit `off()` — `dispose()`
removes handlers with the instance.

**Rationale**: ECharts event handlers live on the instance and survive
`setOption`, so registering alongside each `setOption` stacks them: after the
Nth definition update, one click appends N times. This is precisely the failure
mode of the SignalR listener-registration area that `innochat-concerns` flags as
fragile, appearing in a new place. R7's decision to update in place rather than
re-initialize is what makes the mistake possible here at all — the instance
outlives the option.

`ChatEChart.test.ts` therefore asserts a count, not a presence: update the
`source` prop twice, dispatch one click, assert `requestComposerText` was called
exactly once. Asserting only that the handler fired would pass in the broken
case.

---

## R18. Deriving the hint's visibility rather than reporting it (FR-028, SC-016)

**Decision**: `parseEChartsOption` returns `Result<EChartsOption, EChartsRejection>`
— the option alone. A separate exported `hasActionableItems(option): boolean`
answers the hint question, and `ChatEChart` calls it through a `computed` on
`props.option`.

**Rationale**: An earlier draft had the parser return
`{ option, hasPrompts }` and threaded `hasPrompts` through `MarkdownContent` as a
prop. That is derived state stored beside the thing it is derived from, and it
buys nothing.

Three concrete costs of storing it:

- **It can drift.** `hasPrompts` is a *claim about* the option travelling
  separately from the option. If `MarkdownContent` ever forgets the prop, the hint
  silently never renders — no error, no failing type, just a missing affordance.
  If anything ever transforms the option between parse and render, the flag goes
  stale with nothing to catch it. A `computed` on `props.option` is a function of
  the object actually being rendered and cannot be wrong about it.
- **It widens two signatures to serve one consumer.** The parse result becomes a
  wrapper object, `EChartsBlock` grows a field, and `ChatEChart` grows a prop —
  three surfaces changed so one component can render one line of text.
- **It conflates two questions.** "Is this definition acceptable?" and "does it
  have actionable items?" are unrelated. The first is the parser's job and has a
  failure mode; the second is a query over a valid option and has none. Returning
  them together implies the second is a finding of the first.

**The performance argument for storing it does not hold.** The earlier draft
justified the flag as "computed by the same walk, so it costs nothing extra". True
but irrelevant: the alternative is a second traversal of an object capped at
50 000 characters, memoized by `computed`, running once per distinct option — not
once per render, and not on any hot path. That is microseconds, once. Trading a
correctness property for it is the wrong direction.

**What genuinely must not be duplicated** is the *predicate*, not the traversal.
Two hand-written copies of "a non-empty string of at most 500 characters" would
eventually disagree, and the symptom would be nasty: a chart showing the hint
whose items do nothing when clicked, or the reverse. Hence `isValidPrompt` is
exported and is the single definition, consumed by the validator (to reject), by
`hasActionableItems` (to count), and by the click handler (to guard and to narrow
to `string`).

**Alternatives considered**:

- **Return `{ option, hasPrompts }`** — the earlier draft, rejected above.
- **A boolean prop passed by `MarkdownContent`** — same drift risk, plus it makes
  `ChatEChart` untestable for the hint without going through its parent.
- **Search the raw `source` string for `"prompt"`** — cheapest, and wrong: it
  matches the substring inside a label, an axis name, or a series called
  "prompt latency", so charts with no actionable items would show the hint.
- **Have the click handler set a flag on first click** — the hint would appear
  only after the user did the thing the hint exists to suggest.

---

## Unresolved

None. No `NEEDS CLARIFICATION` markers remain in Technical Context.
