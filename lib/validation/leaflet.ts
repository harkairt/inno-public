import { ok, err, type Result } from 'neverthrow'

export interface LeafletMarker {
  lat: number
  lng: number
  title?: string
  description?: string
}

export interface LeafletPolyline {
  coordinates: [number, number][]
  color?: string
  weight?: number
}

export interface LeafletPolygon {
  coordinates: [number, number][]
  color?: string
  fillColor?: string
  weight?: number
}

export interface LeafletGeoJSONStyle {
  color?: string
  fillColor?: string
  weight?: number
}

export interface LeafletGeoJSONDataItem extends LeafletGeoJSONStyle {
  name: string
  title?: string
  description?: string
}

export interface LeafletGeoJSON {
  map: string
  data?: LeafletGeoJSONDataItem[]
  defaultStyle?: LeafletGeoJSONStyle
}

export interface LeafletMapData {
  center?: [number, number]
  zoom?: number
  markers: LeafletMarker[]
  polylines: LeafletPolyline[]
  polygons: LeafletPolygon[]
  geojson?: LeafletGeoJSON
}

export type LeafletRejectionReason =
  | 'oversize'
  | 'unparseable'
  | 'not-an-object'
  | 'no-features'
  | 'invalid-center'
  | 'invalid-zoom'
  | 'invalid-markers'
  | 'invalid-polylines'
  | 'invalid-polygons'
  | 'invalid-geojson'
  | 'too-many-features'
  | 'coordinate-out-of-range'
  | 'html-in-text'

export interface LeafletRejection {
  reason: LeafletRejectionReason
}

const MAX_JSON_SIZE = 100_000
const MAX_MARKERS = 200
const MAX_POLYLINES = 20
const MAX_POLYGONS = 20
const MAX_GEOJSON_DATA_ITEMS = 200
const MAX_POLYLINE_POINTS = 2000
const MAX_POLYGON_VERTICES = 2000
const MAX_TITLE_LENGTH = 200
const MAX_DESCRIPTION_LENGTH = 1000
const MAX_COLOR_LENGTH = 50

const HTML_TAG_RE = /<[a-z]/i

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value)

const isValidLat = (v: number): boolean => v >= -90 && v <= 90
const isValidLng = (v: number): boolean => v >= -180 && v <= 180

const containsHtml = (value: string): boolean => HTML_TAG_RE.test(value)

function validateCenter(raw: unknown): [number, number] | undefined | 'invalid' | 'out-of-range' {
  if (raw === undefined || raw === null) return undefined
  if (!Array.isArray(raw) || raw.length !== 2) return 'invalid'
  const [lat, lng] = raw
  if (!isFiniteNumber(lat) || !isFiniteNumber(lng)) return 'invalid'
  if (!isValidLat(lat) || !isValidLng(lng)) return 'out-of-range'
  return [lat, lng]
}

function validateZoom(raw: unknown): number | undefined | 'invalid' {
  if (raw === undefined || raw === null) return undefined
  if (!isFiniteNumber(raw) || raw < 0 || raw > 22) return 'invalid'
  return raw
}

function validateColor(raw: unknown): string | undefined | 'invalid' {
  if (raw === undefined || raw === null) return undefined
  if (typeof raw !== 'string' || raw.length > MAX_COLOR_LENGTH) return 'invalid'
  return raw
}

function validateWeight(raw: unknown): number | undefined | 'invalid' {
  if (raw === undefined || raw === null) return undefined
  if (!isFiniteNumber(raw) || raw < 0) return 'invalid'
  return raw
}

function validateCoordList(
  raw: unknown,
  maxPoints: number,
): [number, number][] | 'invalid' | 'out-of-range' | 'too-many' {
  if (!Array.isArray(raw) || raw.length === 0) return 'invalid'
  if (raw.length > maxPoints) return 'too-many'

  const coords: [number, number][] = []
  for (const item of raw) {
    if (!Array.isArray(item) || item.length !== 2) return 'invalid'
    const [lat, lng] = item
    if (!isFiniteNumber(lat) || !isFiniteNumber(lng)) return 'invalid'
    if (!isValidLat(lat) || !isValidLng(lng)) return 'out-of-range'
    coords.push([lat, lng])
  }
  return coords
}

