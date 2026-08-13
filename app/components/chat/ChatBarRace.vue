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
        :model-value="sliderValue"
        :min="0"
        :max="SLIDER_RESOLUTION"
        :step="1"
        class="bar-race-slider"
        @update:model-value="seekSlider"
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
  resolveStepDuration,
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
const progress = ref(0)
const isPlaying = ref(false)
let instance: EChartsInstance | null = null
let rafId: number | null = null
let lastTimestamp: number | null = null
let appliedFrameIndex = -1

const SLIDER_RESOLUTION = 1000

const isDark = computed(() => colorMode.value === 'dark')
const showLoading = computed(() => !isLoaded.value && !error.value)
const lastFrameIndex = computed(() => props.data.frames.length - 1)
const currentFrameIndex = computed(() => Math.min(Math.floor(progress.value), lastFrameIndex.value))
const currentLabel = computed(() => formatFrameLabel(props.data, currentFrameIndex.value))
const playIcon = computed(() => (isPlaying.value ? 'i-lucide-pause' : 'i-lucide-play'))

const sliderValue = computed(() => {
  if (lastFrameIndex.value === 0) return 0
  return Math.round((progress.value / lastFrameIndex.value) * SLIDER_RESOLUTION)
})

const applyFrame = (idx: number) => {
  if (!instance || idx === appliedFrameIndex) return
  appliedFrameIndex = idx
  const option = buildBarRaceOption(props.data, idx)
  if (!applyOption(instance, option, isDark.value, props.blockIndex)) {
    error.value = t('chat.barRace.renderFailed')
  }
}

const tick = (timestamp: number) => {
  if (lastTimestamp === null) {
    lastTimestamp = timestamp
    rafId = requestAnimationFrame(tick)
    return
  }

  const elapsed = timestamp - lastTimestamp
  lastTimestamp = timestamp
  const stepMs = resolveStepDuration(props.data)
  const delta = elapsed / stepMs

  const next = progress.value + delta
  if (next >= lastFrameIndex.value) {
    progress.value = lastFrameIndex.value
    applyFrame(lastFrameIndex.value)
    pause()
    return
  }

  progress.value = next
  applyFrame(Math.floor(next))
  rafId = requestAnimationFrame(tick)
}

const pause = () => {
  isPlaying.value = false
  lastTimestamp = null
  if (rafId !== null) {
    cancelAnimationFrame(rafId)
    rafId = null
  }
}

const play = () => {
  if (progress.value >= lastFrameIndex.value) {
    progress.value = 0
    applyFrame(0)
  }
  isPlaying.value = true
  lastTimestamp = null
  rafId = requestAnimationFrame(tick)
}

const toggle = () => {
  if (isPlaying.value) pause()
  else play()
}

const seekSlider = (val: number | undefined) => {
  if (val == null) return
  pause()
  const mapped = lastFrameIndex.value > 0 ? (val / SLIDER_RESOLUTION) * lastFrameIndex.value : 0
  const frameIdx = Math.min(Math.round(mapped), lastFrameIndex.value)
  progress.value = frameIdx
  applyFrame(frameIdx)
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

watch(
  isLoaded,
  (loaded) => {
    if (loaded) render()
  },
  { flush: 'post' },
)

watch(
  () => props.source,
  () => {
    pause()
    progress.value = 0
    appliedFrameIndex = -1
    render()
  },
)

watch(isDark, () => {
  appliedFrameIndex = -1
  applyFrame(currentFrameIndex.value)
})

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
  aspect-ratio: 1 / 1;
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
