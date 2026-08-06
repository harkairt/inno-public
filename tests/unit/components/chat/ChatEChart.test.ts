import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ref, nextTick } from 'vue'
import type { Component } from 'vue'
import { renderWithProviders } from '@/tests/utils/render'
import type { EChartsOption } from '@/lib/validation/echarts'
import { useChatStore } from '~/stores/chat'

const initSpy = vi.fn()

class FakeInstance {
  setOption = vi.fn()
  resize = vi.fn()
  dispose = vi.fn()
  on = vi.fn()
}

let instances: FakeInstance[] = []

const workingEngine = () => ({
  init: (...args: unknown[]) => {
    initSpy(...args)
    const instance = new FakeInstance()
    instances.push(instance)
    return instance
  },
})

vi.mock('vue-i18n', () => ({
  useI18n: () => ({ t: (key: string) => key, locale: ref('en') }),
}))

const colorMode = ref('light')

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
  // doMock (not a hoisted vi.mock): a hoisted factory is cached for the whole
  // file, so the S21 failure factory would never replace the working one.
  vi.doMock('echarts', workingEngine)
  initSpy.mockClear()
  instances = []
  colorMode.value = 'light'
  resizeCallback = null
  vi.stubGlobal('useColorMode', () => colorMode)
  vi.stubGlobal('ResizeObserver', FakeResizeObserver)
})

const barOption: EChartsOption = {
  xAxis: { type: 'category', data: ['a', 'b'] },
  yAxis: { type: 'value' },
  series: [{ type: 'bar', data: [1, 2] }],
}

async function renderChart(props: Record<string, unknown> = {}) {
  const { default: ChatEChart } = (await import('~/components/chat/ChatEChart.vue')) as {
    default: Component
  }

  const utils = renderWithProviders(ChatEChart, {
    props: { option: barOption, blockIndex: 0, source: JSON.stringify(barOption), ...props },
  })

  return utils
}

async function settle() {
  for (let i = 0; i < 6; i++) {
    await Promise.resolve()
    await nextTick()
  }
}

describe('S15 ChatEChart — loading state', () => {
  it('shows the localized loading indicator before the engine is available', async () => {
    const { container } = await renderChart()

    expect(container.querySelector('.echart-loading')?.textContent?.trim()).toBe(
      'chat.echart.loading',
    )
  })

  it('replaces the loading indicator with the chart once the engine loads', async () => {
    const { container } = await renderChart()
    await settle()

    expect(container.querySelector('.echart-loading')).toBeNull()
    expect(container.querySelector('.echart-canvas')).not.toBeNull()
    expect(instances).toHaveLength(1)
  })
})

describe('S16, S17 ChatEChart — source changes', () => {
  it('re-applies the option on the existing instance when source changes', async () => {
    const { rerender } = await renderChart()
    await settle()

    const instance = instances[0]!
    const optionCallsBefore = instance.setOption.mock.calls.length
    const nextOption = { ...barOption, series: [{ type: 'line', data: [3, 4] }] }

    await rerender({ option: nextOption, blockIndex: 0, source: JSON.stringify(nextOption) })
    await settle()

    expect(instance.setOption.mock.calls.length).toBeGreaterThan(optionCallsBefore)
    expect(initSpy).toHaveBeenCalledTimes(1)
    expect(instance.dispose).not.toHaveBeenCalled()
    expect(instances).toHaveLength(1)
  })

  it('makes zero further engine calls when source is unchanged', async () => {
    const { rerender } = await renderChart()
    await settle()

    const instance = instances[0]!
    const optionCallsBefore = instance.setOption.mock.calls.length

    await rerender({ option: barOption, blockIndex: 0, source: JSON.stringify(barOption) })
    await settle()

    expect(instance.setOption.mock.calls.length).toBe(optionCallsBefore)
    expect(initSpy).toHaveBeenCalledTimes(1)
    expect(instance.dispose).not.toHaveBeenCalled()
  })
})

describe('S18 ChatEChart — theme change', () => {
  it('re-applies the option without re-initializing when the colour mode flips', async () => {
    await renderChart()
    await settle()

    const instance = instances[0]!
    const optionCallsBefore = instance.setOption.mock.calls.length

    colorMode.value = 'dark'
    await settle()

    expect(instance.setOption.mock.calls.length).toBeGreaterThan(optionCallsBefore)
    expect(initSpy).toHaveBeenCalledTimes(1)
    expect(instance.dispose).not.toHaveBeenCalled()
  })
})

