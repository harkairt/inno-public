<template>
  <NuxtErrorBoundary @error="handleError">
    <main id="main-content" class="flex flex-col h-full w-full">
    <!-- Header Section -->
    <div class="flex items-center gap-3 px-4 py-3 border-b border-[hsl(var(--border)/0.5)] min-h-[73px]">
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

      <div v-if="session" class="min-w-0 flex-1 group">
        <!-- View mode: title + pencil icon (pencil hidden for primary sessions) -->
        <div v-if="!isEditingTitle" class="flex items-center gap-2">
          <h1 class="text-xl font-semibold text-foreground truncate" data-testid="session-title">
            {{ isPrimarySession ? otherMemberName : session.sessionName }}
          </h1>
          <button
            v-if="!isPrimarySession"
            type="button"
            class="opacity-0 group-hover:opacity-100 transition-opacity text-foreground hover:bg-[hsl(var(--accent))] rounded-md flex-shrink-0"
            :aria-label="t('chat.sessionMenu.editName')"
            data-testid="edit-title-button"
            @click="startEditingTitle"
          >
            <UIcon name="i-lucide-pencil" class="size-4" />
          </button>
        </div>

        <!-- Edit mode: input field -->
        <input
          v-else
          ref="titleInputRef"
          v-model="editedTitle"
          type="text"
          class="text-xl font-semibold text-foreground bg-transparent border-none outline-none w-full p-0 m-0 focus:ring-0"
          data-testid="session-title-input"
          :disabled="isUpdatingTitle"
          @keydown="handleTitleKeydown"
          @blur="saveTitle"
        >

        <p v-if="otherParticipantNames" class="text-sm text-muted-foreground truncate">
          {{ otherParticipantNames }}
        </p>
      </div>

      <!-- Shimmer skeleton fallback when session data isn't available yet -->
      <div v-else class="min-w-0 flex-1 space-y-2">
        <USkeleton class="h-6 w-48" />
        <USkeleton class="h-4 w-32" />
      </div>

      <!-- Session Members Avatar Stack (hidden for primary sessions) -->
      <SessionMembers
        v-if="session && session.members.length > 0 && selectableUsers && !isPrimarySession"
        :members="session.members"
        :selectable-users="selectableUsers"
      />

      <!-- Manage Session Members Button (hidden for primary sessions) -->
      <ManageSessionUsers
        v-if="session && !isPrimarySession"
        :session-id="session.sessionId"
        :agent-id="session.agentId"
        :members="session.members"
      />

      <!-- Create new session button (shown only for primary sessions) -->
      <UButton
        v-if="session && isPrimarySession && otherMemberId"
        icon="i-heroicons-plus"
        variant="ghost"
        color="neutral"
        size="sm"
        :aria-label="t('chat.createNewSession')"
        data-testid="create-new-session-button"
        @click="navigateTo(`/chats/new/${otherMemberId}`)"
      />
    </div>

    <!-- Loading State -->
    <div v-if="isLoading" class="flex items-center justify-center h-full">
      <div class="text-center">
        <USkeleton class="h-8 w-64 mb-4 mx-auto" />
        <div class="space-y-3 max-w-md mx-auto">
          <USkeleton class="h-16 w-full" />
          <USkeleton class="h-16 w-3/4 ml-auto" />
          <USkeleton class="h-16 w-full" />
        </div>
      </div>
    </div>

    <!-- Error State -->
    <div v-else-if="isError" class="flex items-center justify-center p-6 h-full">
      <div class="text-center max-w-md">
        <UAlert
          variant="soft"
          :title="t('errors.sessionNotFound')"
          :description="errorMessage"
          class="mb-4"
        >
          <template #actions>
            <div class="flex space-x-2">
              <UButton
                size="xs"
                variant="outline"
                @click="refetch()"
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

    <!-- Chat Content -->
    <div v-else-if="session" class="flex flex-col h-full min-h-0">
      <div class="relative flex-1 overflow-hidden min-h-0">
        <div ref="messagesContainer" class="h-full overflow-y-auto p-4 flex flex-col">
          <div class="flex-1" />
          <Transition name="fade" mode="out-in" @after-enter="onMessagesEntered">
            <!-- Show bubble-shaped skeletons while waiting for real data -->
            <div v-if="!isMessagesReady" key="shimmer" class="space-y-3">
              <div class="flex justify-start" :style="{ animation: 'fade-in 0.5s ease 1.2s both' }">
                <USkeleton class="h-32 w-[70%] rounded-2xl rounded-bl-md" />
              </div>
              <div class="flex justify-end" :style="{ animation: 'fade-in 0.5s ease 0.9s both' }">
                <USkeleton class="h-24 w-[55%] rounded-2xl rounded-br-md" />
              </div>
              <div class="flex justify-start" :style="{ animation: 'fade-in 0.5s ease 0.6s both' }">
                <USkeleton class="h-40 w-[65%] rounded-2xl rounded-bl-md" />
              </div>
              <div class="flex justify-start" :style="{ animation: 'fade-in 0.5s ease 0.3s both' }">
                <USkeleton class="h-20 w-[45%] rounded-2xl rounded-bl-md" />
              </div>
              <div class="flex justify-end" :style="{ animation: 'fade-in 0.5s ease both' }">
                <USkeleton class="h-28 w-[60%] rounded-2xl rounded-br-md" />
              </div>
            </div>
            <ChatMessages
              v-else
              key="messages"
              :messages="messages"
              :welcome-message="trimmedWelcomeMessage"
              :agent-id="session?.agentId ?? virtualAgentFromSecondMessage?.agentId"
              :agent-name="virtualAgentFromSecondMessage?.agentName"
              :welcome-message-date="virtualAgentFromSecondMessage?.firstMessageDate"
              :active-options-message-id="lastUnansweredOptionsMessageId"
              @option-submitted="handleOptionSubmitted"
            />
          </Transition>
        </div>
        <!-- Bottom fade gradient -->
        <div class="absolute bottom-0 left-0 right-0 h-2 bg-gradient-to-t from-[hsl(var(--background))] to-transparent pointer-events-none" />
      </div>

      <!-- Typing Indicator - fixed height, doesn't push messages -->
      <TypingIndicator :typing-users="typingUsers" />

      <MessageInput
        v-if="!isOptionsMode"
        ref="messageInputRef"
        :session-id="sessionId"
        :agent-id="authStore.user?.id || 1"
        :selected-agent-id="selectedTargetAgentId"
        :selectable-agents="isSingleVirtualAgentSession ? [] : selectableTargetAgents"
        :selected-agent-name="selectedAgentName"
        :members="session.members || []"
        :is-new-conversation="isPlaceholderData ? undefined : messages.length === 0"
        class="flex-shrink-0 sticky bottom-0"
        @message-sent="handleMessageSent"
        @scroll-to-bottom="scrollToBottom"
        @target-agent-changed="handleTargetAgentChanged"
      />
    </div>

    <!-- Session Not Found -->
    <div v-else class="flex items-center justify-center p-6 h-full">
      <div class="text-center max-w-md">
        <UAlert
          variant="soft"
          :title="t('errors.sessionNotFound')"
          :description="t('errors.accessDenied')"
          class="mb-4"
        >
          <template #actions>
            <UButton
              size="xs"
              variant="outline"
              @click="navigateTo('/chats')"
            >
              {{ t('errors.backToChats') }}
            </UButton>
          </template>
        </UAlert>
      </div>
    </div>

    </main>
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
import { useChatSession, useChatSessions, useWelcomeMessage } from '@/app/composables/useChatQueries'
import { useMarkMessagesRead, useUpdateSessionName, useSendMessage } from '@/app/composables/useChatMutations'
import { useSelectableUsers } from '@/app/composables/useUsers'
import { useAuthStore } from '@/app/stores/auth'
import { useChatStore } from '@/app/stores/chat'
import { useNavigationVisibility } from '~/composables/useNavigationVisibility'
import { usePrimarySession } from '@/app/composables/usePrimarySession'
import { AIAnswerType, AIQuestionType } from '@/types/enums'
import type { AiQuestionRequestDTO } from '@/types/api/schemas'
import { useChatAutoScroll } from '@/app/composables/useChatAutoScroll'
import MessageInput from '@/app/components/chat/MessageInput.vue'
import SessionMembers from '@/app/components/chat/SessionMembers.vue'
import ManageSessionUsers from '@/app/components/chat/ManageSessionUsers.vue'
import TypingIndicator from '@/app/components/chat/TypingIndicator.vue'

