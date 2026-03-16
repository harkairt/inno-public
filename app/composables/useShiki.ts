import { ref } from 'vue'
import type { Highlighter } from 'shiki'

// Shared highlighter instance (singleton)
let highlighterInstance: Highlighter | null = null
let loadingPromise: Promise<Highlighter | null> | null = null

// Reactive state for components to track
const isLoading = ref(false)
const isLoaded = ref(false)

/**
 * Shared Shiki highlighter composable.
 * Uses a singleton pattern to avoid multiple highlighter instances across components.
 */
export const useShiki = () => {
  const loadHighlighter = async (): Promise<Highlighter | null> => {
    // Return existing instance
    if (highlighterInstance) {
      return highlighterInstance
    }

    // Return existing loading promise to avoid parallel loads
    if (loadingPromise) {
      return loadingPromise
    }

    isLoading.value = true

    loadingPromise = (async () => {
      try {
        const { createHighlighter } = await import('shiki')
        highlighterInstance = await createHighlighter({
          themes: ['github-dark-dimmed'],
          langs: [
            'javascript',
            'typescript',
            'python',
            'json',
            'bash',
            'html',
            'css',
            'sql',
            'markdown',
            'yaml',
            'xml',
            'text',
          ],
        })
        isLoaded.value = true
        return highlighterInstance
      } catch (error) {
        console.error('Failed to load syntax highlighter:', error)
        return null
      } finally {
        isLoading.value = false
        loadingPromise = null
      }
    })()

    return loadingPromise
  }

  const getHighlighter = (): Highlighter | null => {
    return highlighterInstance
  }

  /**
   * Highlight code with the shared highlighter.
   * Returns original code if highlighter is not loaded.
   */
  const highlightCode = (code: string, language: string): string => {
    if (!highlighterInstance) {
      return code
    }

    try {
      const loadedLangs = highlighterInstance.getLoadedLanguages()
      const lang = loadedLangs.includes(language) ? language : 'text'

      return highlighterInstance.codeToHtml(code, {
        lang,
        theme: 'github-dark-dimmed',
      })
    } catch (error) {
      console.warn('Code highlighting failed:', error)
      return code
    }
  }

  return {
    isLoading,
    isLoaded,
    loadHighlighter,
    getHighlighter,
    highlightCode,
  }
}
