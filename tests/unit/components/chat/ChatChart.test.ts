/**
 * Component tests for ChatChart — renders a Chart.js chart from an
 * already-validated `ChartConfig` (parseChartConfig upstream rejects bad JSON).
 *
 * Chart.js needs a real <canvas> 2D context that happy-dom can't provide, so
 * `chart.js` is mocked with a fake Chart class (mirrors
 * tests/unit/composables/useChartJs.test.ts). We assert the canvas mounts, the
 * config prop is wired through to the (fake) Chart constructor, and that a
 * construction failure degrades to the visible error fallback rather than
 * throwing.
 *
 * useChartJs holds a module-level singleton, so `isLoaded` persists across tests
 * within this file — the tests are written to be order-independent regardless.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { nextTick } from 'vue'
import type { Component } from 'vue'
import { renderWithProviders } from '@/tests/utils/render'
import type { ChartConfig } from '@/lib/validation/chart'

const registerSpy = vi.fn()
let shouldThrowOnConstruct = false

class FakeChart {
  static register = registerSpy
  static defaults: { color: string; borderColor: string } = { color: '', borderColor: '' }
  static lastInstance: FakeChart | null = null

  canvas: unknown
  config: unknown
  destroy = vi.fn()

  constructor(canvas: unknown, config: unknown) {
    if (shouldThrowOnConstruct) throw new Error('canvas boom')
    this.canvas = canvas
    this.config = config
    FakeChart.lastInstance = this
  }
}

vi.mock('chart.js', () => ({
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
}))

beforeEach(() => {
  registerSpy.mockClear()
  shouldThrowOnConstruct = false
  FakeChart.lastInstance = null
})

// Flush the async onMounted → loadChartJs → watch(isLoaded) → createChart chain.
async function flushChart() {
  for (let i = 0; i < 6; i++) {
    await Promise.resolve()
    await nextTick()
  }
}

const barConfig: ChartConfig = {
  type: 'bar',
  data: { labels: ['a', 'b'], datasets: [{ label: 'Revenue', data: [1, 2] }] },
} as unknown as ChartConfig

async function renderChart(config: ChartConfig) {
  const { default: ChatChart } = (await import('~/components/chat/ChatChart.vue')) as {
    default: Component
  }
  const utils = renderWithProviders(ChatChart, { props: { config } })
  await flushChart()
  return utils
}

describe('ChatChart — valid config', () => {
  it('mounts a canvas and renders the chart without an error fallback', async () => {
    const { container } = await renderChart(barConfig)
    expect(container.querySelector('canvas')).not.toBeNull()
    expect(container.querySelector('.chart-error')).toBeNull()
    expect(FakeChart.lastInstance).not.toBeNull()
  })

  it('wires the config prop through to the Chart constructor', async () => {
    const { container } = await renderChart(barConfig)
    const built = FakeChart.lastInstance!.config as {
      type: string
      data: { datasets: { label: string }[] }
      options: Record<string, unknown>
    }
    expect(built.type).toBe('bar')
    expect(built.data.datasets[0]!.label).toBe('Revenue')
    // useChartJs merges responsive options in.
    expect(built.options.responsive).toBe(true)
    // The mounted <canvas> is the element handed to Chart.js.
    expect(FakeChart.lastInstance!.canvas).toBe(container.querySelector('canvas'))
  })
})

describe('ChatChart — fallback (not a crash)', () => {
  it('shows the error fallback when chart construction fails', async () => {
    shouldThrowOnConstruct = true
    const { container } = await renderChart(barConfig)

    const errorEl = container.querySelector('.chart-error')
    expect(errorEl).not.toBeNull()
    expect(errorEl?.textContent).toContain('Failed to render chart')
    expect(FakeChart.lastInstance).toBeNull()
  })
})