describe('S19 ChatEChart — container resize', () => {
  it('resizes the instance when the container resizes', async () => {
    await renderChart()
    await settle()

    const instance = instances[0]!
    expect(instance.resize).not.toHaveBeenCalled()

    resizeCallback?.()
    await nextTick()

    expect(instance.resize).toHaveBeenCalled()
  })
})

describe('S20 ChatEChart — teardown', () => {
  it('disposes exactly once on unmount and makes no call afterwards', async () => {
    const { unmount } = await renderChart()
    await settle()

    const instance = instances[0]!
    unmount()
    await nextTick()

    expect(instance.dispose).toHaveBeenCalledTimes(1)

    resizeCallback?.()
    await nextTick()

    expect(instance.dispose).toHaveBeenCalledTimes(1)
    expect(instance.resize).not.toHaveBeenCalled()
  })
})

describe('S21 ChatEChart — engine load failure', () => {
  it('shows the localized error and never renders a chart', async () => {
    vi.doMock('echarts', () => {
      throw new Error('engine unavailable')
    })

    const { container } = await renderChart()
    await settle()

    expect(container.querySelector('.echart-error')?.textContent?.trim()).toBe(
      'chat.echart.renderFailed',
    )
    expect(container.querySelector('.echart-loading')).toBeNull()
    expect(instances).toHaveLength(0)
  })
})

describe('S41–S45a ChatEChart — clicking an actionable data item', () => {
  const promptText = 'Why did North drop?'

  const promptOption: EChartsOption = {
    xAxis: { type: 'category', data: ['North', 'South'] },
    yAxis: { type: 'value' },
    series: [
      {
        type: 'bar',
        data: [{ value: 820, prompt: promptText }, { value: 640 }],
      },
    ],
  }

  const clickHandlers = (instance: FakeInstance) =>
    instance.on.mock.calls
      .filter((call) => call[0] === 'click')
      .map((call) => call[1] as (params: unknown) => void)

  const clickAll = (instance: FakeInstance, params: unknown) => {
    for (const handler of clickHandlers(instance)) handler(params)
  }

  async function renderPromptChart() {
    const utils = await renderChart({ option: promptOption, source: JSON.stringify(promptOption) })
    await settle()
    return utils
  }

  it('S41 forwards the prompt of the clicked item to the composer', async () => {
    await renderPromptChart()

    clickAll(instances[0]!, { data: { value: 820, prompt: promptText } })

    expect(useChatStore().composerRequest).toEqual({ text: promptText, seq: 1 })
  })

  it.each([
    ['a bare number', 820],
    ['null', null],
    ['an array', [0, 820]],
  ])('S42 ignores a click whose data is %s', async (_label, data) => {
    await renderPromptChart()

    clickAll(instances[0]!, { data })

    expect(useChatStore().composerRequest).toBeNull()
  })

  it('S43 ignores a click that carries no data at all', async () => {
    await renderPromptChart()

    expect(() => {
      clickAll(instances[0]!, { componentType: 'legend', name: 'North' })
      clickAll(instances[0]!, undefined)
    }).not.toThrow()

    expect(useChatStore().composerRequest).toBeNull()
  })

  it('S44 raises exactly one request after two source updates and one click', async () => {
    const { rerender } = await renderPromptChart()

    for (const value of [821, 822]) {
      const next = {
        ...promptOption,
        series: [{ type: 'bar', data: [{ value, prompt: promptText }, { value: 640 }] }],
      }
      await rerender({ option: next, blockIndex: 0, source: JSON.stringify(next) })
      await settle()
    }

    const instance = instances[0]!
    expect(clickHandlers(instance)).toHaveLength(1)

    clickAll(instance, { data: { value: 822, prompt: promptText } })

    expect(useChatStore().composerRequest?.seq).toBe(1)
  })

  it('S45 renders the click hint only when the option carries a prompt', async () => {
    const { container } = await renderPromptChart()

    expect(container.querySelector('.echart-hint')?.textContent?.trim()).toBe(
      'chat.echart.clickHint',
    )
  })

  it('S45 renders no hint for an option without prompts', async () => {
    const { container } = await renderChart()
    await settle()

    expect(container.querySelector('.echart-hint')).toBeNull()
  })

  it('S45a drops the hint when the option is replaced by one without prompts', async () => {
    const { container, rerender } = await renderPromptChart()
    expect(container.querySelector('.echart-hint')).not.toBeNull()

    await rerender({ option: barOption, blockIndex: 0, source: JSON.stringify(barOption) })
    await settle()

    expect(container.querySelector('.echart-hint')).toBeNull()
    expect(initSpy).toHaveBeenCalledTimes(1)
  })
})
