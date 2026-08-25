export type PreviewFileType = 'pdf' | 'docx' | 'text' | 'markdown'

export interface PreviewedFile {
  fileId: string
  fileName: string
  mimeType: string
  url: string
  thumbnailUrl?: string
  messageId: string
  messageDate: string
  previewedAt: number
}

export function getPreviewFileType(mimeType: string, fileName: string): PreviewFileType | null {
  const ext = fileName.split('.').pop()?.toLowerCase()

  if (mimeType === 'application/pdf' || ext === 'pdf') return 'pdf'
  if (mimeType.includes('word') || ext === 'doc' || ext === 'docx') return 'docx'
  if (mimeType === 'text/markdown' || ext === 'md') return 'markdown'
  if (mimeType === 'text/plain' || mimeType === 'text/csv' || ext === 'txt' || ext === 'csv')
    return 'text'

  return null
}

export function isPreviewableFile(mimeType: string, fileName: string): boolean {
  return getPreviewFileType(mimeType, fileName) !== null
}
