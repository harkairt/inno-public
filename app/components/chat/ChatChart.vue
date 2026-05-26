<template>
  <div class="chart-container">
    <div
      v-if="isLoading"
      class="chart-loading"
    >
      <div class="chart-loading-spinner" />
    </div>
    <div
      v-else-if="error"
      class="chart-error"
    >
      {{ error }}
    </div>
    <canvas
      v-show="!isLoading && !error"
      ref="canvasRef"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, watch } from 'vue'
import type { Chart } from 'chart.js'
import { useChartJs } from '~/composables/useChartJs'
import type { ChartConfig } from '@/lib/validation/chart'

interface Props {
  config: ChartConfig
}

const props = defineProps<Props>()

const { isLoading, isLoaded, loadChartJs, renderChart } = useChartJs()

const canvasRef = ref<HTMLCanvasElement | null>(null)
const error = ref<string | null>(null)
let chartInstance: Chart | null = null

const createChart = () => {
  if (!canvasRef.value || !isLoaded.value) return

  destroyChart()

  const instance = renderChart(canvasRef.value, props.config)
  if (instance) {
    chartInstance = instance
    error.value = null
  } else {
    error.value = 'Failed to render chart'
  }
}

const destroyChart = () => {
  if (chartInstance) {
    chartInstance.destroy()
    chartInstance = null
  }
}

watch(isLoaded, (loaded) => {
  if (loaded) createChart()
})

onMounted(async () => {
  if (isLoaded.value) {
    createChart()
  } else {
    const success = await loadChartJs()
    if (!success) {
      error.value = 'Failed to load chart library'
    }
  }
})

onBeforeUnmount(() => {
  destroyChart()
})
</script>
