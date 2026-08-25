<template>
  <div
    class="flex flex-col flex-1 h-full bg-white"
    :style="{ minWidth: `${contentWidth}px` }"
  >
    <div
      class="flex items-center gap-2 px-3 py-2 border-b border-[hsl(var(--border)/0.5)] flex-shrink-0 min-h-[44px]"
    >
      <button
        v-if="activeFile"
        class="text-[hsl(var(--muted-foreground))] hover:text-foreground transition-colors rounded flex items-center justify-center size-8 flex-shrink-0"
        :aria-label="t('chat.filePreview.back')"
        data-testid="file-preview-back"
        @click="emit('goToList')"
      >
        <UIcon
          name="i-heroicons-arrow-left-20-solid"
          class="size-5"
        />
      </button>
      <button
        v-else
        class="text-[hsl(var(--muted-foreground))] hover:text-foreground transition-colors rounded flex items-center justify-center size-8 flex-shrink-0"
        :aria-label="t('chat.focus.toggleSidebar')"
        data-testid="file-preview-close"
        @click="emit('close')"
      >
        <UIcon
          name="i-heroicons-x-mark-20-solid"
          class="size-5"
        />
      </button>

      <h2
        v-if="!activeFile"
        class="text-sm font-semibold text-foreground truncate flex-1"
      >
        {{ t('chat.filePreview.sidebarTitle') }}
      </h2>
      <span
        v-else
        class="text-sm font-semibold text-foreground truncate flex-1"
        :title="activeFile.fileName"
      >
        {{ activeFile.fileName }}
      </span>

      <template v-if="activeFile">
        <button
          class="text-[hsl(var(--muted-foreground))] hover:text-foreground transition-colors rounded flex items-center justify-center size-8 flex-shrink-0"
          :aria-label="t('chat.filePreview.download')"
          data-testid="file-preview-download"
          @click="downloadFile"
        >
          <UIcon
            name="i-heroicons-arrow-down-tray-20-solid"
            class="size-4"
          />
        </button>
      </template>
    </div>

    <template v-if="activeFile">
      <div
        v-if="isLoadingContent"
        class="flex-1 flex items-center justify-center p-4"
      >
        <div class="text-center">
          <UIcon
            name="i-heroicons-arrow-path-20-solid"
            class="size-8 text-[hsl(var(--muted-foreground)/0.4)] mx-auto mb-2 animate-spin"
          />
          <p class="text-sm text-[hsl(var(--muted-foreground)/0.7)]">
            {{ t('chat.filePreview.loading') }}
          </p>
        </div>
      </div>

      <div
        v-else-if="loadError"
        class="flex-1 flex items-center justify-center p-4"
      >
        <div class="text-center">
          <UIcon
            name="i-heroicons-exclamation-triangle-20-solid"
            class="size-8 text-[hsl(var(--muted-foreground)/0.4)] mx-auto mb-2"
          />
          <p class="text-sm font-medium text-[hsl(var(--muted-foreground)/0.7)]">
            {{ t('chat.filePreview.errorTitle') }}
          </p>
          <p class="text-xs text-[hsl(var(--muted-foreground)/0.5)] mt-1">
            {{ t('chat.filePreview.errorDescription') }}
          </p>
        </div>
      </div>

      <template v-else>
        <iframe
          v-if="activePreviewType === 'pdf'"
          :src="pdfBlobUrl"
          class="flex-1 w-full border-0"
          data-testid="file-preview-pdf"
        />

        <div
          v-else-if="activePreviewType === 'docx'"
          ref="docxContainer"
          class="flex-1 overflow-auto p-2"
          data-testid="file-preview-docx"
        />

        <div
          v-else-if="activePreviewType === 'markdown'"
          class="flex-1 overflow-auto p-4"
          data-testid="file-preview-markdown"
        >
          <MarkdownContent :content="textContent" />
        </div>

        <pre
          v-else-if="activePreviewType === 'text'"
          class="flex-1 overflow-auto p-4 text-sm text-foreground whitespace-pre-wrap break-words m-0"
          data-testid="file-preview-text"
          >{{ textContent }}</pre
        >
      </template>
    </template>

    <template v-else>
      <div
        v-if="previewedFiles.length === 0"
        class="flex-1 flex items-center justify-center p-4"
      >
        <div class="text-center">
          <UIcon
            name="i-heroicons-document-magnifying-glass-20-solid"
            class="size-8 text-[hsl(var(--muted-foreground)/0.4)] mx-auto mb-2"
          />
          <p class="text-sm font-medium text-[hsl(var(--muted-foreground)/0.7)]">
            {{ t('chat.filePreview.emptyTitle') }}
          </p>
          <p class="text-xs text-[hsl(var(--muted-foreground)/0.5)] mt-1">
            {{ t('chat.filePreview.emptyDescription') }}
          </p>
        </div>
      </div>

      <div
        v-else
        class="flex-1 overflow-y-auto py-2 px-2 space-y-1"
      >
        <div
          v-for="file in previewedFiles"
          :key="file.fileId"
          class="flex items-center gap-2 px-2 py-2 rounded-lg hover:bg-[hsl(var(--muted)/0.5)] transition-colors cursor-pointer group/filecard"
          data-testid="file-preview-list-item"
          @click="emit('openFileDetail', file)"
        >
          <UIcon
            :name="fileTypeIcon(file)"
            class="size-5 flex-shrink-0"
          />
          <div class="flex-1 min-w-0">
            <p class="text-sm truncate text-foreground">
              {{ file.fileName }}
            </p>
            <p class="text-[10px] text-[hsl(var(--muted-foreground)/0.6)]">
              {{ formatFileDate(file.messageDate) }}
            </p>
          </div>
          <div
            class="flex items-center gap-0.5 opacity-0 group-hover/filecard:opacity-100 transition-opacity flex-shrink-0"
          >
            <button
              class="text-[hsl(var(--muted-foreground)/0.5)] hover:text-[hsl(var(--muted-foreground))] transition-colors p-1 rounded"
              :aria-label="t('chat.filePreview.scrollToMessage')"
              data-testid="file-preview-scroll-to"
              @click.stop="emit('scrollToMessage', file.messageId)"
            >
              <UIcon
                name="i-ph-chat"
                class="size-3.5"
              />
            </button>
            <button
              class="text-[hsl(var(--muted-foreground)/0.5)] hover:text-[hsl(var(--muted-foreground))] transition-colors p-1 rounded"
              :aria-label="t('chat.filePreview.download')"
              data-testid="file-preview-list-download"
              @click.stop="downloadListFile(file)"
            >
              <UIcon
                name="i-heroicons-arrow-down-tray-20-solid"
                class="size-3.5"
              />
            </button>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import type { PreviewedFile, PreviewFileType } from '@/types/filePreview'
