# `svg` Fence Type — Inline SVG Graphics

Fence tag: ` ```svg `

Renders inline SVG graphics from raw SVG markup. Unlike most fence types that take JSON, this one takes **raw SVG markup**. The validator parses the SVG with a custom hand-written XML parser (NOT DOMParser), validates every element and attribute against allowlists, re-serializes a canonical safe subset, and renders it as an `<img>` via a data URL. This means scripts never execute, external resources never load, and the SVG cannot interact with the page.

---

## Input Format

The fence body is **raw SVG markup**, not JSON. The root element must be `<svg>`. An optional `<?xml ... ?>` declaration is allowed before the root element but is stripped during re-serialization.

```
<svg viewBox="0 0 200 100" xmlns="http://www.w3.org/2000/svg">
  <rect x="10" y="10" width="80" height="80" fill="#3b82f6"/>
</svg>
```

The `xmlns` attribute on the root `<svg>` is optional in the source. If missing, the serializer adds `xmlns="http://www.w3.org/2000/svg"` automatically. If present, its value must be exactly `http://www.w3.org/2000/svg`.

---

## Allowed Elements

Every element in the SVG must be one of the following. Any element not on this list triggers `unsupported-element` rejection.

| Element | Description |
|---|---|
| `svg` | Root container element. Must be the document root. |
| `g` | Group container for applying shared attributes (transforms, opacity) to child elements. |
| `defs` | Container for reusable definitions (gradients, clip paths, markers, symbols). Not rendered directly. |
| `symbol` | Reusable graphic template, referenced via `<use>`. Similar to `<g>` but has its own `viewBox`. |
| `use` | Clones an element defined elsewhere via `href="#id"`. Only internal references allowed. |
| `path` | General-purpose shape defined by the `d` attribute (move, line, curve, arc commands). |
| `rect` | Rectangle. Uses `x`, `y`, `width`, `height`, and optional `rx`/`ry` for rounded corners. |
| `circle` | Circle. Uses `cx`, `cy`, `r`. |
| `ellipse` | Ellipse. Uses `cx`, `cy`, `rx`, `ry`. |
| `line` | Straight line between two points. Uses `x1`, `y1`, `x2`, `y2`. |
| `polyline` | Connected line segments through a list of points. Uses `points`. Not automatically closed. |
| `polygon` | Closed shape through a list of points. Uses `points`. Automatically closed. |
| `text` | Text content. Can contain `<tspan>` children for inline styling. |
| `tspan` | Inline text span within `<text>`. Allows positional and style overrides on portions of text. |
| `title` | Accessibility title. When a direct child of the root `<svg>`, its text becomes the image `alt` text. |
| `desc` | Accessibility description. Provides a longer description of the SVG content. |
| `linearGradient` | Defines a linear color gradient, referenced by paint attributes via `url(#id)`. |
| `radialGradient` | Defines a radial color gradient, referenced by paint attributes via `url(#id)`. |
| `stop` | Color stop within a gradient. Uses `offset` and `stop-color`/`stop-opacity`. |
| `clipPath` | Defines a clipping region that masks parts of other elements. |
| `mask` | Defines a luminance or alpha mask for compositing. |
| `marker` | Defines a graphic for drawing on polyline/polygon/path vertices. Referenced via `marker-start`/`marker-mid`/`marker-end`. |

### Text content rules

Only `text`, `tspan`, `title`, and `desc` may contain text content. Text inside any other element (other than pure whitespace) triggers `invalid-content` rejection.

---

## Allowed Attributes

Every attribute on every element is validated. Unknown attributes trigger `unsupported-attribute` rejection. Attribute values are validated against type-specific rules; invalid values trigger `invalid-attribute` rejection.

All attribute values are checked for external references. Any value containing a URL scheme (`http:`, `https:`, `data:`, `javascript:`, etc.) or a `url()` that does not match the internal `url(#id)` pattern triggers `external-reference` rejection.

### Geometry: Length Attributes

These accept a number with an optional unit suffix. Accepted units: `px`, `em`, `rem`, `pt`, `pc`, `cm`, `mm`, `in`, `%`. Numbers are capped at an absolute value of 1,000,000.

#### Signed lengths (can be negative)

