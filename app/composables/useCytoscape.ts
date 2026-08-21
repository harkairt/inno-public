import { ref } from 'vue'
import type { CytoscapeConfig } from '@/lib/validation/cytoscape'
import { createLogger } from '@/lib/utils/logger'

const logger = createLogger('useCytoscape')

export type CytoscapeInstance = cytoscape.Core

type CytoscapeConstructor = (options?: cytoscape.CytoscapeOptions) => cytoscape.Core

let cytoscapeFactory: CytoscapeConstructor | null = null
let loadingPromise: Promise<boolean> | null = null

const isLoading = ref(false)
const isLoaded = ref(false)

const cssColor = (name: string, fallback: string): string => {
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim()
  return value ? `hsl(${value})` : fallback
}

function buildStyle(
  userStyle?: CytoscapeConfig['style'],
  isDark = false,
): cytoscape.StylesheetCSS[] {
  const text = cssColor('--muted-foreground', isDark ? '#adbac7' : '#4b5563')
  const border = cssColor('--border', isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)')
  const primary = cssColor('--primary', isDark ? '#e5e7eb' : '#18181b')

  const base: cytoscape.StylesheetCSS[] = [
    {
      selector: 'node',
      css: {
        'background-color': primary,
        'border-color': border,
        'border-width': 1,
        label: 'data(id)',
        'font-size': 12,
        color: text,
        'text-valign': 'center',
        'text-halign': 'center',
        'overlay-opacity': 0,
      } as cytoscape.Css.Node,
    },
    {
      selector: 'edge',
      css: {
        width: 2,
        'line-color': border,
        'target-arrow-color': border,
        'target-arrow-shape': 'triangle',
        'curve-style': 'bezier',
        'overlay-opacity': 0,
      } as cytoscape.Css.Edge,
    },
  ]

  if (userStyle) {
    for (const rule of userStyle) {
      base.push({
        selector: rule.selector,
        css: rule.style as cytoscape.Css.Node,
      })
    }
  }

  return base
}

export const useCytoscape = () => {
  const loadCytoscape = (): Promise<boolean> => {
    if (cytoscapeFactory) return Promise.resolve(true)
    if (loadingPromise) return loadingPromise

    isLoading.value = true

    loadingPromise = (async () => {
      try {
        const mod = await import('cytoscape')
        cytoscapeFactory = mod.default
        isLoaded.value = true
        return true
      } catch (error) {
        logger.error('Failed to load Cytoscape', error)
        return false
      } finally {
        isLoading.value = false
        loadingPromise = null
      }
    })()

    return loadingPromise
  }

  const initGraph = (
    el: HTMLElement,
    config: CytoscapeConfig,
    isDark: boolean,
  ): CytoscapeInstance | null => {
    if (!cytoscapeFactory) return null

    return cytoscapeFactory({
      container: el,
      elements: config.elements as cytoscape.ElementDefinition[],
      layout: (config.layout as cytoscape.LayoutOptions) ?? { name: 'cose' },
      style: buildStyle(config.style, isDark),
      userPanningEnabled: true,
      userZoomingEnabled: true,
      boxSelectionEnabled: false,
      autoungrabify: true,
    })
  }

  const applyConfig = (
    instance: CytoscapeInstance,
    config: CytoscapeConfig,
    isDark: boolean,
    blockIndex: number,
  ): boolean => {
    try {
      instance.json({ elements: config.elements as cytoscape.ElementDefinition[] })
      instance.style(buildStyle(config.style, isDark))

      const layout = instance.layout((config.layout as cytoscape.LayoutOptions) ?? { name: 'cose' })
      layout.run()

      return true
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      logger.error('Failed to render Cytoscape block', { blockIndex, error: message })
      return false
    }
  }

  return {
    isLoading,
    isLoaded,
    loadCytoscape,
    initGraph,
    applyConfig,
  }
}
