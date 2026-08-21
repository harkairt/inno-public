import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ref, nextTick } from 'vue'
import type { Component } from 'vue'
import { renderWithProviders } from '@/tests/utils/render'
import type { CytoscapeConfig } from '@/lib/validation/cytoscape'

const destroySpy = vi.fn()
const resizeSpy = vi.fn()
const fitSpy = vi.fn()
const styleSpy = vi.fn()
const jsonSpy = vi.fn()
const layoutRunSpy = vi.fn()
const layoutSpy = vi.fn(() => ({ run: layoutRunSpy }))

class FakeInstance {
  destroy = destroySpy
  resize = resizeSpy
  fit = fitSpy
  style = styleSpy
  json = jsonSpy
  layout = layoutSpy
}

let instances: FakeInstance[] = []

const workingEngine = () => ({
  default: () => {
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
  vi.doMock('cytoscape', workingEngine)
  instances = []
  destroySpy.mockClear()
  resizeSpy.mockClear()
  fitSpy.mockClear()
  styleSpy.mockClear()
  jsonSpy.mockClear()
  layoutRunSpy.mockClear()
  layoutSpy.mockClear()
  colorMode.value = 'light'
  resizeCallback = null
  vi.stubGlobal('useColorMode', () => colorMode)
  vi.stubGlobal('ResizeObserver', FakeResizeObserver)
})

const simpleConfig: CytoscapeConfig = {
  elements: {
    nodes: [{ data: { id: 'a' } }, { data: { id: 'b' } }],
    edges: [{ data: { source: 'a', target: 'b' } }],
  },
}

async function renderGraph(props: Record<string, unknown> = {}) {
  const { default: ChatCytoscape } = (await import('~/components/chat/ChatCytoscape.vue')) as {
    default: Component
  }

  const utils = renderWithProviders(ChatCytoscape, {
    props: {
      config: simpleConfig,
      blockIndex: 0,
      source: JSON.stringify(simpleConfig),
      ...props,
    },
  })

  giveContainerWidth(utils.container)

  return utils
}

function giveContainerWidth(container: HTMLElement) {
  const canvas = container.querySelector('.cytoscape-canvas')
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

describe('ChatCytoscape — loading state', () => {
  it('shows the localized loading indicator before the engine is available', async () => {
    const { container } = await renderGraph()

    expect(container.querySelector('.cytoscape-loading')?.textContent?.trim()).toBe(
      'chat.cytoscape.loading',
    )
  })

  it('replaces the loading indicator with the canvas once the engine loads', async () => {
    const { container } = await renderGraph()
    await settleWithLayout()

    expect(container.querySelector('.cytoscape-loading')).toBeNull()
    expect(container.querySelector('.cytoscape-canvas')).not.toBeNull()
    expect(instances).toHaveLength(1)
  })
})

describe('ChatCytoscape — source changes', () => {
  it('re-applies config on the existing instance when source changes', async () => {
    const { rerender } = await renderGraph()
    await settleWithLayout()

    const jsonCallsBefore = jsonSpy.mock.calls.length
    const nextConfig = {
      ...simpleConfig,
      elements: {
        nodes: [{ data: { id: 'x' } }, { data: { id: 'y' } }],
        edges: [{ data: { source: 'x', target: 'y' } }],
      },
    }

    await rerender({
      config: nextConfig,
      blockIndex: 0,
      source: JSON.stringify(nextConfig),
    })
    await settle()

    expect(jsonSpy.mock.calls.length).toBeGreaterThan(jsonCallsBefore)
    expect(destroySpy).not.toHaveBeenCalled()
    expect(instances).toHaveLength(1)
  })
})

describe('ChatCytoscape — theme change', () => {
  it('re-applies style without re-initializing when the colour mode flips', async () => {
    await renderGraph()
    await settleWithLayout()

    const styleCallsBefore = styleSpy.mock.calls.length

    colorMode.value = 'dark'
    await settle()

    expect(styleSpy.mock.calls.length).toBeGreaterThan(styleCallsBefore)
    expect(destroySpy).not.toHaveBeenCalled()
    expect(instances).toHaveLength(1)
  })
})

describe('ChatCytoscape — container resize', () => {
  it('resizes immediately and re-runs layout after debounce', async () => {
    vi.useFakeTimers()
    await renderGraph()
    await settleWithLayout()

    resizeSpy.mockClear()
    layoutSpy.mockClear()
    fitSpy.mockClear()

    resizeCallback?.()
    await nextTick()

    expect(resizeSpy).toHaveBeenCalled()
    expect(layoutSpy).not.toHaveBeenCalled()

    vi.advanceTimersByTime(200)
    await nextTick()

    expect(layoutSpy).toHaveBeenCalled()
    expect(fitSpy).toHaveBeenCalled()

    vi.useRealTimers()
  })
})

describe('ChatCytoscape — teardown', () => {
  it('destroys exactly once on unmount', async () => {
    const { unmount } = await renderGraph()
    await settleWithLayout()

    unmount()
    await nextTick()

    expect(destroySpy).toHaveBeenCalledTimes(1)
  })
})

describe('ChatCytoscape — engine load failure', () => {
  it('shows the localized error and never renders a graph', async () => {
    vi.doMock('cytoscape', () => {
      throw new Error('engine unavailable')
    })

    const { container } = await renderGraph()
    await settle()

    expect(container.querySelector('.cytoscape-error')?.textContent?.trim()).toBe(
      'chat.cytoscape.renderFailed',
    )
    expect(container.querySelector('.cytoscape-loading')).toBeNull()
    expect(instances).toHaveLength(0)
  })
})