| Attribute | Typical elements | Description |
|---|---|---|
| `x` | `rect`, `text`, `tspan`, `use`, `svg` | Horizontal position |
| `y` | `rect`, `text`, `tspan`, `use`, `svg` | Vertical position |
| `x1` | `line`, `linearGradient` | Start x-coordinate |
| `x2` | `line`, `linearGradient` | End x-coordinate |
| `y1` | `line`, `linearGradient` | Start y-coordinate |
| `y2` | `line`, `linearGradient` | End y-coordinate |
| `cx` | `circle`, `ellipse`, `radialGradient` | Center x |
| `cy` | `circle`, `ellipse`, `radialGradient` | Center y |
| `fx` | `radialGradient` | Focal point x |
| `fy` | `radialGradient` | Focal point y |
| `refX` | `marker`, `symbol` | Reference point x |
| `refY` | `marker`, `symbol` | Reference point y |
| `stroke-dashoffset` | any | Offset for dash pattern |
| `letter-spacing` | `text`, `tspan` | Space between characters |
| `baseline-shift` | `tspan` | Vertical baseline offset |

#### Non-negative lengths (must be >= 0)

| Attribute | Typical elements | Description |
|---|---|---|
| `width` | `rect`, `svg`, `use`, `mask` | Width |
| `height` | `rect`, `svg`, `use`, `mask` | Height |
| `r` | `circle` | Radius |
| `rx` | `rect`, `ellipse` | Horizontal radius / corner radius |
| `ry` | `rect`, `ellipse` | Vertical radius / corner radius |
| `fr` | `radialGradient` | Focal radius |
| `stroke-width` | any | Stroke thickness |
| `font-size` | `text`, `tspan` | Font size |
| `textLength` | `text`, `tspan` | Desired text length |
| `markerWidth` | `marker` | Marker viewport width |
| `markerHeight` | `marker` | Marker viewport height |

### Paint Attributes

Accept CSS color values or internal gradient/pattern references via `url(#id)`.

| Attribute | Description |
|---|---|
| `fill` | Fill color or gradient reference |
| `stroke` | Stroke color or gradient reference |
| `color` | Current color value (inherited by `fill`/`stroke` when set to `currentColor`) |
| `stop-color` | Color at a gradient stop |

**Accepted color formats:**

| Format | Example |
|---|---|
| Hex (3-digit) | `#f00` |
| Hex (6-digit) | `#3b82f6` |
| Hex (4-digit, with alpha) | `#f008` |
| Hex (8-digit, with alpha) | `#3b82f680` |
| Named colors | `red`, `steelblue`, `none` |
| RGB | `rgb(59, 130, 246)` |
| RGBA | `rgba(16, 185, 129, 0.5)` |
| HSL | `hsl(217, 91%, 60%)` |
| HSLA | `hsla(217, 91%, 60%, 0.5)` |
| Gradient reference | `url(#myGradient)` |

The color regex pattern: `/^(?:#[0-9a-f]{3,8}|[a-z]+|(?:rgba?|hsla?)\([0-9.%+\-,\s]+\))$/i`

### Internal URL Attributes

Accept `none` or `url(#id)` (internal reference only). Any other URL form is rejected.

| Attribute | Description |
|---|---|
| `clip-path` | Reference to a `<clipPath>` element |
| `mask` | Reference to a `<mask>` element (note: `mask` is also an allowed element) |
| `marker-start` | Marker at the first vertex of a path/polyline/polygon |
| `marker-mid` | Marker at intermediate vertices |
| `marker-end` | Marker at the last vertex |

### Opacity Attributes

Accept a number 0-1 (decimal) or 0%-100% (percentage).

| Attribute | Description |
|---|---|
| `opacity` | Overall element opacity |
| `fill-opacity` | Fill opacity |
| `stroke-opacity` | Stroke opacity |
| `stop-opacity` | Gradient stop opacity |

### Transform Attributes

| Attribute | Description |
|---|---|
| `transform` | Transformation on any element |
| `gradientTransform` | Transformation on a gradient element |

**Allowed transform functions:**

| Function | Arguments | Example |
|---|---|---|
| `matrix` | Exactly 6 numbers | `matrix(1, 0, 0, 1, 50, 50)` |
| `translate` | 1 or 2 numbers | `translate(50, 100)` or `translate(50)` |
| `scale` | 1 or 2 numbers | `scale(2)` or `scale(2, 0.5)` |
| `rotate` | 1 or 3 numbers | `rotate(45)` or `rotate(45, 100, 100)` |
| `skewX` | Exactly 1 number | `skewX(10)` |
| `skewY` | Exactly 1 number | `skewY(10)` |

