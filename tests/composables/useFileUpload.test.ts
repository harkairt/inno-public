import { describe, it, expect, vi } from 'vitest'
import { defineComponent } from 'vue'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { VueQueryPlugin, QueryClient } from '@tanstack/vue-query'
import { server, http } from '@/tests/msw/server'
import { apiOk, apiError } from '@/tests/msw/http'
import { useFileAttachments } from '@/app/composables/useFileAttachments'
import { seedAuthStorage } from '@/tests/utils/authSeed'

const VALID_UUID_1 = 'a1b2c3d4-e5f6-4890-abcd-ef1234567890'
const VALID_UUID_2 = 'b2c3d4e5-f6a7-4890-abcd-ef1234567891'
const VALID_UUID_3 = 'c3d4e5f6-a7b8-4890-abcd-ef1234567892'

function makeFile(name = 'test.png', size = 1024, type = 'image/png'): File {
  const buffer = new ArrayBuffer(size)
  return new File([buffer], name, { type, lastModified: Date.now() })
}

function mountFileUpload() {
  const pinia = createPinia()
  setActivePinia(pinia)
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })

  let composable!: ReturnType<typeof useFileAttachments>
  const Comp = defineComponent({
    setup() {
      composable = useFileAttachments()
      return {}
    },
    render: () => null,
  })

  mount(Comp, {
    global: { plugins: [pinia, [VueQueryPlugin, { queryClient }]] },
  })

  return composable
}

