import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ref, nextTick } from 'vue'
import type { Component } from 'vue'
import { renderWithProviders } from '@/tests/utils/render'
import type { LeafletMapData } from '@/lib/validation/leaflet'

class FakeMap {
  setView = vi.fn().mockReturnThis()
  fitBounds = vi.fn().mockReturnThis()
  remove = vi.fn()
  invalidateSize = vi.fn()
}

class FakeMarker {
  addTo = vi.fn().mockReturnThis()
  bindPopup = vi.fn().mockReturnThis()
}

class FakeTileLayer {
  addTo = vi.fn().mockReturnThis()
}

class FakePolyline {
  addTo = vi.fn().mockReturnThis()
}

class FakePolygon {
  addTo = vi.fn().mockReturnThis()
}

let fakeMapInstances: FakeMap[] = []

const workingLeaflet = () => ({
  default: {
    map: () => {
      const m = new FakeMap()
      fakeMapInstances.push(m)
      return m
    },
    tileLayer: () => new FakeTileLayer(),
    marker: () => new FakeMarker(),
    polyline: () => new FakePolyline(),
    polygon: () => new FakePolygon(),
    latLngBounds: vi.fn().mockReturnValue({ isValid: () => true }),
    Icon: { Default: { prototype: {}, mergeOptions: vi.fn() } },
  },
})

vi.mock('vue-i18n', () => ({
  useI18n: () => ({ t: (key: string) => key, locale: ref('en') }),
}))

vi.mock('leaflet/dist/leaflet.css', () => ({}))

let resizeCallback: (() => void) | null = null

class FakeResizeObserver {
  constructor(callback: () => void) {
    resizeCallback = callback
  }

  observe = vi.fn()
  unobserve = vi.fn()
  disconnect = vi.fn()
}

beforeEach(() => {
  vi.resetModules()
  vi.doMock('leaflet', workingLeaflet)
  fakeMapInstances = []
  resizeCallback = null
  vi.stubGlobal('ResizeObserver', FakeResizeObserver)
})

const markerData: LeafletMapData = {
  center: [48.2082, 16.3738],
  zoom: 13,
  markers: [{ lat: 48.2082, lng: 16.3738, title: 'Vienna', description: 'Capital' }],
  polylines: [],
  polygons: [],
}

async function renderMap(props: Record<string, unknown> = {}) {
  const { default: ChatMap } = (await import('~/components/chat/ChatMap.vue')) as {
    default: Component
  }

  const utils = renderWithProviders(ChatMap, {
    props: { data: markerData, blockIndex: 0, source: JSON.stringify(markerData), ...props },
  })

  giveContainerWidth(utils.container)

  return utils
}

function giveContainerWidth(container: HTMLElement) {
  const canvas = container.querySelector('.map-canvas')
  if (canvas) {
    Object.defineProperty(canvas, 'offsetWidth', { value: 600, configurable: true })
  }
}

async function settle() {
  for (let i = 0; i < 6; i++) {
    await Promise.resolve()
    await nextTick()
  }
}

async function settleWithLayout() {
  await settle()
  resizeCallback?.()
  await nextTick()
}

describe('ChatMap — loading state', () => {
  it('shows the localized loading indicator before leaflet is available', async () => {
    const { container } = await renderMap()

    expect(container.querySelector('.map-loading')?.textContent?.trim()).toBe('chat.map.loading')
  })

  it('replaces the loading indicator with the map once leaflet loads', async () => {
    const { container } = await renderMap()
    await settleWithLayout()

    expect(container.querySelector('.map-loading')).toBeNull()
    expect(container.querySelector('.map-canvas')).not.toBeNull()
    expect(fakeMapInstances).toHaveLength(1)
  })
})

describe('ChatMap — source changes', () => {
  it('destroys and recreates the map when source changes', async () => {
    const { rerender } = await renderMap()
    await settleWithLayout()

    const firstMap = fakeMapInstances[0]!
    const nextData = { ...markerData, zoom: 10 }

    await rerender({ data: nextData, blockIndex: 0, source: JSON.stringify(nextData) })
    await settle()

    expect(firstMap.remove).toHaveBeenCalled()
    expect(fakeMapInstances).toHaveLength(2)
  })
})

describe('ChatMap — container resize', () => {
  it('calls invalidateSize when the container resizes', async () => {
    await renderMap()
    await settleWithLayout()

    const instance = fakeMapInstances[0]!
    instance.invalidateSize.mockClear()

    resizeCallback?.()
    await nextTick()

    expect(instance.invalidateSize).toHaveBeenCalled()
  })
})

describe('ChatMap — teardown', () => {
  it('removes the map on unmount', async () => {
    const { unmount } = await renderMap()
    await settleWithLayout()

    const instance = fakeMapInstances[0]!
    unmount()
    await nextTick()

    expect(instance.remove).toHaveBeenCalledTimes(1)
  })
})

describe('ChatMap — engine load failure', () => {
  it('shows the localized error and never renders a map', async () => {
    vi.doMock('leaflet', () => {
      throw new Error('leaflet unavailable')
    })

    const { container } = await renderMap()
    await settle()

    expect(container.querySelector('.map-error')?.textContent?.trim()).toBe('chat.map.renderFailed')
    expect(container.querySelector('.map-loading')).toBeNull()
    expect(fakeMapInstances).toHaveLength(0)
  })
})
