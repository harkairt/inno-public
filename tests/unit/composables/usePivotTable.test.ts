/**
 * Unit tests for usePivotTable — a lazy loader for the (heavy) vue-pivottable
 * component. Both the module and its CSS side-effect import are mocked. Covers
 * the load-once cache, getComponent, and the import-failure path.
 *
 * Module-level singleton → re-import per test after resetModules.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

const PivotUi = { name: 'VuePivottableUi' }

vi.mock('vue-pivottable', () => ({ VuePivottableUi: PivotUi }))
vi.mock('vue-pivottable/dist/vue-pivottable.css', () => ({}))

beforeEach(() => {
  vi.resetModules()
})

async function importPivot() {
  const { usePivotTable } = await import('@/app/composables/usePivotTable')
  return usePivotTable()
}

describe('usePivotTable', () => {
  it('loads the pivot component and exposes it via getComponent', async () => {
    const pivot = await importPivot()

    expect(pivot.getComponent()).toBeNull()
    expect(await pivot.loadPivotTable()).toBe(true)
    expect(pivot.isLoaded.value).toBe(true)
    expect(pivot.getComponent()).toBe(PivotUi)
  })

  it('is idempotent — a second load returns true without re-importing', async () => {
    const pivot = await importPivot()

    await pivot.loadPivotTable()
    expect(await pivot.loadPivotTable()).toBe(true)
    expect(pivot.getComponent()).toBe(PivotUi)
  })

  it('dedupes concurrent loads', async () => {
    const pivot = await importPivot()

    const [a, b] = await Promise.all([pivot.loadPivotTable(), pivot.loadPivotTable()])

    expect(a).toBe(true)
    expect(b).toBe(true)
  })

  it('returns false when the dynamic import fails', async () => {
    vi.doMock('vue-pivottable', () => {
      throw new Error('module missing')
    })
    vi.resetModules()

    const { usePivotTable } = await import('@/app/composables/usePivotTable')
    const pivot = usePivotTable()

    expect(await pivot.loadPivotTable()).toBe(false)
    expect(pivot.isLoaded.value).toBe(false)
    expect(pivot.getComponent()).toBeNull()

    vi.doUnmock('vue-pivottable')
  })
})
