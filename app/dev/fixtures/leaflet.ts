import type ChatMap from '@/app/components/chat/ChatMap.vue'
import type { Scenario } from '@/app/dev/fixtures/scenario'
import type { LeafletMapData } from '@/lib/validation/leaflet'

type ChatMapProps = InstanceType<typeof ChatMap>['$props']

const viennaMarkers: LeafletMapData = {
  center: [48.2082, 16.3738],
  zoom: 13,
  markers: [
    { lat: 48.2082, lng: 16.3738, title: 'Vienna', description: 'Capital of Austria' },
    {
      lat: 48.201,
      lng: 16.3699,
      title: "St. Stephen's Cathedral",
      description: 'Gothic cathedral in the heart of Vienna',
    },
    { lat: 48.2066, lng: 16.3631, title: 'Hofburg Palace', description: 'Former imperial palace' },
  ],
  polylines: [],
  polygons: [],
}

const routeMap: LeafletMapData = {
  markers: [
    { lat: 48.2082, lng: 16.3738, title: 'Vienna' },
    { lat: 47.8095, lng: 13.055, title: 'Salzburg' },
  ],
  polylines: [
    {
      coordinates: [
        [48.2082, 16.3738],
        [48.1, 15.5],
        [47.9, 14.5],
        [47.8095, 13.055],
      ],
      color: '#3b82f6',
      weight: 3,
    },
  ],
  polygons: [],
}

const polygonMap: LeafletMapData = {
  markers: [],
  polylines: [],
  polygons: [
    {
      coordinates: [
        [48.22, 16.35],
        [48.22, 16.4],
        [48.19, 16.4],
        [48.19, 16.35],
      ],
      color: '#10b981',
      fillColor: '#10b98133',
      weight: 2,
    },
  ],
}

const mixedMap: LeafletMapData = {
  center: [48.2082, 16.3738],
  zoom: 12,
  markers: [
    { lat: 48.2082, lng: 16.3738, title: 'Vienna Center' },
    {
      lat: 48.1858,
      lng: 16.3126,
      title: 'Schönbrunn Palace',
      description: 'UNESCO World Heritage Site',
    },
  ],
  polylines: [
    {
      coordinates: [
        [48.2082, 16.3738],
        [48.1858, 16.3126],
      ],
      color: '#ef4444',
      weight: 4,
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
      color: '#8b5cf6',
      fillColor: '#8b5cf633',
      weight: 2,
    },
  ],
}

const hungaryCountiesGeoJSON: LeafletMapData = {
  markers: [],
  polylines: [],
  polygons: [],
  geojson: {
    map: 'hungary',
    defaultStyle: { color: '#6b7280', fillColor: '#6b728033', weight: 1 },
    data: [
      {
        name: 'Budapest',
        fillColor: '#3b82f6aa',
        title: 'Budapest',
        description: 'Population: 1.7M',
      },
      { name: 'Pest', fillColor: '#60a5faaa', title: 'Pest', description: 'Population: 1.3M' },
      {
        name: 'Győr-Moson-Sopron',
        fillColor: '#10b981aa',
        title: 'Győr-Moson-Sopron',
        description: 'Population: 460K',
      },
      {
        name: 'Hajdú-Bihar',
        fillColor: '#f59e0baa',
        title: 'Hajdú-Bihar',
        description: 'Population: 530K',
      },
      {
        name: 'Borsod-Abaúj-Zemplén',
        fillColor: '#ef4444aa',
        title: 'Borsod-Abaúj-Zemplén',
        description: 'Population: 640K',
      },
    ],
  },
}

const hungaryRegionsGeoJSON: LeafletMapData = {
  markers: [],
  polylines: [],
  polygons: [],
  geojson: {
    map: 'hungary-regions',
    defaultStyle: { color: '#374151', weight: 2 },
    data: [
      {
        name: 'Budapest',
        fillColor: '#1d4ed8cc',
        title: 'Budapest',
        description: 'GDP: 38,200 EUR/capita',
      },
      {
        name: 'Pest',
        fillColor: '#3b82f6aa',
        title: 'Pest',
        description: 'GDP: 14,500 EUR/capita',
      },
      {
        name: 'Közép-Dunántúl',
        fillColor: '#10b981aa',
        title: 'Közép-Dunántúl',
        description: 'GDP: 15,800 EUR/capita',
      },
      {
        name: 'Nyugat-Dunántúl',
        fillColor: '#059669aa',
        title: 'Nyugat-Dunántúl',
        description: 'GDP: 16,200 EUR/capita',
      },
      {
        name: 'Dél-Dunántúl',
        fillColor: '#f59e0baa',
        title: 'Dél-Dunántúl',
        description: 'GDP: 10,300 EUR/capita',
      },
      {
        name: 'Észak-Magyarország',
        fillColor: '#ef4444aa',
        title: 'Észak-Magyarország',
        description: 'GDP: 9,800 EUR/capita',
      },
      {
        name: 'Észak-Alföld',
        fillColor: '#dc2626aa',
        title: 'Észak-Alföld',
        description: 'GDP: 9,200 EUR/capita',
      },
      {
        name: 'Dél-Alföld',
        fillColor: '#f97316aa',
        title: 'Dél-Alföld',
        description: 'GDP: 10,600 EUR/capita',
      },
    ],
  },
}

const scenarioSource = (data: LeafletMapData) => JSON.stringify(data, null, 2)

export const leafletScenarios: Scenario<ChatMapProps>[] = [
  {
    id: 'leaflet-markers',
    title: 'Markers — Vienna landmarks with popups',
    props: { data: viennaMarkers, blockIndex: 0, source: scenarioSource(viennaMarkers) },
  },
  {
    id: 'leaflet-route',
    title: 'Polyline — Vienna to Salzburg route (auto-fit bounds)',
    props: { data: routeMap, blockIndex: 1, source: scenarioSource(routeMap) },
  },
  {
    id: 'leaflet-polygon',
    title: 'Polygon — area overlay (auto-fit bounds)',
    props: { data: polygonMap, blockIndex: 2, source: scenarioSource(polygonMap) },
  },
  {
    id: 'leaflet-mixed',
    title: 'Mixed — markers, polyline, polygon on one map',
    props: { data: mixedMap, blockIndex: 3, source: scenarioSource(mixedMap) },
  },
  {
    id: 'leaflet-geojson-counties',
    title: 'GeoJSON — Hungarian counties on OSM tiles',
    props: {
      data: hungaryCountiesGeoJSON,
      blockIndex: 4,
      source: scenarioSource(hungaryCountiesGeoJSON),
    },
  },
  {
    id: 'leaflet-geojson-regions',
    title: 'GeoJSON — Hungarian regions on OSM tiles',
    props: {
      data: hungaryRegionsGeoJSON,
      blockIndex: 5,
      source: scenarioSource(hungaryRegionsGeoJSON),
    },
  },
]
