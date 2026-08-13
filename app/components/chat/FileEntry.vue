<template>
  <div
    v-if="mode === 'thumbnail'"
    class="overflow-hidden rounded-lg cursor-pointer"
  >
    <img
      :src="imgSrc"
      :data-source="fullResUrl"
      :alt="sanitizedFileName"
      class="w-full h-auto object-cover"
      loading="lazy"
      :aria-label="t('chat.messages.viewImage')"
      @error="onImgError"
    />
    <div class="px-1.5 py-1 text-xs truncate opacity-70">
      {{ sanitizedFileName }}
    </div>
  </div>

  <a
    v-else
    :href="fullResUrl"
    target="_blank"
    rel="noopener noreferrer"
    class="flex items-center gap-2.5 px-3 py-2 rounded-lg bg-black/8 hover:bg-black/12 dark:bg-white/10 dark:hover:bg-white/15 transition-colors group/file text-[inherit]"
    :title="t('chat.messages.openFile')"
  >
    <div
      class="flex items-center justify-center w-8 h-8 rounded shrink-0 bg-black/10 dark:bg-white/15"
    >
      <UIcon
        :name="fileIcon"
        class="w-4.5 h-4.5"
      />
    </div>
    <span class="text-sm truncate flex-1 min-w-0">{{ sanitizedFileName }}</span>
    <span
      v-if="fileExtension"
      class="text-[10px] font-medium uppercase tracking-wide px-1.5 py-0.5 rounded bg-black/10 dark:bg-white/15 opacity-80 shrink-0"
    >
      {{ fileExtension }}
    </span>
    <UIcon
      name="i-heroicons-arrow-top-right-on-square-20-solid"
      class="w-4 h-4 shrink-0 opacity-0 group-hover/file:opacity-100 transition-opacity"
    />
  </a>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import type { ReceivedFile } from '@/types/api/schemas'
import { sanitizeFileUrl } from '@/app/utils/url'

const { t } = useI18n()

const props = defineProps<{
  file: ReceivedFile
  mode: 'thumbnail' | 'card'
}>()

const thumbnailFailed = ref(false)

const fullResUrl = computed(() => sanitizeFileUrl(props.file.url))

const thumbnailUrl = computed(() => {
  if (props.file.thumbnailUrl && !thumbnailFailed.value) {
    return sanitizeFileUrl(props.file.thumbnailUrl)
  }
  return ''
})

const imgSrc = computed(() => thumbnailUrl.value || fullResUrl.value)

const sanitizedFileName = computed(() => {
  return props.file.fileName.replace(/[<>&"']/g, '')
})

const fileExtension = computed(() => {
  const dot = props.file.fileName.lastIndexOf('.')
  if (dot === -1) return ''
  return props.file.fileName.slice(dot + 1)
})

const fileIcon = computed(() => {
  const mime = props.file.mimeType
  if (mime === 'application/pdf') return 'i-heroicons-document-text-20-solid'
  if (mime.startsWith('text/')) return 'i-heroicons-document-20-solid'
  if (mime.includes('spreadsheet') || mime.includes('excel'))
    return 'i-heroicons-table-cells-20-solid'
  if (mime.includes('presentation') || mime.includes('powerpoint'))
    return 'i-heroicons-presentation-chart-bar-20-solid'
  if (mime.includes('word') || mime.includes('document'))
    return 'i-heroicons-document-text-20-solid'
  return 'i-heroicons-paper-clip-20-solid'
})

function onImgError() {
  if (!thumbnailFailed.value && props.file.thumbnailUrl) {
    thumbnailFailed.value = true
  }
}
</script>