function validateMarkers(raw: unknown): Result<LeafletMarker[], LeafletRejection> {
  if (raw === undefined || raw === null) return ok([])
  if (!Array.isArray(raw)) return err({ reason: 'invalid-markers' })
  if (raw.length > MAX_MARKERS) return err({ reason: 'too-many-features' })

  const markers: LeafletMarker[] = []
  for (const item of raw) {
    if (!isPlainObject(item)) return err({ reason: 'invalid-markers' })

    const { lat, lng, title, description } = item
    if (!isFiniteNumber(lat) || !isFiniteNumber(lng)) return err({ reason: 'invalid-markers' })
    if (!isValidLat(lat) || !isValidLng(lng)) return err({ reason: 'coordinate-out-of-range' })

    const marker: LeafletMarker = { lat, lng }

    if (title !== undefined && title !== null) {
      if (typeof title !== 'string' || title.length > MAX_TITLE_LENGTH)
        return err({ reason: 'invalid-markers' })
      if (containsHtml(title)) return err({ reason: 'html-in-text' })
      marker.title = title
    }

    if (description !== undefined && description !== null) {
      if (typeof description !== 'string' || description.length > MAX_DESCRIPTION_LENGTH)
        return err({ reason: 'invalid-markers' })
      if (containsHtml(description)) return err({ reason: 'html-in-text' })
      marker.description = description
    }

    markers.push(marker)
  }
  return ok(markers)
}

function validatePolylines(raw: unknown): Result<LeafletPolyline[], LeafletRejection> {
  if (raw === undefined || raw === null) return ok([])
  if (!Array.isArray(raw)) return err({ reason: 'invalid-polylines' })
  if (raw.length > MAX_POLYLINES) return err({ reason: 'too-many-features' })

  const polylines: LeafletPolyline[] = []
  for (const item of raw) {
    if (!isPlainObject(item)) return err({ reason: 'invalid-polylines' })

    const coordResult = validateCoordList(item.coordinates, MAX_POLYLINE_POINTS)
    if (coordResult === 'invalid') return err({ reason: 'invalid-polylines' })
    if (coordResult === 'out-of-range') return err({ reason: 'coordinate-out-of-range' })
    if (coordResult === 'too-many') return err({ reason: 'too-many-features' })

    const color = validateColor(item.color)
    if (color === 'invalid') return err({ reason: 'invalid-polylines' })

    const weight = validateWeight(item.weight)
    if (weight === 'invalid') return err({ reason: 'invalid-polylines' })

    const polyline: LeafletPolyline = { coordinates: coordResult }
    if (color !== undefined) polyline.color = color
    if (weight !== undefined) polyline.weight = weight
    polylines.push(polyline)
  }
  return ok(polylines)
}

function validatePolygons(raw: unknown): Result<LeafletPolygon[], LeafletRejection> {
  if (raw === undefined || raw === null) return ok([])
  if (!Array.isArray(raw)) return err({ reason: 'invalid-polygons' })
  if (raw.length > MAX_POLYGONS) return err({ reason: 'too-many-features' })

  const polygons: LeafletPolygon[] = []
  for (const item of raw) {
    if (!isPlainObject(item)) return err({ reason: 'invalid-polygons' })

    const coordResult = validateCoordList(item.coordinates, MAX_POLYGON_VERTICES)
    if (coordResult === 'invalid') return err({ reason: 'invalid-polygons' })
    if (coordResult === 'out-of-range') return err({ reason: 'coordinate-out-of-range' })
    if (coordResult === 'too-many') return err({ reason: 'too-many-features' })

    const color = validateColor(item.color)
    if (color === 'invalid') return err({ reason: 'invalid-polygons' })

    const fillColor = validateColor(item.fillColor)
    if (fillColor === 'invalid') return err({ reason: 'invalid-polygons' })

    const weight = validateWeight(item.weight)
    if (weight === 'invalid') return err({ reason: 'invalid-polygons' })

    const polygon: LeafletPolygon = { coordinates: coordResult }
    if (color !== undefined) polygon.color = color
    if (fillColor !== undefined) polygon.fillColor = fillColor
    if (weight !== undefined) polygon.weight = weight
    polygons.push(polygon)
  }
  return ok(polygons)
}

function validateGeoJSONStyle(item: Record<string, unknown>): LeafletGeoJSONStyle | 'invalid' {
  const color = validateColor(item.color)
  if (color === 'invalid') return 'invalid'
  const fillColor = validateColor(item.fillColor)
  if (fillColor === 'invalid') return 'invalid'
  const weight = validateWeight(item.weight)
  if (weight === 'invalid') return 'invalid'

  const style: LeafletGeoJSONStyle = {}
  if (color !== undefined) style.color = color
  if (fillColor !== undefined) style.fillColor = fillColor
  if (weight !== undefined) style.weight = weight
  return style
}

