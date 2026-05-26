import { ref } from 'vue'
import type { Chart as ChartType, ChartConfiguration } from 'chart.js'
import type { ChartConfig } from '@/lib/validation/chart'
import { createLogger } from '@/lib/utils/logger'

const logger = createLogger('useChartJs')

let ChartConstructor: typeof ChartType | null = null
let loadingPromise: Promise<boolean> | null = null

const isLoading = ref(false)
const isLoaded = ref(false)

export const useChartJs = () => {
  const loadChartJs = async (): Promise<boolean> => {
    if (ChartConstructor) return true
    if (loadingPromise) return loadingPromise

    isLoading.value = true

    loadingPromise = (async () => {
      try {
        const {
          Chart,
          BarController,
          LineController,
          PieController,
          DoughnutController,
          RadarController,
          ScatterController,
          ArcElement,
          BarElement,
          LineElement,
          PointElement,
          RadialLinearScale,
          CategoryScale,
          LinearScale,
          Tooltip,
          Legend,
          Filler,
        } = await import('chart.js')

        Chart.register(
          BarController,
          LineController,
          PieController,
          DoughnutController,
          RadarController,
          ScatterController,
          ArcElement,
          BarElement,
          LineElement,
          PointElement,
          RadialLinearScale,
          CategoryScale,
          LinearScale,
          Tooltip,
          Legend,
          Filler,
        )

        const styles = getComputedStyle(document.documentElement)
        Chart.defaults.color = styles.getPropertyValue('--muted-foreground').trim()
          ? `hsl(${styles.getPropertyValue('--muted-foreground').trim()})`
          : '#adbac7'
        Chart.defaults.borderColor = styles.getPropertyValue('--border').trim()
          ? `hsl(${styles.getPropertyValue('--border').trim()})`
          : 'rgba(255, 255, 255, 0.1)'

        ChartConstructor = Chart
        isLoaded.value = true
        return true
      } catch (error) {
        logger.error('Failed to load Chart.js', error)
        return false
      } finally {
        isLoading.value = false
        loadingPromise = null
      }
    })()

    return loadingPromise
  }

  const renderChart = (canvas: HTMLCanvasElement, config: ChartConfig): ChartType | null => {
    if (!ChartConstructor) return null

    const chartConfig = config as ChartConfiguration

    try {
      return new ChartConstructor(canvas, {
        ...chartConfig,
        options: {
          ...chartConfig.options,
          responsive: true,
          maintainAspectRatio: true,
        },
      })
    } catch (error) {
      logger.error('Failed to render chart', error)
      return null
    }
  }

  return {
    isLoading,
    isLoaded,
    loadChartJs,
    renderChart,
  }
}