describe('useFileAttachments', () => {
  beforeEach(() => {
    seedAuthStorage()
  })

  it('attaches a file and transitions to ready', async () => {
    const upload = mountFileUpload()
    const file = makeFile()

    const { accepted, rejected } = upload.attachFiles([file], 1)

    expect(accepted).toHaveLength(1)
    expect(rejected).toHaveLength(0)
    expect(upload.stagedAttachments.value).toHaveLength(1)

    await vi.waitFor(() => {
      expect(upload.stagedAttachments.value[0]!.status).toBe('ready')
    })

    expect(upload.stagedAttachments.value[0]!.serverFileId).toBe(VALID_UUID_1)
  })

  it('populates serverFileId and serverMimeType on success', async () => {
    server.use(
      http.post('/api/AIWebAPI/uploadFile', () =>
        apiOk({
          id: VALID_UUID_2,
          mimeType: 'application/pdf',
          thumbnailUrl: '',
        }),
      ),
    )

    const upload = mountFileUpload()
    upload.attachFiles([makeFile('doc.pdf', 500, 'application/pdf')], 1)

    await vi.waitFor(() => {
      expect(upload.stagedAttachments.value[0]!.status).toBe('ready')
    })

    expect(upload.stagedAttachments.value[0]!.serverFileId).toBe(VALID_UUID_2)
    expect(upload.stagedAttachments.value[0]!.serverMimeType).toBe('application/pdf')
  })

  it('allows attach without text (files-only send)', async () => {
    const upload = mountFileUpload()
    upload.attachFiles([makeFile()], 1)

    await vi.waitFor(() => {
      expect(upload.canSend.value).toBe(true)
    })

    expect(upload.readyFileIds.value).toHaveLength(1)
  })

  it('clears attachments on clearAttachments', async () => {
    const upload = mountFileUpload()
    upload.attachFiles([makeFile()], 1)

    await vi.waitFor(() => {
      expect(upload.stagedAttachments.value[0]!.status).toBe('ready')
    })

    upload.clearAttachments()
    expect(upload.stagedAttachments.value).toHaveLength(0)
    expect(upload.readyFileIds.value).toHaveLength(0)
  })

  it('does not break text-only send (no files staged)', () => {
    const upload = mountFileUpload()
    expect(upload.stagedAttachments.value).toHaveLength(0)
    expect(upload.canSend.value).toBe(false)
    expect(upload.readyFileIds.value).toHaveLength(0)
  })

  it('rejects file exceeding size limit', () => {
    const upload = mountFileUpload()
    const bigFile = makeFile('big.png', 11 * 1024 * 1024)

    const { accepted, rejected } = upload.attachFiles([bigFile], 1)

    expect(accepted).toHaveLength(0)
    expect(rejected).toHaveLength(1)
    expect(rejected[0]!.error.code).toBe('FILE_TOO_LARGE')
    expect(upload.stagedAttachments.value).toHaveLength(0)
  })

  it('rejects disallowed file type', () => {
    const upload = mountFileUpload()
    const exeFile = makeFile('virus.exe', 100, 'application/x-msdownload')

    const { rejected } = upload.attachFiles([exeFile], 1)

    expect(rejected).toHaveLength(1)
    expect(rejected[0]!.error.code).toBe('FILE_TYPE_NOT_ALLOWED')
  })

  it('rejects when file count exceeds limit', () => {
    const upload = mountFileUpload()

    for (let i = 0; i < 10; i++) {
      upload.attachFiles([makeFile(`file${i}.png`, 100)], 1)
    }

    const { rejected } = upload.attachFiles([makeFile('extra.png', 100)], 1)
    expect(rejected).toHaveLength(1)
    expect(rejected[0]!.error.code).toBe('FILE_COUNT_EXCEEDED')
  })

  it('rejects duplicate files', () => {
    const upload = mountFileUpload()
    const file = makeFile('same.png', 200)

    upload.attachFiles([file], 1)
    const { rejected } = upload.attachFiles([file], 1)

    expect(rejected).toHaveLength(1)
    expect(rejected[0]!.error.code).toBe('VALIDATION_ERROR')
  })

  it('sets failed status on upload error', async () => {
    server.use(
      http.post('/api/AIWebAPI/uploadFile', () => apiError(500, 'UPLOAD_ERROR', 'Server error')),
    )

    const upload = mountFileUpload()
    upload.attachFiles([makeFile()], 1)

    await vi.waitFor(() => {
      expect(upload.stagedAttachments.value[0]!.status).toBe('failed')
    })

    expect(upload.stagedAttachments.value[0]!.error).not.toBeNull()
    expect(upload.hasFailedUploads.value).toBe(true)
    expect(upload.canSend.value).toBe(false)
  })

  it('retries only the failed file', async () => {
    let callCount = 0
    server.use(
      http.post('/api/AIWebAPI/uploadFile', () => {
        callCount++
        if (callCount === 1) {
          return apiError(500, 'UPLOAD_ERROR', 'fail first')
        }
        return apiOk({
          id: VALID_UUID_3,
          mimeType: 'image/png',
          thumbnailUrl: '',
        })
      }),
    )

    const upload = mountFileUpload()
    upload.attachFiles([makeFile()], 1)

    await vi.waitFor(() => {
      expect(upload.stagedAttachments.value[0]!.status).toBe('failed')
    })

    const failedId = upload.stagedAttachments.value[0]!.id
    upload.retryAttachment(failedId, 1)

    await vi.waitFor(() => {
      expect(upload.stagedAttachments.value[0]!.status).toBe('ready')
    })

    expect(callCount).toBe(2)
    expect(upload.stagedAttachments.value[0]!.serverFileId).toBe(VALID_UUID_3)
  })

  it('one upload fails while others succeed', async () => {
    let callCount = 0
    server.use(
      http.post('/api/AIWebAPI/uploadFile', () => {
        callCount++
        if (callCount === 2) {
          return apiError(500, 'UPLOAD_ERROR', 'second fails')
        }
        return apiOk({
          id: `a1b2c3d4-e5f6-4890-abcd-ef12345678${String(callCount).padStart(2, '0')}`,
          mimeType: 'image/png',
          thumbnailUrl: '',
        })
      }),
    )

    const upload = mountFileUpload()
    upload.attachFiles([makeFile('a.png', 100), makeFile('b.png', 200), makeFile('c.png', 300)], 1)

    await vi.waitFor(() => {
      const statuses = upload.stagedAttachments.value.map((a) => a.status)
      expect(statuses).not.toContain('pending')
      expect(statuses).not.toContain('uploading')
    })

    const statuses = upload.stagedAttachments.value.map((a) => a.status)
    expect(statuses.filter((s) => s === 'ready')).toHaveLength(2)
    expect(statuses.filter((s) => s === 'failed')).toHaveLength(1)
  })

  it('removes attachment by id', async () => {
    const upload = mountFileUpload()
    upload.attachFiles([makeFile('a.png', 100), makeFile('b.png', 200)], 1)

    expect(upload.stagedAttachments.value).toHaveLength(2)

    const idToRemove = upload.stagedAttachments.value[0]!.id
    upload.removeAttachment(idToRemove)

    expect(upload.stagedAttachments.value).toHaveLength(1)
    expect(upload.stagedAttachments.value[0]!.fileName).toBe('b.png')
  })
})
