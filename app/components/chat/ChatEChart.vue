<template>
  <div class="echart-container">
    <div
      v-if="showLoading"
      class="echart-loading"
    >
      {{ t('chat.echart.loading') }}
    </div>
    <div
      v-else-if="error"
      class="echart-error"
    >
      {{ error }}
    </div>
    <div
      v-show="!showLoading && !error"
      ref="containerRef"
      class="echart-canvas"
    />
    <p
      v-if="hasPrompts && !showLoading && !error"
      class="echart-hint"
    >
      {{ t('chat.echart.clickHint') }}
    </p>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue'
import { useI18n } from 'vue-i18n'
import { useResizeObserver } from '@vueuse/core'
import { useECharts, type EChartsInstance } from '~/composables/useECharts'
import { useChatStore } from '~/stores/chat'
import { hasActionableItems, isValidPrompt, type EChartsOption } from '@/lib/validation/echarts'

interface Props {
  option: EChartsOption
  blockIndex: number
  source: string
}

const props = defineProps<Props>()

const { t } = useI18n()
const colorMode = useColorMode()
const { isLoaded, loadECharts, initChart, applyOption } = useECharts()

const containerRef = ref<HTMLElement | null>(null)
const error = ref<string | null>(null)
let instance: EChartsInstance | null = null

const isDark = computed(() => colorMode.value === 'dark')
const showLoading = computed(() => !isLoaded.value && !error.value)
const hasPrompts = computed(() => hasActionableItems(props.option))

const chatStore = useChatStore()

const handleClick = (params: unknown) => {
  const data = (params as { data?: unknown } | null)?.data
  if (typeof data !== 'object' || data === null || Array.isArray(data)) return

  const prompt = (data as { prompt?: unknown }).prompt
  if (!isValidPrompt(prompt)) return

  chatStore.requestComposerText(prompt)
}

const applyCurrent = () => {
  if (!instance) return

  const { height, ...optionWithoutHeight } = props.option
  if (containerRef.value) {
    if (typeof height === 'number' && height > 0) {
      containerRef.value.style.height = `${height}px`
      containerRef.value.style.aspectRatio = ''
    } else {
      containerRef.value.style.height = ''
    }
  }

  if (applyOption(instance, optionWithoutHeight, isDark.value, props.blockIndex)) {
    error.value = null
  } else {
    error.value = t('chat.echart.renderFailed')
  }
}

const render = () => {
  if (!instance) {
    if (!containerRef.value || !isLoaded.value) return

    instance = initChart(containerRef.value)
    if (!instance) {
      error.value = t('chat.echart.renderFailed')
      return
    }

    instance.on('click', handleClick)
  }

  applyCurrent()
}

watch(
  isLoaded,
  (loaded) => {
    if (loaded) render()
  },
  { flush: 'post' },
)

watch(() => props.source, render)

watch(isDark, applyCurrent)

useResizeObserver(containerRef, () => {
  instance?.resize()
})

onMounted(async () => {
  if (isLoaded.value) {
    render()
    return
  }

  const loaded = await loadECharts()
  if (!loaded) error.value = t('chat.echart.renderFailed')
})

onBeforeUnmount(() => {
  if (!instance) return

  instance.dispose()
  instance = null
})
</script>

<style scoped>
.echart-container {
  width: 100%;
  margin: 1rem 0;
}

.echart-canvas {
  width: 100%;
  aspect-ratio: 1 / 1;
}

.echart-loading,
.echart-error {
  padding: 1rem;
  font-size: 0.875rem;
  color: hsl(var(--muted-foreground));
}

.echart-hint {
  padding: 0.25rem 0.25rem 0;
  font-size: 0.75rem;
  color: hsl(var(--muted-foreground));
}
</style>
