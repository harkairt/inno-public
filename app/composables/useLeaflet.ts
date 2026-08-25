import { ref } from 'vue'
import type {
  LeafletMapData,
  LeafletMarker,
  LeafletGeoJSONDataItem,
} from '@/lib/validation/leaflet'
import { loadGeoJSON } from '@/lib/geo/registry'
import { createLogger } from '@/lib/utils/logger'

const logger = createLogger('useLeaflet')

type LeafletModule = typeof import('leaflet')

export type LeafletMapInstance = ReturnType<LeafletModule['map']>

let leafletModule: LeafletModule | null = null
let loadingPromise: Promise<boolean> | null = null

const isLoading = ref(false)
const isLoaded = ref(false)

const TILE_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png'
const TILE_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'

const escapeHtml = (text: string): string =>
  text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')

function buildPopupHtml(marker: LeafletMarker): string | null {
  if (!marker.title && !marker.description) return null
  const parts: string[] = []
  if (marker.title) parts.push(`<strong>${escapeHtml(marker.title)}</strong>`)
  if (marker.description) parts.push(escapeHtml(marker.description))
  return parts.join('<br>')
}

function buildGeoJSONPopupHtml(
  featureName: string | undefined,
  item: LeafletGeoJSONDataItem | undefined,
): string | null {
  if (!item) return null
  const title = item.title ?? featureName
  const desc = item.description
  if (!title && !desc) return null
  const parts: string[] = []
  if (title) parts.push(`<strong>${escapeHtml(title)}</strong>`)
  if (desc) parts.push(escapeHtml(desc))
  return parts.join('<br>')
}

async function addFeatures(
  L: LeafletModule,
  map: LeafletMapInstance,
  data: LeafletMapData,
): Promise<[number, number][]> {
  const allBounds: [number, number][] = []

  for (const marker of data.markers) {
    const m = L.marker([marker.lat, marker.lng]).addTo(map)
    allBounds.push([marker.lat, marker.lng])
    const popup = buildPopupHtml(marker)
    if (popup) m.bindPopup(popup)
  }

  for (const polyline of data.polylines) {
    L.polyline(polyline.coordinates, {
      color: polyline.color ?? '#3b82f6',
      weight: polyline.weight ?? 3,
    }).addTo(map)
    allBounds.push(...polyline.coordinates)
  }

  for (const polygon of data.polygons) {
    L.polygon(polygon.coordinates, {
      color: polygon.color ?? '#10b981',
      fillColor: polygon.fillColor ?? (polygon.color ? polygon.color + '33' : '#10b98133'),
      weight: polygon.weight ?? 2,
      fillOpacity: 1,
    }).addTo(map)
    allBounds.push(...polygon.coordinates)
  }

  if (data.geojson) {
    const geoJSON = await loadGeoJSON(data.geojson.map)
    if (geoJSON) {
      const styleMap = new Map<string, LeafletGeoJSONDataItem>()
      for (const item of data.geojson.data ?? []) {
        styleMap.set(item.name, item)
      }
      const ds = data.geojson.defaultStyle ?? {}

      const featureName = (feature: GeoJSON.Feature | undefined): string | undefined => {
        const props = feature?.properties as Record<string, unknown> | undefined
        const n = props?.name
        return typeof n === 'string' ? n : undefined
      }

      const layer = L.geoJSON(geoJSON as GeoJSON.GeoJsonObject, {
        style: (feature) => {
          const name = featureName(feature)
          const item = name ? styleMap.get(name) : undefined
          return {
            color: item?.color ?? ds.color ?? '#10b981',
            fillColor: item?.fillColor ?? ds.fillColor ?? '#10b98133',
            weight: item?.weight ?? ds.weight ?? 1,
            fillOpacity: 1,
          }
        },
        onEachFeature: (feature, featureLayer) => {
          const name = featureName(feature)
          const item = name ? styleMap.get(name) : undefined
          const popup = buildGeoJSONPopupHtml(name, item)
          if (popup) featureLayer.bindPopup(popup)
        },
      }).addTo(map)

      const bounds = layer.getBounds()
      if (bounds.isValid()) {
        allBounds.push([bounds.getSouthWest().lat, bounds.getSouthWest().lng])
        allBounds.push([bounds.getNorthEast().lat, bounds.getNorthEast().lng])
      }
    }
  }

  return allBounds
}

export const useLeaflet = () => {
  const loadLeaflet = (): Promise<boolean> => {
    if (leafletModule) return Promise.resolve(true)
    if (loadingPromise) return loadingPromise

    isLoading.value = true

    loadingPromise = (async () => {
      try {
        const [L] = await Promise.all([import('leaflet'), import('leaflet/dist/leaflet.css')])
        leafletModule = L.default ?? L

        delete (leafletModule.Icon.Default.prototype as unknown as Record<string, unknown>)
          ._getIconUrl
        leafletModule.Icon.Default.mergeOptions({
          iconRetinaUrl: new URL('leaflet/dist/images/marker-icon-2x.png', import.meta.url).href,
          iconUrl: new URL('leaflet/dist/images/marker-icon.png', import.meta.url).href,
          shadowUrl: new URL('leaflet/dist/images/marker-shadow.png', import.meta.url).href,
        })

        isLoaded.value = true
        return true
      } catch (error) {
        logger.error('Failed to load Leaflet', error)
        return false
      } finally {
        isLoading.value = false
        loadingPromise = null
      }
    })()

    return loadingPromise
  }

  const createMap = async (
    el: HTMLElement,
    data: LeafletMapData,
  ): Promise<LeafletMapInstance | null> => {
    if (!leafletModule) return null

    const L = leafletModule

    try {
      const map = L.map(el, { attributionControl: true })
      L.tileLayer(TILE_URL, { attribution: TILE_ATTRIBUTION, maxZoom: 19 }).addTo(map)

      const allBounds = await addFeatures(L, map, data)

      if (data.center) {
        map.setView(data.center, data.zoom ?? 13)
      } else if (allBounds.length > 0) {
        map.fitBounds(L.latLngBounds(allBounds), { padding: [20, 20] })
      } else {
        map.setView([0, 0], 2)
      }

      return map
    } catch (error) {
      logger.error('Failed to create Leaflet map', error)
      return null
    }
  }

  return {
    isLoading,
    isLoaded,
    loadLeaflet,
    createMap,
  }
}
