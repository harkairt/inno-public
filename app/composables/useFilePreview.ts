import { computed, readonly, ref } from 'vue'
import type { ReceivedFile } from '@/types/api/schemas'
import type { PreviewedFile } from '@/types/filePreview'

const STORAGE_PREFIX = 'innochat-previewed-files'
const STORAGE_VERSION = 1
const MAX_HISTORY = 25

interface StoredPreviewedFiles {
  version: typeof STORAGE_VERSION
  files: PreviewedFile[]
}

function toEntry(file: ReceivedFile, messageId: string, messageDate: string): PreviewedFile {
  return {
    fileId: file.id,
    fileName: file.fileName,
    mimeType: file.mimeType,
    url: file.url,
    thumbnailUrl: file.thumbnailUrl,
    messageId,
    messageDate,
    previewedAt: Date.now(),
  }
}

function parseStored(raw: string | null): PreviewedFile[] {
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw) as Partial<StoredPreviewedFiles> | null
    if (parsed?.version !== STORAGE_VERSION || !Array.isArray(parsed.files)) return []
    return parsed.files.filter(
      (f): f is PreviewedFile =>
        typeof f === 'object' &&
        f !== null &&
        typeof f.fileId === 'string' &&
        typeof f.fileName === 'string' &&
        typeof f.previewedAt === 'number',
    )
  } catch {
    return []
  }
}

export function useFilePreview(sessionId: string) {
  const storageKey = `${STORAGE_PREFIX}:${sessionId}`

  const previewedFiles = ref<PreviewedFile[]>([])
  const isOpen = ref(false)
  const activeFile = ref<PreviewedFile | null>(null)

  function load(): void {
    if (typeof window === 'undefined') {
      previewedFiles.value = []
      return
    }
    try {
      previewedFiles.value = parseStored(localStorage.getItem(storageKey))
    } catch {
      previewedFiles.value = []
    }
  }

  function persist(): void {
    if (typeof window === 'undefined') return
    try {
      const value: StoredPreviewedFiles = {
        version: STORAGE_VERSION,
        files: previewedFiles.value,
      }
      localStorage.setItem(storageKey, JSON.stringify(value))
    } catch {
      /* ignored */
    }
  }

  function previewFile(file: ReceivedFile, messageId: string, messageDate: string): void {
    const existing = previewedFiles.value.findIndex((f) => f.fileId === file.id)
    const entry = toEntry(file, messageId, messageDate)
    if (existing !== -1) previewedFiles.value.splice(existing, 1)
    previewedFiles.value.unshift(entry)
    if (previewedFiles.value.length > MAX_HISTORY) {
      previewedFiles.value = previewedFiles.value.slice(0, MAX_HISTORY)
    }
    activeFile.value = entry
    isOpen.value = true
    persist()
  }

  function openFileDetail(file: PreviewedFile): void {
    const existing = previewedFiles.value.findIndex((f) => f.fileId === file.fileId)
    if (existing !== -1) {
      previewedFiles.value[existing]!.previewedAt = Date.now()
      previewedFiles.value.sort((a, b) => b.previewedAt - a.previewedAt)
      persist()
    }
    activeFile.value = file
  }

  function goToList(): void {
    activeFile.value = null
  }

  function closePreview(): void {
    isOpen.value = false
    activeFile.value = null
  }

  function toggleOpen(): void {
    if (isOpen.value) {
      closePreview()
    } else {
      isOpen.value = true
      activeFile.value = null
    }
  }

  const hasPreviewedFiles = computed(() => previewedFiles.value.length > 0)

  load()

  return {
    previewedFiles: readonly(previewedFiles),
    isOpen,
    activeFile: readonly(activeFile),
    previewFile,
    openFileDetail,
    goToList,
    closePreview,
    toggleOpen,
    hasPreviewedFiles,
  }
}