const { t } = useI18n()

const route = useRoute()
const sessionId = route.params.sessionId as string

const authStore = useAuthStore()
const chatStore = useChatStore()

// Navigation visibility for mobile detection
const { isMobile } = useNavigationVisibility()

// Messages container ref for scrolling
const messagesContainer = ref<HTMLElement | null>(null)

// Message input ref for focus control
const messageInputRef = ref<{ focus: () => void } | null>(null)

// Chat auto-scroll composable
const { isAtBottom, scrollToBottom, scrollToElement } = useChatAutoScroll(
  messagesContainer,
  { bottomThreshold: 50, smooth: true }
)

// Track if user was at bottom when they sent their message
// Used to decide scroll behavior when AI responds
const wasAtBottomWhenUserSentMessage = ref(true)

// Track whether initial scroll-to-bottom has happened (prevents duplicate scrolls)
const hasInitiallyScrolled = ref(false)

// Inline edit state
const isEditingTitle = ref(false)
const editedTitle = ref('')
const titleInputRef = ref<HTMLInputElement | null>(null)

// Fetch session with messages
// The composable handles enabled logic internally (auth + sessionId check)
const {
  data: session,
  isLoading,
  isError,
  isPlaceholderData,
  error: chatError,
  refetch,
} = useChatSession(sessionId)

