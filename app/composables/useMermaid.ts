import { ref } from 'vue'
import type { MermaidConfig } from 'mermaid'
import { createLogger } from '@/lib/utils/logger'

const logger = createLogger('useMermaid')

type MermaidModule = typeof import('mermaid')

let mermaidModule: MermaidModule['default'] | null = null
let loadingPromise: Promise<boolean> | null = null

const isLoading = ref(false)
const isLoaded = ref(false)

const cssColor = (name: string, fallback: string): string => {
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim()
  return value ? `hsl(${value})` : fallback
}

const buildConfig = (isDark: boolean): MermaidConfig => {
  const text = cssColor('--foreground', isDark ? '#e5e7eb' : '#18181b')
  const muted = cssColor('--muted-foreground', isDark ? '#adbac7' : '#4b5563')
  const border = cssColor('--border', isDark ? '#3f3f46' : '#d4d4d8')
  const primary = cssColor('--primary', isDark ? '#e5e7eb' : '#18181b')

  return {
    startOnLoad: false,
    securityLevel: 'strict',
    htmlLabels: false,
    maxTextSize: 50_000,
    maxEdges: 500,
    theme: 'base',
    themeVariables: {
      background: 'transparent',
      primaryColor: primary,
      primaryTextColor: isDark ? '#18181b' : '#ffffff',
      primaryBorderColor: border,
      lineColor: muted,
      secondaryColor: isDark ? '#27272a' : '#f4f4f5',
      tertiaryColor: isDark ? '#18181b' : '#fafafa',
      textColor: text,
      mainBkg: primary,
      nodeBorder: border,
      clusterBkg: isDark ? '#18181b' : '#fafafa',
      clusterBorder: border,
    },
  }
}

export const useMermaid = () => {
  const loadMermaid = (): Promise<boolean> => {
    if (mermaidModule) return Promise.resolve(true)
    if (loadingPromise) return loadingPromise

    isLoading.value = true
    loadingPromise = (async () => {
      try {
        const mod = await import('mermaid')
        mermaidModule = mod.default
        isLoaded.value = true
        return true
      } catch (error) {
        logger.error('Failed to load Mermaid', error)
        return false
      } finally {
        isLoading.value = false
        loadingPromise = null
      }
    })()

    return loadingPromise
  }

  const renderMermaid = async (
    source: string,
    isDark: boolean,
    renderId: string,
  ): Promise<string | null> => {
    if (!mermaidModule) return null

    try {
      mermaidModule.initialize(buildConfig(isDark))
      const { svg } = await mermaidModule.render(renderId, source)
      return svg
    } catch (error) {
      logger.error('Failed to render Mermaid block', { error })
      return null
    }
  }

  return { isLoading, isLoaded, loadMermaid, renderMermaid }
}
