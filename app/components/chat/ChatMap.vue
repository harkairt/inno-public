<template>
  <div
    class="map-container"
    @click.stop
  >
    <div
      v-if="showLoading"
      class="map-loading"
    >
      {{ t('chat.map.loading') }}
    </div>
    <div
      v-else-if="error"
      class="map-error"
    >
      {{ error }}
    </div>
    <div
      v-show="!showLoading && !error"
      ref="containerRef"
      class="map-canvas"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue'
import { useI18n } from 'vue-i18n'
import { useResizeObserver } from '@vueuse/core'
import { useLeaflet, type LeafletMapInstance } from '~/composables/useLeaflet'
import type { LeafletMapData } from '@/lib/validation/leaflet'

interface Props {
  data: LeafletMapData
  blockIndex: number
  source: string
}

const props = defineProps<Props>()

const { t } = useI18n()
const { isLoaded, loadLeaflet, createMap } = useLeaflet()

const containerRef = ref<HTMLElement | null>(null)
const error = ref<string | null>(null)
let instance: LeafletMapInstance | null = null

const showLoading = computed(() => !isLoaded.value && !error.value)

const destroyMap = () => {
  if (!instance) return
  instance.remove()
  instance = null
}

const render = () => {
  destroyMap()

  if (!containerRef.value || !isLoaded.value) return
  if (!containerRef.value.offsetWidth) return

  instance = createMap(containerRef.value, props.data)
  if (!instance) {
    error.value = t('chat.map.renderFailed')
  } else {
    error.value = null
  }
}

watch(
  isLoaded,
  (loaded) => {
    if (loaded) render()
  },
  { flush: 'post' },
)

watch(() => props.source, render)

useResizeObserver(containerRef, () => {
  if (instance) instance.invalidateSize()
  else render()
})

onMounted(async () => {
  if (isLoaded.value) {
    render()
    return
  }

  const loaded = await loadLeaflet()
  if (!loaded) error.value = t('chat.map.renderFailed')
})

onBeforeUnmount(() => {
  destroyMap()
})
</script>

<style scoped>
.map-container {
  width: 100%;
  margin: 1rem 0;
}

.map-canvas {
  width: 100%;
  height: 400px;
  border-radius: 0.5rem;
  z-index: 0;
}

@media (max-width: 640px) {
  .map-canvas {
    height: 300px;
  }
}

.map-loading,
.map-error {
  padding: 1rem;
  font-size: 0.875rem;
  color: hsl(var(--muted-foreground));
}

:deep(.leaflet-tile-pane) {
  .dark & {
    filter: brightness(0.6) invert(1) contrast(3) hue-rotate(200deg) saturate(0.3) brightness(0.7);
  }
}
</style>
