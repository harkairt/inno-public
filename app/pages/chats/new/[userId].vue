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
          @click="
            () => {
              navigateTo('/chats')
            }
          "
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
        <ChatMessagesSkeleton />
      </div>

      <!-- Chat Content -->
      <div
        v-else-if="selectedUser"
        class="flex flex-col h-full min-h-0 overflow-hidden relative"
        @dragenter="onDragEnter"
        @dragleave="onDragLeave"
        @dragover.prevent="onDragOver"
        @drop.prevent="onDrop"
      >
        <FileDropOverlay :visible="isDraggingOver" />
        <div class="relative flex-1 overflow-hidden min-h-0">
          <div
            ref="messagesContainer"
            class="h-full overflow-y-auto py-4 flex flex-col"
          >
            <div
              class="max-w-(--container-chat) mx-auto w-full px-4 md:px-[26px] flex flex-col flex-1"
            >
              <div class="flex-1" />
              <ChatMessages
                :messages="messages"
                :welcome-message="trimmedWelcomeMessage"
                :agent-id="agentId"
                :agent-name="selectedUser.name || selectedUser.email"
                :active-options-message-id="lastUnansweredOptionsMessageId"
                :pending-ids="pendingIds"
                :failed-ids="failedIds"
                @option-submitted="handleOptionSubmitted"
                @retry-message="handleRetryMessage"
                @discard-message="handleDiscardMessage"
              />
            </div>
          </div>
        </div>

        <!-- Typing Indicator -->
        <TypingIndicator
          :typing-users="typingUsers"
          :thinking-agents="thinkingAgents"
        />

        <div class="relative z-10 pointer-events-none">
          <div class="absolute bottom-2 left-0 right-0">
            <ScrollToBottomButton
              :visible="!isAtBottom"
              @click="scrollToBottom()"
            />
          </div>
        </div>

        <MessageInput
          v-if="!isOptionsMode"
          ref="messageInputRef"
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
      <ChatErrorFallback
        :title="t('errors.unexpectedError')"
        :description="getUserFriendlyMessage(error, t('errors.unexpectedCreateError'))"
        :full-screen="true"
        :show-retry="true"
        @retry="clearError"
      />
    </template>
  </NuxtErrorBoundary>
</template>

<script setup lang="ts">
import { useChatSession } from '@/app/composables/useChatQueries'
import { useSendMessage } from '@/app/composables/useChatMutations'
import { useChatMessages } from '@/app/composables/useChatMessages'
import { useTrimmedWelcomeMessage } from '@/app/composables/useTrimmedWelcomeMessage'
import { useFileDrop } from '@/app/composables/useFileDrop'
import { useChatAutoScroll } from '@/app/composables/useChatAutoScroll'
import { useSelectableUsers } from '@/app/composables/useUsers'
import { useAuthStore } from '@/app/stores/auth'
import { useChatStore } from '@/app/stores/chat'
import { useChatActions } from '~/composables/useChatActions'
import { getUserFriendlyMessage } from '@/app/utils/error'
import { generateUUID } from '@/lib/utils/uuid'
import { AIQuestionType } from '@/types/enums'
import type { AiQuestionRequestDTO } from '@/types/api/schemas'
import MessageInput from '@/app/components/chat/MessageInput.vue'
import ChatMessages from '@/app/components/chat/ChatMessages.vue'
import ChatMessagesSkeleton from '@/app/components/chat/ChatMessagesSkeleton.vue'
import ChatErrorFallback from '@/app/components/chat/ChatErrorFallback.vue'
import FileDropOverlay from '@/app/components/chat/FileDropOverlay.vue'
import TypingIndicator from '@/app/components/chat/TypingIndicator.vue'
import ScrollToBottomButton from '@/app/components/chat/ScrollToBottomButton.vue'
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

const { trimmedWelcomeMessage } = useTrimmedWelcomeMessage(agentId, {
  enabled: computed(() => !!selectedUser.value && selectedUser.value.isVirtual === true),
  sessionId: '',
  cacheScope: sessionId,
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

const {
  messages,
  typingUsers,
  thinkingAgents,
  lastUnansweredOptionsMessageId,
  isOptionsMode,
  pendingIds,
  failedIds,
} = useChatMessages(sessionId, sessionData)

watch(
  () => messages.value.length > 0,
  (hasMessages) => {
    if (hasMessages) sessionQueryEnabled.value = true
  },
)

watch(
  () => messages.value.length,
  (newLen, oldLen) => {
    if (oldLen === 0 && newLen > 0) {
      chatStore.clearDraft(`new-${userId.value}`)
      chatStore.skipNextEntranceAnimation = true
      // Let the session page keep showing the agent greeting for this handoff only.
      chatStore.nextSessionIsFreshlyCreated = true
      void navigateTo(`/chats/${sessionId.value}`, { replace: true })
    }
  },
)

// Options message mutation
const optionMutation = useSendMessage()

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
    files: [],
  }
  try {
    await optionMutation.mutateAsync({ request })
    scrollToBottom()
  } catch (error) {
    logger.error('Failed to send option answer:', error)
  }
}

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
const messageInputRef = ref<{ handleDroppedFiles: (files: FileList) => void } | null>(null)

const { isDraggingOver, onDragEnter, onDragLeave, onDragOver, onDrop } = useFileDrop((files) =>
  messageInputRef.value?.handleDroppedFiles(files),
)

const { isAtBottom, scrollToBottom } = useChatAutoScroll(messagesContainer)

const { handleRetryMessage, handleDiscardMessage } = useChatActions(sessionId, scrollToBottom)

function handleError(error: unknown) {
  logger.error('New chat error:', error)
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
