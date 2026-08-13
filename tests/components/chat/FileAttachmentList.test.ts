import { describe, it, expect, vi } from 'vitest'
import { renderWithProviders } from '@/tests/utils/render'
import FileAttachmentList from '@/app/components/chat/FileAttachmentList.vue'
import type { StagedAttachment } from '@/types/fileAttachment'

function makeAttachment(overrides: Partial<StagedAttachment> = {}): StagedAttachment {
  const buffer = new ArrayBuffer(1024)
  const file = new File([buffer], overrides.fileName ?? 'test.png', {
    type: overrides.mimeType ?? 'image/png',
  })

  return {
    id: `att-${Math.random().toString(36).slice(2)}`,
    file,
    fileName: file.name,
    fileSize: file.size,
    mimeType: file.type,
    status: 'pending',
    progress: 0,
    serverFileId: null,
    serverMimeType: null,
    error: null,
    ...overrides,
  }
}

describe('FileAttachmentList', () => {
  it('renders nothing when list is empty', () => {
    const { container } = renderWithProviders(FileAttachmentList, {
      props: { attachments: [] },
    })

    expect(container.querySelector('[data-testid="file-attachment-list"]')).toBeNull()
  })

  it('renders each staged attachment with filename', () => {
    const attachments = [
      makeAttachment({ fileName: 'photo.png' }),
      makeAttachment({ fileName: 'doc.pdf', mimeType: 'application/pdf' }),
    ]

    const { getByText } = renderWithProviders(FileAttachmentList, {
      props: { attachments },
    })

    expect(getByText('photo.png')).toBeTruthy()
    expect(getByText('doc.pdf')).toBeTruthy()
  })

  it('shows spinner during upload', () => {
    const attachment = makeAttachment({ status: 'uploading', progress: 50 })

    const { container } = renderWithProviders(FileAttachmentList, {
      props: { attachments: [attachment] },
    })

    const spinner = container.querySelector('.animate-spin')
    expect(spinner).toBeTruthy()
  })

  it('shows check icon for ready state', () => {
    const attachment = makeAttachment({
      status: 'ready',
      progress: 100,
      serverFileId: 'abc',
    })

    const { container } = renderWithProviders(FileAttachmentList, {
      props: { attachments: [attachment] },
    })

    const checkIcon = container.querySelector('.text-emerald-500')
    expect(checkIcon).toBeTruthy()
  })

  it('shows error icon and retry button for failed state', () => {
    const attachment = makeAttachment({ status: 'failed' })

    const { container } = renderWithProviders(FileAttachmentList, {
      props: { attachments: [attachment] },
    })

    const errorIcon = container.querySelector('.text-rose-500')
    expect(errorIcon).toBeTruthy()

    const retryBtn = container.querySelector('[data-testid="retry-upload-button"]')
    expect(retryBtn).toBeTruthy()
  })

  it('emits remove when remove button is clicked', async () => {
    const attachment = makeAttachment({ id: 'att-123' })

    const { container, emitted } = renderWithProviders(FileAttachmentList, {
      props: { attachments: [attachment] },
    })

    const removeBtn = container.querySelector('[data-testid="remove-attachment-button"]')
    expect(removeBtn).toBeTruthy()
    await removeBtn!.dispatchEvent(new Event('click', { bubbles: true }))

    expect(emitted().remove).toBeTruthy()
    expect(emitted().remove[0]).toEqual(['att-123'])
  })

  it('emits retry when retry button is clicked', async () => {
    const attachment = makeAttachment({ id: 'att-fail', status: 'failed' })

    const { container, emitted } = renderWithProviders(FileAttachmentList, {
      props: { attachments: [attachment] },
    })

    const retryBtn = container.querySelector('[data-testid="retry-upload-button"]')
    await retryBtn!.dispatchEvent(new Event('click', { bubbles: true }))

    expect(emitted().retry).toBeTruthy()
    expect(emitted().retry[0]).toEqual(['att-fail'])
  })

  it('shows image thumbnail preview for image attachments', () => {
    const attachment = makeAttachment({ mimeType: 'image/jpeg', fileName: 'pic.jpg' })
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:test-preview')

    const { container } = renderWithProviders(FileAttachmentList, {
      props: { attachments: [attachment] },
    })

    const img = container.querySelector('img')
    expect(img).toBeTruthy()
    expect(img?.src).toContain('blob:test-preview')
  })
})
