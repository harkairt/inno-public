import { describe, it, expect, vi, beforeEach } from 'vitest'
import { TranscriptionService } from '@/lib/api/services/TranscriptionService'
import { ErrorCode } from '@/types/enums'

// @gradio/client talks to a Gradio backend over its own transport (not axios), so
// it never reaches the MSW boundary and cannot run under happy-dom. Per Phase 2
// §0, heavy libs happy-dom can't run are the sanctioned vi.mock case — this is
// NOT an apiClient/service/store mock.
const { connectMock, predictMock, handleFileMock } = vi.hoisted(() => {
  const predictMock = vi.fn()
  return {
    predictMock,
    connectMock: vi.fn(async () => ({ predict: predictMock })),
    handleFileMock: vi.fn((file: unknown) => ({ __handled: file })),
  }
})

vi.mock('@gradio/client', () => ({
  Client: { connect: connectMock },
  handle_file: handleFileMock,
}))

function blobOfSize(bytes: number): Blob {
  // The size guard reads only .size; avoid allocating real megabytes.
  return { size: bytes } as Blob
}

describe('TranscriptionService.transcribe', () => {
  let service: TranscriptionService

  beforeEach(() => {
    connectMock.mockClear()
    predictMock.mockReset()
    handleFileMock.mockClear()
    service = new TranscriptionService('http://transcribe.test', 'test-api-key')
  })

  it('rejects audio larger than 25MB without calling the client', async () => {
    const result = await service.transcribe(blobOfSize(26 * 1024 * 1024))

    expect(result.isErr()).toBe(true)
    if (result.isErr()) {
      expect(result.error.code).toBe(ErrorCode.VALIDATION_ERROR)
      expect(result.error.statusCode).toBe(413)
    }
    expect(connectMock).not.toHaveBeenCalled()
  })

  it('transcribes on the happy path and forwards blob + language + apiKey', async () => {
    predictMock.mockResolvedValue({ data: [{ success: true, text: 'hello world' }] })
    const audio = blobOfSize(1000)

    const result = await service.transcribe(audio, 'english')

    expect(result.isOk()).toBe(true)
    if (result.isOk()) expect(result.value.text).toBe('hello world')

    expect(handleFileMock).toHaveBeenCalledWith(audio)
    expect(predictMock).toHaveBeenCalledWith('/transcribe', [
      { __handled: audio },
      'english',
      'test-api-key',
    ])
  })

  it('parses a JSON-string prediction output', async () => {
    predictMock.mockResolvedValue({
      data: [JSON.stringify({ success: true, text: 'stringified' })],
    })

    const result = await service.transcribe(blobOfSize(500))

    expect(result.isOk()).toBe(true)
    if (result.isOk()) expect(result.value.text).toBe('stringified')
  })

  it('maps a success:false response to a SERVER_ERROR', async () => {
    predictMock.mockResolvedValue({ data: [{ success: false, text: '', error: 'no speech' }] })

    const result = await service.transcribe(blobOfSize(500))

    expect(result.isErr()).toBe(true)
    if (result.isErr()) {
      expect(result.error.code).toBe(ErrorCode.SERVER_ERROR)
      expect(result.error.message).toBe('no speech')
    }
  })

  it('returns VALIDATION_ERROR when the response shape is invalid', async () => {
    predictMock.mockResolvedValue({ data: [{ unexpected: true }] })

    const result = await service.transcribe(blobOfSize(500))

    expect(result.isErr()).toBe(true)
    if (result.isErr()) expect(result.error.code).toBe(ErrorCode.VALIDATION_ERROR)
  })

  it('normalizes a thrown client error and resets the cached client', async () => {
    predictMock.mockRejectedValue(new Error('gradio exploded'))

    const result = await service.transcribe(blobOfSize(500))

    expect(result.isErr()).toBe(true)
    // Next call must reconnect (client was nulled on failure).
    predictMock.mockResolvedValue({ data: [{ success: true, text: 'recovered' }] })
    const retry = await service.transcribe(blobOfSize(500))
    expect(retry.isOk()).toBe(true)
    expect(connectMock).toHaveBeenCalledTimes(2)
  })
})

describe('TranscriptionService.warmUp', () => {
  let service: TranscriptionService

  beforeEach(() => {
    connectMock.mockClear()
    predictMock.mockReset()
    service = new TranscriptionService('http://transcribe.test', 'test-api-key')
  })

  it('returns true when the health endpoint reports healthy', async () => {
    predictMock.mockResolvedValue({ data: [{ status: 'healthy' }] })

    const result = await service.warmUp()

    expect(result.isOk()).toBe(true)
    if (result.isOk()) expect(result.value).toBe(true)
    expect(predictMock).toHaveBeenCalledWith('/health', ['test-api-key'])
  })

  it('returns false when the health endpoint reports non-healthy', async () => {
    predictMock.mockResolvedValue({ data: [{ status: 'starting' }] })

    const result = await service.warmUp()

    expect(result.isOk()).toBe(true)
    if (result.isOk()) expect(result.value).toBe(false)
  })

  it('returns an error when the health check throws', async () => {
    predictMock.mockRejectedValue(new Error('down'))

    const result = await service.warmUp()

    expect(result.isErr()).toBe(true)
  })
})

describe('TranscriptionService.isConfigured', () => {
  it('is true when serviceUrl and apiKey are both present', () => {
    expect(new TranscriptionService('http://svc', 'key').isConfigured()).toBe(true)
  })

  it('is false when apiKey is missing', () => {
    expect(new TranscriptionService('http://svc', '').isConfigured()).toBe(false)
  })
})
