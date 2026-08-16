import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { EChartsOption } from '@/lib/validation/echarts'

const initSpy = vi.fn()
let shouldThrowOnSetOption = false

class FakeInstance {
  applied: Record<string, unknown>[] = []
  setOption = vi.fn((option: Record<string, unknown>) => {
    if (shouldThrowOnSetOption) throw new Error('boom: series[0].data[3] = 42')
    this.applied.push(option)
  })

  resize = vi.fn()
  dispose = vi.fn()
  on = vi.fn()
}

let lastInstance: FakeInstance | null = null

vi.mock('echarts', () => ({
  init: (...args: unknown[]) => {
    initSpy(...args)
    lastInstance = new FakeInstance()
    return lastInstance
  },
}))

beforeEach(() => {
  vi.resetModules()
  initSpy.mockClear()
  shouldThrowOnSetOption = false
  lastInstance = null
  document.documentElement.removeAttribute('style')
})

afterEach(() => {
  document.documentElement.removeAttribute('style')
})

async function importECharts() {
  const { useECharts } = await import('~/composables/useECharts')
  return useECharts()
}

describe('S10 useECharts.loadECharts', () => {
  it('shares one in-flight promise between concurrent callers', async () => {
    const engine = await importECharts()

    const first = engine.loadECharts()
    const second = engine.loadECharts()

    expect(first).toBe(second)
    expect(await first).toBe(true)
    expect(await second).toBe(true)
    expect(engine.isLoaded.value).toBe(true)
    expect(engine.isLoading.value).toBe(false)
  })

  it('resolves true immediately once loaded', async () => {
    const engine = await importECharts()

    expect(await engine.loadECharts()).toBe(true)
    expect(await engine.loadECharts()).toBe(true)
    expect(engine.isLoaded.value).toBe(true)
  })
})

describe('S11 useECharts.initChart', () => {
  it('initializes with the canvas renderer', async () => {
    const engine = await importECharts()
    await engine.loadECharts()

    const el = document.createElement('div')
    const instance = engine.initChart(el)

    expect(instance).not.toBeNull()
    expect(initSpy).toHaveBeenCalledWith(el, null, { renderer: 'canvas' })
  })

  it('returns null when the engine is not loaded', async () => {
    const engine = await importECharts()
    expect(engine.initChart(document.createElement('div'))).toBeNull()
  })
})

async function applyTo(option: EChartsOption, isDark = false) {
  const engine = await importECharts()
  await engine.loadECharts()
  const instance = engine.initChart(document.createElement('div'))!
  const applied = engine.applyOption(instance, option, isDark, 0)
  return { engine, instance: lastInstance!, applied }
}

describe('S12 useECharts.applyOption — tooltip hardening', () => {
  it('forces renderMode richText on a top-level tooltip', async () => {
    const { instance } = await applyTo({ tooltip: { trigger: 'axis' } })

    const definition = instance.applied.at(-1) as { tooltip: Record<string, unknown> }
    expect(definition.tooltip.renderMode).toBe('richText')
    expect(definition.tooltip.trigger).toBe('axis')
  })

  it('forces renderMode richText on tooltips inside baseOption and media[].option', async () => {
    const { instance } = await applyTo({
      baseOption: { tooltip: {} },
      media: [{ query: { maxWidth: 500 }, option: { tooltip: { trigger: 'item' } } }],
    })

    const definition = instance.applied.at(-1) as {
      baseOption: { tooltip: Record<string, unknown> }
      media: { option: { tooltip: Record<string, unknown> } }[]
    }
    expect(definition.baseOption.tooltip.renderMode).toBe('richText')
    expect(definition.media[0]!.option.tooltip.renderMode).toBe('richText')
  })

  it('overrides an author-supplied html renderMode', async () => {
    const { instance } = await applyTo({
      tooltip: { renderMode: 'html', formatter: '<img src=x onerror=alert(1)>' },
    })

    const definition = instance.applied.at(-1) as { tooltip: Record<string, unknown> }
    expect(definition.tooltip.renderMode).toBe('richText')
  })

  it('leaves the caller’s option object untouched', async () => {
    const option = { tooltip: { trigger: 'axis' } }
    await applyTo(option)

    expect(option).toEqual({ tooltip: { trigger: 'axis' } })
  })
})

describe('S13 useECharts.applyOption — theme base', () => {
  it('applies the theme base before the definition so an authored colour wins', async () => {
    document.documentElement.style.setProperty('--muted-foreground', '210 10% 50%')

    const { instance } = await applyTo({ textStyle: { color: '#ff0000' }, series: [] }, true)

    const [base, definition] = instance.applied as { textStyle: { color: string } }[]
    expect(base!.textStyle.color).toBe('hsl(210 10% 50%)')
    expect(definition!.textStyle.color).toBe('#ff0000')
  })

  it('styles axes only when the definition declares them', async () => {
    const withoutAxes = await applyTo({ series: [{ type: 'pie', data: [] }] })
    expect(withoutAxes.instance.applied[0]).not.toHaveProperty('xAxis')

    const withAxes = await applyTo({ xAxis: { type: 'category' }, yAxis: { type: 'value' } })
    expect(withAxes.instance.applied[0]).toHaveProperty('xAxis')
    expect(withAxes.instance.applied[0]).toHaveProperty('yAxis')
  })
})

describe('S14 useECharts.applyOption — draw failure', () => {
  it('returns false and logs blockIndex, error, and option', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    shouldThrowOnSetOption = true

    const { applied } = await applyTo({ series: [{ type: 'bar', data: [1, 2, 3, 42] }] })

    expect(applied).toBe(false)
    expect(errorSpy).toHaveBeenCalledTimes(1)
    const record = JSON.stringify(errorSpy.mock.calls[0])
    expect(record).toContain('blockIndex')
    expect(record).toContain('boom')
    expect(record).toContain('option')
    errorSpy.mockRestore()
  })

  it('returns true on a successful draw', async () => {
    const { applied } = await applyTo({ series: [{ type: 'bar', data: [1] }] })
    expect(applied).toBe(true)
  })
})
