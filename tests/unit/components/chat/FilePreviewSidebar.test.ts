import { afterEach, describe, expect, it, vi } from 'vitest'
import { waitFor } from '@testing-library/vue'
import FilePreviewSidebar from '~/components/chat/FilePreviewSidebar.vue'
import type { PreviewedFile } from '@/types/filePreview'
import { renderWithProviders } from '@/tests/utils/render'
import { HttpResponse, http, server } from '@/tests/msw/server'

const pdfFile: PreviewedFile = {
  fileId: 'pdf-1',
  fileName: 'report.pdf',
  mimeType: 'application/pdf',
  url: 'http://files.example.test/assets/report.pdf',
  messageId: 'message-1',
  messageDate: '2026-08-23T08:00:00Z',
  previewedAt: 1,
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('FilePreviewSidebar', () => {
  it('fetches an attachment PDF and previews it from a blob URL', async () => {
    // happy-dom does not support loading blob: URLs in iframes. The returned
    // value only needs to prove that the iframe uses createObjectURL's output.
    const createObjectURL = vi
      .spyOn(URL, 'createObjectURL')
      .mockReturnValue('about:blank#pdf-preview')
    const revokeObjectURL = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined)

    server.use(
      http.get(
        '/assets/report.pdf',
        () =>
          new HttpResponse('%PDF-1.7', {
            headers: {
              'Content-Type': 'application/pdf',
              'Content-Disposition': 'attachment; filename="report.pdf"',
            },
          }),
      ),
    )

    const { getByTestId, unmount } = renderWithProviders(FilePreviewSidebar, {
      props: {
        isOpen: true,
        activeFile: pdfFile,
        previewedFiles: [pdfFile],
      },
    })

    await waitFor(() => {
      expect(createObjectURL).toHaveBeenCalledWith(expect.any(Blob))
      expect(getByTestId('file-preview-pdf').getAttribute('src')).toBe('about:blank#pdf-preview')
    })

    unmount()
    expect(revokeObjectURL).toHaveBeenCalledWith('about:blank#pdf-preview')
  })
})
