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
    v-else-if="mode === 'card'"
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
        :name="fileTypeIcon(file)"
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

  <a
    v-else-if="mode === 'chip'"
    :href="fullResUrl"
    target="_blank"
    rel="noopener noreferrer"
    class="flex items-center gap-2 px-2.5 h-10 rounded-lg border border-[hsl(var(--border)/0.5)] bg-[hsl(var(--muted)/0.3)] hover:bg-[hsl(var(--muted)/0.5)] transition-colors text-sm max-w-[240px] text-[inherit]"
    :title="t('chat.messages.openFile')"
  >
    <img
      v-if="isImage && imgSrc"
      :src="imgSrc"
      :data-source="fullResUrl"
      :alt="sanitizedFileName"
      class="w-7 h-7 object-cover rounded shrink-0"
      loading="lazy"
      @error="onImgError"
    />
    <UIcon
      v-else
      :name="fileTypeIcon(file)"
      class="w-7 h-7 shrink-0"
    />
    <span class="truncate flex-1 min-w-0">{{ sanitizedFileName }}</span>
  </a>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import type { ReceivedFile } from '@/types/api/schemas'
import { sanitizeFileUrl } from '@/app/utils/url'
import { fileTypeIcon } from '@/app/utils/fileIcon'

const { t } = useI18n()
const {
  public: { apiBaseUrl },
} = useRuntimeConfig()

const props = defineProps<{
  file: ReceivedFile
  mode: 'thumbnail' | 'card' | 'chip'
}>()

const thumbnailFailed = ref(false)

const fullResUrl = computed(() => sanitizeFileUrl(props.file.url, apiBaseUrl as string))

const thumbnailUrl = computed(() => {
  if (props.file.thumbnailUrl && !thumbnailFailed.value) {
    return sanitizeFileUrl(props.file.thumbnailUrl, apiBaseUrl as string)
  }
  return ''
})

const imgSrc = computed(() => thumbnailUrl.value || fullResUrl.value)

const isImage = computed(() => props.file.mimeType.startsWith('image/'))

const sanitizedFileName = computed(() => {
  return props.file.fileName.replace(/[<>&"']/g, '')
})

const fileExtension = computed(() => {
  const dot = props.file.fileName.lastIndexOf('.')
  if (dot === -1) return ''
  return props.file.fileName.slice(dot + 1)
})

function onImgError() {
  if (!thumbnailFailed.value && props.file.thumbnailUrl) {
    thumbnailFailed.value = true
  }
}
</script>
