# `echarts` Fence Type — Chart & Map Visualization

Fence tag: ` ```echarts `

Renders an interactive chart or map using Apache ECharts. The JSON body is a standard ECharts option object — any series type that ECharts supports can be used. The block is validated for security before rendering; invalid blocks fall back to a plain code block.

---

## Top-Level Object

```jsonc
{
  "title": { ... },           // optional — chart title
  "tooltip": { ... },         // optional — hover tooltip config
  "legend": { ... },          // optional — legend config
  "xAxis": { ... },           // optional — category or value axis
  "yAxis": { ... },           // optional — category or value axis
  "series": [ ... ],          // required for most types — data series
  "visualMap": { ... },       // optional — color mapping (heatmap, map)
  "dataZoom": [ ... ],        // optional — scroll/zoom on axes
  "grid": { ... },            // optional — chart area layout
  "radar": { ... },           // optional — radar axis config
  "geo": { ... },             // optional — geographic coordinate system
  "parallel": { ... },        // optional — parallel axis config
  "parallelAxis": [ ... ],    // optional — parallel coordinate axes
  "height": 500,              // optional — override default aspect ratio (px)
  "prompt": "..."             // see Prompt Interaction below
}
```

The option is passed directly to `echarts.setOption()`. There is no allowlist of chart types — any valid ECharts series type renders.

### Special fields (non-ECharts)

| Field | Type | Description |
|---|---|---|
| `height` | `number` | When set (> 0), overrides the default 1:1 aspect ratio container with a fixed pixel height. Stripped before passing to ECharts. |

---

## Series Types

Every chart type is declared via `series[].type`. Multiple series of different types can coexist in a single chart. Below is a reference for each supported type.

**Always set `series[].name`.** When `name` is omitted, ECharts auto-generates labels like `"series0"`, `"series1"` — these show up in tooltips and legends. Give every series a meaningful `name` (e.g. `"Revenue"`, `"Temperature"`) or use a custom tooltip `formatter` to control what appears.

### Bar

Vertical or horizontal bars. Set `xAxis.type: "category"` for vertical bars, or swap axes for horizontal.

```jsonc
{
  "xAxis": { "type": "category", "data": ["Q1", "Q2", "Q3", "Q4"] },
  "yAxis": { "type": "value" },
  "series": [{ "type": "bar", "data": [120, 200, 150, 80] }]
}
```

**Stacked bars:** add `stack: "group-name"` to each series in the same stack.

**Horizontal bars:** swap `xAxis` ↔ `yAxis` (put categories on `yAxis`).

### Line

Trend lines, area charts, and stacked areas.

```jsonc
{
  "xAxis": { "type": "category", "data": ["Mon", "Tue", "Wed", "Thu", "Fri"] },
  "yAxis": { "type": "value" },
  "series": [{
    "type": "line",
    "data": [820, 932, 901, 934, 1290],
    "smooth": true
  }]
}
```

**Area chart:** add `areaStyle: {}` to the series.

**Stacked area:** add both `stack: "group-name"` and `areaStyle: {}`.

### Pie / Doughnut

Proportional data. No axes needed.

```jsonc
{
  "series": [{
    "type": "pie",
    "radius": "60%",
    "data": [
      { "value": 335, "name": "Direct" },
      { "value": 310, "name": "Email" },
      { "value": 234, "name": "Search" }
    ]
  }]
}
```

**Doughnut:** set `radius: ["40%", "70%"]` (inner, outer).

**Rose (nightingale):** add `roseType: "area"` or `roseType: "radius"`.

### Scatter

Point clouds on numeric axes. Each data item is `[x, y]` or `[x, y, size]`.

```jsonc
{
  "xAxis": { "type": "value" },
  "yAxis": { "type": "value" },
  "series": [{
    "type": "scatter",
    "symbolSize": 12,
    "data": [[10.0, 8.04], [8.0, 6.95], [13.0, 7.58], [9.0, 8.81]]
  }]
}
```

**Bubble chart:** use a function-like encoding — set `symbolSize` as a number or use a third value in data to vary size via `visualMap`.

### Radar

Multi-axis star chart. Requires a `radar` component defining the axes (called "indicators").

```jsonc
{
  "radar": {
    "indicator": [
      { "name": "Sales", "max": 6500 },
      { "name": "Admin", "max": 16000 },
      { "name": "IT", "max": 30000 },
      { "name": "Support", "max": 38000 },
      { "name": "R&D", "max": 52000 },
      { "name": "Marketing", "max": 25000 }
    ]
  },
  "series": [{
    "type": "radar",
    "data": [
      { "value": [4200, 3000, 20000, 35000, 50000, 18000], "name": "Budget" },
      { "value": [5000, 14000, 28000, 26000, 42000, 21000], "name": "Actual" }
    ]
  }]
}
```

### Gauge

Single-value dial indicator. No axes needed.

```jsonc
{
  "series": [{
    "type": "gauge",
    "data": [{ "value": 72, "name": "Completion" }],
    "min": 0,
    "max": 100,
    "detail": { "formatter": "{value}%" }
  }]
}
```

### Funnel

Stages of a process, wide at top and narrow at bottom (or reversed).

```jsonc
{
  "series": [{
    "type": "funnel",
    "data": [
      { "value": 100, "name": "Visit" },
      { "value": 80, "name": "Inquiry" },
      { "value": 60, "name": "Order" },
      { "value": 40, "name": "Payment" },
      { "value": 20, "name": "Retained" }
    ]
  }]
}
```

### Treemap

Hierarchical data as nested rectangles.

```jsonc
{
  "series": [{
    "type": "treemap",
    "data": [
      { "name": "Category A", "value": 100, "children": [
        { "name": "A1", "value": 60 },
        { "name": "A2", "value": 40 }
      ]},
      { "name": "Category B", "value": 80 }
    ]
  }]
}
```

### Sunburst

Hierarchical data as concentric rings.

```jsonc
{
  "series": [{
    "type": "sunburst",
    "data": [
      { "name": "Group A", "children": [
        { "name": "A1", "value": 15 },
        { "name": "A2", "value": 25 }
      ]},
      { "name": "Group B", "children": [
        { "name": "B1", "value": 30 },
        { "name": "B2", "value": 10 }
      ]}
    ],
    "radius": ["20%", "90%"]
  }]
}
```

### Heatmap

Grid of colored cells. Requires `visualMap` for the color scale. Data items are `[xIndex, yIndex, value]`.

```jsonc
{
  "xAxis": { "type": "category", "data": ["Mon", "Tue", "Wed", "Thu", "Fri"] },
  "yAxis": { "type": "category", "data": ["Morning", "Afternoon", "Evening"] },
  "visualMap": { "min": 0, "max": 100, "calculable": true },
  "series": [{
    "type": "heatmap",
    "data": [
      [0, 0, 10], [0, 1, 52], [0, 2, 80],
      [1, 0, 30], [1, 1, 45], [1, 2, 60],
      [2, 0, 70], [2, 1, 90], [2, 2, 35],
      [3, 0, 25], [3, 1, 55], [3, 2, 95],
      [4, 0, 40], [4, 1, 65], [4, 2, 50]
    ],
    "label": { "show": true }
  }]
}
```

### Sankey

Flow diagram showing weighted relationships between nodes.

```jsonc
{
  "series": [{
    "type": "sankey",
    "data": [
      { "name": "Source A" },
      { "name": "Source B" },
      { "name": "Target X" },
      { "name": "Target Y" }
    ],
    "links": [
      { "source": "Source A", "target": "Target X", "value": 30 },
      { "source": "Source A", "target": "Target Y", "value": 20 },
      { "source": "Source B", "target": "Target X", "value": 10 },
      { "source": "Source B", "target": "Target Y", "value": 40 }
    ]
  }]
}
```

### Boxplot

Statistical box-and-whisker plots. Each data item is `[min, Q1, median, Q3, max]`.

```jsonc
{
  "xAxis": { "type": "category", "data": ["Group A", "Group B", "Group C"] },
  "yAxis": { "type": "value" },
  "series": [{
    "type": "boxplot",
    "data": [
      [655, 850, 940, 980, 1070],
      [760, 800, 845, 885, 960],
      [780, 840, 855, 880, 940]
    ]
  }]
}
```

### Candlestick

Financial OHLC data. Each data item is `[open, close, low, high]`.

```jsonc
{
  "xAxis": { "type": "category", "data": ["Jan", "Feb", "Mar", "Apr", "May"] },
  "yAxis": { "type": "value" },
  "series": [{
    "type": "candlestick",
    "data": [
      [20, 34, 10, 38],
      [40, 35, 30, 50],
      [31, 38, 33, 44],
      [38, 15, 5, 42],
      [20, 30, 18, 35]
    ]
  }]
}
```

### Graph (Force-Directed)

Network visualization with nodes and edges.

```jsonc
{
  "series": [{
    "type": "graph",
    "layout": "force",
    "roam": true,
    "label": { "show": true },
    "force": { "repulsion": 200 },
    "data": [
      { "name": "Node 1", "symbolSize": 30 },
      { "name": "Node 2", "symbolSize": 20 },
      { "name": "Node 3", "symbolSize": 25 },
      { "name": "Node 4", "symbolSize": 15 }
    ],
    "links": [
      { "source": "Node 1", "target": "Node 2" },
      { "source": "Node 1", "target": "Node 3" },
      { "source": "Node 2", "target": "Node 4" },
      { "source": "Node 3", "target": "Node 4" }
    ]
  }]
}
```

### Tree

Hierarchical tree layout (org charts, file trees).

```jsonc
{
  "series": [{
    "type": "tree",
    "data": [{
      "name": "Root",
      "children": [
        { "name": "Branch A", "children": [
          { "name": "Leaf A1" },
          { "name": "Leaf A2" }
        ]},
        { "name": "Branch B", "children": [
          { "name": "Leaf B1" }
        ]}
      ]
    }],
    "orient": "TB",
    "label": { "position": "top" }
  }]
}
```

`orient` can be `"TB"` (top-bottom), `"BT"`, `"LR"` (left-right), or `"RL"`.

### Parallel

Multi-dimensional data where each axis is a dimension.

```jsonc
{
  "parallelAxis": [
    { "dim": 0, "name": "Price" },
    { "dim": 1, "name": "Rating" },
    { "dim": 2, "name": "Volume" },
    { "dim": 3, "name": "Sales" }
  ],
  "series": [{
    "type": "parallel",
    "data": [
      [12, 4.5, 300, 120],
      [8, 3.8, 500, 200],
      [15, 4.2, 180, 90],
      [6, 4.9, 600, 350]
    ]
  }]
}
```

### Map (Choropleth)

Geographic choropleth using a pre-registered GeoJSON map. Each data item's `name` must match a GeoJSON feature's `properties.name`.

```jsonc
{
  "series": [{
    "type": "map",
    "map": "hungary",
    "label": { "show": true, "fontSize": 10 },
    "data": [
      { "name": "Budapest", "value": 5850 },
      { "name": "Pest", "value": 3610 },
      { "name": "Baranya", "value": 6000 }
    ]
  }],
  "visualMap": {
    "min": 2500,
    "max": 8000,
    "calculable": true,
    "inRange": { "color": ["#bae4bc", "#2b8cbe", "#084081"] }
  }
}
```

#### Registered maps

| `map` value | Region | Features |
|---|---|---|
| `hungary` | Hungary — counties | 20 counties (vármegyék) including Budapest |
| `hungary-regions` | Hungary — NUTS-2 regions | 8 statistical regions (régiók) including Budapest and Pest separately |

Only pre-registered map names work. Using an unregistered name renders nothing. The GeoJSON is lazy-loaded on first use.

#### Hungary county names (`map: "hungary"`)

The `data[].name` values must exactly match the GeoJSON feature names:

> Bács-Kiskun, Baranya, Békés, Borsod-Abaúj-Zemplén, Budapest, Csongrád-Csanád, Fejér, Győr-Moson-Sopron, Hajdú-Bihar, Heves, Jász-Nagykun-Szolnok, Komárom-Esztergom, Nógrád, Pest, Somogy, Szabolcs-Szatmár-Bereg, Tolna, Vas, Veszprém, Zala

#### Hungary region names (`map: "hungary-regions"`)

> Budapest, Dél-Alföld, Dél-Dunántúl, Észak-Alföld, Észak-Magyarország, Közép-Dunántúl, Nyugat-Dunántúl, Pest

Names are case-sensitive and include accented characters.

#### Map series fields

| Field | Type | Description |
|---|---|---|
| `type` | `"map"` | Required |
| `map` | `string` | Required — name of a registered map (e.g. `"hungary"`) |
| `data` | `array` | `{ name, value }` items mapping features to values |
| `label` | `object` | Label config (e.g. `{ "show": true, "fontSize": 10 }`) |
| `roam` | `boolean` | Enable pan/zoom interaction (default `false`) |
| `selectedMode` | `string\|boolean` | `"single"`, `"multiple"`, or `false` |
| `emphasis` | `object` | Hover highlight style |
| `itemStyle` | `object` | Default region fill/border style |

---

## Common Components

These ECharts components can be used across chart types.

### `title`

```jsonc
{ "title": { "text": "Main Title", "subtext": "Subtitle", "left": "center" } }
```

### `tooltip`

```jsonc
{ "tooltip": { "trigger": "axis" } }        // for line/bar
{ "tooltip": { "trigger": "item" } }        // for pie/scatter/map
{ "tooltip": { "trigger": "item", "formatter": "{b}: {c} kg/ha" } }
```

`trigger` values: `"item"` (per data point), `"axis"` (per axis category), `"none"`.

Tooltips are forced to `renderMode: "richText"` at runtime for security — custom HTML formatters are stripped.

### `legend`

```jsonc
{ "legend": { "show": true } }
{ "legend": { "data": ["Series A", "Series B"], "bottom": 0 } }
```

### `visualMap`

Maps numeric ranges to colors. Used with heatmap, map, and scatter charts.

```jsonc
{
  "visualMap": {
    "min": 0,
    "max": 100,
    "calculable": true,
    "text": ["High", "Low"],
    "inRange": { "color": ["#50a3ba", "#eac736", "#d94e5d"] }
  }
}
```

`type` can be `"continuous"` (default, slider) or `"piecewise"` (discrete segments).

### `dataZoom`

Adds scroll/zoom controls on axes.

```jsonc
{
  "dataZoom": [
    { "type": "slider", "xAxisIndex": 0 },
    { "type": "inside", "xAxisIndex": 0 }
  ]
}
```

`type: "slider"` shows a visible scrollbar. `type: "inside"` enables scroll-wheel / pinch zoom.

### `grid`

Controls the plot area position and size.

```jsonc
{ "grid": { "left": "10%", "right": "10%", "bottom": "15%", "containLabel": true } }
```

---

## Prompt Interaction

Data items can include a `prompt` field. When the user clicks a data point that has a prompt, the text is inserted into the chat composer so the user can send it as a follow-up message. A hint label appears below the chart when any data item has a valid prompt.

### Rules

| Constraint | Value |
|---|---|
| Field name | `prompt` |
| Type | `string` |
| Must be | Non-empty after trimming |
| Max length | 500 characters |

### Where to place prompts

Add `prompt` to individual data items in a series:

```jsonc
{
  "series": [{
    "type": "bar",
    "data": [
      { "value": 42, "name": "Widget A", "prompt": "Tell me more about Widget A" },
      { "value": 87, "name": "Widget B", "prompt": "Tell me more about Widget B" }
    ]
  }]
}
```

Prompts work on any series type — bar, pie, scatter, map, etc. On map charts, clicking a county/region with a `prompt` fills the composer.

### Invalid prompts

A `prompt` that fails validation (empty string, too long, non-string type) causes the entire chart to be rejected with `invalid-prompt`.

---

## Custom Height

By default, the chart container uses a 1:1 aspect ratio. Override with a top-level `height` field:

```jsonc
{
  "height": 400,
  "series": [{ "type": "pie", "data": [...] }]
}
```

The `height` field is stripped before the option reaches ECharts. Values must be positive numbers (pixels).

---

## Validation Limits

| Limit | Value |
|---|---|
| Total JSON size | 50,000 characters |
| Max `prompt` length | 500 characters |

---

## What Gets Rejected

| Reason | Trigger |
|---|---|
| `oversize` | JSON string exceeds 50,000 characters |
| `unparseable` | JSON syntax error |
| `not-an-object` | Top level is not a plain object, or is an empty object `{}` |
| `external-reference` | Any string value anywhere in the tree starts with a blocked protocol prefix |
| `navigation-target` | Any object has a `link` or `sublink` key with a non-empty string value |
| `invalid-prompt` | A `prompt` field exists but is not a non-empty string of ≤ 500 characters |

When a block is rejected, it renders as a plain syntax-highlighted code block — not a chart.

### External reference blocking

All string values in the entire option tree are scanned recursively. A string is blocked if it starts with (case-insensitive, after trimming):

`image://`, `http:`, `https:`, `ftp:`, `ftps:`, `ws:`, `wss:`, `file:`, `blob:`, `data:`, `javascript:`, `vbscript:`, `//`

