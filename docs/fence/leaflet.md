# `leaflet` Fence Type — Map Visualization

Fence tag: ` ```leaflet `

Renders an interactive OpenStreetMap-based map with markers, polylines, polygons, and registered GeoJSON layers. The JSON body is parsed and validated before rendering; invalid blocks fall back to a plain code block.

---

## Top-Level Object

```jsonc
{
  "center": [48.2082, 16.3738],   // optional
  "zoom": 13,                      // optional
  "markers": [ ... ],              // optional (defaults to [])
  "polylines": [ ... ],            // optional (defaults to [])
  "polygons": [ ... ],             // optional (defaults to [])
  "geojson": { ... }               // optional — registered GeoJSON layer
}
```

At least one feature (a marker, polyline, polygon, or geojson layer) is required. A JSON object with all arrays empty and no geojson is rejected (`no-features`).

---

## Map Viewport

### `center` — optional `[lat, lng]`

A two-element array: `[latitude, longitude]`.

| Constraint | Value |
|---|---|
| Latitude range | -90 to 90 inclusive |
| Longitude range | -180 to 180 inclusive |
| Values must be | Finite numbers (no `NaN`, `Infinity`) |

When omitted, the map auto-fits to the bounding box of all features with 20 px padding. If there are no features and no center (impossible in practice because `no-features` rejects), it falls back to `[0, 0]` at zoom 2.

### `zoom` — optional `number`

| Constraint | Value |
|---|---|
| Range | 0 (whole world) to 22 (building-level) |
| Must be | A finite number |
| Default when `center` is set | 13 |
| Default when auto-fitting | Determined by `fitBounds` (fits all features) |

**Zoom level reference:**

| Zoom | Approximate coverage |
|---|---|
| 0–2 | World / continent |
| 3–6 | Country / large region |
| 7–9 | Region / metropolitan area |
| 10–12 | City / district |
| 13–15 | Neighborhood / streets |
| 16–18 | Block / buildings |
| 19–22 | Building detail (tile max is 19) |

---

## Feature Types

### Markers

Point locations on the map, rendered as the default Leaflet pin icon. Clicking a marker with a title or description opens a popup.

```jsonc
{
  "markers": [
    {
      "lat": 48.2082,                        // required — latitude
      "lng": 16.3738,                        // required — longitude
      "title": "Vienna",                     // optional — bold text in popup
      "description": "Capital of Austria"    // optional — body text in popup
    }
  ]
}
```

#### Marker fields

| Field | Type | Required | Constraints |
|---|---|---|---|
| `lat` | `number` | yes | Finite, -90 to 90 |
| `lng` | `number` | yes | Finite, -180 to 180 |
| `title` | `string` | no | Max 200 characters. No HTML tags (see HTML check below). |
| `description` | `string` | no | Max 1,000 characters. No HTML tags. |

#### Popup rendering

- If both `title` and `description` are present: `<strong>title</strong><br>description`
- If only `title`: `<strong>title</strong>`
- If only `description`: `description`
- If neither is present: no popup is bound — the marker is just a pin on the map.

All text is HTML-escaped before insertion (no raw HTML passthrough).

#### Limits

| Limit | Value |
|---|---|
| Maximum markers per map | 200 |

### Polylines

Connected lines drawn through an ordered sequence of coordinates.

```jsonc
{
  "polylines": [
    {
      "coordinates": [                // required — at least one point
        [48.2082, 16.3738],           // [lat, lng] pairs
        [47.8095, 13.0550],
        [47.2692, 11.4041]
      ],
      "color": "#3b82f6",            // optional — stroke color
      "weight": 3                     // optional — stroke width in pixels
    }
  ]
}
```

#### Polyline fields

| Field | Type | Required | Constraints |
|---|---|---|---|
| `coordinates` | `[number, number][]` | yes | Non-empty array of `[lat, lng]` pairs. Each lat -90..90, each lng -180..180. Max 2,000 points per polyline. |
| `color` | `string` | no | Any CSS color string. Max 50 characters. Default: `#3b82f6` (blue). |
| `weight` | `number` | no | Finite, >= 0. Stroke width in pixels. Default: `3`. |

