import { describe, it, expect } from 'vitest'
import { parseLeafletData } from '@/lib/validation/leaflet'

const validMarkerOnly = {
  markers: [{ lat: 48.2082, lng: 16.3738, title: 'Vienna', description: 'Capital of Austria' }],
}

const validMixed = {
  center: [48.2082, 16.3738],
  zoom: 13,
  markers: [{ lat: 48.2082, lng: 16.3738, title: 'Vienna' }],
  polylines: [
    {
      coordinates: [
        [48.2082, 16.3738],
        [47.8095, 13.055],
      ],
      color: '#3b82f6',
      weight: 3,
    },
  ],
  polygons: [
    {
      coordinates: [
        [48.22, 16.35],
        [48.22, 16.4],
        [48.19, 16.4],
        [48.19, 16.35],
      ],
      color: '#10b981',
    },
  ],
}

function reasonOf(json: string): string | undefined {
  const result = parseLeafletData(json)
  return result.isErr() ? result.error.reason : undefined
}

describe('parseLeafletData — valid data', () => {
  it('accepts a marker-only map', () => {
    const result = parseLeafletData(JSON.stringify(validMarkerOnly))
    expect(result.isOk()).toBe(true)
    expect(result._unsafeUnwrap().markers).toHaveLength(1)
  })

  it('accepts a fully specified map with center, zoom, markers, polylines, and polygons', () => {
    const result = parseLeafletData(JSON.stringify(validMixed))
    expect(result.isOk()).toBe(true)
    const data = result._unsafeUnwrap()
    expect(data.center).toEqual([48.2082, 16.3738])
    expect(data.zoom).toBe(13)
    expect(data.markers).toHaveLength(1)
    expect(data.polylines).toHaveLength(1)
    expect(data.polygons).toHaveLength(1)
  })

  it('accepts optional center and zoom omitted (auto-fit mode)', () => {
    const result = parseLeafletData(
      JSON.stringify({
        markers: [{ lat: 0, lng: 0 }],
      }),
    )
    expect(result.isOk()).toBe(true)
    const data = result._unsafeUnwrap()
    expect(data.center).toBeUndefined()
    expect(data.zoom).toBeUndefined()
  })

  it('accepts polyline-only map', () => {
    const result = parseLeafletData(
      JSON.stringify({
        polylines: [
          {
            coordinates: [
              [0, 0],
              [1, 1],
            ],
          },
        ],
      }),
    )
    expect(result.isOk()).toBe(true)
  })

  it('accepts polygon-only map', () => {
    const result = parseLeafletData(
      JSON.stringify({
        polygons: [
          {
            coordinates: [
              [0, 0],
              [1, 1],
              [1, 0],
            ],
          },
        ],
      }),
    )
    expect(result.isOk()).toBe(true)
  })
})

describe('parseLeafletData — size guard', () => {
  it('rejects JSON over 100KB', () => {
    const padded = `{"markers":[{"lat":0,"lng":0,"description":"${'a'.repeat(100_001)}"}]}`
    expect(reasonOf(padded)).toBe('oversize')
  })

  it('reports oversize before unparseable', () => {
    expect(reasonOf('x'.repeat(100_001))).toBe('oversize')
  })
})

describe('parseLeafletData — structure', () => {
  it('rejects truncated JSON', () => {
    expect(reasonOf('{"markers": [')).toBe('unparseable')
  })

  it.each([['{}'], ['[]'], ['null'], ['3'], ['""']])('rejects %s', (json: string) => {
    expect(reasonOf(json)).toBe('not-an-object')
  })

  it('rejects an object with no features', () => {
    expect(reasonOf('{"center":[0,0],"zoom":10}')).toBe('no-features')
  })

  it('rejects when all feature arrays are empty', () => {
    expect(reasonOf(JSON.stringify({ markers: [], polylines: [], polygons: [] }))).toBe(
      'no-features',
    )
  })
})

describe('parseLeafletData — center validation', () => {
  it('rejects a non-array center', () => {
    expect(reasonOf(JSON.stringify({ center: 'foo', markers: [{ lat: 0, lng: 0 }] }))).toBe(
      'invalid-center',
    )
  })

  it('rejects center with wrong length', () => {
    expect(reasonOf(JSON.stringify({ center: [0], markers: [{ lat: 0, lng: 0 }] }))).toBe(
      'invalid-center',
    )
  })

  it('rejects center with out-of-range lat', () => {
    expect(reasonOf(JSON.stringify({ center: [91, 0], markers: [{ lat: 0, lng: 0 }] }))).toBe(
      'coordinate-out-of-range',
    )
  })

  it('rejects center with out-of-range lng', () => {
    expect(reasonOf(JSON.stringify({ center: [0, 181], markers: [{ lat: 0, lng: 0 }] }))).toBe(
      'coordinate-out-of-range',
    )
  })
})

describe('parseLeafletData — zoom validation', () => {
  it('rejects negative zoom', () => {
    expect(reasonOf(JSON.stringify({ zoom: -1, markers: [{ lat: 0, lng: 0 }] }))).toBe(
      'invalid-zoom',
    )
  })

  it('rejects zoom above 22', () => {
    expect(reasonOf(JSON.stringify({ zoom: 23, markers: [{ lat: 0, lng: 0 }] }))).toBe(
      'invalid-zoom',
    )
  })

  it('accepts zoom at boundaries (0 and 22)', () => {
    expect(
      parseLeafletData(JSON.stringify({ zoom: 0, markers: [{ lat: 0, lng: 0 }] })).isOk(),
    ).toBe(true)
    expect(
      parseLeafletData(JSON.stringify({ zoom: 22, markers: [{ lat: 0, lng: 0 }] })).isOk(),
    ).toBe(true)
  })
})