Multiple transforms can be chained: `transform="translate(50, 50) rotate(45) scale(2)"`

### Text Attributes

| Attribute | Accepted values | Description |
|---|---|---|
| `font-family` | Max 200 chars, `/^[-\w ,'"]+$/` | Font family name(s) |
| `font-size` | Non-negative length | Text size |
| `font-style` | `normal`, `italic`, `oblique`, `inherit` | Text style |
| `font-weight` | `normal`, `bold`, `bolder`, `lighter`, `100`-`900`, `inherit` | Text weight |
| `text-anchor` | `start`, `middle`, `end`, `inherit` | Horizontal text alignment |
| `text-decoration` | `none`, `underline`, `overline`, `line-through`, `inherit` | Text decoration |
| `dominant-baseline` | `auto`, `baseline`, `before-edge`, `text-before-edge`, `middle`, `central`, `after-edge`, `text-after-edge`, `ideographic`, `alphabetic`, `hanging`, `mathematical`, `inherit` | Vertical text alignment |
| `alignment-baseline` | Same values as `dominant-baseline` | Inline vertical alignment |
| `letter-spacing` | Signed length | Space between characters |
| `lengthAdjust` | `spacing`, `spacingAndGlyphs` | How to adjust text to `textLength` |

### Stroke Attributes

| Attribute | Accepted values | Description |
|---|---|---|
| `stroke-width` | Non-negative length | Line thickness |
| `stroke-dasharray` | `none`, or comma/space-separated non-negative lengths | Dash pattern |
| `stroke-dashoffset` | Signed length | Dash pattern offset |
| `stroke-linecap` | `butt`, `round`, `square`, `inherit` | Line end shape |
| `stroke-linejoin` | `miter`, `miter-clip`, `round`, `bevel`, `arcs`, `inherit` | Corner join shape |
| `stroke-miterlimit` | Number >= 1 | Miter limit ratio |

### Shape-Specific Attributes

| Attribute | Accepted values | Description |
|---|---|---|
| `d` | Path data: chars `mzlhvcsqtae0-9.,+-` and whitespace. Must contain `m` or `M`. | Path definition |
| `points` | Number list, at least 4 values, even count | Polyline/polygon vertices |
| `pathLength` | Positive number | Author's computed path length |
| `dx` | Length list | Relative horizontal shifts (text) |
| `dy` | Length list | Relative vertical shifts (text) |
| `rotate` | Number list | Per-character rotation (text) |

### Fill/Clip Rule Attributes

| Attribute | Accepted values |
|---|---|
| `fill-rule` | `nonzero`, `evenodd`, `inherit` |
| `clip-rule` | `nonzero`, `evenodd`, `inherit` |

### Viewport and Reference Attributes

| Attribute | Accepted values | Description |
|---|---|---|
| `viewBox` | 4 numbers (min-x, min-y, width, height). Width and height must be > 0. | Coordinate system for the SVG |
| `preserveAspectRatio` | `none`, or alignment (`xMinYMin`, `xMidYMid`, `xMaxYMax`, etc.) optionally followed by `meet` or `slice` | How the viewBox maps to the viewport |
| `xmlns` | Only `http://www.w3.org/2000/svg`, only on `<svg>` | XML namespace declaration |
| `vector-effect` | `none`, `non-scaling-stroke` | Prevents stroke from scaling |
| `overflow` | `visible`, `hidden` | Overflow behavior |

### Gradient-Specific Attributes

| Attribute | Accepted values | Description |
|---|---|---|
| `gradientUnits` | `userSpaceOnUse`, `objectBoundingBox` | Coordinate system for gradient |
| `spreadMethod` | `pad`, `reflect`, `repeat` | How gradient extends beyond its bounds |
| `offset` | 0-1 (decimal) or 0%-100% | Position of a gradient stop |

### Clip/Mask Unit Attributes

| Attribute | Accepted values |
|---|---|
| `clipPathUnits` | `userSpaceOnUse`, `objectBoundingBox` |
| `maskUnits` | `userSpaceOnUse`, `objectBoundingBox` |
| `maskContentUnits` | `userSpaceOnUse`, `objectBoundingBox` |

