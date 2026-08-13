import { describe, it, expect } from 'vitest'
import { renderWithProviders } from '@/tests/utils/render'
import FileEntry from '@/app/components/chat/FileEntry.vue'

const pdfFile = {
  id: 'f1',
  fileName: 'report.pdf',
  mimeType: 'application/pdf',
  url: '/api/storage/report.pdf',
}

const imageFile = {
  id: 'f2',
  fileName: 'photo.png',
  mimeType: 'image/png',
  url: '/api/storage/photo.png',
}

describe('FileEntry — card mode', () => {
  it('renders filename', () => {
    const { getByText } = renderWithProviders(FileEntry, {
      props: { file: pdfFile, mode: 'card' },
    })

    expect(getByText('report.pdf')).toBeTruthy()
  })

  it('renders as a link with correct href', () => {
    const { container } = renderWithProviders(FileEntry, {
      props: { file: pdfFile, mode: 'card' },
    })

    const link = container.querySelector('a')
    expect(link).toBeTruthy()
    expect(link?.getAttribute('href')).toBe('/api/storage/report.pdf')
    expect(link?.getAttribute('target')).toBe('_blank')
  })

  it('renders file extension badge', () => {
    const { getByText } = renderWithProviders(FileEntry, {
      props: { file: pdfFile, mode: 'card' },
    })

    expect(getByText('pdf')).toBeTruthy()
  })

  it('does not render an img tag', () => {
    const { container } = renderWithProviders(FileEntry, {
      props: { file: pdfFile, mode: 'card' },
    })

    expect(container.querySelector('img')).toBeNull()
  })
})

describe('FileEntry — thumbnail mode', () => {
  it('renders an img with correct src', () => {
    const { container } = renderWithProviders(FileEntry, {
      props: { file: imageFile, mode: 'thumbnail' },
    })

    const img = container.querySelector('img')
    expect(img).toBeTruthy()
    expect(img?.src).toContain('/api/storage/photo.png')
  })

  it('sets data-source to full-res url', () => {
    const { container } = renderWithProviders(FileEntry, {
      props: { file: imageFile, mode: 'thumbnail' },
    })

    const img = container.querySelector('img')
    expect(img?.getAttribute('data-source')).toBe('/api/storage/photo.png')
  })

  it('renders filename below thumbnail', () => {
    const { getByText } = renderWithProviders(FileEntry, {
      props: { file: imageFile, mode: 'thumbnail' },
    })

    expect(getByText('photo.png')).toBeTruthy()
  })

  it('uses thumbnailUrl as img src when available', () => {
    const fileWithThumb = {
      ...imageFile,
      thumbnailUrl: '/api/storage/thumb/photo.png',
    }

    const { container } = renderWithProviders(FileEntry, {
      props: { file: fileWithThumb, mode: 'thumbnail' },
    })

    const img = container.querySelector('img')
    expect(img?.src).toContain('/api/storage/thumb/photo.png')
    expect(img?.getAttribute('data-source')).toBe('/api/storage/photo.png')
  })

  it('does not render a link tag', () => {
    const { container } = renderWithProviders(FileEntry, {
      props: { file: imageFile, mode: 'thumbnail' },
    })

    expect(container.querySelector('a')).toBeNull()
  })
})