// Fetch all sessions for primary session detection
const { data: allSessions } = useChatSessions()

// Mark messages as read mutation
const { mutate: markMessagesRead } = useMarkMessagesRead()

// Update session name mutation
const { mutate: updateSessionName, isPending: isUpdatingTitle } = useUpdateSessionName()

// Track whether we've already marked messages as read for this session
// This prevents the cascade loop when session cache updates trigger the watcher
const hasMarkedAsRead = ref(false)

// Watch for session data and trigger mark as read ONCE per navigation
watch(
  () => session.value,
  (newSession) => {
    if (newSession && !hasMarkedAsRead.value && authStore.user?.email) {
      hasMarkedAsRead.value = true
      markMessagesRead({
        sessionId,
        agentId: newSession.agentId,
        userCode: authStore.user.email,
      })
    }
  },
  { immediate: true }
)

// Focus chat input on desktop when session loads
watch(
  () => session.value,
  (newSession) => {
    if (newSession && !isMobile.value) {
      nextTick(() => {
        messageInputRef.value?.focus()
      })
    }
  },
  { immediate: true }
)

// Fetch selectable users to determine target agentId
const { data: selectableUsers, isLoading: isSelectableUsersLoading } = useSelectableUsers()

// Primary session detection
const currentUserEmail = computed(() => authStore.user?.email)
const { isPrimarySession, otherMemberName, otherMemberId } = usePrimarySession(
  session,
  allSessions,
  selectableUsers,
  currentUserEmail
)

// Use messages from session + failed messages from store
const messages = computed(() => {
  const queryMessages = session.value?.messages ?? []
  const failedMessages = chatStore.getFailedMessages(sessionId)
  return [...queryMessages, ...failedMessages]
})

// Get typing users for this session
const typingUsers = computed(() => chatStore.getTypingUsers(sessionId))

// Compute selectable target agents from session members (only virtual agents)
const selectableTargetAgents = computed(() => {
  if (!session.value?.members || !selectableUsers.value) {
    return []
  }

  // Filter to only virtual agents who are session members
  return selectableUsers.value.filter(user =>
    session.value.members.includes(user.email) &&
    user.isVirtual
  )
})

// Selected target agent ID (undefined = no selection, falls back to current user)
const selectedTargetAgentId = ref<number | undefined>(undefined)

// Options message mutation + logic
const optionMutation = useSendMessage()

const lastUnansweredOptionsMessageId = computed(() => {
  const msgs = messages.value
  const userEmail = authStore.user?.email
  for (let i = msgs.length - 1; i >= 0; i--) {
    const msg = msgs[i]
    if (msg?.messageType === AIAnswerType.Options) {
      const hasUserAfter = msgs.slice(i + 1).some(m => m.senderUserCode === userEmail)
      return hasUserAfter ? undefined : msg.messageID
    }
  }
  return undefined
})

const isOptionsMode = computed(() => !!lastUnansweredOptionsMessageId.value)

async function handleOptionSubmitted(answer: string) {
  if (!session.value) return
  const targetAgentId = selectedTargetAgentId.value ?? (authStore.user?.id ?? 1)
  const request: AiQuestionRequestDTO = {
    userCode: authStore.user?.email ?? '',
    sessionId,
    agentId: targetAgentId,
    members: session.value.members ?? [],
    question: answer,
    group: '',
    pquestionType: AIQuestionType.Text,
    options: [],
  }
  try {
    await optionMutation.mutateAsync(request)
    scrollToBottom()
  } catch {
    // Error handled by mutation error state
  }
}

