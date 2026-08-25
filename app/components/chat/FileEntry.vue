<template>
  <div
    v-if="mode === 'thumbnail'"
    class="overflow-hidden rounded-lg"
    :class="{ 'cursor-pointer': interactive }"
  >
    <img
      :src="imgSrc"
      :data-source="interactive ? fullResUrl : undefined"
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

  <component
    :is="interactive ? 'a' : 'div'"
    v-else-if="mode === 'card'"
    v-bind="
      interactive
        ? {
            href: fullResUrl,
            target: '_blank',
            rel: 'noopener noreferrer',
            title: t('chat.messages.openFile'),
          }
        : {}
    "
    class="flex items-center gap-2.5 px-3 py-2 rounded-lg bg-black/8 dark:bg-white/10 transition-colors group/file text-[inherit]"
    :class="{ 'hover:bg-black/12 dark:hover:bg-white/15': interactive }"
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
      v-if="interactive"
      name="i-heroicons-arrow-top-right-on-square-20-solid"
      class="w-4 h-4 shrink-0 opacity-0 group-hover/file:opacity-100 transition-opacity"
    />
  </component>

  <div
    v-else-if="mode === 'chip'"
    class="flex items-center gap-2 px-2.5 h-10 rounded-lg border border-[hsl(var(--border)/0.5)] bg-[hsl(var(--muted)/0.3)] transition-colors text-sm max-w-[280px] text-[inherit]"
    :class="{ 'hover:bg-[hsl(var(--muted)/0.5)]': interactive }"
  >
    <component
      :is="interactive ? 'a' : 'div'"
      v-bind="
        interactive
          ? {
              href: fullResUrl,
              target: '_blank',
              rel: 'noopener noreferrer',
              title: t('chat.messages.openFile'),
            }
          : {}
      "
      class="flex items-center gap-2 min-w-0 flex-1 text-[inherit]"
    >
      <img
        v-if="isImage && imgSrc"
        :src="imgSrc"
        :data-source="interactive ? fullResUrl : undefined"
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
    </component>
    <button
      v-if="interactive && canPreview"
      class="text-current hover:opacity-70 transition-opacity rounded shrink-0 flex items-center justify-center size-7"
      :aria-label="t('chat.filePreview.previewFile')"
      data-testid="file-preview-button"
      @click.stop="emit('previewFile', file)"
    >
      <UIcon
        name="i-heroicons-document-magnifying-glass"
        class="size-4"
      />
    </button>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import type { ReceivedFile } from '@/types/api/schemas'
import { sanitizeFileUrl } from '@/app/utils/url'
import { fileTypeIcon } from '@/app/utils/fileIcon'
import { isPreviewableFile } from '@/types/filePreview'

const { t } = useI18n()
const {
  public: { apiBaseUrl },
} = useRuntimeConfig()

const props = withDefaults(
  defineProps<{
    file: ReceivedFile
    mode: 'thumbnail' | 'card' | 'chip'
    interactive?: boolean
  }>(),
  { interactive: true },
)

const emit = defineEmits<{
  previewFile: [file: ReceivedFile]
}>()

const canPreview = computed(() => isPreviewableFile(props.file.mimeType, props.file.fileName))

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