#### Limits

| Limit | Value |
|---|---|
| Maximum polylines per map | 20 |
| Maximum points per polyline | 2,000 |

### Polygons

Closed filled shapes drawn through an ordered sequence of coordinates. Leaflet automatically closes the shape (connects the last point back to the first).

```jsonc
{
  "polygons": [
    {
      "coordinates": [                // required — at least one point
        [48.22, 16.35],               // [lat, lng] pairs
        [48.22, 16.40],
        [48.18, 16.40],
        [48.18, 16.35]
      ],
      "color": "#10b981",            // optional — stroke (border) color
      "fillColor": "#10b98133",      // optional — fill color (use alpha for transparency)
      "weight": 2                     // optional — stroke width in pixels
    }
  ]
}
```

#### Polygon fields

| Field | Type | Required | Constraints |
|---|---|---|---|
| `coordinates` | `[number, number][]` | yes | Non-empty array of `[lat, lng]` pairs. Each lat -90..90, each lng -180..180. Max 2,000 vertices per polygon. |
| `color` | `string` | no | Stroke color. Any CSS color string. Max 50 characters. Default: `#10b981` (emerald). |
| `fillColor` | `string` | no | Fill color. Max 50 characters. Default: `color + "33"` if `color` is set, otherwise `#10b98133`. Append a hex alpha suffix for transparency. |
| `weight` | `number` | no | Finite, >= 0. Stroke width in pixels. Default: `2`. |

#### Limits

| Limit | Value |
|---|---|
| Maximum polygons per map | 20 |
| Maximum vertices per polygon | 2,000 |

### GeoJSON Layers

Render a pre-registered GeoJSON map (e.g. Hungarian counties or regions) as colored polygons on top of the OSM tile layer. This avoids embedding thousands of coordinate points in the JSON — the LLM just references a map name and provides per-feature styling.

```jsonc
{
  "geojson": {
    "map": "hungary",                       // required — registered map name
    "defaultStyle": {                        // optional — fallback for features not in data
      "color": "#6b7280",
      "fillColor": "#6b728033",
      "weight": 1
    },
    "data": [                                // optional — per-feature styling and popups
      {
        "name": "Budapest",                  // required — must match GeoJSON properties.name
        "fillColor": "#3b82f6aa",            // optional — fill color
        "color": "#3b82f6",                  // optional — stroke color
        "weight": 2,                         // optional — stroke width
        "title": "Budapest",                 // optional — popup title
        "description": "Population: 1.7M"   // optional — popup body
      }
    ]
  }
}
```

#### `geojson` fields

| Field | Type | Required | Constraints |
|---|---|---|---|
| `map` | `string` | yes | Non-empty. Must be a registered map name. |
| `data` | `array` | no | Per-feature styling/popups. Max 200 items. |
| `defaultStyle` | `object` | no | Fallback `color`, `fillColor`, `weight` for features not in `data`. |

#### `data` item fields

| Field | Type | Required | Constraints |
|---|---|---|---|
| `name` | `string` | yes | Must exactly match a GeoJSON feature's `properties.name`. Case-sensitive, accented. |
| `color` | `string` | no | Stroke color. Max 50 characters. |
| `fillColor` | `string` | no | Fill color. Max 50 characters. Include alpha for transparency. |
| `weight` | `number` | no | Stroke width in pixels. Finite, >= 0. |
| `title` | `string` | no | Popup title. Max 200 characters. No HTML. |
| `description` | `string` | no | Popup body. Max 1,000 characters. No HTML. |

Features in the GeoJSON that have no matching `data` entry use `defaultStyle`. If `defaultStyle` is also absent, they get a light gray fill.

#### Registered maps

| `map` value | Region | Features |
|---|---|---|
| `hungary` | Hungary — counties | 20 counties (vármegyék) including Budapest |
| `hungary-regions` | Hungary — NUTS-2 regions | 8 statistical regions (régiók) |

