import { ref } from 'vue'
import type { LeafletMapData, LeafletMarker } from '@/lib/validation/leaflet'
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

function addFeatures(
  L: LeafletModule,
  map: LeafletMapInstance,
  data: LeafletMapData,
): [number, number][] {
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
    }).addTo(map)
    allBounds.push(...polygon.coordinates)
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

  const createMap = (el: HTMLElement, data: LeafletMapData): LeafletMapInstance | null => {
    if (!leafletModule) return null

    const L = leafletModule

    try {
      const map = L.map(el, { attributionControl: true })
      L.tileLayer(TILE_URL, { attribution: TILE_ATTRIBUTION, maxZoom: 19 }).addTo(map)

      const allBounds = addFeatures(L, map, data)

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