// Detect if second message is from a virtual agent (for welcome message)
const virtualAgentFromSecondMessage = computed(() => {
  const msgs = session.value?.messages
  if (!msgs || msgs.length < 2 || !selectableUsers.value) {
    return null
  }

  // Sort messages by sendDate to find chronologically second message
  const sortedMsgs = [...msgs].sort((a, b) =>
    new Date(a.sendDate).getTime() - new Date(b.sendDate).getTime()
  )

  const firstMsg = sortedMsgs[0]
  const secondMsg = sortedMsgs[1]
  if (!firstMsg || !secondMsg) return null

  const senderCode = secondMsg.senderUserCode

  // Find the user in selectableUsers by email (senderUserCode is email)
  const sender = selectableUsers.value.find(u => u.email === senderCode)

  if (sender?.isVirtual) {
    return {
      agentId: sender.id,
      agentName: sender.name,
      firstMessageDate: firstMsg.sendDate
    }
  }

  return null
})

// Fetch welcome message if second message is from virtual agent
const { data: welcomeMessageData, isLoading: isWelcomeMessageLoading } = useWelcomeMessage(
  computed(() => virtualAgentFromSecondMessage.value?.agentId ?? 0),
  {
    enabled: computed(() => !!virtualAgentFromSecondMessage.value),
    sessionId: sessionId
  }
)

// Trim quotes from welcome message (same pattern as /chats/new.vue)
const trimmedWelcomeMessage = computed(() => {
  if (!welcomeMessageData.value?.message) return undefined
  let msg = welcomeMessageData.value.message
  if (msg.startsWith('"') && msg.endsWith('"')) {
    msg = msg.slice(1, -1)
  }
  return msg
})

// Determine if all data needed for messages is ready (prevents layout jump)
// We wait for selectableUsers to load so we can check if welcome message is needed,
// and if it is, we also wait for the welcome message to load
const isMessagesReady = computed(() => {
  // Placeholder data has messages: [] — don't render messages yet
  if (isPlaceholderData.value) return false

  // Must have selectableUsers loaded to determine if we need welcome message
  if (isSelectableUsersLoading.value) return false

  // If we detected a virtual agent and welcome message is still loading, wait
  if (virtualAgentFromSecondMessage.value && isWelcomeMessageLoading.value) return false

  return true
})

// Check if this is a 2-member session with exactly 1 virtual agent
// In this case, auto-select the virtual agent and hide buttons
const isSingleVirtualAgentSession = computed(() => {
  if (!session.value?.members || !authStore.user?.email) {
    return false
  }
  // Session has exactly 2 members AND exactly 1 virtual agent
  return session.value.members.length === 2 && selectableTargetAgents.value.length === 1
})

// The single virtual agent (if applicable)
const singleVirtualAgent = computed(() => {
  if (isSingleVirtualAgentSession.value) {
    return selectableTargetAgents.value[0]
  }
  return undefined
})

// Auto-select the single virtual agent in 2-member sessions
watch([isSingleVirtualAgentSession, singleVirtualAgent], () => {
  if (isSingleVirtualAgentSession.value && singleVirtualAgent.value) {
    selectedTargetAgentId.value = singleVirtualAgent.value.id
  }
}, { immediate: true })

// Get the name of the currently selected agent (for placeholder text)
const selectedAgentName = computed(() => {
  if (!selectedTargetAgentId.value) {
    return undefined
  }
  const agent = selectableTargetAgents.value.find(a => a.id === selectedTargetAgentId.value)
  return agent?.name
})

// Participant names for header subtitle (excludes current user)
const otherParticipantNames = computed(() => {
  if (!session.value?.members || !selectableUsers.value) return ''
  const currentEmail = authStore.user?.email
  return session.value.members
    .filter(email => email !== currentEmail)
    .map(email => {
      const user = selectableUsers.value!.find(u => u.email === email)
      return user?.name ?? email
    })
    .join(', ')
})

// Handle target agent change
function handleTargetAgentChanged(agentId: number | undefined) {
  selectedTargetAgentId.value = agentId
}

// Inline title edit functions
function startEditingTitle() {
  if (!session.value) return
  editedTitle.value = session.value.sessionName
  isEditingTitle.value = true
  nextTick(() => {
    const input = titleInputRef.value
    if (input) {
      input.focus()
      input.setSelectionRange(input.value.length, input.value.length)
    }
  })
}

function cancelEditingTitle() {
  isEditingTitle.value = false
  editedTitle.value = ''
}

