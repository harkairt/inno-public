<template>
  <div class="bg-[hsl(var(--background))] flex-shrink-0">
    <div class="max-w-(--container-chat) mx-auto w-full px-4 md:px-[26px] py-3">
      <form
        class="composer-pill flex flex-col gap-1 rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3 py-2 shadow-md transition-colors focus-within:border-[hsl(var(--primary))]"
        @submit.prevent="handleSubmit"
      >
        <!-- Agent Selection - only show if virtual agents exist -->
        <div
          v-if="virtualAgents.length > 0"
          class="flex items-center gap-2 flex-wrap max-h-[4.5rem] overflow-hidden"
        >
          <UButton
            v-for="agent in virtualAgents"
            :key="agent.id"
            :variant="agent.id === selectedAgentId ? 'solid' : 'soft'"
            :label="agent.name"
            size="sm"
            class="transition-all duration-150 max-w-48 truncate"
            @click="toggleAgent(agent.id)"
          />
        </div>

        <FileAttachmentList
          v-if="!props.disableFileUpload && fileUpload.stagedAttachments.value.length > 0"
          :attachments="fileUpload.stagedAttachments.value"
          @remove="fileUpload.removeAttachment"
          @retry="(id) => fileUpload.retryAttachment(id, props.selectedAgentId ?? props.agentId)"
        />

        <UAlert
          v-if="mutation.isError.value && mutation.error.value"
          color="error"
          variant="soft"
          :title="errorMessage"
          class="mb-2"
        >
          <template #actions>
            <UButton
              size="xs"
              variant="outline"
              @click="retryFailedMessage"
            >
              {{ t('chat.messageInput.retry') }}
            </UButton>
          </template>
        </UAlert>

        <div class="flex items-end gap-2">
          <input
            v-if="!props.disableFileUpload"
            ref="fileInputRef"
            type="file"
            multiple
            :accept="acceptFilter"
            class="hidden"
            data-testid="file-input"
            @change="handleFileSelected"
          />

          <UButton
            v-if="!props.disableFileUpload"
            icon="i-heroicons-paper-clip-20-solid"
            variant="ghost"
            color="neutral"
            size="lg"
            class="shrink-0"
            :disabled="disabled"
            :aria-label="t('chat.messageInput.attachFile')"
            data-testid="attach-file-button"
            @click="triggerFileInput"
          />

          <div
            class="flex-1"
            @keydown="handleKeyDown"
          >
            <UTextarea
              ref="textareaRef"
              v-model="messageText"
              :placeholder="inputPlaceholder"
              :aria-label="inputPlaceholder"
              :rows="1"
              :maxrows="5"
              autoresize
              variant="none"
              size="lg"
              class="w-full"
              :disabled="disabled || isTranscribing"
              data-testid="message-input"
              :ui="{
                root: 'relative flex items-center',
                base: 'placeholder:text-dimmed/70',
              }"
            />
          </div>

          <!-- Voice Recording Button -->
          <div
            v-if="isTranscriptionEnabled && !props.disableVoice"
            class="shrink-0"
            @pointerdown="onMicPointerDown"
            @pointerup="onMicPointerUp"
            @pointerleave="onMicPointerUp"
          >
            <UButton
              :icon="voiceButtonIcon"
              :color="isRecording ? 'error' : 'neutral'"
              :variant="isRecording ? 'solid' : 'ghost'"
              :class="['transition-all', isRecording && 'animate-pulse']"
              :loading="isTranscribing"
              :disabled="disabled || isTranscribing"
              size="lg"
              :aria-label="
                isRecording
                  ? t('chat.messageInput.stopRecording')
                  : t('chat.messageInput.startRecording')
              "
              data-testid="voice-record-button"
              @click="toggleRecording"
            />
          </div>

          <!-- Send Button -->
          <UButton
            type="submit"
            :disabled="disabled || !canSend || isRecording"
            icon="i-heroicons-paper-airplane-20-solid"
            size="lg"
            color="primary"
            class="shrink-0 !rounded-xl"
            :aria-label="t('chat.messageInput.send')"
            data-testid="send-button"
          />
        </div>
      </form>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useSendMessage } from '@/app/composables/useChatMutations'