Only pre-registered map names work. An unregistered name silently renders nothing (no error).

#### Hungary county names (`map: "hungary"`)

> Bács-Kiskun, Baranya, Békés, Borsod-Abaúj-Zemplén, Budapest, Csongrád-Csanád, Fejér, Győr-Moson-Sopron, Hajdú-Bihar, Heves, Jász-Nagykun-Szolnok, Komárom-Esztergom, Nógrád, Pest, Somogy, Szabolcs-Szatmár-Bereg, Tolna, Vas, Veszprém, Zala

#### Hungary region names (`map: "hungary-regions"`)

> Budapest, Dél-Alföld, Dél-Dunántúl, Észak-Alföld, Észak-Magyarország, Közép-Dunántúl, Nyugat-Dunántúl, Pest

#### Limits

| Limit | Value |
|---|---|
| Maximum data items per geojson | 200 |

---

## Color Values

All color fields (`color`, `fillColor`) accept any CSS color string up to 50 characters. Common formats:

| Format | Example | Notes |
|---|---|---|
| Hex (6-digit) | `#3b82f6` | Most common |
| Hex (8-digit, with alpha) | `#3b82f680` | Last two hex digits = opacity (00=transparent, ff=opaque) |
| Named colors | `red`, `blue` | Standard CSS color names |
| RGB | `rgb(59, 130, 246)` | Functional notation |
| RGBA | `rgba(16, 185, 129, 0.2)` | With alpha channel |
| HSL | `hsl(217, 91%, 60%)` | Hue, saturation, lightness |

For polygon fills, always include an alpha channel to keep the map readable underneath. The hex `33` suffix gives approximately 20% opacity — a good default.

**Note:** Polygon `fillOpacity` is hardcoded to `1` in the renderer. Transparency is controlled solely through the alpha channel in `fillColor` (8-digit hex or `rgba()`). This prevents double-multiplication of opacity (Leaflet's default `fillOpacity` of 0.2 would otherwise compound with the color's own alpha).

---

## Coordinate System

All coordinates use the **`[latitude, longitude]`** order (geographic convention), not `[lng, lat]` (GeoJSON convention).

| Axis | Range | Positive direction |
|---|---|---|
| Latitude | -90 (south pole) to 90 (north pole) | North |
| Longitude | -180 to 180 | East |

**Reference coordinates for common cities:**

| City | lat | lng |
|---|---|---|
| London | 51.5074 | -0.1278 |
| Paris | 48.8566 | 2.3522 |
| Berlin | 52.5200 | 13.4050 |
| Vienna | 48.2082 | 16.3738 |
| New York | 40.7128 | -74.0060 |
| Tokyo | 35.6762 | 139.6503 |
| Sydney | -33.8688 | 151.2093 |
| São Paulo | -23.5505 | -46.6333 |
| Budapest | 47.4979 | 19.0402 |

---

## Validation Limits Summary

| Limit | Value |
|---|---|
| Total JSON size | 100,000 characters |
| Max markers | 200 |
| Max polylines | 20 |
| Max polygons | 20 |
| Max points per polyline | 2,000 |
| Max vertices per polygon | 2,000 |
| Max marker title length | 200 characters |
| Max marker description length | 1,000 characters |
| Max geojson data items | 200 |
| Max color string length | 50 characters |
| Zoom range | 0–22 |
| Latitude range | -90 to 90 |
| Longitude range | -180 to 180 |

---

## What Gets Rejected