### Marker-Specific Attributes

| Attribute | Accepted values | Description |
|---|---|---|
| `markerUnits` | `strokeWidth`, `userSpaceOnUse` | Coordinate system for marker sizing |
| `orient` | `auto`, `auto-start-reverse`, or a number (degrees) | Marker orientation |
| `markerWidth` | Non-negative length | Marker viewport width |
| `markerHeight` | Non-negative length | Marker viewport height |

### ID and Reference Attributes

| Attribute | Accepted values | Description |
|---|---|---|
| `id` | Must match `/^[a-z_][\w.-]*$/i` — starts with letter or underscore, then word chars, dots, hyphens | Element identifier |
| `href` | Only on `<use>`, must match `/^#[a-z_][\w.-]*$/i` — internal reference only | Reference to a defined element |

### Accessibility Attributes

| Attribute | Accepted values | Description |
|---|---|---|
| `role` | `img`, `presentation`, `graphics-document`, `graphics-symbol` | ARIA role |
| `aria-label` | Non-empty string, max 500 chars | Text alternative |
| `aria-labelledby` | Space-separated list of valid IDs | References elements providing a label |
| `aria-describedby` | Space-separated list of valid IDs | References elements providing a description |
| `focusable` | `true`, `false`, `auto` | Whether element can receive focus |

### Other Attributes

| Attribute | Accepted values | Description |
|---|---|---|
| `xml:space` | `default`, `preserve` | Whitespace handling |

---

## Length and Number Format

Numbers accept optional sign, integer or decimal digits, and optional scientific notation:

```
42        -3.14       .5        1e3       -2.5e-1
```

Pattern: `/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i`

Length values are numbers with an optional unit suffix:

| Unit | Description |
|---|---|
| *(none)* | User units (same as `px` in most contexts) |
| `px` | Pixels |
| `em` | Relative to font size |
| `rem` | Relative to root font size |
| `pt` | Points (1/72 inch) |
| `pc` | Picas (1/6 inch) |
| `cm` | Centimeters |
| `mm` | Millimeters |
| `in` | Inches |
| `%` | Percentage of reference dimension |

All numbers (including those embedded in transforms, path data, and point lists) are capped at an absolute value of **1,000,000**. Values exceeding this cap are rejected.

---

## Validation Limits Summary

| Limit | Value |
|---|---|
| Maximum SVG source size | 50,000 characters |
| Maximum elements | 1,000 |
| Maximum total attributes (across all elements) | 4,000 |
| Maximum nesting depth | 64 |
| Maximum absolute number value | 1,000,000 |
| Maximum `aria-label` length | 500 characters |
| Maximum `font-family` length | 200 characters |
| Maximum extracted title length | 300 characters |

---

## What Gets Rejected

| Reason | Trigger |
|---|---|
| `oversize` | SVG source exceeds 50,000 characters |
| `unparseable` | Invalid XML syntax: unclosed tags, mismatched tags, duplicate attributes on the same element, unrecognized or bare `&` (only `&amp;`, `&lt;`, `&gt;`, `&apos;`, `&quot;`, and numeric character references are allowed), `<` inside attribute values, unterminated attributes, `--` inside comments, unrecognized `<?...?>` or `<!...>` constructs, invalid numeric character references |
| `not-svg` | Root element is not `<svg>`, or the source contains no tags at all |
| `unsupported-element` | An element not in the allowed elements list |
| `unsupported-attribute` | An attribute not recognized by any validator |
| `invalid-attribute` | An attribute value that fails its type-specific validator (wrong format, out of range, wrong element context) |
| `external-reference` | Any attribute value containing a URL scheme (`http:`, `https:`, `data:`, `javascript:`, `blob:`, `file:`, `ftp:`, `//`, etc.) or a `url()` that is not an internal `url(#id)` reference |
| `invalid-content` | Text content (other than whitespace) inside an element that is not `text`, `tspan`, `title`, or `desc` |
| `too-complex` | Exceeds max elements (1,000), max total attributes (4,000), or max nesting depth (64) |

When a block is rejected, it renders as a plain syntax-highlighted code block — not an image.

---

## Title and Accessibility

