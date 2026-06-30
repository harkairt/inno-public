<template>
  <NuxtErrorBoundary @error="handleError">
    <div class="flex flex-col h-full w-full">
      <!-- Header Section -->
      <div class="flex items-center gap-3 px-4 py-3 border-b border-border">
        <!-- Mobile: back button to session list -->
        <UButton
          v-if="isMobile"
          icon="i-heroicons-arrow-left"
          variant="ghost"
          color="neutral"
          square
          size="sm"
          :aria-label="t('errors.backToChats')"
          data-testid="back-to-chats"
          @click="navigateTo('/chats')"
        />

        <div
          v-if="selectedUser"
          class="min-w-0 flex-1"
        >
          <h1 class="text-xl font-semibold text-foreground truncate">
            {{ selectedUser.name || selectedUser.email }}
          </h1>
          <p
            v-if="selectedUser?.email"
            class="text-sm text-muted-foreground truncate"
          >
            {{ selectedUser.email }}
          </p>
        </div>
      </div>

      <!-- Loading State -->
      <div
        v-if="isLoadingUsers"
        class="flex items-center justify-center h-full p-4"
      >
        <div class="w-full max-w-md space-y-3 animate-[fade-in_0.4s_ease_both]">
          <div class="flex justify-end">
            <USkeleton
              class="h-12 w-[50%] !bg-[hsl(var(--muted-foreground)/0.08)]"
              style="border-radius: var(--config-message-border-radius)"
            />
          </div>
          <div class="flex justify-start">
            <USkeleton
              class="h-28 w-[70%] !bg-[hsl(var(--muted-foreground)/0.08)]"
              style="border-radius: var(--config-message-border-radius)"
            />
          </div>
        </div>
      </div>

      <!-- Chat Content -->
      <div
        v-else-if="selectedUser"
        class="flex flex-col h-full min-h-0 overflow-hidden"
      >
        <div
          ref="messagesContainer"
          class="flex-1 overflow-y-auto min-h-0 p-4 flex flex-col"
        >
          <div class="flex-1" />
          <ChatMessages
            :messages="messages"
            :welcome-message="trimmedWelcomeMessage"
            :agent-id="agentId"
            :agent-name="selectedUser.name || selectedUser.email"
            :active-options-message-id="lastUnansweredOptionsMessageId"
            @option-submitted="handleOptionSubmitted"
          />
        </div>

        <!-- Typing Indicator -->
        <TypingIndicator :typing-users="typingUsers" />

        <MessageInput
          v-if="!isOptionsMode"
          :session-id="sessionId"
          :draft-key="`new-${userId}`"
          :agent-id="agentId"
          :selected-agent-id="selectedTargetAgentId ?? agentId"
          :selectable-agents="isSingleVirtualAgentSession ? [] : [selectedUser]"
          :selected-agent-name="selectedAgentName"
          :members="members"
          :is-new-conversation="messages.length === 0"
          @scroll-to-bottom="scrollToBottom"
          @target-agent-changed="handleTargetAgentChanged"
        />
      </div>
    </div>
    <!-- Error Boundary Fallback -->
    <template #error="{ error, clearError }">
      <div class="min-h-screen flex items-center justify-center p-6 bg-background">
        <div class="text-center max-w-md">
          <UAlert
            variant="soft"
            :title="t('errors.unexpectedError')"
            :description="getUserFriendlyMessage(error)"
            class="mb-4"
          >
            <template #actions>
              <div class="flex space-x-2">
                <UButton
                  size="xs"
                  variant="outline"
                  @click="clearError"
                >
                  {{ t('errors.tryAgain') }}
                </UButton>
                <UButton
                  size="xs"
                  variant="outline"
                  @click="navigateTo('/chats')"
                >
                  {{ t('errors.backToChats') }}
                </UButton>
              </div>
            </template>
          </UAlert>
        </div>
      </div>
    </template>
  </NuxtErrorBoundary>
</template>

<script setup lang="ts">
import { useWelcomeMessage, useChatSession } from '@/app/composables/useChatQueries'
import { useSendMessage } from '@/app/composables/useChatMutations'
import { useSelectableUsers } from '@/app/composables/useUsers'
import { useAuthStore } from '@/app/stores/auth'
import { useChatStore } from '@/app/stores/chat'
import { generateUUID } from '@/lib/utils/uuid'
import { AIAnswerType, AIQuestionType } from '@/types/enums'
import type { AiQuestionRequestDTO } from '@/types/api/schemas'
import MessageInput from '@/app/components/chat/MessageInput.vue'
import ChatMessages from '@/app/components/chat/ChatMessages.vue'
import TypingIndicator from '@/app/components/chat/TypingIndicator.vue'
import { useNavigationVisibility } from '~/composables/useNavigationVisibility'
import { createLogger } from '@/lib/utils/logger'

const logger = createLogger('NewChat')

const { t } = useI18n()
const { isMobile } = useNavigationVisibility()