This blocks external images, remote data sources, XSS vectors, and protocol-relative URLs.

### Navigation key blocking

ECharts supports `link` and `sublink` properties on data items to navigate the browser when clicked. These keys are blocked — any object with a non-empty `link` or `sublink` string value causes rejection.

---

## Dark Mode

The chart automatically adapts to the app's color mode:

- Background is always `transparent` (inherits the chat message background)
- Axis labels, lines, and split lines derive colors from CSS custom properties (`--muted-foreground`, `--border`)
- Text colors update when toggling light ↔ dark mode
- No action needed from the JSON payload

Explicitly setting `backgroundColor`, `textStyle.color`, or axis colors in the option will override the automatic theming.

---

## Tooltip Security

All tooltips are forced to `renderMode: "richText"` at runtime. This means:

- Custom HTML `formatter` functions are stripped (ECharts HTML tooltip rendering is disabled)
- Only ECharts' built-in rich text renderer is used
- String formatters like `"{b}: {c}"` work normally
- This prevents XSS via tooltip content

---

## Complete Examples

### 1. Bar chart — basic vertical bars

````
```echarts
{
  "xAxis": { "type": "category", "data": ["Budapest", "Debrecen", "Vienna", "Bratislava"] },
  "yAxis": { "type": "value" },
  "series": [{
    "type": "bar",
    "data": [
      { "value": 20750, "name": "Budapest" },
      { "value": 4120, "name": "Debrecen" },
      { "value": 24870, "name": "Vienna" },
      { "value": 0, "name": "Bratislava" }
    ]
  }]
}
```
````

