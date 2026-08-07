<template>
  <div class="bar-race-container">
    <div
      v-if="showLoading"
      class="bar-race-loading"
    >
      {{ t('chat.barRace.loading') }}
    </div>
    <div
      v-else-if="error"
      class="bar-race-error"
    >
      {{ error }}
    </div>
    <div
      v-show="!showLoading && !error"
      ref="containerRef"
      class="bar-race-canvas"
    />
    <div
      v-if="!showLoading && !error"
      class="bar-race-controls"
    >
      <UButton
        :icon="playIcon"
        size="xs"
        variant="ghost"
        :aria-label="isPlaying ? t('chat.barRace.pause') : t('chat.barRace.play')"
        @click="toggle"
      />
      <USlider
        :model-value="currentFrameIndex"
        :min="0"
        :max="lastFrameIndex"
        :step="1"
        class="bar-race-slider"
        @update:model-value="seek"
      />
      <span class="bar-race-label">{{ currentLabel }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue'
import { useI18n } from 'vue-i18n'
import { useResizeObserver } from '@vueuse/core'
import { useECharts, type EChartsInstance } from '~/composables/useECharts'
import type { BarRaceData } from '@/lib/validation/barRace'
import {
  buildBarRaceOption,
  formatFrameLabel,
  BAR_RACE_FRAME_INTERVAL_MS,
} from '@/lib/charts/barRaceOption'

interface Props {
  data: BarRaceData
  blockIndex: number
  source: string
}

const props = defineProps<Props>()

const { t } = useI18n()
const colorMode = useColorMode()
const { isLoaded, loadECharts, initChart, applyOption } = useECharts()

const containerRef = ref<HTMLElement | null>(null)
const error = ref<string | null>(null)
const currentFrameIndex = ref(0)
const isPlaying = ref(false)
let instance: EChartsInstance | null = null
let intervalId: ReturnType<typeof setInterval> | null = null

const isDark = computed(() => colorMode.value === 'dark')
const showLoading = computed(() => !isLoaded.value && !error.value)
const lastFrameIndex = computed(() => props.data.frames.length - 1)
const currentLabel = computed(() => formatFrameLabel(props.data, currentFrameIndex.value))
const playIcon = computed(() => (isPlaying.value ? 'i-lucide-pause' : 'i-lucide-play'))

const applyFrame = (idx: number) => {
  if (!instance) return
  const option = buildBarRaceOption(props.data, idx)
  if (!applyOption(instance, option, isDark.value, props.blockIndex)) {
    error.value = t('chat.barRace.renderFailed')
  }
}

const pause = () => {
  isPlaying.value = false
  if (intervalId !== null) {
    clearInterval(intervalId)
    intervalId = null
  }
}

const play = () => {
  if (currentFrameIndex.value >= lastFrameIndex.value) {
    currentFrameIndex.value = 0
  }
  isPlaying.value = true
  intervalId = setInterval(() => {
    if (currentFrameIndex.value >= lastFrameIndex.value) {
      pause()
      return
    }
    currentFrameIndex.value++
  }, BAR_RACE_FRAME_INTERVAL_MS)
}

const toggle = () => {
  if (isPlaying.value) {
    pause()
  } else {
    play()
  }
}

const seek = (idx: number | undefined) => {
  if (idx == null) return
  pause()
  currentFrameIndex.value = idx
}

const render = () => {
  if (!instance) {
    if (!containerRef.value || !isLoaded.value) return
    instance = initChart(containerRef.value)
    if (!instance) {
      error.value = t('chat.barRace.renderFailed')
      return
    }
  }
  applyFrame(currentFrameIndex.value)
}

watch(currentFrameIndex, applyFrame)

watch(isLoaded, (loaded) => {
  if (loaded) render()
})

watch(
  () => props.source,
  () => {
    pause()
    currentFrameIndex.value = 0
    render()
  },
)

watch(isDark, () => applyFrame(currentFrameIndex.value))

useResizeObserver(containerRef, () => {
  instance?.resize()
})

onMounted(async () => {
  if (isLoaded.value) {
    render()
    return
  }
  const loaded = await loadECharts()
  if (!loaded) error.value = t('chat.barRace.renderFailed')
})

onBeforeUnmount(() => {
  pause()
  if (!instance) return
  instance.dispose()
  instance = null
})
</script>

<style scoped>
.bar-race-container {
  width: 100%;
  margin: 1rem 0;
}

.bar-race-canvas {
  width: 100%;
  height: 320px;
}

.bar-race-loading,
.bar-race-error {
  padding: 1rem;
  font-size: 0.875rem;
  color: hsl(var(--muted-foreground));
}

.bar-race-controls {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.25rem 0.25rem 0;
}

.bar-race-slider {
  flex: 1;
}

.bar-race-label {
  font-size: 0.75rem;
  font-weight: 500;
  font-variant-numeric: tabular-nums;
  color: hsl(var(--muted-foreground));
  min-width: 3rem;
  text-align: right;
}

@media (max-width: 640px) {
  .bar-race-canvas {
    height: 240px;
  }
}
</style>