const route = useRoute()
const authStore = useAuthStore()
const chatStore = useChatStore()

const userId = computed(() => route.params.userId as string)
const sessionId = ref(generateUUID())

// Register navigation callback for when server confirms the new session
chatStore.onNewSessionConfirmed(sessionId.value, () => {
  chatStore.clearDraft(`new-${userId.value}`)
  chatStore.skipNextEntranceAnimation = true
  void navigateTo(`/chats/${sessionId.value}`, { replace: true })
})

onUnmounted(() => {
  chatStore.removeNewSessionCallback(sessionId.value)
})

const { data: users, isLoading: isLoadingUsers } = useSelectableUsers()

const selectedUser = computed(() => {
  if (!users.value || !userId.value) return null
  return users.value.find((u) => String(u.id) === String(userId.value))
})

watchEffect(() => {
  if (users.value && !selectedUser.value) {
    void navigateTo('/chats', { replace: true })
  }
})

const agentId = computed(() => selectedUser.value?.id ?? 1)

const { data: welcomeMsg } = useWelcomeMessage(agentId, {
  enabled: computed(() => !!selectedUser.value && selectedUser.value.isVirtual === true),
  sessionId: '',
})

const trimmedWelcomeMessage = computed(() => {
  if (!welcomeMsg.value?.message) return undefined
  let msg = welcomeMsg.value.message
  if (msg.startsWith('"') && msg.endsWith('"')) {
    msg = msg.slice(1, -1)
  }
  return msg
})

const members = computed(() => {
  if (!authStore.user?.email || !selectedUser.value?.email) return []
  return [authStore.user.email, selectedUser.value.email]
})

// Session doesn't exist on server until first message is sent.
// Once messages arrive (via optimistic update or SignalR), enable the query so
// subsequent server pushes (milestones) trigger a refetch.
const sessionQueryEnabled = ref(false)
const { data: sessionData } = useChatSession(sessionId.value, {
  enabled: sessionQueryEnabled,
})

const messages = computed(() => {
  const queryMessages = sessionData.value?.messages ?? []
  const failedMessages = chatStore.getFailedMessages(sessionId.value)
  return [...queryMessages, ...failedMessages]
})

watch(
  () => messages.value.length > 0,
  (hasMessages) => {
    if (hasMessages) sessionQueryEnabled.value = true
  },
)

// Options message logic
const optionMutation = useSendMessage()

const lastUnansweredOptionsMessageId = computed(() => {
  const msgs = messages.value
  const userEmail = authStore.user?.email
  for (let i = msgs.length - 1; i >= 0; i--) {
    const msg = msgs[i]
    if (msg?.messageType === AIAnswerType.Options) {
      const hasUserAfter = msgs.slice(i + 1).some((m) => m.senderUserCode === userEmail)
      return hasUserAfter ? undefined : msg.messageID
    }
  }
  return undefined
})

const isOptionsMode = computed(() => !!lastUnansweredOptionsMessageId.value)

async function handleOptionSubmitted(answer: string) {
  const request: AiQuestionRequestDTO = {
    userCode: authStore.user?.email ?? '',
    sessionId: sessionId.value,
    agentId: agentId.value,
    members: members.value,
    question: answer,
    group: '',
    pquestionType: AIQuestionType.Text,
    options: [],
  }
  try {
    await optionMutation.mutateAsync(request)
    scrollToBottom()
  } catch (error) {
    logger.error('Failed to send option answer:', error)
  }
}

// Typing indicator
const typingUsers = computed(() => chatStore.getTypingUsers(sessionId.value))

// Check if single virtual agent session - hide buttons if so
const isSingleVirtualAgentSession = computed(() => {
  return members.value.length === 2 && selectedUser.value?.isVirtual
})

// Selected target agent ID
const selectedTargetAgentId = ref<number | undefined>(undefined)

// Auto-select when single agent
watch(
  [isSingleVirtualAgentSession, selectedUser],
  () => {
    if (isSingleVirtualAgentSession.value && selectedUser.value) {
      selectedTargetAgentId.value = selectedUser.value.id
    }
  },
  { immediate: true },
)

// Handler for agent changes
function handleTargetAgentChanged(agentId: number | undefined) {
  selectedTargetAgentId.value = agentId
}

// Get the name of the currently selected agent (for placeholder text)
const selectedAgentName = computed(() => {
  if (!selectedTargetAgentId.value || !selectedUser.value) {
    return undefined
  }
  return selectedUser.value.name
})

const messagesContainer = ref<HTMLElement | null>(null)

function scrollToBottom() {
  void nextTick(() => {
    if (messagesContainer.value) {
      messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight
    }
  })
}

function handleError(error: unknown) {
  logger.error('New chat error:', error)
}

function getUserFriendlyMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message
  }
  return t('errors.unexpectedCreateError')
}

definePageMeta({
  description: 'Start a new conversation',
  key: (route) => route.fullPath,
})

useSeoMeta({
  title: 'New Chat',
  description: 'Start a new conversation',
})
</script>