### 2. Line chart — two series with legend

````
```echarts
{
  "xAxis": { "type": "category", "data": ["Jan", "Feb", "Mar", "Apr", "May", "Jun"] },
  "yAxis": { "type": "value" },
  "series": [
    { "type": "line", "name": "Sessions", "data": [120, 190, 145, 260, 310, 280], "smooth": true },
    { "type": "line", "name": "Answered", "data": [40, 72, 61, 118, 154, 149], "smooth": true }
  ],
  "legend": { "show": true }
}
```
````

### 3. Doughnut chart with title and tooltip

````
```echarts
{
  "title": { "text": "Ticket status", "left": "center" },
  "tooltip": { "trigger": "item" },
  "legend": { "bottom": 0 },
  "series": [{
    "type": "pie",
    "radius": ["45%", "72%"],
    "data": [
      { "value": 68, "name": "Resolved" },
      { "value": 19, "name": "In progress" },
      { "value": 13, "name": "Waiting" }
    ]
  }]
}
```
````

### 4. Stacked area chart

````
```echarts
{
  "tooltip": { "trigger": "axis" },
  "legend": { "show": true },
  "xAxis": { "type": "category", "data": ["Mon", "Tue", "Wed", "Thu", "Fri"] },
  "yAxis": { "type": "value" },
  "series": [
    {
      "type": "line", "name": "Support", "stack": "requests",
      "areaStyle": {}, "smooth": true, "data": [42, 58, 49, 63, 55]
    },
    {
      "type": "line", "name": "Sales", "stack": "requests",
      "areaStyle": {}, "smooth": true, "data": [28, 34, 41, 36, 48]
    }
  ]
}
```
````