import { useFileAttachments } from '@/app/composables/useFileAttachments'
import { useAuthStore } from '@/app/stores/auth'
import { useChatStore } from '@/app/stores/chat'
import { useSignalRChat } from '@/app/composables/useSignalRChat'
import { useVoiceRecording } from '@/app/composables/useVoiceRecording'
import { useTranscriptionService } from '@/lib/api/services/TranscriptionService'
import { ALLOWED_EXTENSIONS } from '@/lib/validation/fileAttachment'
import FileAttachmentList from '@/app/components/chat/FileAttachmentList.vue'
import type { AiQuestionRequestDTO, UserDTO } from '@/types/api/schemas'
import { AIQuestionType } from '@/types/enums'
import { watchDebounced } from '@vueuse/core'

const { t } = useI18n()
const toast = useToast()

// Props
interface Props {
  sessionId: string
  agentId: number // Fallback when no agent selected (current user's ID)
  draftKey?: string // Optional override for new sessions (userId-based key)
  members?: string[]
  selectableAgents?: UserDTO[]
  selectedAgentId?: number | undefined // undefined = no selection
  selectedAgentName?: string // Name of selected agent for placeholder
  isNewConversation?: boolean | undefined // true = "How can I help?", false = "Reply...", undefined = messages not loaded yet
  disableSignalR?: boolean
  disableVoice?: boolean
  disableFileUpload?: boolean
  disabled?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  draftKey: undefined,
  members: () => [],
  selectableAgents: () => [],
  selectedAgentId: undefined,
  selectedAgentName: undefined,
  isNewConversation: undefined,
  disableSignalR: false,
  disableVoice: false,
  disableFileUpload: false,
  disabled: false,
})

// Filter to only virtual agents
const virtualAgents = computed(
  () => props.selectableAgents?.filter((agent) => agent.isVirtual) ?? [],
)

// Emits
const emit = defineEmits<{
  messageSent: []
  scrollToBottom: []
  targetAgentChanged: [agentId: number | undefined]
}>()

// Auth store
const authStore = useAuthStore()

// Chat store
const chatStore = useChatStore()

// Compute draft key: use draftKey prop if provided, otherwise sessionId
const effectiveDraftKey = computed(() => props.draftKey ?? props.sessionId)

// SignalR chat hook
const { sendTypingIndicator, sendStoppedTypingIndicator } = useSignalRChat()

// Message state
const messageText = ref('')
const lastFailedMessage = ref<string>('')

// Restore draft from store on mount
onMounted(() => {
  const draft = chatStore.getDraft(effectiveDraftKey.value)
  if (draft) {
    messageText.value = draft
  }
})

watch(
  () => chatStore.composerRequest?.seq,
  (seq) => {
    const request = chatStore.composerRequest
    if (seq === undefined || !request) return

    const currentText = messageText.value.trim()
    messageText.value = currentText ? `${currentText} ${request.text}` : request.text

    chatStore.clearComposerRequest()
    focus()
  },
)

// Typing indicator state
const isTypingActive = ref(false)
let typingTimeoutId: ReturnType<typeof setTimeout> | null = null

const mutation = useSendMessage()

const fileUpload = useFileAttachments()
const fileInputRef = ref<HTMLInputElement | null>(null)
const acceptFilter = ALLOWED_EXTENSIONS.join(',')

function triggerFileInput() {
  fileInputRef.value?.click()
}

function handleFileSelected(event: Event) {
  const input = event.target as HTMLInputElement
  if (!input.files?.length) return

  const targetAgentId = props.selectedAgentId ?? props.agentId
  const { rejected } = fileUpload.attachFiles(input.files, targetAgentId)

  for (const { error } of rejected) {
    toast.add({ title: t(error.message), color: 'error' })
  }

  input.value = ''
}

