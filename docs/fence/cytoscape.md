# `cytoscape` Fence Type — Graph / Network Visualization

Fence tag: ` ```cytoscape `

Renders an interactive graph/network visualization using Cytoscape.js. The JSON body describes nodes, edges, an optional layout algorithm, and optional style rules. The JSON is parsed and validated before rendering; invalid blocks fall back to a plain code block.

---

## Top-Level Object

```jsonc
{
  "elements": { ... },   // required — nodes and edges (two formats accepted)
  "layout": { ... },     // optional — layout algorithm (default: cose)
  "style": [ ... ]       // optional — visual style rules
}
```

`elements` is the only required field. An empty object `{}` or a missing `elements` key is rejected.

---

## Elements

Elements can be provided in **two formats**:

### Format A: Object with `nodes` and `edges` arrays

```jsonc
{
  "elements": {
    "nodes": [
      { "data": { "id": "a" } },
      { "data": { "id": "b" } }
    ],
    "edges": [
      { "data": { "source": "a", "target": "b" } }
    ]
  }
}
```

Both `nodes` and `edges` must be arrays. They can contain zero items individually, but they cannot **both** be empty.

### Format B: Flat array of elements

```jsonc
{
  "elements": [
    { "data": { "id": "a" } },
    { "data": { "id": "b" } },
    { "data": { "source": "a", "target": "b" } }
  ]
}
```

An element with `data.id` is treated as a node. An element with `data.source` and `data.target` is treated as an edge. The flat array must not be empty.

### Node fields

| Field | Type | Required | Constraints |
|---|---|---|---|
| `data.id` | `string` | yes | Non-empty string. Must be unique across all nodes. |
| `data.*` | `unknown` | no | Any additional data properties (e.g. `data.label`, `data.weight`). |
| Top-level keys | `unknown` | no | Any additional keys on the node object itself (e.g. `position`, `classes`). |

### Edge fields

| Field | Type | Required | Constraints |
|---|---|---|---|
| `data.source` | `string` | yes | Non-empty string. Should reference an existing node `id`. |
| `data.target` | `string` | yes | Non-empty string. Should reference an existing node `id`. |
| `data.*` | `unknown` | no | Any additional data properties (e.g. `data.label`, `data.weight`). |
| Top-level keys | `unknown` | no | Any additional keys on the edge object itself. |

---

## Layout

Optional. When omitted, defaults to `cose`.

```jsonc
{
  "layout": {
    "name": "breadthfirst",   // required within layout — must be an allowed name
    "directed": true          // optional — extra options are passed through to Cytoscape.js
  }
}
```

### `name` — required `string`

Must be one of the 8 allowed layout names:

| Name | Description |
|---|---|
| `cose` | **Default.** Compound Spring Embedder: physics-based force-directed layout. Good general-purpose choice for arbitrary graphs. Nodes repel, edges attract, reaching an equilibrium. |
| `grid` | Places nodes in a grid pattern. Useful when structure does not matter and you want orderly placement. |
| `circle` | Arranges all nodes in a circle. Good for showing connectivity in small-to-medium graphs. |
| `breadthfirst` | Hierarchical tree layout (BFS from roots). Best for trees and DAGs. Pair with `"directed": true` for top-down flow. |
| `concentric` | Places nodes in concentric circles, typically by degree. Good for highlighting central/peripheral nodes. |
| `random` | Random positions. Useful only for testing or very small graphs where layout does not matter. |
| `preset` | Uses positions from each node's `position` field (`{ x, y }`). Nodes without a position are placed at `(0, 0)`. |
| `null` | No layout is run. Nodes remain at their current positions (or `(0, 0)` if no position data exists). |

### Additional layout options

Any extra properties on the layout object (beyond `name`) are passed through to the Cytoscape.js layout engine. Common examples:

| Option | Applies to | Purpose |
|---|---|---|
| `directed` | `breadthfirst` | `true` for top-down tree; `false` (default) for unrooted BFS |
| `spacingFactor` | `breadthfirst`, `concentric`, `circle` | Multiplier for spacing between nodes (e.g. `1.5` for more space) |
| `avoidOverlap` | most layouts | `true` (default for most) to prevent node overlap |
| `animate` | all | `false` (hardcoded in renderer) — the renderer always disables animation on relayout |
| `roots` | `breadthfirst` | Selector string for root nodes (e.g. `"#root"`) |
| `padding` | `cose` | Extra padding around the layout |

---

## Style

Optional. An array of style rules. Each rule targets elements via a selector and applies visual properties.

```jsonc
{
  "style": [
    {
      "selector": "node",
      "style": {
        "background-color": "#6366f1",
        "shape": "round-rectangle",
        "label": "data(id)"
      }
    },
    {
      "selector": "edge",
      "style": {
        "line-color": "#a5b4fc",
        "target-arrow-color": "#a5b4fc",
        "target-arrow-shape": "triangle"
      }
    }
  ]
}
```

### Style rule structure

| Field | Type | Required | Constraints |
|---|---|---|---|
| `selector` | `string` | yes | Cytoscape.js selector string (see below) |
| `style` | `object` | yes | Keys must be from the 22 allowed style properties |

### Common selectors

| Selector | Targets |
|---|---|
| `"node"` | All nodes |
| `"edge"` | All edges |
| `"#myId"` | The element with `data.id === "myId"` |
| `".className"` | Elements with that class |
| `"node[weight > 50]"` | Nodes where `data.weight > 50` |
| `"edge[source = 'a']"` | Edges originating from node `a` |

### Allowed style properties (22 total)

Every key in a `style` object must be one of the following. Any unrecognized key causes the entire block to be rejected (`invalid-style`).

#### Node properties

| Property | Purpose | Typical values |
|---|---|---|
| `background-color` | Fill color of the node body | `"#6366f1"`, `"rgb(99, 102, 241)"` |
| `border-color` | Color of the node border | `"#4f46e5"` |
| `border-width` | Thickness of the node border (px) | `1`, `2`, `0` |
| `shape` | Node shape | `"ellipse"`, `"round-rectangle"`, `"rectangle"`, `"diamond"`, `"triangle"`, `"hexagon"`, `"star"`, `"barrel"`, `"rhomboid"` |
| `width` | Node width (px or `"label"`) | `40`, `60`, `"label"` |
| `height` | Node height (px or `"label"`) | `40`, `60`, `"label"` |
| `opacity` | Overall node opacity | `0` (invisible) to `1` (fully opaque) |
| `padding` | Internal padding (px) | `10`, `20` |

#### Edge properties

| Property | Purpose | Typical values |
|---|---|---|
| `line-color` | Color of the edge line | `"#a5b4fc"` |
| `line-style` | Edge line pattern | `"solid"`, `"dotted"`, `"dashed"` |
| `width` | Edge line thickness (px) | `1`, `2`, `3` |
| `curve-style` | How the edge curves | `"bezier"`, `"straight"`, `"taxi"`, `"segments"`, `"unbundled-bezier"` |
| `target-arrow-color` | Color of the arrowhead at the target end | `"#a5b4fc"` |
| `target-arrow-shape` | Shape of the arrowhead at the target end | `"triangle"`, `"vee"`, `"circle"`, `"diamond"`, `"none"` |
| `source-arrow-color` | Color of the arrowhead at the source end | `"#a5b4fc"` |
| `source-arrow-shape` | Shape of the arrowhead at the source end | `"triangle"`, `"vee"`, `"circle"`, `"diamond"`, `"none"` |
| `opacity` | Overall edge opacity | `0` to `1` |

#### Label/text properties (apply to both nodes and edges)

| Property | Purpose | Typical values |
|---|---|---|
| `label` | Text label to display | `"data(id)"`, `"data(label)"`, `"My Label"` |
| `font-size` | Label font size (px) | `10`, `12`, `14` |
| `color` | Label text color | `"#4b5563"`, `"white"` |
| `text-opacity` | Label text opacity | `0` to `1` |
| `text-valign` | Vertical alignment of the label (nodes only) | `"center"`, `"top"`, `"bottom"` |
| `text-halign` | Horizontal alignment of the label (nodes only) | `"center"`, `"left"`, `"right"` |

#### Overlay property

| Property | Purpose | Typical values |
|---|---|---|
| `overlay-opacity` | Opacity of the interaction overlay (hover/tap highlight) | `0` (no highlight) to `1` |

---

## Default Styling

When no `style` array is provided, the renderer applies these defaults (which also serve as a base layer beneath user style rules):

**Nodes:**
- `background-color`: derived from CSS `--primary` (dark: `#e5e7eb`, light: `#18181b`)
- `border-color`: derived from CSS `--border`
- `border-width`: `1`
- `label`: `data(id)` (the node's id is shown as its label)
- `font-size`: `12`
- `color`: derived from CSS `--muted-foreground`
- `text-valign`: `"center"`
- `text-halign`: `"center"`
- `overlay-opacity`: `0`

**Edges:**
- `width`: `2`
- `line-color`: derived from CSS `--border`
- `target-arrow-color`: derived from CSS `--border`
- `target-arrow-shape`: `"triangle"`
- `curve-style`: `"bezier"`
- `overlay-opacity`: `0`

User-supplied style rules are appended **after** these defaults, so they override on a per-property basis through CSS specificity.

---

## Validation Limits Summary

| Limit | Value |
|---|---|
| Total JSON size | 50,000 characters |
| Layout names | `cose`, `grid`, `circle`, `breadthfirst`, `concentric`, `random`, `preset`, `null` |
| Style properties | 22 allowed properties (listed above) |
| External references | Blocked (recursive scan of all string values) |

---

## What Gets Rejected

| Reason | Trigger |
|---|---|
| `oversize` | JSON string exceeds 50,000 characters |
| `unparseable` | JSON syntax error (cannot be parsed by `JSON.parse`) |
| `not-an-object` | Top level is not a plain object, or is an empty object `{}` |
| `missing-elements` | The `elements` key is absent |
| `invalid-elements` | `elements` is present but invalid: not an object/array, contains invalid nodes/edges, both `nodes` and `edges` are empty, or the flat array is empty |
| `invalid-layout` | `layout` is present but is not a plain object, or `layout.name` is missing or not one of the 8 allowed names |
| `invalid-style` | `style` is present but is not an array, or any rule is missing `selector`/`style`, or any style property key is not in the 22 allowed properties |
| `external-reference` | Any string value anywhere in the JSON (recursively scanned) starts with a blocked prefix: `image://`, `http:`, `https:`, `ftp:`, `ftps:`, `ws:`, `wss:`, `file:`, `blob:`, `data:`, `javascript:`, `vbscript:`, `//` |

When a block is rejected, it renders as a plain syntax-highlighted code block — not a graph.

### External reference detection specifics

The scanner traverses the entire parsed JSON tree recursively. Every string value is trimmed, lowercased, and checked against the prefix list. This means external references are blocked even if buried inside `data` properties, layout options, or style values.

---

## Rendering Behavior

### Canvas dimensions

The graph canvas has `aspect-ratio: 4/3` with a `min-height: 240px` and `width: 100%`. The graph fills the container and is not scrollable — use panning and zooming to navigate.

### Interaction

- **Panning**: click and drag on the background to pan
- **Zooming**: scroll wheel or pinch gesture to zoom
- **Reset view**: a button in the top-right corner of the canvas fits all elements into view
- **Node dragging**: disabled (`autoungrabify: true`) — nodes cannot be dragged by the user
- **Box selection**: disabled

### Resize behavior

When the container resizes, the renderer debounces (200ms), re-runs the layout algorithm, and re-fits the view. The layout name is taken from `config.layout.name` (or `cose` if none was specified).

### Dark mode

The renderer reads CSS custom properties to derive theme-appropriate colors:

| CSS Property | Used for | Dark fallback | Light fallback |
|---|---|---|---|
| `--primary` | Node background | `#e5e7eb` | `#18181b` |
| `--border` | Node border, edge line/arrow colors | `rgba(255,255,255,0.1)` | `rgba(0,0,0,0.1)` |
| `--muted-foreground` | Label text color | `#adbac7` | `#4b5563` |

Dark mode changes are applied reactively — switching the color mode updates the graph without a page reload.

### Lifecycle

- Cytoscape.js is lazy-loaded (dynamic `import('cytoscape')`) on first use. A loading indicator is shown while loading.
- The Cytoscape instance is destroyed on component unmount.

---

## Complete Examples

### 1. Minimal graph — Two connected nodes

````
```cytoscape
{
  "elements": {
    "nodes": [
      { "data": { "id": "a" } },
      { "data": { "id": "b" } }
    ],
    "edges": [
      { "data": { "source": "a", "target": "b" } }
    ]
  }
}
```
````

Uses the default `cose` layout. Nodes display their `id` as labels.

### 2. Labeled nodes with custom data

````
```cytoscape
{
  "elements": {
    "nodes": [
      { "data": { "id": "server", "label": "Web Server" } },
      { "data": { "id": "db", "label": "Database" } },
      { "data": { "id": "cache", "label": "Redis Cache" } }
    ],
    "edges": [
      { "data": { "source": "server", "target": "db", "label": "SQL" } },
      { "data": { "source": "server", "target": "cache", "label": "GET/SET" } }
    ]
  },
  "style": [
    { "selector": "node", "style": { "label": "data(label)" } },
    { "selector": "edge", "style": { "label": "data(label)", "font-size": 10, "color": "#9ca3af" } }
  ]
}
```
````

Uses `data(label)` in the style to display the `label` data property instead of the `id`.

### 3. Directed graph with arrows

````
```cytoscape
{
  "elements": {
    "nodes": [
      { "data": { "id": "start" } },
      { "data": { "id": "process" } },
      { "data": { "id": "end" } }
    ],
    "edges": [
      { "data": { "source": "start", "target": "process" } },
      { "data": { "source": "process", "target": "end" } }
    ]
  },
  "layout": { "name": "breadthfirst", "directed": true },
  "style": [
    { "selector": "edge", "style": { "target-arrow-shape": "triangle", "curve-style": "bezier" } }
  ]
}
```
````

The `breadthfirst` layout with `directed: true` arranges nodes top-to-bottom. Arrows show flow direction.

### 4. Styled graph — Custom colors and shapes

````
```cytoscape
{
  "elements": {
    "nodes": [
      { "data": { "id": "api" } },
      { "data": { "id": "auth" } },
      { "data": { "id": "db" } },
      { "data": { "id": "queue" } }
    ],
    "edges": [
      { "data": { "source": "api", "target": "auth" } },
      { "data": { "source": "api", "target": "db" } },
      { "data": { "source": "api", "target": "queue" } }
    ]
  },
  "layout": { "name": "circle" },
  "style": [
    {
      "selector": "node",
      "style": {
        "background-color": "#6366f1",
        "border-color": "#4f46e5",
        "border-width": 2,
        "shape": "round-rectangle",
        "width": 50,
        "height": 50,
        "color": "#e0e7ff"
      }
    },
    {
      "selector": "edge",
      "style": {
        "line-color": "#a5b4fc",
        "target-arrow-color": "#a5b4fc",
        "target-arrow-shape": "vee",
        "width": 2
      }
    }
  ]
}
```
````

### 5. Breadthfirst tree

````
```cytoscape
{
  "elements": {
    "nodes": [
      { "data": { "id": "CEO" } },
      { "data": { "id": "CTO" } },
      { "data": { "id": "CFO" } },
      { "data": { "id": "Dev Lead" } },
      { "data": { "id": "QA Lead" } },
      { "data": { "id": "Accounting" } }
    ],
    "edges": [
      { "data": { "source": "CEO", "target": "CTO" } },
      { "data": { "source": "CEO", "target": "CFO" } },
      { "data": { "source": "CTO", "target": "Dev Lead" } },
      { "data": { "source": "CTO", "target": "QA Lead" } },
      { "data": { "source": "CFO", "target": "Accounting" } }
    ]
  },
  "layout": { "name": "breadthfirst", "directed": true, "spacingFactor": 1.5 }
}
```
````

Organizational hierarchy rendered as a top-down tree. `spacingFactor: 1.5` adds extra breathing room between levels.

### 6. Flat array format with mixed styling

````
```cytoscape
{
  "elements": [
    { "data": { "id": "input", "label": "User Input" } },
    { "data": { "id": "validate", "label": "Validate" } },
    { "data": { "id": "transform", "label": "Transform" } },
    { "data": { "id": "store", "label": "Store" } },
    { "data": { "id": "respond", "label": "Respond" } },
    { "data": { "source": "input", "target": "validate" } },
    { "data": { "source": "validate", "target": "transform" } },
    { "data": { "source": "transform", "target": "store" } },
    { "data": { "source": "store", "target": "respond" } }
  ],
  "layout": { "name": "breadthfirst", "directed": true },
  "style": [
    {
      "selector": "node",
      "style": {
        "label": "data(label)",
        "background-color": "#059669",
        "shape": "round-rectangle",
        "width": 60,
        "height": 40,
        "font-size": 10,
        "color": "#d1fae5",
        "text-valign": "center",
        "text-halign": "center"
      }
    },
    {
      "selector": "#input",
      "style": { "background-color": "#2563eb" }
    },
    {
      "selector": "#respond",
      "style": { "background-color": "#dc2626" }
    },
    {
      "selector": "edge",
      "style": {
        "line-color": "#6b7280",
        "target-arrow-color": "#6b7280",
        "target-arrow-shape": "triangle",
        "curve-style": "bezier",
        "width": 2,
        "line-style": "solid"
      }
    }
  ]
}
```
````

Uses the flat array element format. Demonstrates per-node styling with `#id` selectors, custom shapes, labeled nodes, and edge arrows. The pipeline flows top-to-bottom with colored endpoints.

### 7. Concentric layout with dashed edges

````
```cytoscape
{
  "elements": {
    "nodes": [
      { "data": { "id": "core" } },
      { "data": { "id": "service-a" } },
      { "data": { "id": "service-b" } },
      { "data": { "id": "service-c" } },
      { "data": { "id": "external-1" } },
      { "data": { "id": "external-2" } }
    ],
    "edges": [
      { "data": { "source": "core", "target": "service-a" } },
      { "data": { "source": "core", "target": "service-b" } },
      { "data": { "source": "core", "target": "service-c" } },
      { "data": { "source": "service-a", "target": "external-1" } },
      { "data": { "source": "service-b", "target": "external-2" } }
    ]
  },
  "layout": { "name": "concentric" },
  "style": [
    { "selector": "#core", "style": { "background-color": "#ef4444", "width": 60, "height": 60 } },
    { "selector": "edge", "style": { "line-style": "dashed", "line-color": "#9ca3af", "target-arrow-shape": "none" } }
  ]
}
```
````

Shows a concentric ring layout with a highlighted core node and dashed edges.

---

## Unsupported Features

The following Cytoscape.js library features are **not** available through this fence type:

- **Compound (parent) nodes** — `data.parent` for nested group nodes is not validated or styled
- **Animations** — the renderer sets `animate: false` on all layout runs
- **Event handlers** — no `tap`, `mouseover`, `cxttap`, or other event bindings
- **Custom images on nodes** — `background-image`, `background-image-url` are not in the allowed style properties, and any URL would be blocked by the external-reference scanner
- **Background images or watermarks** — not exposed
- **Node gradient fills** — not available (only flat `background-color`)
- **Edge labels with background** — `text-background-color`, `text-background-opacity`, `text-background-shape` are not allowed
- **Compound node padding/border** — `compound-sizing-wrt-labels`, `min-width`, `min-height` are not allowed
- **Edge endpoint positioning** — `source-endpoint`, `target-endpoint` are not allowed
- **Ghost/overlay styling** — `ghost-*` properties are not allowed
- **Selection/grabbing styling** — `:selected`, `:grabbed` state styling is not meaningful (selection and grabbing are disabled)
- **Pie chart backgrounds** — `pie-*` properties are not allowed
- **Multiple labels** — `source-label`, `target-label` are not allowed
- **Extensions/plugins** — no Cytoscape.js extensions (e.g. `cytoscape-dagre`, `cytoscape-cola`, `cytoscape-elk`) are loaded
- **Export** — `cy.png()`, `cy.jpg()` export functions are not accessible
- **Programmatic manipulation** — no API to add/remove elements or run algorithms after render
- **Taphold / right-click context menus** — no context menu support
- **Tooltips** — no built-in tooltip on hover (only labels are shown)