If the root `<svg>` element has a `<title>` element as a direct child (at depth 1 in the tree, i.e. `svg > title`), its text content is extracted and used as the `alt` text of the rendered `<img>` tag. The title is collapsed (multiple whitespace replaced with single spaces), trimmed, and capped at 300 characters.

For best accessibility, always include a `<title>` as the first child of `<svg>`:

```xml
<svg viewBox="0 0 200 100" xmlns="http://www.w3.org/2000/svg">
  <title>Bar chart showing Q4 revenue</title>
  <!-- ... graphic content ... -->
</svg>
```

You can also add `role="img"` and `aria-label` on the `<svg>` element, though note these are applied to the source before re-serialization — the final rendering is an `<img>` tag, where `alt` is derived from `<title>`.

---

## Rendering Behavior

- The validated SVG is **re-serialized** from the parsed structure (not passed through as raw source). Only elements and attributes that passed validation appear in the output.
- The re-serialized SVG is rendered as `<img src="data:image/svg+xml;...">`. This sandboxing means:
  - No JavaScript execution
  - No external resource loading (images, fonts, stylesheets)
  - No interaction with the host page
  - No CSS animations that reference external resources
- The image has `max-height: min(70vh, 720px)` and `object-fit: contain`.
- Comments in the source are stripped during re-serialization.
- XML declarations (`<?xml ... ?>`) are stripped during re-serialization.
- Entity references (`&amp;`, `&lt;`, `&gt;`, `&apos;`, `&quot;`, numeric `&#123;`, `&#x7B;`) are decoded during parsing and re-encoded in the output.
- The `xmlns` attribute is automatically added to `<svg>` if not present.

---

## Complete Examples

### 1. Minimal rectangle

A single blue rectangle on a white background.

````
```svg
<svg viewBox="0 0 200 100" xmlns="http://www.w3.org/2000/svg">
  <title>Blue rectangle</title>
  <rect x="10" y="10" width="180" height="80" rx="8" fill="#3b82f6"/>
</svg>
```
````

### 2. Circle with radial gradient

A circle filled with a radial gradient from gold to deep orange.

````
```svg
<svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
  <title>Sun with radial gradient</title>
  <defs>
    <radialGradient id="sunGrad" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#fbbf24"/>
      <stop offset="100%" stop-color="#ea580c"/>
    </radialGradient>
  </defs>
  <circle cx="100" cy="100" r="80" fill="url(#sunGrad)"/>
</svg>
```
````

### 3. Text with styling

Multi-line styled text using `<tspan>` elements.

````
```svg
<svg viewBox="0 0 300 120" xmlns="http://www.w3.org/2000/svg">
  <title>Styled text example</title>
  <text x="150" y="40" text-anchor="middle" font-family="sans-serif" font-size="24" fill="#1e293b">
    Hello, World!
  </text>
  <text x="150" y="80" text-anchor="middle" font-family="sans-serif" font-size="16" fill="#64748b">
    <tspan font-weight="bold" fill="#3b82f6">SVG</tspan>
    <tspan> fence rendering</tspan>
  </text>
</svg>
```
````

### 4. Path drawing — star shape

A five-pointed star drawn with path commands.

````
```svg
<svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
  <title>Five-pointed star</title>
  <path d="M100 10 L124 78 L196 78 L138 122 L158 190 L100 150 L42 190 L62 122 L4 78 L76 78 Z"
        fill="#facc15" stroke="#ca8a04" stroke-width="2" stroke-linejoin="round"/>
</svg>
```
````

### 5. Complex diagram with defs, use, clipPath, and markers

A flowchart-style diagram demonstrating reusable definitions, clipping, and arrow markers.