function handleDroppedFiles(files: FileList) {
  if (props.disableFileUpload) return

  const targetAgentId = props.selectedAgentId ?? props.agentId
  const { rejected } = fileUpload.attachFiles(files, targetAgentId)

  for (const { error } of rejected) {
    toast.add({ title: t(error.message), color: 'error' })
  }
}

const transcriptionService = useTranscriptionService()
const isTranscriptionEnabled = computed(() => transcriptionService.isConfigured())

const {
  isRecording,
  isTranscribing,
  startRecording,
  stopRecording,
  cancelRecording,
  setTranscribing,
  error: voiceError,
} = useVoiceRecording({
  onError: (_err) => {
    // Voice error handled via voiceError watcher + toast
  },
})

// Voice button icon based on state
const voiceButtonIcon = computed(() => {
  if (isTranscribing.value) return 'i-heroicons-arrow-path-20-solid'
  if (isRecording.value) return 'i-heroicons-stop-20-solid'
  return 'i-heroicons-microphone-20-solid'
})

// Long press detection for cancel (500ms)
let longPressTimer: ReturnType<typeof setTimeout> | null = null
const LONG_PRESS_DURATION = 500

function onMicPointerDown() {
  if (isRecording.value) {
    // Start long-press timer for cancel
    longPressTimer = setTimeout(() => {
      cancelRecording()
      toast.add({ title: t('voice.cancelled'), color: 'neutral' })
    }, LONG_PRESS_DURATION)
  }
}

function onMicPointerUp() {
  if (longPressTimer) {
    clearTimeout(longPressTimer)
    longPressTimer = null
  }
}

// Toggle recording on click
async function toggleRecording() {
  if (isRecording.value) {
    const blob = await stopRecording()
    if (blob) {
      await transcribeAudio(blob)
    }
  } else {
    await startRecording()
  }
}

// Transcribe audio and append to input
async function transcribeAudio(blob: Blob) {
  setTranscribing(true)

  try {
    const result = await transcriptionService.transcribe(blob)

    if (result.isOk() && result.value.text.trim()) {
      // Append to existing text with space
      const transcribedText = result.value.text.trim()
      const currentText = messageText.value.trim()
      messageText.value = currentText ? `${currentText} ${transcribedText}` : transcribedText
    } else if (result.isErr()) {
      // Show toast error
      toast.add({
        title: t('voice.transcriptionFailed'),
        description: result.error.message,
        color: 'error',
      })
    }
  } catch {
    toast.add({
      title: t('voice.transcriptionFailed'),
      color: 'error',
    })
  } finally {
    setTranscribing(false)
  }
}

// Watch for voice errors and show toast
watch(voiceError, (errorMsg) => {
  if (errorMsg) {
    // Map error message to i18n key
    let toastTitle = t('voice.recordingFailed')
    if (errorMsg.includes('permission') || errorMsg.includes('NotAllowedError')) {
      toastTitle = t('voice.permissionDenied')
    } else if (errorMsg.includes('not found') || errorMsg.includes('No microphone')) {
      toastTitle = t('voice.noMicrophone')
    } else if (errorMsg.includes('not supported')) {
      toastTitle = t('voice.notSupported')
    }
    toast.add({ title: toastTitle, color: 'error' })
  }
})

// Function: Toggle agent selection
function toggleAgent(agentId: number) {
  // If clicking the already-selected agent, deselect it (return to undefined)
  if (agentId === props.selectedAgentId) {
    emit('targetAgentChanged', undefined)
  } else {
    emit('targetAgentChanged', agentId)
  }
}

const inputPlaceholder = computed(() => {
  if (props.selectedAgentName) {
    return t('chat.messageInput.placeholderWithAgent', { agentName: props.selectedAgentName })
  }
  return t('chat.messageInput.placeholderReply')
})

