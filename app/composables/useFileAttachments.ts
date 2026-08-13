import { ref, computed } from 'vue'
import type { StagedAttachment } from '@/types/fileAttachment'
import { chatService } from '@/lib/api/services/ChatService'
import { AppError } from '@/lib/errors/types'
import { ErrorCode } from '@/types/enums'
import {
  MAX_FILE_SIZE_BYTES,
  MAX_FILES_PER_MESSAGE,
  MAX_TOTAL_SIZE_BYTES,
  MAX_CONCURRENT_UPLOADS,
  ALLOWED_MIME_TYPES,
  ALLOWED_EXTENSIONS,
} from '@/lib/validation/fileAttachment'

function generateAttachmentId(): string {
  return `att-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
}

function getFileExtension(fileName: string): string {
  const dot = fileName.lastIndexOf('.')
  return dot >= 0 ? fileName.slice(dot).toLowerCase() : ''
}

function isDuplicate(file: File, existing: StagedAttachment[]): boolean {
  return existing.some(
    (a) =>
      a.fileName === file.name &&
      a.fileSize === file.size &&
      a.file.lastModified === file.lastModified,
  )
}

export function useFileAttachments() {
  const stagedAttachments = ref<StagedAttachment[]>([])
  let activeUploads = 0

  const hasReadyFiles = computed(() => stagedAttachments.value.some((a) => a.status === 'ready'))

  const hasPendingUploads = computed(() =>
    stagedAttachments.value.some((a) => a.status === 'pending' || a.status === 'uploading'),
  )

  const hasFailedUploads = computed(() =>
    stagedAttachments.value.some((a) => a.status === 'failed'),
  )

  const canSend = computed(
    () =>
      stagedAttachments.value.length > 0 &&
      stagedAttachments.value.every((a) => a.status === 'ready'),
  )

  const readyFileIds = computed(() =>
    stagedAttachments.value
      .filter((a) => a.status === 'ready' && a.serverFileId)
      .map((a) => a.serverFileId!),
  )

  function validateFile(file: File): AppError | null {
    if (file.size > MAX_FILE_SIZE_BYTES) {
      return new AppError(ErrorCode.FILE_TOO_LARGE, 'chat.messageInput.fileTooLarge')
    }

    const ext = getFileExtension(file.name)
    const mimeAllowed = (ALLOWED_MIME_TYPES as readonly string[]).includes(file.type)
    const extAllowed = (ALLOWED_EXTENSIONS as readonly string[]).includes(ext)

    if (!mimeAllowed && !extAllowed) {
      return new AppError(ErrorCode.FILE_TYPE_NOT_ALLOWED, 'chat.messageInput.fileTypeNotAllowed')
    }

    if (stagedAttachments.value.length >= MAX_FILES_PER_MESSAGE) {
      return new AppError(ErrorCode.FILE_COUNT_EXCEEDED, 'chat.messageInput.fileCountExceeded')
    }

    const currentTotalSize = stagedAttachments.value.reduce((sum, a) => sum + a.fileSize, 0)
    if (currentTotalSize + file.size > MAX_TOTAL_SIZE_BYTES) {
      return new AppError(
        ErrorCode.FILE_TOTAL_SIZE_EXCEEDED,
        'chat.messageInput.fileTotalSizeExceeded',
      )
    }

    return null
  }

  function processQueue(agentId: number, sessionId: string) {
    while (activeUploads < MAX_CONCURRENT_UPLOADS) {
      const next = stagedAttachments.value.find((a) => a.status === 'pending')
      if (!next) break
      activeUploads++
      void uploadAttachment(next, agentId, sessionId)
    }
  }

  async function uploadAttachment(
    attachment: StagedAttachment,
    agentId: number,
    sessionId: string,
  ) {
    const idx = stagedAttachments.value.findIndex((a) => a.id === attachment.id)
    if (idx === -1) {
      activeUploads--
      return
    }

    stagedAttachments.value[idx] = {
      ...stagedAttachments.value[idx]!,
      status: 'uploading',
      progress: 0,
    }

    const result = await chatService.uploadFile(agentId, sessionId, attachment.file, (percent) => {
      const i = stagedAttachments.value.findIndex((a) => a.id === attachment.id)
      if (i !== -1) {
        stagedAttachments.value[i] = { ...stagedAttachments.value[i]!, progress: percent }
      }
    })

    const finalIdx = stagedAttachments.value.findIndex((a) => a.id === attachment.id)
    if (finalIdx === -1) {
      activeUploads--
      processQueue(agentId, sessionId)
      return
    }

    if (result.isOk()) {
      stagedAttachments.value[finalIdx] = {
        ...stagedAttachments.value[finalIdx]!,
        status: 'ready',
        progress: 100,
        serverFileId: result.value.id,
        serverMimeType: result.value.mimeType,
        error: null,
      }
    } else {
      stagedAttachments.value[finalIdx] = {
        ...stagedAttachments.value[finalIdx]!,
        status: 'failed',
        progress: 0,
        error: result.error,
      }
    }

    activeUploads--
    processQueue(agentId, sessionId)
  }

  type AttachResult = {
    accepted: StagedAttachment[]
    rejected: Array<{ file: File; error: AppError }>
  }

  function attachFiles(files: FileList | File[], agentId: number, sessionId: string): AttachResult {
    const accepted: StagedAttachment[] = []
    const rejected: Array<{ file: File; error: AppError }> = []

    for (const file of Array.from(files)) {
      if (isDuplicate(file, stagedAttachments.value)) {
        rejected.push({
          file,
          error: new AppError(ErrorCode.VALIDATION_ERROR, 'chat.messageInput.duplicateFile'),
        })
        continue
      }

      const validationError = validateFile(file)
      if (validationError) {
        rejected.push({ file, error: validationError })
        continue
      }

      const attachment: StagedAttachment = {
        id: generateAttachmentId(),
        file,
        fileName: file.name,
        fileSize: file.size,
        mimeType: file.type,
        status: 'pending',
        progress: 0,
        serverFileId: null,
        serverMimeType: null,
        error: null,
      }

      stagedAttachments.value.push(attachment)
      accepted.push(attachment)
    }

    if (accepted.length > 0) {
      processQueue(agentId, sessionId)
    }

    return { accepted, rejected }
  }

  function removeAttachment(id: string) {
    stagedAttachments.value = stagedAttachments.value.filter((a) => a.id !== id)
  }

  function retryAttachment(id: string, agentId: number, sessionId: string) {
    const idx = stagedAttachments.value.findIndex((a) => a.id === id)
    if (idx === -1) return

    const attachment = stagedAttachments.value[idx]!
    if (attachment.status !== 'failed') return

    stagedAttachments.value[idx] = {
      ...attachment,
      status: 'pending',
      progress: 0,
      error: null,
    }

    processQueue(agentId, sessionId)
  }

  function clearAttachments() {
    stagedAttachments.value = []
    activeUploads = 0
  }

  return {
    stagedAttachments: computed(() => stagedAttachments.value),
    hasReadyFiles,
    hasPendingUploads,
    hasFailedUploads,
    canSend,
    readyFileIds,
    attachFiles,
    removeAttachment,
    retryAttachment,
    clearAttachments,
  }
}
