import type { AppError } from '@/lib/errors/types'

export type UploadStatus = 'pending' | 'uploading' | 'ready' | 'failed'

export interface StagedAttachment {
  id: string
  file: File
  fileName: string
  fileSize: number
  mimeType: string
  status: UploadStatus
  progress: number
  serverFileId: string | null
  serverMimeType: string | null
  error: AppError | null
}
