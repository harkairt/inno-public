<template>
  <div class="svg-container">
    <div
      v-if="isLoading"
      class="svg-loading"
    >
      {{ t('chat.svg.loading') }}
    </div>
    <div
      v-else-if="error"
      class="svg-error"
    >
      {{ error }}
    </div>
    <img
      v-show="!isLoading && !error"
      :key="source"
      class="svg-image"
      :src="dataUrl"
      :alt="altText"
      @load="handleLoad"
      @error="handleError"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import type { SvgData } from '@/lib/validation/svg'
import { createLogger } from '@/lib/utils/logger'

interface Props {
  data: SvgData
  blockIndex: number
  source: string
}

const props = defineProps<Props>()

const { t } = useI18n()
const logger = createLogger('ChatSvg')

const isLoading = ref(true)
const error = ref<string | null>(null)

// Keep untrusted SVG out of the live document namespace. Image documents do
// not expose their nodes or scripts to the embedding page.
const dataUrl = computed(
  () => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(props.data.markup)}`,
)
const altText = computed(() => props.data.title ?? t('chat.svg.altText'))

const handleLoad = () => {
  isLoading.value = false
  error.value = null
}

const handleError = () => {
  isLoading.value = false
  error.value = t('chat.svg.renderFailed')
  logger.error('Failed to render SVG block', { blockIndex: props.blockIndex })
}

watch(
  () => props.source,
  () => {
    isLoading.value = true
    error.value = null
  },
  { flush: 'sync' },
)
</script>

<style scoped>
.svg-container {
  width: 100%;
  margin: 1rem 0;
}

.svg-image {
  display: block;
  width: 100%;
  max-height: min(70vh, 720px);
  object-fit: contain;
}

.svg-loading,
.svg-error {
  padding: 1rem;
  font-size: 0.875rem;
  color: hsl(var(--muted-foreground));
}
</style>
