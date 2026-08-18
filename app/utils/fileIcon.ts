export function fileTypeIcon(file: { mimeType: string; fileName: string }): string {
  const mime = file.mimeType
  const ext = file.fileName.split('.').pop()?.toLowerCase()

  if (mime === 'application/pdf' || ext === 'pdf') return 'i-vscode-icons-file-type-pdf2'
  if (mime.includes('word') || ext === 'doc' || ext === 'docx')
    return 'i-vscode-icons-file-type-word'
  if (mime.includes('spreadsheet') || mime.includes('excel') || ext === 'xls' || ext === 'xlsx')
    return 'i-vscode-icons-file-type-excel'
  if (
    mime.includes('presentation') ||
    mime.includes('powerpoint') ||
    ext === 'ppt' ||
    ext === 'pptx'
  )
    return 'i-vscode-icons-file-type-powerpoint'
  if (mime === 'text/csv' || ext === 'csv') return 'i-vscode-icons-file-type-excel'
  if (
    mime === 'application/zip' ||
    mime === 'application/x-rar-compressed' ||
    ext === 'zip' ||
    ext === 'rar'
  )
    return 'i-vscode-icons-file-type-zip'
  if (mime.startsWith('text/') || ext === 'txt') return 'i-vscode-icons-file-type-text'
  if (mime.startsWith('audio/')) return 'i-vscode-icons-file-type-audio'
  if (mime.startsWith('video/')) return 'i-vscode-icons-file-type-video'
  if (mime.startsWith('image/')) return 'i-vscode-icons-file-type-image'
  return 'i-vscode-icons-default-file'
}