| Reason | Trigger |
|---|---|
| `oversize` | JSON string exceeds 100,000 characters |
| `unparseable` | JSON syntax error |
| `not-an-object` | Top level is not a plain object, or is an empty object `{}` |
| `no-features` | All arrays (markers, polylines, polygons) are empty and no geojson layer is set |
| `invalid-center` | `center` is not a 2-element `[number, number]` array |
| `invalid-zoom` | `zoom` is not a finite number in 0–22 |
| `invalid-markers` | A marker is not an object, has non-number lat/lng, or has invalid title/description types |
| `invalid-polylines` | A polyline has missing/empty/invalid coordinates, or invalid color/weight |
| `invalid-polygons` | A polygon has missing/empty/invalid coordinates, or invalid color/fillColor/weight |
| `invalid-geojson` | `geojson` is not an object, `map` is missing/empty, or data items have invalid fields |
| `too-many-features` | Exceeds any of the count/size limits above |
| `coordinate-out-of-range` | A latitude or longitude is outside its valid range |
| `html-in-text` | A marker `title` or `description` contains something matching `/<[a-z]/i` (e.g. `<script>`, `<img>`) |

When a block is rejected, it renders as a plain syntax-highlighted code block — not a map.

### HTML detection specifics

The regex `/<[a-z]/i` fires on strings like `<script>`, `<div>`, `<img src=...>` — anything that looks like an opening HTML tag. It does **not** fire on comparison operators like `Revenue < 100k` (because `<` is followed by a space or digit, not a letter).

---

## Auto-Fit Behavior

When `center` is omitted, the map computes a bounding box from every coordinate across all features (markers, polyline points, polygon vertices) and calls `fitBounds` with 20 px padding.

When `center` is provided but `zoom` is omitted, it defaults to zoom `13`.

For best results when showing multiple spread-out locations, **omit `center` and `zoom`** and let auto-fit handle it. Use explicit center/zoom when you need a specific viewport (e.g., zooming into a particular neighborhood).

---

## Dark Mode

The map tiles are automatically adjusted for dark mode via CSS filters. No action is needed from the JSON payload — this is handled by the renderer component.

---

## Tile Layer

The tile layer is hardcoded to OpenStreetMap and is not configurable from the JSON. Max tile zoom is 19. Attribution is added automatically.

---

## Complete Examples

### 1. Simple — Single marker with popup

````
```leaflet
{
  "center": [47.4979, 19.0402],
  "zoom": 14,
  "markers": [
    {
      "lat": 47.4979,
      "lng": 19.0402,
      "title": "Budapest",
      "description": "Capital of Hungary, on the Danube river"
    }
  ]
}
```
````

### 2. Multiple markers — Auto-fit bounds

````
```leaflet
{
  "markers": [
    { "lat": 48.2082, "lng": 16.3738, "title": "Vienna" },
    { "lat": 48.8566, "lng": 2.3522, "title": "Paris" },
    { "lat": 52.5200, "lng": 13.4050, "title": "Berlin" },
    { "lat": 47.4979, "lng": 19.0402, "title": "Budapest" }
  ]
}
```
````

No `center` or `zoom` — the map auto-fits to show all four cities.

### 3. Route — Polyline connecting cities

````
```leaflet
{
  "markers": [
    { "lat": 47.4979, "lng": 19.0402, "title": "Budapest" },
    { "lat": 48.2082, "lng": 16.3738, "title": "Vienna" },
    { "lat": 47.8095, "lng": 13.0550, "title": "Salzburg" }
  ],
  "polylines": [
    {
      "coordinates": [
        [47.4979, 19.0402],
        [47.6849, 17.6354],
        [48.2082, 16.3738],
        [47.8095, 13.0550]
      ],
      "color": "#ef4444",
      "weight": 4
    }
  ]
}
```
````

### 4. Area highlight — Polygon overlay

````
```leaflet
{
  "center": [47.5000, 19.0500],
  "zoom": 13,
  "markers": [
    { "lat": 47.4979, "lng": 19.0402, "title": "City Center" }
  ],
  "polygons": [
    {
      "coordinates": [
        [47.51, 19.03],
        [47.51, 19.07],
        [47.49, 19.07],
        [47.49, 19.03]
      ],
      "color": "#8b5cf6",
      "fillColor": "rgba(139, 92, 246, 0.15)",
      "weight": 2
    }
  ]
}
```
````

### 5. Mixed — Markers, route, and area on one map