### 5. Scatter plot

````
```echarts
{
  "title": { "text": "Resolution time vs. customer score", "left": "center" },
  "tooltip": { "trigger": "item" },
  "xAxis": { "type": "value", "name": "Hours to resolve" },
  "yAxis": { "type": "value", "name": "Score" },
  "series": [{
    "type": "scatter",
    "name": "Tickets",
    "symbolSize": 14,
    "data": [
      [1.2, 4.9], [2.4, 4.7], [3.1, 4.3],
      [4.8, 3.8], [6.2, 3.4], [7.5, 3.1]
    ]
  }]
}
```
````

### 6. Radar chart

````
```echarts
{
  "radar": {
    "indicator": [
      { "name": "Sales", "max": 100 },
      { "name": "Admin", "max": 100 },
      { "name": "IT", "max": 100 },
      { "name": "Support", "max": 100 },
      { "name": "R&D", "max": 100 }
    ]
  },
  "series": [{
    "type": "radar",
    "data": [
      { "value": [80, 60, 90, 70, 95], "name": "Team A" },
      { "value": [60, 85, 75, 80, 65], "name": "Team B" }
    ]
  }],
  "legend": { "show": true }
}
```
````

### 7. Gauge

````
```echarts
{
  "series": [{
    "type": "gauge",
    "data": [{ "value": 72, "name": "SLA %" }],
    "min": 0,
    "max": 100,
    "detail": { "formatter": "{value}%" }
  }]
}
```
````

