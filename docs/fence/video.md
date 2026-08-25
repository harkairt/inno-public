# `video` Fence Type — HTML5 Video Player

Fence tag: ` ```video `

Renders an HTML5 video player for local video files. The JSON body describes the file path and playback options; invalid blocks fall back to a plain code block. **Only local file paths are accepted** — external URLs, data URIs, and streaming protocols are rejected.

---

## Top-Level Object

```jsonc
{
  "src": "/files/demo.mp4",          // required — absolute path to video file
  "title": "Project walkthrough",    // optional — caption below the video
  "poster": "/files/thumb.png",      // optional — preview image before playback
  "loop": false,                     // optional — loop playback (default: false)
  "muted": false,                    // optional — mute audio (default: false)
  "autoplay": false,                 // optional — start playing automatically (default: false)
  "preload": "metadata"             // optional — preload strategy (default: "metadata")
}
```

Only `src` is required. All other fields are optional.

---

## Fields

### `src` — required `string`

Absolute local file path to the video file.

| Constraint | Value |
|---|---|
| Must start with | `/` (absolute path) |
| Must NOT start with | `//` |
| Must NOT contain | `..` (path traversal) |
| Must NOT contain | `\` (backslash) |
| Must NOT contain | `?` or `#` (query/fragment) |
| Must NOT match | External prefixes (`http:`, `https:`, `data:`, `javascript:`, etc.) |
| File extension | Must be one of: `.mp4`, `.webm`, `.ogv`, `.ogg` (case-insensitive) |

### `title` — optional `string`

Caption text displayed below the video in a `<figcaption>` element.

| Constraint | Value |
|---|---|
| Max length | 200 characters |

When omitted, no caption is rendered.

### `poster` — optional `string`

Absolute local file path to an image displayed as the video preview before the user starts playback.

| Constraint | Value |
|---|---|
| Must start with | `/` (absolute path) |
| Must NOT start with | `//` |
| Must NOT contain | `..` (path traversal) |
| Must NOT contain | `\` (backslash) |
| Must NOT contain | `?` or `#` (query/fragment) |
| Must NOT match | External prefixes (`http:`, `https:`, `data:`, `javascript:`, etc.) |
| File extension | Must be one of: `.avif`, `.gif`, `.jpg`, `.jpeg`, `.png`, `.webp` (case-insensitive) |

### `loop` — optional `boolean`

When `true`, the video restarts automatically after reaching the end.

| Constraint | Value |
|---|---|
| Type | Boolean (`true` or `false`) |
| Default | `false` |

### `muted` — optional `boolean`

When `true`, the video plays with audio muted.

| Constraint | Value |
|---|---|
| Type | Boolean (`true` or `false`) |
| Default | `false` |

### `autoplay` — optional `boolean`

When `true`, the video begins playing as soon as it loads.

| Constraint | Value |
|---|---|
| Type | Boolean (`true` or `false`) |
| Default | `false` |
| Special rule | **`autoplay: true` requires `muted: true`** — setting autoplay without mute is rejected as `invalid-option` |

This constraint reflects browser autoplay policies, which block unmuted autoplay.

### `preload` — optional `string`

Controls how much of the video the browser preloads before the user presses play.

| Value | Behavior |
|---|---|
| `"none"` | Do not preload any data |
| `"metadata"` | Preload only metadata (duration, dimensions, first frame) |
| `"auto"` | Let the browser decide how much to preload |

| Constraint | Value |
|---|---|
| Allowed values | `"none"`, `"metadata"`, `"auto"` |
| Default | `"metadata"` |

---

## Allowed Video File Extensions

| Extension | Format |
|---|---|
| `.mp4` | MPEG-4 (H.264/H.265) |
| `.webm` | WebM (VP8/VP9/AV1) |
| `.ogv` | Ogg Video (Theora) |
| `.ogg` | Ogg container |

Extension matching is case-insensitive (`.MP4` and `.mp4` are both valid).

---

## Allowed Poster Image Extensions

| Extension | Format |
|---|---|
| `.avif` | AVIF |
| `.gif` | GIF |
| `.jpg` | JPEG |
| `.jpeg` | JPEG |
| `.png` | PNG |
| `.webp` | WebP |

Extension matching is case-insensitive.

---

## Path Format Rules

Both `src` and `poster` follow the same path validation rules:

1. **Absolute paths only** — must start with `/`
2. **No double-slash prefix** — `//network/share/file.mp4` is rejected
3. **No path traversal** — `..` anywhere in the path is rejected
4. **No backslashes** — `\` is rejected (use `/` as the separator)
5. **No query strings or fragments** — `?` and `#` are rejected
6. **Correct file extension** — `src` must end with a video extension; `poster` must end with an image extension
7. **No external references** — all string values in the JSON are scanned against external reference prefixes (`http:`, `https:`, `data:`, `javascript:`, and others); any match is rejected

