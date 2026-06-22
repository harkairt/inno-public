import { ref, type Component } from 'vue'
import { createLogger } from '@/lib/utils/logger'

const logger = createLogger('usePivotTable')

let PivotComponent: Component | null = null
let loadingPromise: Promise<boolean> | null = null

const isLoading = ref(false)
const isLoaded = ref(false)

export const usePivotTable = () => {
  const loadPivotTable = async (): Promise<boolean> => {
    if (PivotComponent) return true
    if (loadingPromise) return loadingPromise

    isLoading.value = true

    loadingPromise = (async () => {
      try {
        const mod = await import('vue-pivottable')
        await import('vue-pivottable/dist/vue-pivottable.css')
        PivotComponent = mod.VuePivottableUi ?? mod.default
        isLoaded.value = true
        return true
      } catch (error) {
        logger.error('Failed to load vue-pivottable', error)
        return false
      } finally {
        isLoading.value = false
        loadingPromise = null
      }
    })()

    return loadingPromise
  }

  const getComponent = (): Component | null => PivotComponent

  return {
    isLoading,
    isLoaded,
    loadPivotTable,
    getComponent,
  }
}