function saveTitle() {
  // Guard against double-fire (Enter triggers blur which would call this again)
  if (!isEditingTitle.value || isUpdatingTitle.value) return

  if (!session.value || !editedTitle.value.trim()) {
    cancelEditingTitle()
    return
  }

  const trimmedTitle = editedTitle.value.trim()
  if (trimmedTitle === session.value.sessionName) {
    cancelEditingTitle()
    return
  }

  updateSessionName({
    sessionId: session.value.sessionId,
    sessionName: trimmedTitle,
    agentId: session.value.agentId,
  }, {
    onSuccess: () => cancelEditingTitle(),
    onError: () => cancelEditingTitle(),
  })
}

function handleTitleKeydown(event: KeyboardEvent) {
  if (event.key === 'Enter') {
    event.preventDefault()
    saveTitle()
  } else if (event.key === 'Escape') {
    event.preventDefault()
    cancelEditingTitle()
  }
}

// Error message
const errorMessage = computed(() => {
  if (!chatError.value) return t('errors.sessionNotFound')
  return chatError.value.message || t('errors.unexpectedError')
})

// Handle session not found or access denied
watchEffect(() => {
  if (isError.value && chatError.value) {
    const err = chatError.value as { code?: string; statusCode?: number }
    if (err.code === 'NOT_FOUND' || err.statusCode === 404) {
      // Session not found - redirect to chats list after a short delay
      setTimeout(() => {
        navigateTo('/chats')
      }, 3000)
    } else if (err.code === 'FORBIDDEN' || err.statusCode === 403) {
      // Access denied - redirect to chats list
      navigateTo('/chats')
    }
  }
})

// Set page metadata
definePageMeta({
  description: 'View your conversation history',
})

// SEO
useSeoMeta({
  title: () => session.value?.sessionName ?? 'Chat Session',
  description: 'View and continue your conversation',
})

// Error boundary handler
function handleError(_error: unknown) {
  // Error boundary catches rendering errors
}

// Error message normalization
function getUserFriendlyMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message
  }
  return t('errors.unexpectedCreateError')
}


// Handle message sent event
function handleMessageSent() {
  // Only scroll if user is still at the bottom (they may have scrolled up while waiting)
  if (isAtBottom.value) {
    scrollToBottom()
  }
  if (import.meta.dev) console.log('Message sent successfully, isAtBottom:', isAtBottom.value)
}


// Auto-scroll when messages change (new message arrives)
// NOTE: We check isAtBottom BEFORE DOM updates (default flush),
// then scroll functions use nextTick to wait for DOM
watch(
  messages,
  (newMessages, oldMessages) => {
    const oldCount = oldMessages?.length ?? 0
    const newCount = newMessages?.length ?? 0

    if (!isMessagesReady.value) return
    if (newCount <= oldCount) return

    const latestMessage = newMessages[newMessages.length - 1]
    const userEmail = authStore.user?.email
    const isUserMessage = latestMessage?.senderUserCode === userEmail

    if (isUserMessage) {
      // Capture scroll state BEFORE scrolling - used when AI responds
      wasAtBottomWhenUserSentMessage.value = isAtBottom.value
      // User sent a message - always scroll to bottom to show their message
      scrollToBottom()
    } else {
      // AI responded - only scroll if user was at bottom when they sent message AND still at bottom
      if (import.meta.dev) console.log('[auto-scroll] AI message received:', {
        wasAtBottomWhenUserSentMessage: wasAtBottomWhenUserSentMessage.value,
        isAtBottom: isAtBottom.value,
        willScroll: wasAtBottomWhenUserSentMessage.value && isAtBottom.value
      })

      if (wasAtBottomWhenUserSentMessage.value && isAtBottom.value) {
        const userMessageIndex = newMessages.length - 2
        const userMessage = newMessages[userMessageIndex]

        if (userMessage) {
          scrollToElement(`[data-testid="message-${userMessage.messageID}"]`)
        } else {
          scrollToBottom()
        }
      }
    }
    // If user scrolled up before sending, don't auto-scroll on AI response
  },
  { deep: true }
)

// Scroll to bottom when messages become ready (handles cached data where Transition @after-enter won't fire).
// When data is cached, isMessagesReady is true from the first render — the shimmer is never shown,
// so the Transition never fires @after-enter. This watch catches that case.
watch(isMessagesReady, (ready) => {
  if (ready && !hasInitiallyScrolled.value) {
    hasInitiallyScrolled.value = true
    nextTick(() => scrollToBottom(true))
  }
}, { immediate: true })

// Scroll to bottom when the message thread enters the DOM (after shimmer → messages transition).
// Using @after-enter on the Transition ensures the ChatMessages DOM is fully rendered,
// which is necessary because mode="out-in" delays the enter phase until the leave animation finishes.
function onMessagesEntered() {
  hasInitiallyScrolled.value = true
  scrollToBottom(true)
}
</script>