# `bar-race` Fence Type — Animated Bar Chart Race

Fence tag: ` ```bar-race `

Renders an animated bar chart race using ECharts. Shows how values for categories change over a sequence of frames (e.g., population by country over years). The user gets playback controls: play/pause button, seek slider, and current frame label. The JSON body is parsed and validated before rendering; invalid blocks fall back to a plain code block.

---

## Top-Level Object

```jsonc
{
  "categories": ["A", "B", "C"],         // required — bar labels
  "start": 2020,                          // required — first frame label
  "end": 2022,                            // required — last frame label
  "step": 1,                              // required — increment between frames
  "sort": "desc",                         // optional (default "desc")
  "maxBars": null,                        // optional (default null — show all)
  "stepDuration": null,                   // optional (default null → 1000ms)
  "frames": [                             // required — one object per frame
    { "A": 10, "B": 20, "C": 15 },
    { "A": 25, "B": 18, "C": 30 },
    { "A": 40, "B": 35, "C": 28 }
  ]
}
```

---

## Fields

### `categories` — required `string[]`

A non-empty array of non-empty strings identifying each bar. These are the labels shown on the y-axis.

| Constraint | Value |
|---|---|
| Minimum length | 1 element |
| Element type | Non-empty string |
| Duplicates | Not allowed — every string must be unique |

### `start` — required `number`

The label for the first frame.

| Constraint | Value |
|---|---|
| Must be | A finite number (no `NaN`, `Infinity`) |

### `end` — required `number`

The label for the last frame. Defines the upper bound of the frame range.

| Constraint | Value |
|---|---|
| Must be | A finite number (no `NaN`, `Infinity`) |
| Relationship | Must be >= `start` |

### `step` — required `number`

The increment between consecutive frames. Determines how many frames are expected.

| Constraint | Value |
|---|---|
| Must be | A finite number > 0 |

### `sort` — optional `'asc' | 'desc'`

Controls the sort order of bars within each frame.

| Constraint | Value |
|---|---|
| Allowed values | `"asc"` or `"desc"` |
| Default | `"desc"` |

- `"desc"` — highest values at the top (most common for bar race charts)
- `"asc"` — lowest values at the top

### `maxBars` — optional `number | null`

Limits how many bars are visible at once. When set, only the top N bars (per the sort order) are shown.

| Constraint | Value |
|---|---|
| Must be | An integer >= 1 (if provided) |
| Default | `null` (all categories visible) |

### `stepDuration` — optional `number | null`

Milliseconds per frame during playback.

| Constraint | Value |
|---|---|
| Must be | A finite number > 0 (if provided) |
| Default | `null` (falls back to 1000ms) |
| Animation duration | `stepDuration * 0.8` (bars animate at 80% of frame time) |
| Animation easing | Linear |

---

## Frame Count Formula

The number of frames in the `frames` array must **exactly** match:

```
expectedFrames = Math.round((end - start) / step) + 1
```

This is strictly enforced. If `frames.length` does not equal the expected count, the block is rejected with `frame-count-mismatch`.

**Examples:**

| start | end | step | Expected frames |
|---|---|---|---|
| 2020 | 2022 | 1 | 3 (2020, 2021, 2022) |
| 2000 | 2020 | 2 | 11 (2000, 2002, ..., 2020) |
| 0 | 1 | 0.25 | 5 (0, 0.25, 0.5, 0.75, 1.0) |
| 1990 | 2020 | 5 | 7 (1990, 1995, 2000, 2005, 2010, 2015, 2020) |
| 10 | 10 | 1 | 1 (just frame 10) |

---

## How Frames Map to Labels

Each frame in the `frames` array corresponds to a label computed as:

```
label = start + frameIndex * step
```

where `frameIndex` is the zero-based position in the `frames` array (0, 1, 2, ...).

**Label formatting:**
- Integer values are displayed as integers (e.g., `2020`)
- Non-integer values are displayed with 2 decimal places (e.g., `0.25`)

---

## Frame Objects

Each element in the `frames` array is an object mapping category names to numeric values.

```jsonc
{ "CategoryA": 100, "CategoryB": 250, "CategoryC": 175 }
```

| Constraint | Value |
|---|---|
| Keys | Must be members of `categories` |
| Values | Must be finite numbers (no `NaN`, `Infinity`) |
| Missing keys | A category not present in a frame object is valid (it will have no bar for that frame) |

Not every category must appear in every frame. If a category is absent from a frame, it simply has no bar shown for that time step.

---

## Playback Behavior

The chart provides three controls:

1. **Play/Pause button** — starts or pauses the animation
2. **Seek slider** — drag to jump to any frame
3. **Current frame label** — displays the label for the currently shown frame

Playback behavior:
- Animation advances one frame per `stepDuration` (default 1000ms)
- Bars animate smoothly between frames over `stepDuration * 0.8` ms with linear easing
- ECharts `realtimeSort: true` makes bars reorder smoothly as values change
- Playback auto-stops when the last frame is reached
- After reaching the end, pressing play restarts from the beginning

---

## Sort Behavior

The `sort` field controls bar ordering within each frame:

- **`"desc"`** (default) — bars sorted from highest to lowest value, highest at the top. This is the standard layout for bar race charts where viewers track which category "wins."
- **`"asc"`** — bars sorted from lowest to highest value, lowest at the top.

Sorting is applied in real time as values change between frames (`realtimeSort: true`), so bars visually slide past each other during transitions.

---

## `maxBars` Behavior

When `maxBars` is set to an integer N:
- Only the top N bars (per sort order) are visible at any given frame
- The ECharts yAxis `max` property is set to N
- Categories outside the top N are hidden but will appear if their values enter the top N in a later frame

When `maxBars` is `null` (default), all categories are visible in every frame.

This is useful when you have many categories but want to focus on the leaders — e.g., 50 countries but only showing the top 10 at any time.

---

## Rendering Details

- Chart type: ECharts horizontal bar chart
- Canvas aspect ratio: `1:1` (square)
- On mobile (viewport < 640px): canvas height fixed at 240px instead of aspect-ratio
- Grid layout: right margin 80px (for value labels), left margin 10px with `containLabel: true`
- Dark mode: automatically handled via ECharts theme

---

## Validation Limits Summary

| Limit | Value |
|---|---|
| Total JSON size | 500,000 characters |
| `categories` | Non-empty array of unique non-empty strings |
| `start` | Finite number |
| `end` | Finite number, >= `start` |
| `step` | Finite number > 0 |
| `sort` | `"asc"` or `"desc"` |
| `maxBars` | Integer >= 1, or `null` |
| `stepDuration` | Finite number > 0, or `null` |
| `frames` | Non-empty array; length must equal `Math.round((end - start) / step) + 1` |
| Frame values | Finite numbers |
| Frame keys | Must be members of `categories` |

---

## What Gets Rejected

| Reason | Trigger |
|---|---|
| `oversize` | JSON string exceeds 500,000 characters |
| `unparseable` | JSON syntax error |
| `not-an-object` | Top level is not a plain object |
| `invalid-categories` | `categories` is missing, not an array, empty, contains non-strings, empty strings, or duplicates |
| `invalid-range` | `start`, `end`, or `step` is missing or not a finite number; `end < start`; `step <= 0` |
| `invalid-frames` | `frames` is missing, not a non-empty array, or a frame contains non-finite values or keys not in `categories` |
| `frame-count-mismatch` | `frames.length` does not equal `Math.round((end - start) / step) + 1` |
| `invalid-sort` | `sort` is present but is not `"asc"` or `"desc"` |
| `invalid-max-bars` | `maxBars` is present and not `null`, but is not an integer >= 1 |
| `invalid-step-duration` | `stepDuration` is present and not `null`, but is not a finite number > 0 |

When a block is rejected, it renders as a plain syntax-highlighted code block — not an animated chart.

---

## Complete Examples

### 1. Minimal — 3 categories, 3 frames

start=2020, end=2022, step=1 → `Math.round((2022 - 2020) / 1) + 1 = 3` frames.

````
```bar-race
{
  "categories": ["Apples", "Bananas", "Cherries"],
  "start": 2020,
  "end": 2022,
  "step": 1,
  "frames": [
    { "Apples": 50, "Bananas": 30, "Cherries": 20 },
    { "Apples": 55, "Bananas": 45, "Cherries": 38 },
    { "Apples": 60, "Bananas": 70, "Cherries": 42 }
  ]
}
```
````

Uses all defaults: `sort` is `"desc"`, `maxBars` is `null` (all visible), `stepDuration` is `null` (1000ms).

### 2. Medium — 5 categories over 10 years with maxBars

start=2010, end=2020, step=2 → `Math.round((2020 - 2010) / 2) + 1 = 6` frames.

````
```bar-race
{
  "categories": ["USA", "China", "India", "Brazil", "Germany"],
  "start": 2010,
  "end": 2020,
  "step": 2,
  "maxBars": 3,
  "frames": [
    { "USA": 310, "China": 1340, "India": 1230, "Brazil": 196, "Germany": 82 },
    { "USA": 314, "China": 1355, "India": 1260, "Brazil": 200, "Germany": 81 },
    { "USA": 319, "China": 1371, "India": 1295, "Brazil": 204, "Germany": 81 },
    { "USA": 323, "China": 1383, "India": 1326, "Brazil": 208, "Germany": 82 },
    { "USA": 327, "China": 1393, "India": 1353, "Brazil": 211, "Germany": 83 },
    { "USA": 331, "China": 1402, "India": 1380, "Brazil": 213, "Germany": 83 }
  ]
}
```
````

Only the top 3 bars (by value, descending) are visible at any time. The frame labels are 2010, 2012, 2014, 2016, 2018, 2020.

### 3. Custom step duration — fast playback

start=1, end=5, step=1 → `Math.round((5 - 1) / 1) + 1 = 5` frames.

````
```bar-race
{
  "categories": ["Alpha", "Beta", "Gamma"],
  "start": 1,
  "end": 5,
  "step": 1,
  "stepDuration": 500,
  "frames": [
    { "Alpha": 10, "Beta": 8,  "Gamma": 12 },
    { "Alpha": 15, "Beta": 20, "Gamma": 11 },
    { "Alpha": 22, "Beta": 19, "Gamma": 25 },
    { "Alpha": 30, "Beta": 28, "Gamma": 24 },
    { "Alpha": 35, "Beta": 40, "Gamma": 33 }
  ]
}
```
````

Each frame lasts 500ms (half a second). Bar animations take 400ms (500 * 0.8). Frame labels: 1, 2, 3, 4, 5.

### 4. Ascending sort

start=2020, end=2023, step=1 → `Math.round((2023 - 2020) / 1) + 1 = 4` frames.

````
```bar-race
{
  "categories": ["Low", "Medium", "High", "Critical"],
  "start": 2020,
  "end": 2023,
  "step": 1,
  "sort": "asc",
  "frames": [
    { "Low": 120, "Medium": 80, "High": 30, "Critical": 5 },
    { "Low": 95,  "Medium": 70, "High": 40, "Critical": 12 },
    { "Low": 60,  "Medium": 55, "High": 50, "Critical": 20 },
    { "Low": 40,  "Medium": 45, "High": 55, "Critical": 28 }
  ]
}
```
````

Bars are sorted lowest-first (ascending). The bar with the smallest value appears at the top.

### 5. Complex — many categories, fractional steps, all options

start=0, end=2, step=0.5 → `Math.round((2 - 0) / 0.5) + 1 = 5` frames.

````
```bar-race
{
  "categories": ["Mercury", "Venus", "Earth", "Mars", "Jupiter", "Saturn", "Uranus", "Neptune"],
  "start": 0,
  "end": 2,
  "step": 0.5,
  "sort": "desc",
  "maxBars": 5,
  "stepDuration": 1500,
  "frames": [
    { "Mercury": 3,  "Venus": 7,  "Earth": 10, "Mars": 5,  "Jupiter": 50, "Saturn": 40, "Uranus": 20, "Neptune": 18 },
    { "Mercury": 5,  "Venus": 12, "Earth": 15, "Mars": 8,  "Jupiter": 55, "Saturn": 42, "Uranus": 22, "Neptune": 25 },
    { "Mercury": 8,  "Venus": 18, "Earth": 22, "Mars": 14, "Jupiter": 58, "Saturn": 45, "Uranus": 30, "Neptune": 28 },
    { "Mercury": 12, "Venus": 25, "Earth": 30, "Mars": 20, "Jupiter": 60, "Saturn": 48, "Uranus": 38, "Neptune": 35 },
    { "Mercury": 15, "Venus": 30, "Earth": 38, "Mars": 28, "Jupiter": 62, "Saturn": 50, "Uranus": 45, "Neptune": 40 }
  ]
}
```
````

Frame labels: 0.00, 0.50, 1.00, 1.50, 2.00 (displayed with 2 decimal places since the values are non-integer). Only the top 5 bars are shown. Each frame lasts 1500ms with bar animations over 1200ms.

### 6. Single frame — static snapshot

start=2025, end=2025, step=1 → `Math.round((2025 - 2025) / 1) + 1 = 1` frame.

````
```bar-race
{
  "categories": ["Revenue", "Costs", "Profit"],
  "start": 2025,
  "end": 2025,
  "step": 1,
  "frames": [
    { "Revenue": 500, "Costs": 320, "Profit": 180 }
  ]
}
```
````

A single frame produces a static bar chart with no animation. The playback controls are present but have nothing to advance through.

---

## Unsupported Features

The following are **not** available through this fence type:

- Custom bar colors or per-category color assignment
- Multiple series or grouped bars
- Stacked bar charts
- Custom axis labels or axis formatting
- Tooltips configuration
- Custom grid or layout overrides
- Negative values display customization
- Images or icons on bars
- Custom fonts or text styling
- Vertical bar orientation (always horizontal)
- Click handlers or interactivity beyond playback controls
- Data labels on bars (format is fixed)
- Legend display
- Background watermarks or annotations