### 8. Funnel

````
```echarts
{
  "tooltip": { "trigger": "item" },
  "series": [{
    "type": "funnel",
    "data": [
      { "value": 100, "name": "Visited" },
      { "value": 80, "name": "Inquiry" },
      { "value": 60, "name": "Order" },
      { "value": 40, "name": "Paid" },
      { "value": 20, "name": "Retained" }
    ]
  }]
}
```
````

### 9. Heatmap with axis labels

````
```echarts
{
  "tooltip": { "trigger": "item" },
  "xAxis": { "type": "category", "data": ["Mon", "Tue", "Wed", "Thu", "Fri"] },
  "yAxis": { "type": "category", "data": ["Morning", "Afternoon", "Evening"] },
  "visualMap": { "min": 0, "max": 100, "calculable": true },
  "series": [{
    "type": "heatmap",
    "data": [
      [0, 0, 10], [0, 1, 52], [0, 2, 80],
      [1, 0, 30], [1, 1, 45], [1, 2, 60],
      [2, 0, 70], [2, 1, 90], [2, 2, 35],
      [3, 0, 25], [3, 1, 55], [3, 2, 95],
      [4, 0, 40], [4, 1, 65], [4, 2, 50]
    ],
    "label": { "show": true }
  }]
}
```
````

