---
name: add-fence-type
description: Use when adding a new fenced code block renderer to chat messages — a new ```xyz block that renders as a rich visualization (chart, graph, map, diagram, etc.) instead of plain code. Triggers on "add fence", "new fence type", "new code block renderer", "add visualization block", "new markdown block", "render block", "custom code fence", "add block type".
---

# Adding a New Fence Type

A "fence type" is a fenced code block language tag (e.g. ` ```cytoscape `) that the chat markdown pipeline intercepts and renders as a rich visualization instead of syntax-highlighted code.

Existing fence types: `chart.js`, `echarts`, `bar-race`, `rows`/`h-rows`, `pivot`, `cytoscape`, `leaflet`, `svg`.

---

## Architecture Overview

```
Raw markdown  ──▸  markdown-it (standard <pre><code class="language-{tag}">)
              ──▸  MarkdownContent.vue post-processing pipeline:
                     1. has{Type}Blocks() — fast presence check on raw markdown
                     2. extract{Type}Blocks() — regex on rendered HTML → validate → placeholder div
                     3. Shiki syntax highlighting (runs AFTER extraction, only on remaining code blocks)
              ──▸  DOMPurify sanitization
              ──▸  Vue <Teleport :defer> mounts renderer component into placeholder
```

The heavy visualization library is **lazy-loaded** via dynamic `import()` in a composable with singleton deduplication.

---

## Step-by-step Checklist

Use `{tag}` for the fence language (e.g. `cytoscape`), `{Tag}` for PascalCase (e.g. `Cytoscape`), and `{slug}` for kebab-case data attribute names (e.g. `cytoscape`).

### 1. Validation — `lib/validation/{tag}.ts`

Parse and validate the JSON body of the fence block. This is a **pure function** with no DOM or Vue dependencies.

**Required exports:**

```ts
import { ok, err, type Result } from 'neverthrow'

// The parsed data type
export interface {Tag}Data { /* ... */ }

// Exhaustive union of rejection reasons
export type {Tag}RejectionReason = 'oversize' | 'unparseable' | 'not-an-object' | /* domain-specific */

export interface {Tag}Rejection {
  reason: {Tag}RejectionReason
}

// The parser — returns Result, never throws
export const parse{Tag}Data = (json: string): Result<{Tag}Data, {Tag}Rejection> => { ... }
```

**Conventions (follow existing validators — see `lib/validation/cytoscape.ts` as the canonical example):**

- **Size guard first** — `if (json.length > MAX_JSON_SIZE) return err({ reason: 'oversize' })`. Use 50,000 as the default max.
- **JSON.parse in try/catch** — return `err({ reason: 'unparseable' })` on failure.
- **Plain-object check** — reject arrays and primitives at the top level with `'not-an-object'`.
- **Domain validation** — validate required fields, allowlist enum values (layouts, style properties), reject unknown/dangerous values.
- **External reference scan** — recursively check all string values against `EXTERNAL_REFERENCE_PREFIXES` (copy the list from cytoscape.ts). Block `http:`, `https:`, `javascript:`, `data:`, `blob:`, etc. Return `err({ reason: 'external-reference' })`.
- **Security-first**: fence data is untrusted LLM output. Allowlist > denylist. Never pass raw URLs, HTML, or script content through.

### 2. Composable — `app/composables/use{Tag}.ts`

Lazy-loads the visualization library and exposes init/render/destroy helpers.

**Required structure:**