function validateGeoJSON(raw: unknown): Result<LeafletGeoJSON | undefined, LeafletRejection> {
  if (raw === undefined || raw === null) return ok(undefined)
  if (!isPlainObject(raw)) return err({ reason: 'invalid-geojson' })

  const { map, data, defaultStyle } = raw
  if (typeof map !== 'string' || map.trim().length === 0) return err({ reason: 'invalid-geojson' })

  const result: LeafletGeoJSON = { map: map.trim() }

  if (defaultStyle !== undefined && defaultStyle !== null) {
    if (!isPlainObject(defaultStyle)) return err({ reason: 'invalid-geojson' })
    const style = validateGeoJSONStyle(defaultStyle)
    if (style === 'invalid') return err({ reason: 'invalid-geojson' })
    result.defaultStyle = style
  }

  if (data !== undefined && data !== null) {
    if (!Array.isArray(data)) return err({ reason: 'invalid-geojson' })
    if (data.length > MAX_GEOJSON_DATA_ITEMS) return err({ reason: 'too-many-features' })

    const items: LeafletGeoJSONDataItem[] = []
    for (const item of data) {
      if (!isPlainObject(item)) return err({ reason: 'invalid-geojson' })
      if (typeof item.name !== 'string' || item.name.trim().length === 0)
        return err({ reason: 'invalid-geojson' })

      const style = validateGeoJSONStyle(item)
      if (style === 'invalid') return err({ reason: 'invalid-geojson' })

      const entry: LeafletGeoJSONDataItem = { name: item.name, ...style }

      if (item.title !== undefined && item.title !== null) {
        if (typeof item.title !== 'string' || item.title.length > MAX_TITLE_LENGTH)
          return err({ reason: 'invalid-geojson' })
        if (containsHtml(item.title)) return err({ reason: 'html-in-text' })
        entry.title = item.title
      }

      if (item.description !== undefined && item.description !== null) {
        if (
          typeof item.description !== 'string' ||
          item.description.length > MAX_DESCRIPTION_LENGTH
        )
          return err({ reason: 'invalid-geojson' })
        if (containsHtml(item.description)) return err({ reason: 'html-in-text' })
        entry.description = item.description
      }

      items.push(entry)
    }
    result.data = items
  }

  return ok(result)
}

export const parseLeafletData = (json: string): Result<LeafletMapData, LeafletRejection> => {
  if (json.length > MAX_JSON_SIZE) return err({ reason: 'oversize' })

  let parsed: unknown
  try {
    parsed = JSON.parse(json)
  } catch {
    return err({ reason: 'unparseable' })
  }

  if (!isPlainObject(parsed) || Object.keys(parsed).length === 0) {
    return err({ reason: 'not-an-object' })
  }

  const center = validateCenter(parsed.center)
  if (center === 'invalid') return err({ reason: 'invalid-center' })
  if (center === 'out-of-range') return err({ reason: 'coordinate-out-of-range' })

  const zoom = validateZoom(parsed.zoom)
  if (zoom === 'invalid') return err({ reason: 'invalid-zoom' })

  const markersResult = validateMarkers(parsed.markers)
  if (markersResult.isErr()) return err(markersResult.error)

  const polylinesResult = validatePolylines(parsed.polylines)
  if (polylinesResult.isErr()) return err(polylinesResult.error)

  const polygonsResult = validatePolygons(parsed.polygons)
  if (polygonsResult.isErr()) return err(polygonsResult.error)

  const geojsonResult = validateGeoJSON(parsed.geojson)
  if (geojsonResult.isErr()) return err(geojsonResult.error)

  const markers = markersResult.value
  const polylines = polylinesResult.value
  const polygons = polygonsResult.value
  const geojson = geojsonResult.value

  if (markers.length === 0 && polylines.length === 0 && polygons.length === 0 && !geojson) {
    return err({ reason: 'no-features' })
  }

  const data: LeafletMapData = { markers, polylines, polygons }
  if (center !== undefined) data.center = center
  if (zoom !== undefined) data.zoom = zoom
  if (geojson !== undefined) data.geojson = geojson

  return ok(data)
}
