<template>
  <div class="border-t border-[hsl(var(--border))] bg-[hsl(var(--background))] flex-shrink-0">
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
              v-model="messageText"
              :placeholder="inputPlaceholder"
              :rows="textareaRows"
              :maxrows="5"
              autoresize
              size="lg"
              class="w-full"
              data-testid="message-input"
              :ui="{ root: 'relative flex items-center' }"
              @keydown="handleKeyDown"
            />
          </div>

          <!-- Send Button -->
          <UButton
            type="submit"
            :disabled="!canSend"
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
import { useSignalRChat } from '@/app/composables/useSignalRChat'
import type { AiQuestionRequestDTO, UserDTO } from '@/types/api/schemas'
import { AIQuestionType } from '@/types/enums'

const { t } = useI18n()

// Props
interface Props {
  sessionId: string
  agentId: number                      // Fallback when no agent selected (current user's ID)
  members?: string[]
  selectableAgents?: UserDTO[]
  selectedAgentId?: number | undefined // undefined = no selection
  selectedAgentName?: string           // Name of selected agent for placeholder
}

const props = withDefaults(defineProps<Props>(), {
  members: () => [],
  selectableAgents: () => [],
  selectedAgentId: undefined,
  selectedAgentName: undefined
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

// SignalR chat hook
const { sendTypingIndicator, sendStoppedTypingIndicator } = useSignalRChat()

// Message state
const messageText = ref('')
const lastFailedMessage = ref<string>('')

// Typing indicator state
const isTypingActive = ref(false)
let typingTimeoutId: ReturnType<typeof setTimeout> | null = null

// Send message mutation
const mutation = useSendMessage()

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

// Dynamic placeholder based on selected agent
const inputPlaceholder = computed(() => {
  if (props.selectedAgentName) {
    return t('chat.messageInput.askFromAgent', { name: props.selectedAgentName })
  }
  return t('chat.messageInput.placeholder')
})

// Computed: Can send message
const canSend = computed(() => {
  const trimmed = messageText.value.trim()
  return trimmed.length > 0
})

// Computed: Error message
const errorMessage = computed(() => {
  if (!mutation.error.value) return t('chat.messageInput.failedToSend')
  const error = mutation.error.value as any
  return error.message || t('chat.messageInput.anErrorOccurred')
})

// Handle form submit
async function handleSubmit() {
  if (!canSend.value) return

  // Clear typing indicator immediately on send
  if (typingTimeoutId) clearTimeout(typingTimeoutId)
  if (isTypingActive.value) {
    isTypingActive.value = false
    sendStoppedTypingIndicator(props.sessionId)
  }

  // Trim and store message, clear input immediately
  const trimmedMessage = messageText.value.trim()
  lastFailedMessage.value = trimmedMessage
  messageText.value = ''

  // Prepare request
  const targetAgentId = props.selectedAgentId ?? props.agentId
  const request: AiQuestionRequestDTO = {
    userCode: authStore.user?.email || '',
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

    // Clear failed message tracking on success
    lastFailedMessage.value = ''

    // Emit message sent event after successful send
    emit('messageSent')
  } catch (error) {
    // Error is handled by mutation error state
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

// Watch messageText for changes - typing indicator
watch(messageText, (newValue) => {
  if (newValue.trim()) {
    // User is typing
    if (!isTypingActive.value) {
      isTypingActive.value = true
      sendTypingIndicator(props.sessionId)
    }

    // Reset timeout - stop typing after 3 seconds of no keystrokes
    if (typingTimeoutId) clearTimeout(typingTimeoutId)
    typingTimeoutId = setTimeout(() => {
      isTypingActive.value = false
      sendStoppedTypingIndicator(props.sessionId)
    }, 3000)
  } else {
    // Empty message - clear typing indicator
    if (typingTimeoutId) clearTimeout(typingTimeoutId)
    if (isTypingActive.value) {
      isTypingActive.value = false
      sendStoppedTypingIndicator(props.sessionId)
    }
  }
})

// Cleanup on unmount
onUnmounted(() => {
  if (typingTimeoutId) clearTimeout(typingTimeoutId)
  if (isTypingActive.value) {
    sendStoppedTypingIndicator(props.sessionId)
  }
})
</script>
