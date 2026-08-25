const MAP_LOADERS: Record<string, () => Promise<unknown>> = {
  hungary: () => import('@/lib/geo/hungary-counties.json'),
  'hungary-regions': () => import('@/lib/geo/hungary-regions.json'),
}

const cache = new Map<string, unknown>()

export async function loadGeoJSON(name: string): Promise<unknown | null> {
  const cached = cache.get(name)
  if (cached) return cached
  const loader = MAP_LOADERS[name]
  if (!loader) return null
  const mod = (await loader()) as { default: unknown }
  cache.set(name, mod.default)
  return mod.default
}

export function isRegisteredMap(name: string): boolean {
  return name in MAP_LOADERS
}
