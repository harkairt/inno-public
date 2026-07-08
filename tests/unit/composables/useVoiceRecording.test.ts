/**
 * Unit tests for useVoiceRecording. happy-dom has no MediaRecorder / getUserMedia,
 * so both are faked: a MediaRecorder class fake driving the
 * ondataavailable/onstop lifecycle, and a getUserMedia stub for the permission
 * paths. The composable registers onUnmounted, so it is exercised inside a mounted
 * component.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { defineComponent } from 'vue'
import { mount } from '@vue/test-utils'
import { useVoiceRecording } from '@/app/composables/useVoiceRecording'

class FakeMediaRecorder {
  static isTypeSupported = vi.fn(() => true)
  static latest: FakeMediaRecorder | null = null

  ondataavailable: ((e: { data: Blob }) => void) | null = null
  onstop: (() => void) | null = null
  onerror: (() => void) | null = null
  mimeType: string
  state: 'inactive' | 'recording' = 'inactive'

  constructor(_stream: unknown, opts?: { mimeType?: string }) {
    this.mimeType = opts?.mimeType ?? 'audio/webm'
    FakeMediaRecorder.latest = this
  }

  start(_timeslice?: number) {
    this.state = 'recording'
    this.ondataavailable?.({ data: new Blob(['abc'], { type: this.mimeType }) })
  }

  stop() {
    this.state = 'inactive'
    this.onstop?.()
  }
}

const trackStop = vi.fn()
function makeStream() {
  return { getTracks: () => [{ stop: trackStop }] } as unknown as MediaStream
}

function setMediaDevices(getUserMedia: unknown) {
  Object.defineProperty(navigator, 'mediaDevices', {
    value: getUserMedia ? { getUserMedia } : undefined,
    configurable: true,
  })
}

function mountComposable(onError?: (e: Error) => void) {
  let api!: ReturnType<typeof useVoiceRecording>
  const Comp = defineComponent({
    setup() {
      api = useVoiceRecording(onError ? { onError } : {})
      return () => null
    },
  })
  const wrapper = mount(Comp)
  return { api, wrapper }
}

beforeEach(() => {
  vi.stubGlobal('MediaRecorder', FakeMediaRecorder)
  FakeMediaRecorder.isTypeSupported.mockReturnValue(true)
  trackStop.mockClear()
})

afterEach(() => {
  vi.unstubAllGlobals()
  Object.defineProperty(navigator, 'mediaDevices', { value: undefined, configurable: true })
})

describe('useVoiceRecording — supported browser', () => {
  it('reports supported when mediaDevices + MediaRecorder are present', () => {
    setMediaDevices(vi.fn())
    const { api } = mountComposable()
    expect(api.isSupported.value).toBe(true)
    expect(api.canRecord.value).toBe(true)
    expect(api.isIdle.value).toBe(true)
  })

  it('records: permission granted → recording → stop assembles a blob', async () => {
    setMediaDevices(vi.fn(async () => makeStream()))
    const { api } = mountComposable()

    await api.startRecording()
    expect(api.isRecording.value).toBe(true)
    expect(api.error.value).toBeNull()

    const blob = await api.stopRecording()

    expect(blob).toBeInstanceOf(Blob)
    expect(blob!.size).toBeGreaterThan(0)
    expect(api.audioBlob.value?.size).toBe(blob!.size)
    expect(api.isIdle.value).toBe(true)
    expect(trackStop).toHaveBeenCalled() // stream tracks cleaned up
  })

  it('stopRecording resolves null when not recording', async () => {
    setMediaDevices(vi.fn(async () => makeStream()))
    const { api } = mountComposable()

    expect(await api.stopRecording()).toBeNull()
  })

  it('setTranscribing toggles the transcribing state', () => {
    setMediaDevices(vi.fn(async () => makeStream()))
    const { api } = mountComposable()

    api.setTranscribing(true)
    expect(api.isTranscribing.value).toBe(true)
    api.setTranscribing(false)
    expect(api.isIdle.value).toBe(true)
  })

  it('cancelRecording while recording tears down and clears the blob', async () => {
    setMediaDevices(vi.fn(async () => makeStream()))
    const { api } = mountComposable()

    await api.startRecording()
    expect(api.isRecording.value).toBe(true)

    api.cancelRecording()

    expect(api.isIdle.value).toBe(true)
    expect(api.audioBlob.value).toBeNull()
    expect(trackStop).toHaveBeenCalled()
  })

  it('surfaces a MediaRecorder onerror as an error and returns to idle', async () => {
    setMediaDevices(vi.fn(async () => makeStream()))
    const onError = vi.fn()
    const { api } = mountComposable(onError)

    await api.startRecording()
    expect(api.isRecording.value).toBe(true)

    // Fire the error callback the composable wired onto the live recorder.
    FakeMediaRecorder.latest!.onerror!()

    expect(api.error.value).toBe('Recording failed')
    expect(api.isIdle.value).toBe(true)
    expect(onError).toHaveBeenCalled()
    expect(trackStop).toHaveBeenCalled()
  })

  it('errors when no audio mime type is supported', async () => {
    FakeMediaRecorder.isTypeSupported.mockReturnValue(false)
    setMediaDevices(vi.fn(async () => makeStream()))
    const onError = vi.fn()
    const { api } = mountComposable(onError)

    await api.startRecording()

    expect(api.error.value).toBe('No supported audio format found')
    expect(api.isRecording.value).toBe(false)
    expect(onError).toHaveBeenCalled()
  })
})

describe('useVoiceRecording — permission denied', () => {
  it('sets a permission error and stays idle, without crashing', async () => {
    const denial = new DOMException('denied', 'NotAllowedError')
    setMediaDevices(vi.fn(async () => Promise.reject(denial)))
    const onError = vi.fn()
    const { api } = mountComposable(onError)

    await api.startRecording()

    expect(api.error.value).toBe('Microphone permission denied')
    expect(api.isIdle.value).toBe(true)
    expect(onError).toHaveBeenCalledWith(denial)
  })
})

describe('useVoiceRecording — permission error mapping', () => {
  it.each([
    ['NotFoundError', 'No microphone found'],
    ['NotSupportedError', 'Voice recording not supported'],
    ['NotReadableError', 'Microphone is in use by another application'],
    ['SomeOtherError', 'Failed to access microphone'],
  ])('maps DOMException %s to "%s"', async (name, message) => {
    setMediaDevices(vi.fn(async () => Promise.reject(new DOMException('x', name))))
    const { api } = mountComposable()

    await api.startRecording()

    expect(api.error.value).toBe(message)
    expect(api.isIdle.value).toBe(true)
  })

  it('maps a non-DOMException rejection to the generic message', async () => {
    setMediaDevices(vi.fn(async () => Promise.reject(new Error('boom'))))
    const onError = vi.fn()
    const { api } = mountComposable(onError)

    await api.startRecording()

    expect(api.error.value).toBe('Failed to access microphone')
    expect(onError).toHaveBeenCalled()
  })

  it('cancelRecording while idle is a no-op that stays idle', () => {
    setMediaDevices(vi.fn(async () => makeStream()))
    const { api } = mountComposable()

    api.cancelRecording()

    expect(api.isIdle.value).toBe(true)
    expect(api.audioBlob.value).toBeNull()
  })
})

describe('useVoiceRecording — unsupported browser', () => {
  it('reports unsupported and errors on start when mediaDevices is missing', async () => {
    setMediaDevices(undefined)
    const onError = vi.fn()
    const { api } = mountComposable(onError)

    expect(api.isSupported.value).toBe(false)
    expect(api.canRecord.value).toBe(false)

    await api.startRecording()

    expect(api.error.value).toBe('Voice recording is not supported in this browser')
    expect(api.isRecording.value).toBe(false)
    expect(onError).toHaveBeenCalled()
  })
})
