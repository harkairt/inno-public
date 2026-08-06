import { ref } from 'vue'
import type { EChartsOption } from '@/lib/validation/echarts'
import { createLogger } from '@/lib/utils/logger'

const logger = createLogger('useECharts')

type EChartsModule = typeof import('echarts')

export type EChartsInstance = ReturnType<EChartsModule['init']>

let echartsModule: EChartsModule | null = null
let loadingPromise: Promise<boolean> | null = null

const isLoading = ref(false)
const isLoaded = ref(false)

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

function forceRichText(tooltip: unknown): unknown {
  if (Array.isArray(tooltip)) return tooltip.map(forceRichText)
  if (!isPlainObject(tooltip)) return tooltip
  return { ...(harden(tooltip) as Record<string, unknown>), renderMode: 'richText' }
}

function harden(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(harden)
  if (!isPlainObject(node)) return node

  const hardened: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(node)) {
    hardened[key] = key === 'tooltip' ? forceRichText(value) : harden(value)
  }
  return hardened
}

const cssColor = (name: string, fallback: string): string => {
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim()
  return value ? `hsl(${value})` : fallback
}

const axisTheme = (text: string, line: string) => ({
  axisLine: { lineStyle: { color: line } },
  axisLabel: { color: text },
  splitLine: { lineStyle: { color: line } },
})

const themeBase = (option: EChartsOption, isDark: boolean): Record<string, unknown> => {
  const text = cssColor('--muted-foreground', isDark ? '#adbac7' : '#4b5563')
  const line = cssColor('--border', isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)')

  const base: Record<string, unknown> = {
    backgroundColor: 'transparent',
    textStyle: { color: text },
  }

  for (const axis of ['xAxis', 'yAxis'] as const) {
    const declared = option[axis]
    if (Array.isArray(declared)) base[axis] = declared.map(() => axisTheme(text, line))
    else if (declared !== undefined) base[axis] = axisTheme(text, line)
  }

  return base
}

export const useECharts = () => {
  const loadECharts = (): Promise<boolean> => {
    if (echartsModule) return Promise.resolve(true)
    if (loadingPromise) return loadingPromise

    isLoading.value = true

    loadingPromise = (async () => {
      try {
        echartsModule = await import('echarts')
        isLoaded.value = true
        return true
      } catch (error) {
        logger.error('Failed to load ECharts', error)
        return false
      } finally {
        isLoading.value = false
        loadingPromise = null
      }
    })()

    return loadingPromise
  }

  const initChart = (el: HTMLElement): EChartsInstance | null => {
    if (!echartsModule) return null
    return echartsModule.init(el, null, { renderer: 'canvas' })
  }

  const applyOption = (
    instance: EChartsInstance,
    option: EChartsOption,
    isDark: boolean,
    blockIndex: number,
  ): boolean => {
    try {
      instance.setOption(themeBase(option, isDark))
      instance.setOption(harden(option) as EChartsOption)
      return true
    } catch {
      logger.error('Failed to draw ECharts block', { blockIndex })
      return false
    }
  }

  return {
    isLoading,
    isLoaded,
    loadECharts,
    initChart,
    applyOption,
  }
}
