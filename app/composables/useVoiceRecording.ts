/**
 * Voice Recording Composable
 * Handles audio recording using MediaRecorder API with cross-browser support
 */

export type VoiceRecordingState = 'idle' | 'recording' | 'transcribing'

export interface UseVoiceRecordingOptions {
  onError?: (error: Error) => void
}

export function useVoiceRecording(options: UseVoiceRecordingOptions = {}) {
  const { onError } = options

  // State
  const state = ref<VoiceRecordingState>('idle')
  const audioBlob = ref<Blob | null>(null)
  const error = ref<string | null>(null)
  const isSupported = ref(true)

  // Internal
  let mediaRecorder: MediaRecorder | null = null
  let audioChunks: Blob[] = []
  let stream: MediaStream | null = null

  // Computed
  const isIdle = computed(() => state.value === 'idle')
  const isRecording = computed(() => state.value === 'recording')
  const isTranscribing = computed(() => state.value === 'transcribing')
  const canRecord = computed(() => isSupported.value && state.value === 'idle')

  /**
   * Check browser support for MediaRecorder
   */
  function checkSupport(): boolean {
    if (import.meta.server) return false
    if (typeof navigator === 'undefined') return false
    if (!navigator.mediaDevices?.getUserMedia) return false
    if (typeof MediaRecorder === 'undefined') return false
    return true
  }

  /**
   * Get supported MIME type for audio recording
   * Priority: WebM for Chrome/Firefox, MP4 for Safari/iOS
   */
  function getSupportedMimeType(): string {
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

  /**
   * Request microphone permission and start recording
   */
  async function startRecording(): Promise<void> {
    if (!checkSupport()) {
      isSupported.value = false
      error.value = 'Voice recording is not supported in this browser'
      onError?.(new Error(error.value))
      return
    }

    const mimeType = getSupportedMimeType()
    if (!mimeType) {
      error.value = 'No supported audio format found'
      onError?.(new Error(error.value))
      return
    }

    try {
      error.value = null
      audioChunks = []

      // Request microphone access with audio optimization
      stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      })

      mediaRecorder = new MediaRecorder(stream, { mimeType })

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunks.push(event.data)
        }
      }

      mediaRecorder.onerror = () => {
        const err = new Error('Recording failed')
        error.value = err.message
        onError?.(err)
        cleanup()
        state.value = 'idle'
      }

      // Start recording - collect data every 100ms
      mediaRecorder.start(100)
      state.value = 'recording'
    } catch (err) {
      handlePermissionError(err)
      state.value = 'idle'
    }
  }

  /**
   * Handle permission and access errors with specific messages
   */
  function handlePermissionError(err: unknown): void {
    if (err instanceof DOMException) {
      switch (err.name) {
        case 'NotAllowedError':
          error.value = 'Microphone permission denied'
          break
        case 'NotFoundError':
          error.value = 'No microphone found'
          break
        case 'NotSupportedError':
          error.value = 'Voice recording not supported'
          break
        case 'NotReadableError':
          error.value = 'Microphone is in use by another application'
          break
        default:
          error.value = 'Failed to access microphone'
      }
    } else {
      error.value = 'Failed to access microphone'
    }
    onError?.(err instanceof Error ? err : new Error(error.value))
  }

  /**
   * Stop recording and return audio blob
   */
  async function stopRecording(): Promise<Blob | null> {
    return new Promise((resolve) => {
      if (!mediaRecorder || state.value !== 'recording') {
        resolve(null)
        return
      }

      mediaRecorder.onstop = () => {
        const mimeType = mediaRecorder?.mimeType ?? 'audio/webm'
        const blob = new Blob(audioChunks, { type: mimeType })
        audioBlob.value = blob
        cleanup()
        state.value = 'idle'
        resolve(blob)
      }

      mediaRecorder.stop()
    })
  }

  /**
   * Cancel recording without returning blob (for long-press cancel)
   */
  function cancelRecording(): void {
    if (mediaRecorder && state.value === 'recording') {
      // Override onstop to prevent returning blob
      mediaRecorder.onstop = () => {
        cleanup()
        state.value = 'idle'
      }
      mediaRecorder.stop()
    } else {
      cleanup()
      state.value = 'idle'
    }
    audioBlob.value = null
  }

  /**
   * Set transcribing state (for external control)
   */
  function setTranscribing(value: boolean): void {
    state.value = value ? 'transcribing' : 'idle'
  }

  /**
   * Cleanup resources
   */
  function cleanup(): void {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop())
      stream = null
    }
    mediaRecorder = null
    audioChunks = []
  }

  // Check support on init (client-side only)
  if (import.meta.client) {
    isSupported.value = checkSupport()
  }

  // Cleanup on unmount
  onUnmounted(() => {
    cancelRecording()
  })

  return {
    // State
    state,
    audioBlob,
    error,
    isSupported,

    // Computed
    isIdle,
    isRecording,
    isTranscribing,
    canRecord,

    // Methods
    startRecording,
    stopRecording,
    cancelRecording,
    setTranscribing,
  }
}
