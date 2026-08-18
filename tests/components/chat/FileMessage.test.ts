import { describe, it, expect } from 'vitest'
import { renderWithProviders } from '@/tests/utils/render'
import FileMessage from '@/app/components/chat/FileMessage.vue'

function filePayload(overrides: Record<string, unknown> = {}): string {
  return JSON.stringify({
    text: 'here are the files',
    files: [
      {
        id: 'file-1',
        fileName: 'photo.png',
        mimeType: 'image/png',
        url: '/api/storage/photo.png',
      },
    ],
    ...overrides,
  })
}

function mixedPayload(): string {
  return JSON.stringify({
    text: 'mixed content',
    files: [
      {
        id: 'img-1',
        fileName: 'screenshot.jpg',
        mimeType: 'image/jpeg',
        url: '/api/storage/screenshot.jpg',
      },
      {
        id: 'img-2',
        fileName: 'diagram.png',
        mimeType: 'image/png',
        url: '/api/storage/diagram.png',
      },
      {
        id: 'doc-1',
        fileName: 'report.pdf',
        mimeType: 'application/pdf',
        url: '/api/storage/report.pdf',
      },
      {
        id: 'doc-2',
        fileName: 'data.xlsx',
        mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        url: '/api/storage/data.xlsx',
      },
    ],
  })
}

describe('FileMessage', () => {
  it('renders accompanying text as markdown', () => {
    const { getByText } = renderWithProviders(FileMessage, {
      props: { messageText: filePayload() },
    })

    expect(getByText('here are the files')).toBeTruthy()
  })

  it('renders file entries with filenames', () => {
    const { getByText } = renderWithProviders(FileMessage, {
      props: { messageText: filePayload() },
    })

    expect(getByText('photo.png')).toBeTruthy()
  })

  it('renders image thumbnail for image files', () => {
    const { container } = renderWithProviders(FileMessage, {
      props: { messageText: filePayload() },
    })

    const img = container.querySelector('img')
    expect(img).toBeTruthy()
    expect(img?.src).toContain('photo.png')
  })

  it('renders chip (no img) for non-image files', () => {
    const payload = filePayload({
      files: [
        {
          id: 'file-2',
          fileName: 'report.pdf',
          mimeType: 'application/pdf',
          url: '/api/storage/report.pdf',
        },
      ],
    })

    const { queryByText, container } = renderWithProviders(FileMessage, {
      props: { messageText: payload },
    })

    expect(queryByText('report.pdf')).toBeTruthy()
    expect(container.querySelector('img')).toBeNull()
  })

  it('renders file chips as links', () => {
    const payload = filePayload({
      files: [
        {
          id: 'file-2',
          fileName: 'report.pdf',
          mimeType: 'application/pdf',
          url: '/api/storage/report.pdf',
        },
      ],
    })

    const { container } = renderWithProviders(FileMessage, {
      props: { messageText: payload },
    })

    const link = container.querySelector('a')
    expect(link).toBeTruthy()
    expect(link?.getAttribute('href')).toBe('/api/storage/report.pdf')
    expect(link?.getAttribute('target')).toBe('_blank')
  })

  it('accepts relative URLs from the backend', () => {
    const payload = filePayload({
      files: [
        {
          id: 'file-rel',
          fileName: 'photo.png',
          mimeType: 'image/png',
          url: '/api/storage/photo.png',
        },
      ],
    })

    const { container } = renderWithProviders(FileMessage, {
      props: { messageText: payload },
    })

    const img = container.querySelector('img')
    expect(img).toBeTruthy()
    expect(img?.src).toContain('/api/storage/photo.png')
  })

  it('accepts absolute https URLs', () => {
    const payload = filePayload({
      files: [
        {
          id: 'file-abs',
          fileName: 'photo.png',
          mimeType: 'image/png',
          url: 'https://cdn.example.com/photo.png',
        },
      ],
    })

    const { container } = renderWithProviders(FileMessage, {
      props: { messageText: payload },
    })

    const img = container.querySelector('img')
    expect(img).toBeTruthy()
    expect(img?.src).toContain('photo.png')
  })

  it('does not render text block when text is empty', () => {
    const payload = filePayload({ text: '' })

    const { container } = renderWithProviders(FileMessage, {
      props: { messageText: payload },
    })

    const imgs = container.querySelectorAll('img')
    expect(imgs.length).toBeGreaterThan(0)
  })

  it('renders raw text fallback for malformed messageText', () => {
    const { getByText } = renderWithProviders(FileMessage, {
      props: { messageText: 'not valid json at all' },
    })

    expect(getByText('not valid json at all')).toBeTruthy()
  })

  it('renders raw text fallback for missing files array', () => {
    const broken = JSON.stringify({ text: 'oops' })

    const { container } = renderWithProviders(FileMessage, {
      props: { messageText: broken },
    })

    expect(container.textContent).toContain('oops')
  })

  it('renders mixed payload with image thumbnails and file chips', () => {
    const { container, getByText } = renderWithProviders(FileMessage, {
      props: { messageText: mixedPayload() },
    })

    const imgs = container.querySelectorAll('img')
    expect(imgs).toHaveLength(2)

    const links = container.querySelectorAll('a')
    expect(links).toHaveLength(2)

    expect(getByText('screenshot.jpg')).toBeTruthy()
    expect(getByText('report.pdf')).toBeTruthy()
    expect(getByText('data.xlsx')).toBeTruthy()
  })

  it('renders image-only payload as thumbnails without links', () => {
    const payload = filePayload({
      files: [
        { id: '1', fileName: 'a.png', mimeType: 'image/png', url: '/api/storage/a.png' },
        { id: '2', fileName: 'b.jpg', mimeType: 'image/jpeg', url: '/api/storage/b.jpg' },
      ],
    })

    const { container } = renderWithProviders(FileMessage, {
      props: { messageText: payload },
    })

    const imgs = container.querySelectorAll('img')
    expect(imgs).toHaveLength(2)

    const links = container.querySelectorAll('a')
    expect(links).toHaveLength(0)
  })

  it('renders file-only payload', () => {
    const payload = filePayload({
      files: [
        { id: '1', fileName: 'a.pdf', mimeType: 'application/pdf', url: '/api/storage/a.pdf' },
        {
          id: '2',
          fileName: 'b.docx',
          mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          url: '/api/storage/b.docx',
        },
      ],
    })

    const { container } = renderWithProviders(FileMessage, {
      props: { messageText: payload },
    })

    const imgs = container.querySelectorAll('img')
    expect(imgs).toHaveLength(0)

    const links = container.querySelectorAll('a')
    expect(links).toHaveLength(2)
  })

  it('renders multiple files', () => {
    const payload = filePayload({
      files: [
        { id: '1', fileName: 'a.png', mimeType: 'image/png', url: '/api/storage/a.png' },
        { id: '2', fileName: 'b.pdf', mimeType: 'application/pdf', url: '/api/storage/b.pdf' },
      ],
    })

    const { getByText } = renderWithProviders(FileMessage, {
      props: { messageText: payload },
    })

    expect(getByText('a.png')).toBeTruthy()
    expect(getByText('b.pdf')).toBeTruthy()
  })
})