```ts
import { ref } from 'vue'
import type { {Tag}Data } from '@/lib/validation/{tag}'
import { createLogger } from '@/lib/utils/logger'

const logger = createLogger('use{Tag}')

// Module-level singletons for load deduplication
let libModule: SomeType | null = null
let loadingPromise: Promise<boolean> | null = null

// Shared refs — reactive across all component instances
const isLoading = ref(false)
const isLoaded = ref(false)

export const use{Tag} = () => {
  const load{Tag} = (): Promise<boolean> => {
    if (libModule) return Promise.resolve(true)
    if (loadingPromise) return loadingPromise    // dedup concurrent loads

    isLoading.value = true
    loadingPromise = (async () => {
      try {
        const mod = await import('{library-package}')
        libModule = mod.default  // or mod, depending on the library
        isLoaded.value = true
        return true
      } catch (error) {
        logger.error('Failed to load {Tag}', error)
        return false
      } finally {
        isLoading.value = false
        loadingPromise = null
      }
    })()
    return loadingPromise
  }

  const init{Tag} = (el: HTMLElement, data: {Tag}Data, isDark: boolean): InstanceType | null => {
    if (!libModule) return null
    // Create and return the visualization instance
  }

  const apply{Tag} = (instance: InstanceType, data: {Tag}Data, isDark: boolean, blockIndex: number): boolean => {
    try {
      // Update an existing instance with new data
      return true
    } catch (error) {
      logger.error('Failed to render {Tag} block', { blockIndex, error })
      return false
    }
  }

  return { isLoading, isLoaded, load{Tag}, init{Tag}, apply{Tag} }
}
```

**Conventions:**

- If the library needs CSS (like Leaflet), import it alongside: `await Promise.all([import('leaflet'), import('leaflet/dist/leaflet.css')])`.
- Dark mode: read CSS custom properties (`--muted-foreground`, `--border`, `--primary`) via `getComputedStyle` and build a theme object. Don't import Nuxt UI theme tokens directly.
- The composable is the only file that imports the heavy library — components and validation never do.

### 3. Renderer component — `app/components/chat/Chat{Tag}.vue`

**Required props interface:**

```ts
interface Props {
  data: {Tag}Data          // or `config`, `option` — match the domain noun
  blockIndex: number       // for error logging
  source: string           // raw JSON string — used as change-detection key
}
```

**Template pattern (three states: loading / error / rendered):**

```vue
<template>
  <div class="{slug}-container">
    <div v-if="showLoading" class="{slug}-loading">
      {{ t('chat.{tag}.loading') }}
    </div>
    <div v-else-if="error" class="{slug}-error">
      {{ error }}
    </div>
    <div v-show="!showLoading && !error" ref="containerRef" class="{slug}-canvas" />
  </div>
</template>
```

**Script conventions:**