import { getPreviewFileType } from '@/types/filePreview'
import { sanitizeFileUrl } from '@/app/utils/url'
import { fileTypeIcon } from '@/app/utils/fileIcon'
import MarkdownContent from '@/app/components/chat/MarkdownContent.vue'

const { t, locale } = useI18n()
const {
  public: { apiBaseUrl },
} = useRuntimeConfig()

interface Props {
  activeFile: PreviewedFile | null
  previewedFiles: readonly PreviewedFile[]
  contentWidth: number
}

const props = defineProps<Props>()

const emit = defineEmits<{
  close: []
  goToList: []
  openFileDetail: [file: PreviewedFile]
  scrollToMessage: [messageId: string]
}>()

const textContent = ref('')
const isLoadingContent = ref(false)
const loadError = ref(false)
const docxContainer = ref<HTMLElement>()
const pdfBlobUrl = ref('')
let loadVersion = 0

const activePreviewType = computed((): PreviewFileType | null => {
  if (!props.activeFile) return null
  return getPreviewFileType(props.activeFile.mimeType, props.activeFile.fileName)
})

const resolvedActiveUrl = computed(() => {
  if (!props.activeFile) return ''
  return sanitizeFileUrl(props.activeFile.url, apiBaseUrl as string)
})

const proxiedActiveUrl = computed(() => {
  if (!props.activeFile) return ''
  return proxiedUrl(props.activeFile.url)
})

