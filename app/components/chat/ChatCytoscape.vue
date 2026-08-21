<template>
  <div class="cytoscape-container">
    <div
      v-if="showLoading"
      class="cytoscape-loading"
    >
      {{ t('chat.cytoscape.loading') }}
    </div>
    <div
      v-else-if="error"
      class="cytoscape-error"
    >
      {{ error }}
    </div>
    <div
      v-show="!showLoading && !error"
      class="cytoscape-wrapper"
    >
      <div
        ref="containerRef"
        class="cytoscape-canvas"
      />
      <UButton
        icon="i-lucide-maximize"
        size="xs"
        variant="ghost"
        class="cytoscape-reset"
        :aria-label="t('chat.cytoscape.resetView')"
        @click="resetView"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue'
import { useI18n } from 'vue-i18n'
import { useDebounceFn, useResizeObserver } from '@vueuse/core'
import { useCytoscape, type CytoscapeInstance } from '~/composables/useCytoscape'
import type { CytoscapeConfig } from '@/lib/validation/cytoscape'

interface Props {
  config: CytoscapeConfig
  blockIndex: number
  source: string
}

const props = defineProps<Props>()

const { t } = useI18n()
const colorMode = useColorMode()
const { isLoaded, loadCytoscape, initGraph, applyConfig } = useCytoscape()

const containerRef = ref<HTMLElement | null>(null)
const error = ref<string | null>(null)
let instance: CytoscapeInstance | null = null

const isDark = computed(() => colorMode.value === 'dark')
const showLoading = computed(() => !isLoaded.value && !error.value)

const resetView = () => {
  if (!instance) return
  instance.fit()
}

const applyCurrent = () => {
  if (!instance) return

  if (applyConfig(instance, props.config, isDark.value, props.blockIndex)) {
    error.value = null
  } else {
    error.value = t('chat.cytoscape.renderFailed')
  }
}

const render = () => {
  if (!instance) {
    if (!containerRef.value || !isLoaded.value) return
    if (!containerRef.value.offsetWidth) return

    instance = initGraph(containerRef.value, props.config, isDark.value)
    if (!instance) {
      error.value = t('chat.cytoscape.renderFailed')
      return
    }

    error.value = null
    return
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

const relayout = useDebounceFn(() => {
  if (!instance) return
  const layoutName = (props.config.layout?.name ?? 'cose') as string
  instance.layout({ name: layoutName, animate: false } as cytoscape.LayoutOptions).run()
  instance.fit()
}, 200)

useResizeObserver(containerRef, () => {
  if (instance) {
    instance.resize()
    void relayout()
  } else {
    render()
  }
})

onMounted(async () => {
  if (isLoaded.value) {
    render()
    return
  }

  const loaded = await loadCytoscape()
  if (!loaded) error.value = t('chat.cytoscape.renderFailed')
})

onBeforeUnmount(() => {
  if (!instance) return

  instance.destroy()
  instance = null
})
</script>

<style scoped>
.cytoscape-container {
  width: 100%;
  margin: 1rem 0;
}

.cytoscape-wrapper {
  position: relative;
}

.cytoscape-canvas {
  width: 100%;
  aspect-ratio: 4 / 3;
  min-height: 240px;
}

.cytoscape-reset {
  position: absolute;
  top: 0.25rem;
  right: 0.25rem;
  opacity: 0.6;
}

.cytoscape-reset:hover {
  opacity: 1;
}

.cytoscape-loading,
.cytoscape-error {
  padding: 1rem;
  font-size: 0.875rem;
  color: hsl(var(--muted-foreground));
}
</style>
