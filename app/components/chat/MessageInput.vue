<template>
  <div class="border-t border-[hsl(var(--border)/0.5)] bg-[hsl(var(--background))] flex-shrink-0">
    <div class="px-3 py-2">
      <form class="flex flex-col gap-1" @submit.prevent="handleSubmit">
        <!-- Agent Selection - only show if virtual agents exist -->
        <div v-if="virtualAgents.length > 0" class="flex items-center gap-2 flex-wrap">
          <UButton
            v-for="agent in virtualAgents"
            :key="agent.id"
            :variant="agent.id === selectedAgentId ? 'solid' : 'soft'"
            size="sm"
            class="transition-all duration-150"
            @click="toggleAgent(agent.id)"
          >
            {{ agent.name }}
          </UButton>
        </div>

        <!-- Error Message Display -->
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

        <!-- Message Input -->
        <div class="flex items-end gap-2">
          <!-- Input Area -->
          <div class="flex-1">
            <UTextarea
              ref="textareaRef"
              v-model="messageText"
              :placeholder="inputPlaceholder"
              :rows="textareaRows"
              :maxrows="5"
              autoresize
              size="lg"
              class="w-full"
              :disabled="isTranscribing"
              data-testid="message-input"
              :ui="{ root: 'relative flex items-center' }"
              @keydown="handleKeyDown"
            />
          </div>

          <!-- Voice Recording Button -->
          <UButton
            v-if="isTranscriptionEnabled && !props.disableVoice"
            :icon="voiceButtonIcon"
            :color="isRecording ? 'error' : 'neutral'"
            :variant="isRecording ? 'solid' : 'ghost'"
            :class="[
              'shrink-0 transition-all',
              isRecording && 'animate-pulse'
            ]"
            :loading="isTranscribing"
            :disabled="isTranscribing"
            size="lg"
            data-testid="voice-record-button"
            @click="toggleRecording"
            @pointerdown="onMicPointerDown"
            @pointerup="onMicPointerUp"
            @pointerleave="onMicPointerUp"
          />

          <!-- Send Button -->
          <UButton
            type="submit"
            :disabled="!canSend || isRecording"
            icon="i-heroicons-paper-airplane-20-solid"
            size="lg"
            color="primary"
            class="shrink-0"
            data-testid="send-button"
          />
        </div>

        <!-- Helper Text (desktop only) -->
        <div v-if="width >= 1024" class="text-xs text-[hsl(var(--muted-foreground))]">
          {{ t('chat.messageInput.pressEnterToSend') }}
        </div>
      </form>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useSendMessage } from '@/app/composables/useChatMutations'
import { useAuthStore } from '@/app/stores/auth'
import { useChatStore } from '@/app/stores/chat'
import { useSignalRChat } from '@/app/composables/useSignalRChat'
import { useVoiceRecording } from '@/app/composables/useVoiceRecording'
import { useTranscriptionService } from '@/lib/api/services/TranscriptionService'
import type { AiQuestionRequestDTO, UserDTO } from '@/types/api/schemas'
import { AIQuestionType } from '@/types/enums'
import { watchDebounced } from '@vueuse/core'

const { t } = useI18n()
const toast = useToast()

// Props
interface Props {
  sessionId: string
  agentId: number                      // Fallback when no agent selected (current user's ID)
  draftKey?: string                    // Optional override for new sessions (userId-based key)
  members?: string[]
  selectableAgents?: UserDTO[]
  selectedAgentId?: number | undefined // undefined = no selection
  selectedAgentName?: string           // Name of selected agent for placeholder
  isNewConversation?: boolean          // Show "How can I help?" instead of "Reply..."
  disableSignalR?: boolean             // Disable SignalR typing indicators (for public mode)
  disableVoice?: boolean               // Disable voice recording button (for public mode)
}

const props = withDefaults(defineProps<Props>(), {
  draftKey: undefined,
  members: () => [],
  selectableAgents: () => [],
  selectedAgentId: undefined,
  selectedAgentName: undefined,
  isNewConversation: false,
  disableSignalR: false,
  disableVoice: false,
})