function proxiedUrl(url: string): string {
  if (url.startsWith('/') && !url.startsWith('//')) return url

  const resolvedUrl = sanitizeFileUrl(url, apiBaseUrl as string)
  if (!resolvedUrl) return ''

  try {
    const parsedUrl = new URL(resolvedUrl)
    if (parsedUrl.pathname.startsWith('/api/') || parsedUrl.pathname.startsWith('/assets/')) {
      return `${parsedUrl.pathname}${parsedUrl.search}${parsedUrl.hash}`
    }
  } catch {
    /* sanitizeFileUrl already rejects malformed URLs */
  }

  return resolvedUrl
}

function resolveUrl(url: string): string {
  return sanitizeFileUrl(url, apiBaseUrl as string)
}

function formatFileDate(dateStr: string): string {
  try {
    const date = new Date(dateStr)
    return date.toLocaleDateString(locale.value, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return ''
  }
}

async function downloadFile(): Promise<void> {
  if (!props.activeFile) return
  const url = proxiedActiveUrl.value
  try {
    const response = await fetch(url)
    const blob = await response.blob()
    const blobUrl = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = blobUrl
    link.download = props.activeFile.fileName
    link.click()
    URL.revokeObjectURL(blobUrl)
  } catch {
    window.open(resolvedActiveUrl.value, '_blank')
  }
}

async function downloadListFile(file: PreviewedFile): Promise<void> {
  const url = proxiedUrl(file.url)
  try {
    const response = await fetch(url)
    const blob = await response.blob()
    const blobUrl = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = blobUrl
    link.download = file.fileName
    link.click()
    URL.revokeObjectURL(blobUrl)
  } catch {
    window.open(resolveUrl(file.url), '_blank')
  }
}

async function loadTextContent(url: string): Promise<string> {
  const response = await fetch(url)
  if (!response.ok) throw new Error(`HTTP ${response.status}`)
  return response.text()
}

async function loadDocxContent(url: string, container: HTMLElement): Promise<void> {
  const response = await fetch(url)
  if (!response.ok) throw new Error(`HTTP ${response.status}`)
  const blob = await response.blob()
  const { renderAsync } = await import('docx-preview')
  await renderAsync(blob, container, undefined, {
    ignoreWidth: true,
    ignoreHeight: true,
  })
}

function revokePdfBlobUrl(): void {
  if (!pdfBlobUrl.value) return
  URL.revokeObjectURL(pdfBlobUrl.value)
  pdfBlobUrl.value = ''
}

watch(
  () => props.activeFile?.fileId,
  async (fileId) => {
    const version = ++loadVersion
    textContent.value = ''
    loadError.value = false
    revokePdfBlobUrl()

    if (!fileId || !props.activeFile) {
      isLoadingContent.value = false
      return
    }

    const type = activePreviewType.value
    isLoadingContent.value = true
    const url = proxiedActiveUrl.value

    try {
      if (type === 'pdf') {
        const response = await fetch(url)
        if (!response.ok) throw new Error(`HTTP ${response.status}`)
        const blob = await response.blob()
        if (version !== loadVersion) return
        pdfBlobUrl.value = URL.createObjectURL(blob) + '#navpanes=0&view=FitH'
      } else if (type === 'text' || type === 'markdown') {
        textContent.value = await loadTextContent(url)
      } else if (type === 'docx') {
        await nextTick()
        if (docxContainer.value) {
          await loadDocxContent(url, docxContainer.value)
        }
      }
    } catch {
      if (version === loadVersion) loadError.value = true
    } finally {
      if (version === loadVersion) isLoadingContent.value = false
    }
  },
  { immediate: true },
)

onBeforeUnmount(() => {
  loadVersion++
  revokePdfBlobUrl()
})
</script>