````
```svg
<svg viewBox="0 0 500 300" xmlns="http://www.w3.org/2000/svg">
  <title>Flowchart: Input to Processing to Output</title>
  <defs>
    <marker id="arrowHead" markerWidth="10" markerHeight="7"
            refX="10" refY="3.5" orient="auto" markerUnits="strokeWidth">
      <polygon points="0 0, 10 3.5, 0 7" fill="#475569"/>
    </marker>

    <linearGradient id="boxGrad" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#e0f2fe"/>
      <stop offset="100%" stop-color="#bae6fd"/>
    </linearGradient>

    <clipPath id="roundClip">
      <rect x="0" y="0" width="120" height="60" rx="8"/>
    </clipPath>

    <symbol id="box" viewBox="0 0 120 60">
      <rect width="120" height="60" rx="8" fill="url(#boxGrad)"
            stroke="#0284c7" stroke-width="1.5"/>
    </symbol>
  </defs>

  <use href="#box" x="30" y="120"/>
  <text x="90" y="155" text-anchor="middle" font-family="sans-serif"
        font-size="14" fill="#0c4a6e">Input</text>

  <use href="#box" x="190" y="120"/>
  <text x="250" y="155" text-anchor="middle" font-family="sans-serif"
        font-size="14" fill="#0c4a6e">Process</text>

  <use href="#box" x="350" y="120"/>
  <text x="410" y="155" text-anchor="middle" font-family="sans-serif"
        font-size="14" fill="#0c4a6e">Output</text>

  <line x1="150" y1="150" x2="188" y2="150"
        stroke="#475569" stroke-width="2" marker-end="url(#arrowHead)"/>
  <line x1="310" y1="150" x2="348" y2="150"
        stroke="#475569" stroke-width="2" marker-end="url(#arrowHead)"/>
</svg>
```
````

### 6. Styled multi-element illustration — house

A simple house illustration using multiple shape types, a gradient sky, and grouped elements.

````
```svg
<svg viewBox="0 0 400 300" xmlns="http://www.w3.org/2000/svg">
  <title>Simple house illustration</title>
  <defs>
    <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#7dd3fc"/>
      <stop offset="100%" stop-color="#e0f2fe"/>
    </linearGradient>
  </defs>

  <rect width="400" height="300" fill="url(#sky)"/>
  <rect x="0" y="220" width="400" height="80" fill="#86efac"/>

  <g transform="translate(100, 80)">
    <polygon points="100 0, 200 80, 0 80" fill="#dc2626" stroke="#991b1b" stroke-width="2"/>

    <rect x="25" y="80" width="150" height="120" fill="#fef3c7"
          stroke="#92400e" stroke-width="2"/>

    <rect x="75" y="140" width="50" height="60" fill="#92400e"/>

    <rect x="40" y="100" width="30" height="30" fill="#bfdbfe"
          stroke="#1e40af" stroke-width="1.5"/>
    <line x1="55" y1="100" x2="55" y2="130" stroke="#1e40af" stroke-width="1"/>
    <line x1="40" y1="115" x2="70" y2="115" stroke="#1e40af" stroke-width="1"/>

    <rect x="130" y="100" width="30" height="30" fill="#bfdbfe"
          stroke="#1e40af" stroke-width="1.5"/>
    <line x1="145" y1="100" x2="145" y2="130" stroke="#1e40af" stroke-width="1"/>
    <line x1="130" y1="115" x2="160" y2="115" stroke="#1e40af" stroke-width="1"/>
  </g>

  <circle cx="340" cy="50" r="25" fill="#fbbf24"/>
</svg>
```
````

### 7. Bar chart with labels

A simple bar chart showing quarterly data with text labels and a baseline.

````
```svg
<svg viewBox="0 0 400 250" xmlns="http://www.w3.org/2000/svg">
  <title>Quarterly revenue bar chart</title>
  <defs>
    <linearGradient id="barFill" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#818cf8"/>
      <stop offset="100%" stop-color="#4f46e5"/>
    </linearGradient>
  </defs>

  <line x1="60" y1="200" x2="380" y2="200" stroke="#94a3b8" stroke-width="1"/>

  <rect x="80" y="120" width="50" height="80" rx="4" fill="url(#barFill)"/>
  <text x="105" y="215" text-anchor="middle" font-family="sans-serif"
        font-size="12" fill="#64748b">Q1</text>
  <text x="105" y="115" text-anchor="middle" font-family="sans-serif"
        font-size="11" fill="#1e293b">80</text>

  <rect x="160" y="80" width="50" height="120" rx="4" fill="url(#barFill)"/>
  <text x="185" y="215" text-anchor="middle" font-family="sans-serif"
        font-size="12" fill="#64748b">Q2</text>
  <text x="185" y="75" text-anchor="middle" font-family="sans-serif"
        font-size="11" fill="#1e293b">120</text>

  <rect x="240" y="140" width="50" height="60" rx="4" fill="url(#barFill)"/>
  <text x="265" y="215" text-anchor="middle" font-family="sans-serif"
        font-size="12" fill="#64748b">Q3</text>
  <text x="265" y="135" text-anchor="middle" font-family="sans-serif"
        font-size="11" fill="#1e293b">60</text>

  <rect x="320" y="60" width="50" height="140" rx="4" fill="url(#barFill)"/>
  <text x="345" y="215" text-anchor="middle" font-family="sans-serif"
        font-size="12" fill="#64748b">Q4</text>
  <text x="345" y="55" text-anchor="middle" font-family="sans-serif"
        font-size="11" fill="#1e293b">140</text>
</svg>
```
````