### 10. Sankey flow diagram

````
```echarts
{
  "tooltip": { "trigger": "item" },
  "series": [{
    "type": "sankey",
    "data": [
      { "name": "Organic" },
      { "name": "Paid" },
      { "name": "Referral" },
      { "name": "Signup" },
      { "name": "Trial" },
      { "name": "Premium" }
    ],
    "links": [
      { "source": "Organic", "target": "Signup", "value": 500 },
      { "source": "Paid", "target": "Signup", "value": 300 },
      { "source": "Referral", "target": "Signup", "value": 200 },
      { "source": "Signup", "target": "Trial", "value": 800 },
      { "source": "Trial", "target": "Premium", "value": 350 }
    ]
  }]
}
```
````

### 11. Treemap — hierarchical proportions

````
```echarts
{
  "tooltip": { "trigger": "item" },
  "series": [{
    "type": "treemap",
    "data": [
      { "name": "Engineering", "value": 120, "children": [
        { "name": "Backend", "value": 50 },
        { "name": "Frontend", "value": 40 },
        { "name": "Infra", "value": 30 }
      ]},
      { "name": "Product", "value": 40 },
      { "name": "Design", "value": 25 }
    ]
  }]
}
```
````

### 12. Choropleth map — Hungarian counties

````
```echarts
{
  "title": { "text": "Kukorica termésátlaga vármegyénként, 2025", "left": "center" },
  "tooltip": { "trigger": "item", "formatter": "{b}: {c} kg/ha" },
  "visualMap": {
    "min": 2500,
    "max": 8000,
    "text": ["Magas", "Alacsony"],
    "calculable": true,
    "inRange": { "color": ["#bae4bc", "#2b8cbe", "#084081"] }
  },
  "series": [{
    "type": "map",
    "map": "hungary",
    "label": { "show": true, "fontSize": 10 },
    "data": [
      { "name": "Bács-Kiskun", "value": 4250 },
      { "name": "Baranya", "value": 6000 },
      { "name": "Békés", "value": 2720 },
      { "name": "Borsod-Abaúj-Zemplén", "value": 6350 },
      { "name": "Budapest", "value": 5850 },
      { "name": "Csongrád-Csanád", "value": 3570 },
      { "name": "Fejér", "value": 4650 },
      { "name": "Győr-Moson-Sopron", "value": 7630 },
      { "name": "Hajdú-Bihar", "value": 5400 },
      { "name": "Heves", "value": 3750 },
      { "name": "Jász-Nagykun-Szolnok", "value": 3750 },
      { "name": "Komárom-Esztergom", "value": 5260 },
      { "name": "Nógrád", "value": 4400 },
      { "name": "Pest", "value": 3610 },
      { "name": "Somogy", "value": 5910 },
      { "name": "Szabolcs-Szatmár-Bereg", "value": 5980 },
      { "name": "Tolna", "value": 5980 },
      { "name": "Vas", "value": 7360 },
      { "name": "Veszprém", "value": 5470 },
      { "name": "Zala", "value": 7120 }
    ]
  }]
}
```
````