---

## Autoplay Constraint

Setting `autoplay: true` without also setting `muted: true` is rejected with the `invalid-option` reason. This is a hard validation rule, not just a browser behavior.

To use autoplay, always pair it with mute:

```jsonc
{
  "src": "/videos/background.mp4",
  "autoplay": true,
  "muted": true
}
```

---

## Validation Limits Summary

| Limit | Value |
|---|---|
| Total JSON size | 50,000 characters |
| Max title length | 200 characters |
| Allowed video extensions | `.mp4`, `.webm`, `.ogv`, `.ogg` |
| Allowed poster extensions | `.avif`, `.gif`, `.jpg`, `.jpeg`, `.png`, `.webp` |
| Allowed preload values | `"none"`, `"metadata"`, `"auto"` |
| Allowed keys | `src`, `title`, `poster`, `loop`, `muted`, `autoplay`, `preload` |

---

## What Gets Rejected

| Reason | Trigger |
|---|---|
| `oversize` | JSON string exceeds 50,000 characters |
| `unparseable` | JSON syntax error |
| `not-an-object` | Top level is not a plain object |
| `missing-source` | `src` field is absent |
| `invalid-source` | `src` is not a string, or fails path validation, or has a non-video extension |
| `invalid-poster` | `poster` is not a string, or fails path validation, or has a non-image extension |
| `invalid-title` | `title` is not a string or exceeds 200 characters |
| `invalid-option` | A boolean field has a non-boolean value, `preload` has a disallowed value, or `autoplay: true` without `muted: true` |
| `unknown-option` | A key is present that is not in the allowed set (`src`, `title`, `poster`, `loop`, `muted`, `autoplay`, `preload`) |
| `external-reference` | Any string value matches an external reference prefix (`http:`, `https:`, `data:`, `javascript:`, etc.) |

When a block is rejected, it renders as a plain syntax-highlighted code block — not a video player.

---

## Renderer Details

- Component: `ChatVideo.vue`
- Renders a `<figure>` containing a `<video controls>` element
- When `title` is provided, a `<figcaption>` is rendered below the video
- Default preload is `metadata` when not specified in the JSON
- Video max height: `min(70vh, 42rem)`
- Black background with rounded corners (`0.5rem`)
- When the `src` prop changes, the component calls `video.load()` to reload the new source
- If the video file fails to load, an error message is displayed in place of the player

---

## Complete Examples

### 1. Minimal — Just a video file

````
```video
{
  "src": "/files/meeting-recording.mp4"
}
```
````

Only `src` is required. The player renders with default controls, no caption, `metadata` preloading, and no autoplay.

### 2. With title — Video and caption

````
```video
{
  "src": "/files/sprint-demo.webm",
  "title": "Sprint 14 demo — new dashboard features"
}
```
````

The title appears as a `<figcaption>` below the video.

### 3. With poster — Preview image before playback

````
```video
{
  "src": "/files/tutorial.mp4",
  "title": "Getting started tutorial",
  "poster": "/files/tutorial-thumbnail.jpg"
}
```
````

The poster image is displayed until the user presses play.

### 4. Looping muted — Background-style video

````
```video
{
  "src": "/videos/animation-loop.mp4",
  "loop": true,
  "muted": true,
  "autoplay": true,
  "preload": "auto"
}
```
````

Autoplays on load, loops continuously, with no audio. Note that `autoplay: true` requires `muted: true`.

### 5. Full-featured — All options specified

````
```video
{
  "src": "/media/project-update.mp4",
  "title": "Q3 project status update",
  "poster": "/media/project-update-poster.png",
  "loop": false,
  "muted": false,
  "autoplay": false,
  "preload": "metadata"
}
```
````

Explicit values for every field. The poster image shows until the user clicks play; audio is enabled; the video plays once and stops.

### 6. Ogg format — Alternative container

````
```video
{
  "src": "/recordings/lecture.ogv",
  "title": "Lecture recording — Introduction to algorithms"
}
```
````

The `.ogv` extension is accepted alongside `.mp4`, `.webm`, and `.ogg`.

---

## Unsupported Features

The following are **not** available through this fence type:

- External URLs (only local file paths are accepted)
- Multiple source elements (only a single `src` is supported)
- Subtitles or captions (`<track>` elements)
- Custom controls or control bar styling
- Streaming protocols (HLS, DASH, RTMP)
- Picture-in-picture configuration
- Playback rate control
- Start/end time ranges
- Download button configuration
- Width/height overrides (sizing is handled by the renderer)
- Inline/playsInline attribute
- Audio-only files (use an appropriate fence type for audio)
