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
    const indicator = container.querySelector('[data-testid="uploading-attachment-indicator"]')
    expect(spinner).toBeTruthy()
    expect(spinner?.classList.contains('w-3.5')).toBe(true)
    expect(spinner?.classList.contains('h-3.5')).toBe(true)
    expect(indicator?.classList.contains('w-5')).toBe(true)
    expect(indicator?.classList.contains('h-5')).toBe(true)
    expect(indicator?.classList.contains('-top-2')).toBe(true)
    expect(indicator?.classList.contains('-right-2')).toBe(true)
    expect(container.querySelector('[data-testid="remove-attachment-button"]')).toBeNull()
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

  it('keeps failed attachment actions visible and emits retry', async () => {
    const attachment = makeAttachment({ id: 'att-failed', status: 'failed' })

    const { container, emitted } = renderWithProviders(FileAttachmentList, {
      props: { attachments: [attachment] },
    })

    const card = container.querySelector('[data-testid="attachment-att-failed"]')
    const actions = container.querySelector('[data-testid="failed-attachment-actions"]')
    const retryButton = container.querySelector('[data-testid="retry-upload-button"]')
    const removeButton = container.querySelector('[data-testid="remove-attachment-button"]')

    expect(card?.classList.contains('border-red-500')).toBe(true)
    expect(card?.classList.contains('pr-14')).toBe(false)
    expect(retryButton).toBeTruthy()
    expect(removeButton?.classList.contains('opacity-0')).toBe(false)
    expect(retryButton?.classList.contains('text-red-500')).toBe(false)
    expect(retryButton?.classList.contains('hover:border-[hsl(var(--foreground)/0.45)]')).toBe(true)
    expect(actions?.classList.contains('-top-2')).toBe(true)
    expect(actions?.classList.contains('-right-2')).toBe(true)
    expect(actions?.classList.contains('bg-[hsl(var(--background))]')).toBe(false)
    expect(actions?.classList.contains('p-0.5')).toBe(false)
    expect(retryButton?.classList.contains('shadow-[0_0_0_2px_hsl(var(--background))]')).toBe(false)

    await retryButton!.dispatchEvent(new Event('click', { bubbles: true }))
    expect(emitted().retry?.[0]).toEqual(['att-failed'])
  })

  it('keeps the remove button hover-only after a successful upload', () => {
    const attachment = makeAttachment({ status: 'ready' })

    const { container } = renderWithProviders(FileAttachmentList, {
      props: { attachments: [attachment] },
    })

    const removeButton = container.querySelector('[data-testid="remove-attachment-button"]')
    expect(removeButton?.classList.contains('opacity-0')).toBe(true)
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