### 13. Choropleth map — Hungarian regions

````
```echarts
{
  "title": { "text": "GDP per capita by region, 2024", "left": "center" },
  "tooltip": { "trigger": "item", "formatter": "{b}: {c} EUR" },
  "visualMap": {
    "min": 8000, "max": 40000,
    "text": ["High", "Low"],
    "calculable": true,
    "inRange": { "color": ["#fee8c8", "#e34a33"] }
  },
  "series": [{
    "type": "map",
    "map": "hungary-regions",
    "label": { "show": true, "fontSize": 11 },
    "data": [
      { "name": "Budapest", "value": 38200 },
      { "name": "Pest", "value": 14500 },
      { "name": "Közép-Dunántúl", "value": 15800 },
      { "name": "Nyugat-Dunántúl", "value": 16200 },
      { "name": "Dél-Dunántúl", "value": 10300 },
      { "name": "Észak-Magyarország", "value": 9800 },
      { "name": "Észak-Alföld", "value": 9200 },
      { "name": "Dél-Alföld", "value": 10600 }
    ]
  }]
}
```
````

### 14. Bar chart with prompt interaction

````
```echarts
{
  "xAxis": { "type": "category", "data": ["Alfa", "Beta", "Gamma"] },
  "yAxis": { "type": "value" },
  "series": [{
    "type": "bar",
    "data": [
      { "value": 18551, "name": "Alfa", "prompt": "Tell me more about Alfa" },
      { "value": 8300, "name": "Beta", "prompt": "Tell me more about Beta" },
      { "value": 22890, "name": "Gamma", "prompt": "Tell me more about Gamma" }
    ]
  }]
}
```
````

