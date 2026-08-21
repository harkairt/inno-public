<template>
  <figure class="video-container">
    <video
      ref="videoRef"
      class="video-player"
      controls
      :src="data.src"
      :poster="data.poster"
      :loop="data.loop"
      :muted="data.muted"
      :autoplay="data.autoplay"
      :preload="data.preload ?? 'metadata'"
      :aria-label="data.title ?? t('chat.video.defaultLabel')"
      :data-block-index="blockIndex"
      @error="error = t('chat.video.renderFailed')"
    >
      {{ t('chat.video.unsupported') }}
    </video>
    <figcaption
      v-if="data.title"
      class="video-title"
    >
      {{ data.title }}
    </figcaption>
    <p
      v-if="error"
      class="video-error"
    >
      {{ error }}
    </p>
  </figure>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import type { VideoData } from '@/lib/validation/video'

interface Props {
  data: VideoData
  blockIndex: number
  source: string
}

const props = defineProps<Props>()
const { t } = useI18n()
const videoRef = ref<HTMLVideoElement | null>(null)
const error = ref<string | null>(null)

watch(
  () => props.source,
  () => {
    error.value = null
    videoRef.value?.load()
  },
)
</script>

<style scoped>
.video-container {
  width: 100%;
  margin: 1rem 0;
}
.video-player {
  display: block;
  width: 100%;
  max-height: min(70vh, 42rem);
  background: #000;
  border-radius: 0.5rem;
}
.video-title,
.video-error {
  margin-top: 0.5rem;
  font-size: 0.875rem;
  color: hsl(var(--muted-foreground));
}
</style>