describe('parseLeafletData — marker validation', () => {
  it('rejects non-numeric lat/lng', () => {
    expect(reasonOf(JSON.stringify({ markers: [{ lat: 'x', lng: 0 }] }))).toBe('invalid-markers')
  })

  it('rejects out-of-range marker coordinates', () => {
    expect(reasonOf(JSON.stringify({ markers: [{ lat: 91, lng: 0 }] }))).toBe(
      'coordinate-out-of-range',
    )
  })

  it('rejects too many markers', () => {
    const markers = Array.from({ length: 201 }, (_, i) => ({ lat: 0, lng: i * 0.001 }))
    expect(reasonOf(JSON.stringify({ markers }))).toBe('too-many-features')
  })

  it('accepts exactly 200 markers', () => {
    const markers = Array.from({ length: 200 }, (_, i) => ({ lat: 0, lng: i * 0.001 }))
    expect(parseLeafletData(JSON.stringify({ markers })).isOk()).toBe(true)
  })

  it('rejects title exceeding 200 chars', () => {
    expect(
      reasonOf(JSON.stringify({ markers: [{ lat: 0, lng: 0, title: 'a'.repeat(201) }] })),
    ).toBe('invalid-markers')
  })

  it('rejects description exceeding 1000 chars', () => {
    expect(
      reasonOf(JSON.stringify({ markers: [{ lat: 0, lng: 0, description: 'a'.repeat(1001) }] })),
    ).toBe('invalid-markers')
  })
})

describe('parseLeafletData — security', () => {
  it('rejects HTML in marker title', () => {
    expect(
      reasonOf(
        JSON.stringify({ markers: [{ lat: 0, lng: 0, title: '<script>alert(1)</script>' }] }),
      ),
    ).toBe('html-in-text')
  })

  it('rejects HTML in marker description', () => {
    expect(
      reasonOf(JSON.stringify({ markers: [{ lat: 0, lng: 0, description: '<img src=x>' }] })),
    ).toBe('html-in-text')
  })

  it('accepts text with angle brackets that do not form HTML tags', () => {
    const result = parseLeafletData(
      JSON.stringify({ markers: [{ lat: 0, lng: 0, title: 'Revenue < 100k' }] }),
    )
    expect(result.isOk()).toBe(true)
  })
})

describe('parseLeafletData — polyline validation', () => {
  it('rejects non-array polylines', () => {
    expect(reasonOf(JSON.stringify({ polylines: 'foo' }))).toBe('invalid-polylines')
  })

  it('rejects polyline with empty coordinates', () => {
    expect(reasonOf(JSON.stringify({ polylines: [{ coordinates: [] }] }))).toBe('invalid-polylines')
  })

  it('rejects polyline with out-of-range coordinates', () => {
    expect(reasonOf(JSON.stringify({ polylines: [{ coordinates: [[91, 0]] }] }))).toBe(
      'coordinate-out-of-range',
    )
  })

  it('rejects too many polylines', () => {
    const polylines = Array.from({ length: 21 }, () => ({
      coordinates: [
        [0, 0],
        [1, 1],
      ],
    }))
    expect(reasonOf(JSON.stringify({ polylines }))).toBe('too-many-features')
  })

  it('rejects polyline with too many points', () => {
    const coordinates = Array.from({ length: 2001 }, (_, i) => [i * 0.001, 0])
    expect(reasonOf(JSON.stringify({ polylines: [{ coordinates }] }))).toBe('too-many-features')
  })

  it('rejects color string exceeding 50 chars', () => {
    expect(
      reasonOf(
        JSON.stringify({
          polylines: [
            {
              coordinates: [
                [0, 0],
                [1, 1],
              ],
              color: 'a'.repeat(51),
            },
          ],
        }),
      ),
    ).toBe('invalid-polylines')
  })
})

describe('parseLeafletData — polygon validation', () => {
  it('rejects non-array polygons', () => {
    expect(reasonOf(JSON.stringify({ polygons: 'foo' }))).toBe('invalid-polygons')
  })

  it('rejects too many polygons', () => {
    const polygons = Array.from({ length: 21 }, () => ({
      coordinates: [
        [0, 0],
        [1, 1],
        [1, 0],
      ],
    }))
    expect(reasonOf(JSON.stringify({ polygons }))).toBe('too-many-features')
  })

  it('rejects polygon with too many vertices', () => {
    const coordinates = Array.from({ length: 2001 }, (_, i) => [i * 0.001, 0])
    expect(reasonOf(JSON.stringify({ polygons: [{ coordinates }] }))).toBe('too-many-features')
  })

  it('accepts valid polygon with optional fillColor and weight', () => {
    const result = parseLeafletData(
      JSON.stringify({
        polygons: [
          {
            coordinates: [
              [0, 0],
              [1, 1],
              [1, 0],
            ],
            color: '#f00',
            fillColor: '#f0033',
            weight: 2,
          },
        ],
      }),
    )
    expect(result.isOk()).toBe(true)
  })
})