const canSend = computed(() => {
  const hasText = messageText.value.trim().length > 0
  const hasFiles = fileUpload.stagedAttachments.value.length > 0

  if (!hasText && !hasFiles) return false
  if (fileUpload.hasPendingUploads.value) return false
  if (fileUpload.hasFailedUploads.value) return false

  return true
})

// Computed: Error message
const errorMessage = computed(() => {
  if (!mutation.error.value) return t('chat.messageInput.failedToSend')
  const error = mutation.error.value
  return error instanceof Error ? error.message : t('chat.messageInput.anErrorOccurred')
})

async function handleSubmit() {
  if (props.disabled || !canSend.value) return

  if (!props.disableSignalR) {
    if (typingTimeoutId) clearTimeout(typingTimeoutId)
    if (isTypingActive.value) {
      isTypingActive.value = false
      sendStoppedTypingIndicator(props.sessionId, props.members)
    }
  }

  const trimmedMessage = messageText.value.trim()
  lastFailedMessage.value = trimmedMessage
  messageText.value = ''

  const targetAgentId = props.selectedAgentId ?? props.agentId
  const files = fileUpload.readyFileIds.value
  const request: AiQuestionRequestDTO = {
    userCode: authStore.user?.email ?? '',
    sessionId: props.sessionId,
    agentId: targetAgentId,
    members: props.members,
    question: trimmedMessage,
    group: '',
    pquestionType: AIQuestionType.Text,
    options: [],
    files,
  }

  emit('scrollToBottom')

  try {
    await mutation.mutateAsync(request)

    chatStore.clearDraft(effectiveDraftKey.value)
    fileUpload.clearAttachments()
    lastFailedMessage.value = ''
    emit('messageSent')
  } catch {
    // Error handled by mutation error state; attachments preserved for retry
  }
}

// Retry failed message
function retryFailedMessage() {
  if (lastFailedMessage.value) {
    messageText.value = lastFailedMessage.value
    void handleSubmit()
  }
}

// Handle keyboard shortcuts
function handleKeyDown(event: KeyboardEvent) {
  if (event.key === 'Enter') {
    if (event.ctrlKey || event.metaKey || event.shiftKey) {
      // Ctrl+Enter, Cmd+Enter, or Shift+Enter to add newline (default textarea behavior)
      return
    }
    // Plain Enter to send
    event.preventDefault()
    void handleSubmit()
  }
}

// Watch messageText for changes - typing indicator (only if SignalR enabled)
watch(messageText, (newValue) => {
  // Skip typing indicator logic if SignalR is disabled
  if (props.disableSignalR) return

  if (newValue.trim()) {
    // User is typing
    if (!isTypingActive.value) {
      isTypingActive.value = true
      sendTypingIndicator(props.sessionId, props.members)
    }

    // Reset timeout - stop typing after 3 seconds of no keystrokes
    if (typingTimeoutId) clearTimeout(typingTimeoutId)
    typingTimeoutId = setTimeout(() => {
      isTypingActive.value = false
      sendStoppedTypingIndicator(props.sessionId, props.members)
    }, 3000)
  } else {
    // Empty message - clear typing indicator
    if (typingTimeoutId) clearTimeout(typingTimeoutId)
    if (isTypingActive.value) {
      isTypingActive.value = false
      sendStoppedTypingIndicator(props.sessionId, props.members)
    }
  }
})

// Save draft to store with 500ms debounce
watchDebounced(
  messageText,
  (value) => {
    chatStore.saveDraft(effectiveDraftKey.value, value)
  },
  { debounce: 500 },
)

// Cleanup on unmount (only if SignalR enabled)
onUnmounted(() => {
  if (typingTimeoutId) clearTimeout(typingTimeoutId)
  if (!props.disableSignalR && isTypingActive.value) {
    sendStoppedTypingIndicator(props.sessionId, props.members)
  }
})

// Expose focus method for parent components
const textareaRef = ref<{ textareaRef: HTMLTextAreaElement } | null>(null)

function focus() {
  textareaRef.value?.textareaRef?.focus()
}

defineExpose({ focus, handleDroppedFiles })
</script>