Clicking any bar fills the chat composer with the corresponding prompt text.

### 15. Candlestick chart

````
```echarts
{
  "xAxis": { "type": "category", "data": ["Jan", "Feb", "Mar", "Apr", "May"] },
  "yAxis": { "type": "value" },
  "series": [{
    "type": "candlestick",
    "data": [
      [20, 34, 10, 38],
      [40, 35, 30, 50],
      [31, 38, 33, 44],
      [38, 15, 5, 42],
      [20, 30, 18, 35]
    ]
  }]
}
```
````

### 16. Force-directed graph

````
```echarts
{
  "height": 500,
  "series": [{
    "type": "graph",
    "layout": "force",
    "roam": true,
    "label": { "show": true },
    "force": { "repulsion": 200, "edgeLength": 100 },
    "data": [
      { "name": "Auth", "symbolSize": 40 },
      { "name": "Users", "symbolSize": 30 },
      { "name": "Chat", "symbolSize": 35 },
      { "name": "Config", "symbolSize": 20 },
      { "name": "SignalR", "symbolSize": 25 }
    ],
    "links": [
      { "source": "Auth", "target": "Users" },
      { "source": "Auth", "target": "Config" },
      { "source": "Chat", "target": "Users" },
      { "source": "Chat", "target": "SignalR" },
      { "source": "SignalR", "target": "Config" }
    ]
  }]
}
```
````

### 17. Map with prompts — clickable counties

````
```echarts
{
  "title": { "text": "Click a county for details", "left": "center" },
  "tooltip": { "trigger": "item" },
  "visualMap": {
    "min": 0, "max": 100, "calculable": true,
    "inRange": { "color": ["#e0f3db", "#43a2ca"] }
  },
  "series": [{
    "type": "map",
    "map": "hungary",
    "name": "Coverage",
    "label": { "show": true, "fontSize": 9 },
    "data": [
      { "name": "Budapest", "value": 95, "prompt": "Tell me about Budapest's coverage" },
      { "name": "Pest", "value": 72, "prompt": "Tell me about Pest county's coverage" },
      { "name": "Győr-Moson-Sopron", "value": 88, "prompt": "Tell me about Győr county's coverage" },
      { "name": "Hajdú-Bihar", "value": 64, "prompt": "Tell me about Hajdú-Bihar's coverage" }
    ]
  }]
}
```
````

---

## Unsupported Features

The following ECharts capabilities are **not** available through this fence type:

- **Custom JavaScript** — functions in `formatter`, `encode`, or event callbacks (the option is JSON, not JS)
- **External data loading** — `dataset.source` URLs, image URLs, or any remote references (blocked by validation)
- **HTML tooltips** — custom HTML formatters are stripped; only `renderMode: "richText"` is used
- **Navigation links** — `link` and `sublink` properties are blocked
- **Extension charts** — types requiring separate ECharts extension packages (e.g. `wordCloud`, `liquidFill`, `bmap`)
- **Unregistered maps** — only pre-registered map names work (currently: `hungary`). Custom GeoJSON cannot be passed inline
- **Toolbox** — the toolbar component renders but export/download buttons are non-functional in the sandboxed environment
- **Timeline** — the `timeline` component for animated option switching is not tested and may not work correctly
- **3D charts** — `bar3D`, `scatter3D`, `surface3D` etc. require the `echarts-gl` extension which is not bundled