- Import: `useI18n`, `useColorMode`, `useResizeObserver` (from `@vueuse/core`), the composable, and the validation type.
- `onMounted` — call `load{Tag}()`, set error if it fails.
- `watch(isLoaded, ...)` — render when library arrives (flush: `'post'`).
- `watch(() => props.source, render)` — re-render on data change (streaming updates).
- `watch(isDark, applyCurrent)` — react to theme changes.
- `useResizeObserver(containerRef, ...)` — call resize/relayout on the instance.
- `onBeforeUnmount` — **destroy the instance** to prevent memory leaks.
- Use a `let instance: InstanceType | null = null` (not a ref — visualization instances aren't reactive).

**Scoped CSS conventions:**

```css
.{slug}-container { width: 100%; margin: 1rem 0; }
.{slug}-canvas    { width: 100%; aspect-ratio: ...; min-height: 240px; }
.{slug}-loading,
.{slug}-error     { padding: 1rem; font-size: 0.875rem; color: hsl(var(--muted-foreground)); }
```

### 4. MarkdownContent.vue — wire it in

**4a. Imports** (top of `<script setup>`):

```ts
import { use{Tag} } from '~/composables/use{Tag}'
import { parse{Tag}Data, type {Tag}Data } from '@/lib/validation/{tag}'
import Chat{Tag} from '~/components/chat/Chat{Tag}.vue'
```

**4b. Composable destructure:**

```ts
const { isLoaded: {tag}Loaded, load{Tag} } = use{Tag}()
```

**4c. Entry interface + reactive array:**

```ts
interface {Tag}Entry {
  id: string
  data: {Tag}Data   // match the prop name from the renderer
  source: string
  blockIndex: number
}

const {tag}Entries = ref<{Tag}Entry[]>([])
```

**4d. Detection function** — fast short-circuit on raw markdown:

```ts
const has{Tag}Blocks = (content: string | null | undefined): boolean => {
  if (!content) return false
  const openIdx = content.indexOf('```{tag}')
  if (openIdx === -1) return false
  return content.indexOf('```', openIdx + {tag.length + 3}) !== -1
}
```

**4e. Extraction function** — regex on rendered HTML, calls validator:

```ts
const extract{Tag}Blocks = (html: string): { html: string; entries: {Tag}Entry[] } => {
  const entries: {Tag}Entry[] = []
  let index = 0
  const regex = /<pre><code\s+class="language-{tag}">([\s\S]*?)<\/code><\/pre>/g

  const replaced = html.replace(regex, (match, encoded: string) => {
    const source = decodeHtmlEntities(encoded)
    const parsed = parse{Tag}Data(source)
    const blockIndex = index++

    if (parsed.isErr()) {
      const key = `{tag}-${blockIndex}:${parsed.error.reason}`
      if (!reportedRejections.has(key)) {
        reportedRejections.add(key)
        logger.warn('Rejected {tag} block', { reason: parsed.error.reason, blockIndex })
      }
      return match   // leave as <pre><code> — falls through to Shiki
    }

    const id = `${instancePrefix}-{slug}-${blockIndex}`
    entries.push({ id, data: parsed.value, source, blockIndex })
    return `<div class="{slug}-placeholder" data-{slug}-id="${id}"></div>`
  })

  return { html: replaced, entries }
}
```

**4f. Apply wrapper:**

```ts
const apply{Tag}Blocks = (html: string): string => {
  if (!has{Tag}Blocks(props.content)) {
    {tag}Entries.value = []
    return html
  }
  const result = extract{Tag}Blocks(html)
  {tag}Entries.value = result.entries
  return result.html
}
```

**4g. Plug into `renderContent()`** — add `html = apply{Tag}Blocks(html)` **before** the Shiki highlighting step, after the existing extraction calls. Also add `{tag}Entries.value = []` to the null-content and catch-all reset blocks.

**4h. Library loading in `onMounted`:**

```ts
if (has{Tag}Blocks(props.content)) {
  void load{Tag}()
}
```

**4i. Watcher for loaded state:**

```ts
watch({tag}Loaded, (loaded) => {
  if (loaded && {tag}Entries.value.length > 0) {
    renderContent()
  }
})
```

**4j. Teleport in template:**

```vue
<Teleport
  v-for="entry in {tag}Entries"
  :key="entry.id"
  :to="`[data-{slug}-id='${entry.id}']`"
  :defer="true"
>
  <Chat{Tag}
    :data="entry.data"
    :block-index="entry.blockIndex"
    :source="entry.source"
  />
</Teleport>
```

### 5. Sanitization — `app/utils/sanitize.ts`

Add `'data-{slug}-id'` to the `ALLOWED_ATTR` array in the DOMPurify config. Without this, DOMPurify strips the placeholder's data attribute and the Teleport target disappears.

### 6. Wide content (optional) — `app/utils/messageContent.ts`

If the visualization is wide enough to warrant a wider chat bubble, add `` '```{tag}' `` to `WIDE_CONTENT_MARKERS`.

### 7. i18n — `i18n/locales/en.json` + `hu.json`

Add keys under `chat.{tag}`:

```json
"{tag}": {
  "loading": "Loading {display name}…",
  "renderFailed": "This {display name} could not be displayed."
}
```

Add both `en.json` and `hu.json` entries.

### 8. npm dependency

```bash
npm install {library-package}
```

If the library has TypeScript types in a separate package (e.g. `@types/{library}`), install that too as a dev dependency.

### 9. Tests

**9a. Validation tests** — `tests/unit/lib/validation/{tag}.test.ts`

Cover at minimum:
- Valid data accepted, parsed fields match
- Size guard rejects oversized input (`'oversize'`)
- Malformed JSON rejects (`'unparseable'`)
- Non-object rejects (`'not-an-object'`)
- Missing required fields reject (domain-specific reasons)
- External references rejected (`'external-reference'`)
- Each domain-specific rejection reason exercised

Use a `reasonOf(json)` helper for concise rejection tests (see `cytoscape.test.ts`).

