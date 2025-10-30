<template>
  <NuxtErrorBoundary @error="handleError">
    <!-- Header Section -->
    <div class="flex items-center gap-3 px-4 py-3 border-b border-border">
      <!-- UNIFIED BUTTON: Mobile toggle / Desktop collapse -->
      <UDashboardSidebarToggle />
      <UDashboardSidebarCollapse />

      <div v-if="session" class="min-w-0 flex-1 group">
        <!-- View mode: title + pencil icon -->
        <div v-if="!isEditingTitle" class="flex items-center gap-2">
          <h1 class="text-xl font-semibold text-foreground truncate">
            {{ session.sessionName }}
          </h1>
          <button
            type="button"
            class="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-foreground flex-shrink-0"
            :aria-label="t('chat.sessionMenu.editName')"
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
          :disabled="isUpdatingTitle"
          @keydown="handleTitleKeydown"
          @blur="saveTitle"
        >

        <div class="flex items-center text-sm text-muted-foreground"/>
      </div>

      <!-- NEW: Session Members Avatar Stack (hidden when no members) -->
      <SessionMembers
        v-if="session && session.members.length > 0 && selectableUsers"
        :members="session.members"
        :selectable-users="selectableUsers"
      />

      <!-- NEW: Manage Session Members Button -->
      <ManageSessionUsers
        v-if="session"
        :session-id="session.sessionId"
        :agent-id="session.agentId"
        :members="session.members"
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
    <div v-else-if="session" class="flex flex-col h-full min-h-0 overflow-y-auto">
      <div class="relative flex-1 overflow-hidden min-h-0">
        <div ref="messagesContainer" class="h-full overflow-y-auto p-4 flex flex-col">
          <div class="flex-1" />
          <!-- Show skeleton while waiting for welcome message data to be ready -->
          <div v-if="!isMessagesReady" class="space-y-3">
            <USkeleton class="h-20 w-48" />
            <USkeleton class="h-20 w-40 ml-auto" />
            <USkeleton class="h-20 w-52" />
          </div>
          <ChatMessages
            v-else
            :messages="messages"
            :welcome-message="trimmedWelcomeMessage"
            :agent-id="virtualAgentFromSecondMessage?.agentId"
            :agent-name="virtualAgentFromSecondMessage?.agentName"
            :welcome-message-date="virtualAgentFromSecondMessage?.firstMessageDate"
          />
        </div>
        <!-- Bottom fade gradient -->
        <div class="absolute bottom-0 left-0 right-0 h-2 bg-gradient-to-t from-[hsl(var(--background))] to-transparent pointer-events-none" />
      </div>

      <!-- Typing Indicator - fixed height, doesn't push messages -->
      <TypingIndicator :typing-users="typingUsers" />

      <MessageInput
        :session-id="sessionId"
        :agent-id="authStore.user?.id || 1"
        :selected-agent-id="selectedTargetAgentId"
        :selectable-agents="isSingleVirtualAgentSession ? [] : selectableTargetAgents"
        :selected-agent-name="selectedAgentName"
        :members="session.members || []"
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
import { useChatSession, useWelcomeMessage } from '@/app/composables/useChatQueries'
import { useMarkMessagesRead, useUpdateSessionName } from '@/app/composables/useChatMutations'
import { useSelectableUsers } from '@/app/composables/useUsers'
import { useAuthStore } from '@/app/stores/auth'
import { useChatStore } from '@/app/stores/chat'
import { useSidebar } from '@/app/composables/useSidebar'
import MessageInput from '@/app/components/chat/MessageInput.vue'
import SessionMembers from '@/app/components/chat/SessionMembers.vue'
import ManageSessionUsers from '@/app/components/chat/ManageSessionUsers.vue'
import TypingIndicator from '@/app/components/chat/TypingIndicator.vue'

const { t } = useI18n()

const route = useRoute()
const sessionId = route.params.sessionId as string

const authStore = useAuthStore()
const chatStore = useChatStore()

// Sidebar composable for toggle functionality
const { toggleSidebar } = useSidebar()

// Messages container ref for scrolling
const messagesContainer = ref<HTMLElement | null>(null)

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
  error,
  refetch,
} = useChatSession(sessionId)

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

// Fetch selectable users to determine target agentId
const { data: selectableUsers, isLoading: isSelectableUsersLoading } = useSelectableUsers()

// Use messages from session + failed messages from store
const messages = computed(() => {
  const queryMessages = session.value?.messages || []
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

// Debug logging
watch([session, isLoading, isError], () => {
  console.log('[Chat Session Debug]', {
    sessionId,
    session: session.value,
    messages: messages.value,
    isLoading: isLoading.value,
    isError: isError.value,
    error: error.value,
  })
}, { immediate: true })

// Error message
const errorMessage = computed(() => {
  if (!error.value) return t('errors.sessionNotFound')
  return error.value.message || t('errors.unexpectedError')
})

// Handle session not found or access denied
watchEffect(() => {
  if (isError.value && error.value) {
    const err = error.value as any
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
  title: () => session.value?.sessionName || 'Chat Session',
  description: 'View and continue your conversation',
})

// Error boundary handler
function handleError(error: any) {
  console.error('Chat session error:', error)
}

// Error message normalization
function getUserFriendlyMessage(error: any): string {
  if (error?.message) {
    return error.message
  }
  return t('errors.unexpectedCreateError')
}

// Date formatting
function formatDate(dateString: string): string {
  try {
    const date = new Date(dateString)
    if (isNaN(date.getTime())) return ''

    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: date.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined
    })
  } catch {
    return ''
  }
}

// Scroll to bottom function
function scrollToBottom() {
  nextTick(() => {
    if (messagesContainer.value) {
      messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight
    }
  })
}

// Handle message sent event
function handleMessageSent() {
  // Optionally show a toast or perform other actions
  console.log('Message sent successfully')
}

// Dismiss failed message
function dismissFailedMessage(messageId: string) {
  chatStore.removeFailedMessage(sessionId, messageId)
}

// Auto-scroll to bottom when messages change (new message arrives)
watch(messages, () => {
  if (isMessagesReady.value) {
    scrollToBottom()
  }
}, { deep: true })

// Scroll to bottom when messages become ready (after welcome message loads)
watch(isMessagesReady, (ready) => {
  if (ready) {
    scrollToBottom()
  }
})
</script>