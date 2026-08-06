import { ref } from 'vue'
import { createLogger } from '@/lib/utils/logger'

const logger = createLogger('useXlsx')

type XLSX = typeof import('xlsx')

let xlsxModule: XLSX | null = null
let loadingPromise: Promise<boolean> | null = null

const isLoading = ref(false)

export const useXlsx = () => {
  const loadXlsx = async (): Promise<boolean> => {
    if (xlsxModule) return true
    if (loadingPromise) return loadingPromise

    isLoading.value = true

    loadingPromise = (async () => {
      try {
        xlsxModule = await import('xlsx')
        return true
      } catch (error) {
        logger.error('Failed to load xlsx', error)
        return false
      } finally {
        isLoading.value = false
        loadingPromise = null
      }
    })()

    return loadingPromise
  }

  const exportToXlsx = async (
    headers: string[],
    rows: string[][],
    filename = 'export.xlsx',
  ): Promise<boolean> => {
    const loaded = await loadXlsx()
    if (!loaded || !xlsxModule) return false

    try {
      const data = [headers, ...rows]
      const worksheet = xlsxModule.utils.aoa_to_sheet(data)
      const workbook = xlsxModule.utils.book_new()
      xlsxModule.utils.book_append_sheet(workbook, worksheet, 'Sheet1')

      xlsxModule.writeFile(workbook, filename)
      return true
    } catch (error) {
      logger.error('Failed to export xlsx', error)
      return false
    }
  }

  return {
    isLoading,
    exportToXlsx,
  }
}