**9b. Component tests** — `tests/unit/components/chat/Chat{Tag}.test.ts`

Cover at minimum:
- Shows loading state while library loads
- Renders when library loads (init called with container + data)
- Re-renders on `source` prop change
- Reacts to theme change (isDark)
- Resizes on container resize (debounced)
- Destroys instance on unmount
- Shows error when library fails to load

Mock the library with `vi.mock('{library}')` and a fake instance class that tracks method calls. Mock `vue-i18n` and `useColorMode`. Stub `ResizeObserver`.

**9c. MarkdownContent integration** — add test cases to `tests/unit/components/chat/MarkdownContent.test.ts`

Cover:
- Valid ` ```{tag} ` block extracted → placeholder div rendered → component teleported
- Invalid block left as `<pre><code>` (rejected by validator)
- Library not imported when no `{tag}` blocks present

### 10. Fence documentation — `docs/fence/{tag}.md`

Create a comprehensive reference document for agents that generate this fence type. These agents have **no internet access**, so the document must be fully self-contained — it replaces the library's online docs.

Use `docs/fence/leaflet.md` as the canonical example. The document must cover:

- **Fence tag** — the exact language identifier (e.g. ` ```leaflet `).
- **Top-level JSON schema** — every field, its type, whether it's required/optional, and its default value.
- **Every feature type** — complete field tables with types, constraints, and defaults.
- **All styling options** — allowed formats (hex, rgb, named colors, etc.) with examples.
- **Coordinate system** — axis order, ranges, reference coordinates for common cities.
- **Validation limits** — every constant from the validation file in one summary table.
- **Rejection reasons** — every reason and what triggers it, in a table.
- **Auto-fit / viewport behavior** — what happens when center/zoom are omitted.
- **Complete examples** — at least 5, progressing from minimal to complex mixed usage. Wrap each in a quadruple-backtick fence so the inner triple-backtick block renders correctly in markdown.
- **Unsupported features** — what the underlying library supports but this fence type does not expose.

### 11. Dev gallery and thread — `app/dev/fixtures/markdown.ts` + `app/dev/fixtures/thread.ts`

Every new fence type must include at least one representative, valid fenced example in
`markdownScenarios`. Build it with the existing `fence()` helper so `/dev/gallery` exercises the
real `MarkdownContent` detection, extraction, sanitization, and Teleport path.

- Use a payload that demonstrates the renderer's main visual behavior.
- Keep the fixture deterministic and independent of the backend or external resources.
- Add a rejected or malformed example when the fence has security-sensitive failure behavior that
  benefits from manual inspection.
- If the renderer needs isolated controls or interaction testing, also add a typed fixture and a
  dedicated component section to `app/pages/dev/gallery.vue`; the embedded MarkdownContent example
  is still required.
- Verify the example at `/dev/gallery` in light and dark mode and at mobile and desktop widths.
- Add the same representative fixture to `fixtureGroups` in `app/dev/fixtures/thread.ts`. This makes
  the complete chat view exercise the real message list, bubble sizing, and MarkdownContent path.

---

## Extraction Order

The order in `renderContent()` matters:

```
tables → pivots → chart.js → echarts → bar-race → cytoscape → leaflet → [NEW TYPE HERE] → markdown tables → Shiki
```

New types go **after** existing visualizations and **before** markdown tables and Shiki highlighting. This ensures:
1. Visualization blocks are extracted before Shiki tries to syntax-highlight them.
2. Markdown tables are extracted after visualizations (they use a different regex on `<table>` tags, not `<pre><code>`).

---

## Security Checklist

Before merging a new fence type, verify:

- [ ] Size guard prevents DoS from oversized payloads
- [ ] External references (URLs, `javascript:`, `data:`) are blocked recursively
- [ ] No raw HTML passthrough — all text content is escaped or validated
- [ ] Style properties are allowlisted (if the format supports styling)
- [ ] No dynamic code execution (`eval`, `Function`, `innerHTML` of user data)
- [ ] DOMPurify config updated with the new `data-*-id` attribute
- [ ] Library is dynamically imported (not bundled in main chunk)
- [ ] Instance is destroyed on component unmount