````
```leaflet
{
  "markers": [
    { "lat": 47.4979, "lng": 19.0402, "title": "Parliament", "description": "Hungarian Parliament Building" },
    { "lat": 47.5025, "lng": 19.0344, "title": "Chain Bridge" }
  ],
  "polylines": [
    {
      "coordinates": [
        [47.4979, 19.0402],
        [47.5025, 19.0344],
        [47.5075, 19.0350]
      ],
      "color": "#3b82f6",
      "weight": 3
    }
  ],
  "polygons": [
    {
      "coordinates": [
        [47.505, 19.030],
        [47.505, 19.040],
        [47.500, 19.040],
        [47.500, 19.030]
      ],
      "color": "#10b981",
      "fillColor": "#10b98133",
      "weight": 2
    }
  ]
}
```
````

### 6. Dense markers — Pins without popups

````
```leaflet
{
  "markers": [
    { "lat": 47.50, "lng": 19.04 },
    { "lat": 47.51, "lng": 19.05 },
    { "lat": 47.49, "lng": 19.03 },
    { "lat": 47.50, "lng": 19.06 },
    { "lat": 47.48, "lng": 19.05 }
  ]
}
```
````

Markers without `title` or `description` are just pins — no popup on click.

### 7. Custom styling — Thick dashed-look route

````
```leaflet
{
  "markers": [
    { "lat": 51.5074, "lng": -0.1278, "title": "London" },
    { "lat": 48.8566, "lng": 2.3522, "title": "Paris" }
  ],
  "polylines": [
    {
      "coordinates": [
        [51.5074, -0.1278],
        [51.0, 1.0],
        [50.0, 1.5],
        [49.0, 2.0],
        [48.8566, 2.3522]
      ],
      "color": "#f59e0b",
      "weight": 5
    }
  ]
}
```
````

### 8. GeoJSON — Hungarian counties on OSM tiles

````
```leaflet
{
  "geojson": {
    "map": "hungary",
    "defaultStyle": { "color": "#6b7280", "fillColor": "#6b728033", "weight": 1 },
    "data": [
      { "name": "Budapest", "fillColor": "#3b82f6aa", "title": "Budapest", "description": "Population: 1.7M" },
      { "name": "Pest", "fillColor": "#60a5faaa", "title": "Pest", "description": "Population: 1.3M" },
      { "name": "Győr-Moson-Sopron", "fillColor": "#10b981aa", "title": "Győr-Moson-Sopron", "description": "Population: 460K" },
      { "name": "Hajdú-Bihar", "fillColor": "#f59e0baa", "title": "Hajdú-Bihar", "description": "Population: 530K" }
    ]
  }
}
```
````

Counties not listed in `data` get the gray `defaultStyle`. Click a highlighted county to see its popup.

### 9. GeoJSON — Hungarian regions with markers

````
```leaflet
{
  "markers": [
    { "lat": 47.4979, "lng": 19.0402, "title": "Budapest", "description": "Capital" }
  ],
  "geojson": {
    "map": "hungary-regions",
    "defaultStyle": { "color": "#374151", "fillColor": "#9ca3af33", "weight": 2 },
    "data": [
      { "name": "Budapest", "fillColor": "#1d4ed8cc" },
      { "name": "Nyugat-Dunántúl", "fillColor": "#059669aa" },
      { "name": "Észak-Alföld", "fillColor": "#dc2626aa" },
      { "name": "Dél-Alföld", "fillColor": "#f97316aa" }
    ]
  }
}
```
````

GeoJSON layers can be combined with markers, polylines, and polygons on the same map. Auto-fit includes all features.

---

## Unsupported Features

The following Leaflet library features are **not** available through this fence type:

- Custom marker icons (only the default blue pin)
- Circles or rectangles as shapes
- Inline GeoJSON (only pre-registered maps via the `geojson.map` field)
- Tile layer configuration (always OpenStreetMap)
- Image or video overlays
- Layer groups or layer controls
- WMS/WMTS layers
- Heatmaps or clustering
- Custom popups/tooltips beyond title + description text
- Draggable markers or editable shapes
- Any event handlers or interactivity beyond the default popup click
