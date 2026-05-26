/**
 * Voice Recording Composable
 * Handles audio recording using MediaRecorder API with cross-browser support
 */

export type VoiceRecordingState = 'idle' | 'recording' | 'transcribing'

export interface UseVoiceRecordingOptions {
  onError?: (error: Error) => void
}

// --- Voice recording helpers ---

function checkMediaRecorderSupport(): boolean {
  if (import.meta.server) return false
  if (typeof navigator === 'undefined') return false
  if (!navigator.mediaDevices?.getUserMedia) return false
  if (typeof MediaRecorder === 'undefined') return false
  return true
}

function getSupportedAudioMimeType(): string {
  if (import.meta.server) return ''

  const types = [
    'audio/webm;codecs=opus', // Chrome, Firefox, Edge
    'audio/webm', // Fallback WebM
    'audio/mp4', // Safari, iOS Safari
    'audio/ogg;codecs=opus', // Firefox fallback
    'audio/wav', // Universal fallback
  ]

  for (const type of types) {
    if (MediaRecorder.isTypeSupported(type)) {
      return type
    }
  }

  return '' // No supported type
}

function resolvePermissionError(err: unknown): string {
  if (err instanceof DOMException) {
    switch (err.name) {
      case 'NotAllowedError':
        return 'Microphone permission denied'
      case 'NotFoundError':
        return 'No microphone found'
      case 'NotSupportedError':
        return 'Voice recording not supported'
      case 'NotReadableError':
        return 'Microphone is in use by another application'
      default:
        return 'Failed to access microphone'
    }
  }
  return 'Failed to access microphone'
}

function cleanupMediaStream(stream: MediaStream | null): void {
  if (stream) {
    stream.getTracks().forEach((track) => track.stop())
  }
}

interface RecordingContext {
  state: Ref<VoiceRecordingState>
  audioBlob: Ref<Blob | null>
  error: Ref<string | null>
  isSupported: Ref<boolean>
  onError?: (error: Error) => void
  mediaRecorder: MediaRecorder | null
  audioChunks: Blob[]
  stream: MediaStream | null
}

function cleanupCtx(ctx: RecordingContext): void {
  cleanupMediaStream(ctx.stream)
  ctx.stream = null
  ctx.mediaRecorder = null
  ctx.audioChunks = []
}

async function performStartRecording(ctx: RecordingContext): Promise<void> {
  if (!checkMediaRecorderSupport()) {
    ctx.isSupported.value = false
    ctx.error.value = 'Voice recording is not supported in this browser'
    ctx.onError?.(new Error(ctx.error.value))
    return
  }

  const mimeType = getSupportedAudioMimeType()
  if (!mimeType) {
    ctx.error.value = 'No supported audio format found'
    ctx.onError?.(new Error(ctx.error.value))
    return
  }

  try {
    ctx.error.value = null
    ctx.audioChunks = []
    ctx.stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
    })
    ctx.mediaRecorder = new MediaRecorder(ctx.stream, { mimeType })
    ctx.mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) ctx.audioChunks.push(event.data)
    }
    ctx.mediaRecorder.onerror = () => {
      const err = new Error('Recording failed')
      ctx.error.value = err.message
      ctx.onError?.(err)
      cleanupCtx(ctx)
      ctx.state.value = 'idle'
    }
    ctx.mediaRecorder.start(100)
    ctx.state.value = 'recording'
  } catch (err) {
    ctx.error.value = resolvePermissionError(err)
    ctx.onError?.(err instanceof Error ? err : new Error(ctx.error.value))
    ctx.state.value = 'idle'
  }
}

function performStopRecording(ctx: RecordingContext): Promise<Blob | null> {
  return new Promise((resolve) => {
    if (!ctx.mediaRecorder || ctx.state.value !== 'recording') {
      resolve(null)
      return
    }
    ctx.mediaRecorder.onstop = () => {
      const mt = ctx.mediaRecorder?.mimeType ?? 'audio/webm'
      const blob = new Blob(ctx.audioChunks, { type: mt })
      ctx.audioBlob.value = blob
      cleanupCtx(ctx)
      ctx.state.value = 'idle'
      resolve(blob)
    }
    ctx.mediaRecorder.stop()
  })
}

function performCancelRecording(ctx: RecordingContext): void {
  if (ctx.mediaRecorder && ctx.state.value === 'recording') {
    ctx.mediaRecorder.onstop = () => {
      cleanupCtx(ctx)
      ctx.state.value = 'idle'
    }
    ctx.mediaRecorder.stop()
  } else {
    cleanupCtx(ctx)
    ctx.state.value = 'idle'
  }
  ctx.audioBlob.value = null
}

export function useVoiceRecording(options: UseVoiceRecordingOptions = {}) {
  const ctx: RecordingContext = {
    state: ref<VoiceRecordingState>('idle'),
    audioBlob: ref<Blob | null>(null),
    error: ref<string | null>(null),
    isSupported: ref(true),
    onError: options.onError,
    mediaRecorder: null,
    audioChunks: [],
    stream: null,
  }

  const isIdle = computed(() => ctx.state.value === 'idle')
  const isRecording = computed(() => ctx.state.value === 'recording')
  const isTranscribing = computed(() => ctx.state.value === 'transcribing')
  const canRecord = computed(() => ctx.isSupported.value && ctx.state.value === 'idle')

  if (import.meta.client) {
    ctx.isSupported.value = checkMediaRecorderSupport()
  }

  onUnmounted(() => performCancelRecording(ctx))

  return {
    state: ctx.state,
    audioBlob: ctx.audioBlob,
    error: ctx.error,
    isSupported: ctx.isSupported,
    isIdle,
    isRecording,
    isTranscribing,
    canRecord,
    startRecording: () => performStartRecording(ctx),
    stopRecording: () => performStopRecording(ctx),
    cancelRecording: () => performCancelRecording(ctx),
    setTranscribing: (value: boolean) => {
      ctx.state.value = value ? 'transcribing' : 'idle'
    },
  }
}
