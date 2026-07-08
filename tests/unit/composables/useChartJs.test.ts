/**
 * Unit tests for useChartJs. Chart.js needs a real canvas, so `chart.js` is
 * mocked with a fake Chart class. Covers lazy-load + register, theme-colour
 * resolution from CSS custom properties on the document root, config building in
 * renderChart, and the null/error paths.
 *
 * Module-level singleton (ChartConstructor) → re-import per test after resetModules.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { ChartConfig } from '@/lib/validation/chart'

const registerSpy = vi.fn()
let shouldThrowOnConstruct = false

class FakeChart {
  static register = registerSpy
  static defaults: { color: string; borderColor: string } = { color: '', borderColor: '' }
  static lastInstance: FakeChart | null = null

  canvas: unknown
  config: unknown

  constructor(canvas: unknown, config: unknown) {
    if (shouldThrowOnConstruct) throw new Error('canvas boom')
    this.canvas = canvas
    this.config = config
    FakeChart.lastInstance = this
  }
}

const chartJsExports = {
  Chart: FakeChart,
  BarController: {},
  LineController: {},
  PieController: {},
  DoughnutController: {},
  RadarController: {},
  ScatterController: {},
  ArcElement: {},
  BarElement: {},
  LineElement: {},
  PointElement: {},
  RadialLinearScale: {},
  CategoryScale: {},
  LinearScale: {},
  Tooltip: {},
  Legend: {},
  Filler: {},
}

vi.mock('chart.js', () => chartJsExports)

beforeEach(() => {
  vi.resetModules()
  registerSpy.mockClear()
  shouldThrowOnConstruct = false
  FakeChart.defaults = { color: '', borderColor: '' }
  FakeChart.lastInstance = null
  document.documentElement.removeAttribute('style')
})

afterEach(() => {
  document.documentElement.removeAttribute('style')
})

async function importChartJs() {
  const { useChartJs } = await import('@/app/composables/useChartJs')
  return useChartJs()
}

const barConfig: ChartConfig = {
  type: 'bar',
  data: { labels: ['a'], datasets: [{ label: 'x', data: [1] }] },
} as unknown as ChartConfig

describe('useChartJs.loadChartJs', () => {
  it('loads and registers Chart.js once, caching the result', async () => {
    const chart = await importChartJs()

    expect(await chart.loadChartJs()).toBe(true)
    expect(await chart.loadChartJs()).toBe(true)
    expect(registerSpy).toHaveBeenCalledTimes(1)
    expect(chart.isLoaded.value).toBe(true)
  })

  it('falls back to hard-coded default colours when no CSS vars are set', async () => {
    const chart = await importChartJs()
    await chart.loadChartJs()

    expect(FakeChart.defaults.color).toBe('#adbac7')
    expect(FakeChart.defaults.borderColor).toBe('rgba(255, 255, 255, 0.1)')
  })

  it('reads theme colours from CSS custom properties on the document root', async () => {
    document.documentElement.style.setProperty('--muted-foreground', '210 10% 50%')
    document.documentElement.style.setProperty('--border', '0 0% 20%')

    const chart = await importChartJs()
    await chart.loadChartJs()

    expect(FakeChart.defaults.color).toBe('hsl(210 10% 50%)')
    expect(FakeChart.defaults.borderColor).toBe('hsl(0 0% 20%)')
  })
})

describe('useChartJs.renderChart', () => {
  it('returns null before Chart.js is loaded', async () => {
    const chart = await importChartJs()
    expect(chart.renderChart({} as HTMLCanvasElement, barConfig)).toBeNull()
  })

  it('builds a chart with responsive options merged in', async () => {
    const chart = await importChartJs()
    await chart.loadChartJs()

    const canvas = {} as HTMLCanvasElement
    const instance = chart.renderChart(canvas, barConfig)

    expect(instance).toBe(FakeChart.lastInstance)
    const built = FakeChart.lastInstance!.config as {
      type: string
      options: Record<string, unknown>
    }
    expect(built.type).toBe('bar')
    expect(built.options.responsive).toBe(true)
    expect(built.options.maintainAspectRatio).toBe(true)
    expect(FakeChart.lastInstance!.canvas).toBe(canvas)
  })

  it('returns null when the Chart constructor throws', async () => {
    const chart = await importChartJs()
    await chart.loadChartJs()
    shouldThrowOnConstruct = true

    expect(chart.renderChart({} as HTMLCanvasElement, barConfig)).toBeNull()
  })
})
