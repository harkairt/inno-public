<template>
  <div class="mermaid-container">
    <div
      v-if="showLoading"
      class="mermaid-loading"
    >
      {{ t('chat.mermaid.loading') }}
    </div>
    <div
      v-else-if="error"
      class="mermaid-error"
    >
      {{ error }}
    </div>
    <button
      v-else
      type="button"
      class="mermaid-lightbox-trigger"
      :class="{ 'mermaid-lightbox-trigger--hidden': isLightboxOpen }"
      :aria-label="t('chat.mermaid.altText')"
      @click.stop="openLightbox"
    >
      <img
        class="mermaid-image"
        :src="dataUrl"
        :alt="t('chat.mermaid.altText')"
        @load="handleLoad"
        @error="handleImageError"
      />
    </button>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { api as viewerApi } from 'v-viewer'
import { useMermaid } from '~/composables/useMermaid'
import type { MermaidData } from '@/lib/validation/mermaid'

interface Props {
  data: MermaidData
  blockIndex: number
  source: string
}

const props = defineProps<Props>()

const { t } = useI18n()
const colorMode = useColorMode()
const { isLoaded, loadMermaid, renderMermaid } = useMermaid()

const svg = ref<string | null>(null)
const error = ref<string | null>(null)
const isLightboxOpen = ref(false)
let renderVersion = 0

const isDark = computed(() => colorMode.value === 'dark')
const showLoading = computed(() => !svg.value && !error.value)
const dataUrl = computed(() =>
  svg.value ? `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg.value)}` : '',
)
const lightboxDataUrl = computed(() => {
  if (!svg.value) return ''

  const viewBox = svg.value.match(/\bviewBox=(["'])\s*[\d.-]+\s+[\d.-]+\s+([\d.]+)\s+[\d.]+\s*\1/i)
  const fullSizeSvg = viewBox?.[2]
    ? svg.value.replace(/\bwidth=(["'])100%\1/i, `width="${viewBox[2]}"`)
    : svg.value
  const lightboxSvg = fullSizeSvg.replace(
    /(<svg\b[^>]*>)/i,
    '$1<rect width="100%" height="100%" fill="#fff"/>',
  )

  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(lightboxSvg)}`
})

const openLightbox = () => {
  if (!lightboxDataUrl.value) return

  isLightboxOpen.value = true
  viewerApi({
    images: [lightboxDataUrl.value],
    options: {
      initialCoverage: 1,
      hidden: () => {
        isLightboxOpen.value = false
      },
    },
  })
}

const render = async () => {
  if (!isLoaded.value) return

  const version = ++renderVersion
  svg.value = null
  error.value = null
  const result = await renderMermaid(
    props.data.source,
    isDark.value,
    `mermaid-${props.blockIndex}-${version}`,
  )

  if (version !== renderVersion) return
  if (!result) {
    error.value = t('chat.mermaid.renderFailed')
    return
  }

  svg.value = result
}

const handleLoad = () => {
  error.value = null
}

const handleImageError = () => {
  error.value = t('chat.mermaid.renderFailed')
}

watch(
  isLoaded,
  (loaded) => {
    if (loaded) void render()
  },
  { flush: 'post' },
)

watch(
  () => props.source,
  () => void render(),
)
watch(isDark, () => void render())

onMounted(async () => {
  if (isLoaded.value) {
    await render()
    return
  }

  const loaded = await loadMermaid()
  if (!loaded) error.value = t('chat.mermaid.renderFailed')
})
</script>

<style scoped>
.mermaid-container {
  width: 100%;
  margin: 1rem 0;
}

.mermaid-image {
  display: block;
  width: 100%;
  max-height: min(70vh, 720px);
  object-fit: contain;
}

.mermaid-lightbox-trigger {
  display: block;
  width: 100%;
  padding: 0;
  border: 0;
  background: transparent;
  cursor: zoom-in;
}

.mermaid-lightbox-trigger:focus-visible {
  outline: 2px solid hsl(var(--ring));
  outline-offset: 4px;
}

.mermaid-lightbox-trigger--hidden {
  visibility: hidden;
}

.mermaid-loading,
.mermaid-error {
  padding: 1rem;
  font-size: 0.875rem;
  color: hsl(var(--muted-foreground));
}
</style>