### 8. Masked element with clip path

A photo-placeholder circle using a clip path and mask together.

````
```svg
<svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
  <title>Clipped gradient circle</title>
  <defs>
    <clipPath id="circleClip">
      <circle cx="100" cy="100" r="80"/>
    </clipPath>
    <linearGradient id="diagGrad" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#c084fc"/>
      <stop offset="50%" stop-color="#f472b6"/>
      <stop offset="100%" stop-color="#fb923c"/>
    </linearGradient>
  </defs>

  <g clip-path="url(#circleClip)">
    <rect width="200" height="200" fill="url(#diagGrad)"/>
    <line x1="0" y1="0" x2="200" y2="200" stroke="white" stroke-width="2" stroke-opacity="0.3"/>
    <line x1="200" y1="0" x2="0" y2="200" stroke="white" stroke-width="2" stroke-opacity="0.3"/>
  </g>

  <circle cx="100" cy="100" r="80" fill="none" stroke="#7c3aed" stroke-width="3"/>
</svg>
```
````

---

## Unsupported Features

The following SVG features are **not available** through this fence type. Using any of them will trigger rejection or be silently dropped:

### Rejected elements (trigger `unsupported-element`)

- `<script>` — no script execution
- `<style>` — no CSS stylesheets (use presentation attributes instead)
- `<foreignObject>` — no embedded HTML
- `<image>` — no embedded raster images (also blocked by external reference rules)
- `<a>` — no hyperlinks
- `<filter>`, `<feGaussianBlur>`, `<feColorMatrix>`, `<feComposite>`, and all `fe*` filter primitives — no SVG filters
- `<animate>`, `<animateTransform>`, `<animateMotion>`, `<set>` — no SMIL animations
- `<switch>`, `<metadata>`, `<pattern>` — not in the allowed set
- `<textPath>` — no text along a path

### Rejected attributes (trigger `unsupported-attribute`)

- `class` — no CSS class references
- `style` — no inline CSS (use individual presentation attributes instead)
- `onclick`, `onload`, `onmouseover`, and all event handler attributes
- `xlink:href` — use `href` on `<use>` instead (internal only)
- `data-*` attributes — not recognized
- `filter` — no filter references
- `display`, `visibility` — not in the validated set (use `opacity="0"` as a workaround for hiding)

### Rejected content patterns (trigger `external-reference`)

- `url(http://...)`, `url(https://...)` — no external URLs in any attribute
- `url(data:...)` — no data URIs
- `href="http://..."` — no external links
- Any URL scheme: `http:`, `https:`, `ftp:`, `data:`, `javascript:`, `blob:`, `file:`, `//`

### Not applicable (due to `<img>` rendering)

- CSS animations and transitions — the SVG is rendered as a static image
- JavaScript-driven interactivity — scripts never execute in `<img>` context
- External font loading — use generic font families (`sans-serif`, `serif`, `monospace`) or system fonts
- SVG `<style>` with `@font-face` — style elements are not allowed
- Hover, click, and focus states — no interactivity in `<img>` rendering

### Practical guidance

Since `<style>` elements and `class` attributes are not allowed, apply all styling via **presentation attributes** directly on each element:

```xml
<!-- Instead of this (NOT ALLOWED): -->
<style>.box { fill: blue; }</style>
<rect class="box" .../>

<!-- Do this: -->
<rect fill="blue" .../>
```

Since `<image>` is not allowed, all graphics must be constructed from vector shapes (rect, circle, ellipse, path, polygon, polyline) and text.

Since external fonts cannot load in the `<img>` sandbox, use generic font families:

```xml
<text font-family="sans-serif" ...>Label</text>
<text font-family="'Courier New', monospace" ...>Code</text>
```