// Filter to only virtual agents
const virtualAgents = computed(() =>
  props.selectableAgents?.filter(agent => agent.isVirtual) ?? []
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

// Typing indicator state
const isTypingActive = ref(false)
let typingTimeoutId: ReturnType<typeof setTimeout> | null = null

// Send message mutation
const mutation = useSendMessage()

// Voice recording setup
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
  onError: (err) => {
    console.error('Voice recording error:', err)
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
      messageText.value = currentText
        ? `${currentText} ${transcribedText}`
        : transcribedText
    } else if (result.isErr()) {
      // Show toast error
      toast.add({
        title: t('voice.transcriptionFailed'),
        description: result.error.message,
        color: 'error',
      })
    }
  } catch (error) {
    console.error('Transcription error:', error)
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

// Responsive rows: 1 on mobile, 2 on desktop (lg breakpoint = 1024px)
const { width } = useWindowSize()
const textareaRows = computed(() => width.value >= 1024 ? 3 : 1)

// Function: Toggle agent selection
function toggleAgent(agentId: number) {
  // If clicking the already-selected agent, deselect it (return to undefined)
  if (agentId === props.selectedAgentId) {
    emit('targetAgentChanged', undefined)
  } else {
    emit('targetAgentChanged', agentId)
  }
}

// Dynamic placeholder based on selected agent and conversation state
const inputPlaceholder = computed(() => {
  if (props.selectedAgentName) {
    return t('chat.messageInput.askFromAgent', { name: props.selectedAgentName })
  }
  if (props.isNewConversation) {
    return t('chat.messageInput.placeholderNew')
  }
  return t('chat.messageInput.placeholderReply')
})

// Computed: Can send message
const canSend = computed(() => {
  const trimmed = messageText.value.trim()
  return trimmed.length > 0
})

// Computed: Error message
const errorMessage = computed(() => {
  if (!mutation.error.value) return t('chat.messageInput.failedToSend')
  const error = mutation.error.value
  return error instanceof Error ? error.message : t('chat.messageInput.anErrorOccurred')
})

// Handle form submit
async function handleSubmit() {
  if (!canSend.value) return

  // Clear typing indicator immediately on send (only if SignalR enabled)
  if (!props.disableSignalR) {
    if (typingTimeoutId) clearTimeout(typingTimeoutId)
    if (isTypingActive.value) {
      isTypingActive.value = false
      sendStoppedTypingIndicator(props.sessionId, props.members)
    }
  }

  // Trim and store message, clear input immediately
  const trimmedMessage = messageText.value.trim()
  lastFailedMessage.value = trimmedMessage
  messageText.value = ''

  // Prepare request
  const targetAgentId = props.selectedAgentId ?? props.agentId
  const request: AiQuestionRequestDTO = {
    userCode: authStore.user?.email ?? '',
    sessionId: props.sessionId,
    agentId: targetAgentId,
    members: props.members,
    question: trimmedMessage,
    group: '', // Empty group for regular text messages
    pquestionType: AIQuestionType.Text,
    options: [], // No options for text messages
  }

  // Scroll to bottom immediately when user sends message
  emit('scrollToBottom')

  try {
    // Send message
    await mutation.mutateAsync(request)

    // Clear draft on success (CRITICAL - prevents awkward UX)
    chatStore.clearDraft(effectiveDraftKey.value)

    // Clear failed message tracking on success
    lastFailedMessage.value = ''

    // Emit message sent event after successful send
    emit('messageSent')
  } catch (error) {
    // Error is handled by mutation error state
    // Draft remains in store - user can retry
    console.error('Failed to send message:', error)
  }
}

// Retry failed message
function retryFailedMessage() {
  if (lastFailedMessage.value) {
    messageText.value = lastFailedMessage.value
    handleSubmit()
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
    handleSubmit()
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
  { debounce: 500 }
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

defineExpose({ focus })
</script>
