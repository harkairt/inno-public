<template>
  <NuxtErrorBoundary @error="handleError">
    <!-- Header Section -->
    <div class="flex items-center gap-3 px-4 py-3 border-b border-border">
      <UDashboardSidebarToggle />
      <UDashboardSidebarCollapse />

      <div v-if="selectedUser" class="min-w-0 flex-1">
        <h1 class="text-xl font-semibold text-foreground truncate">
          {{ selectedUser.name || selectedUser.email }}
        </h1>
      </div>
    </div>

    <!-- Loading State -->
    <div v-if="isLoadingUsers" class="flex items-center justify-center h-full">
      <div class="text-center">
        <USkeleton class="h-8 w-64 mb-4 mx-auto" />
        <div class="space-y-3 max-w-md mx-auto">
          <USkeleton class="h-16 w-full" />
          <USkeleton class="h-16 w-3/4 ml-auto" />
        </div>
      </div>
    </div>

    <!-- Chat Content -->
    <div v-else-if="selectedUser" class="flex flex-col h-full min-h-0 overflow-hidden">
      <div ref="messagesContainer" class="flex-1 overflow-y-auto min-h-0 p-4 flex flex-col">
        <div class="flex-1" />
        <ChatMessages
          :messages="messages"
          :welcome-message="trimmedWelcomeMessage"
          :agent-id="agentId"
          :agent-name="selectedUser.name || selectedUser.email"
        />
      </div>

      <!-- Typing Indicator -->
      <TypingIndicator :typing-users="typingUsers" />

      <MessageInput
        :session-id="sessionId"
        :agent-id="agentId"
        :selected-agent-id="selectedTargetAgentId ?? agentId"
        :selectable-agents="isSingleVirtualAgentSession ? [] : [selectedUser]"
        :selected-agent-name="selectedAgentName"
        :members="members"
        @message-sent="handleMessageSent"
        @scroll-to-bottom="scrollToBottom"
        @target-agent-changed="handleTargetAgentChanged"
      />
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
import { useSelectableUsers } from '@/app/composables/useUsers'
import { useAuthStore } from '@/app/stores/auth'
import { useChatStore } from '@/app/stores/chat'
import MessageInput from '@/app/components/chat/MessageInput.vue'
import ChatMessages from '@/app/components/chat/ChatMessages.vue'
import TypingIndicator from '@/app/components/chat/TypingIndicator.vue'

const { t } = useI18n()

const route = useRoute()
const authStore = useAuthStore()
const chatStore = useChatStore()

const userId = computed(() => route.query.userId as string)
const sessionId = ref(crypto.randomUUID())

const { data: users, isLoading: isLoadingUsers } = useSelectableUsers()

const selectedUser = computed(() => {
  if (!users.value || !userId.value) return null
  return users.value.find(u => String(u.id) === String(userId.value))
})

watchEffect(() => {
  if (users.value && !selectedUser.value) {
    navigateTo('/chats', { replace: true })
  }
})

const agentId = computed(() => selectedUser.value?.id || 1)

const { data: welcomeMsg } = useWelcomeMessage(agentId, {
  enabled: computed(() => !!selectedUser.value),
  sessionId: ''
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

// Get messages from cache (mutation adds optimistic messages here)
const { data: sessionData } = useChatSession(sessionId.value)

const messages = computed(() => {
  const queryMessages = sessionData.value?.messages || []
  const failedMessages = chatStore.getFailedMessages(sessionId.value)
  return [...queryMessages, ...failedMessages]
})

// Typing indicator
const typingUsers = computed(() => chatStore.getTypingUsers(sessionId.value))

// Check if single virtual agent session - hide buttons if so
const isSingleVirtualAgentSession = computed(() => {
  return members.value.length === 2 && selectedUser.value?.isVirtual
})

// Selected target agent ID
const selectedTargetAgentId = ref<number | undefined>(undefined)

// Auto-select when single agent
watch([isSingleVirtualAgentSession, selectedUser], () => {
  if (isSingleVirtualAgentSession.value && selectedUser.value) {
    selectedTargetAgentId.value = selectedUser.value.id
  }
}, { immediate: true })

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
  nextTick(() => {
    if (messagesContainer.value) {
      messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight
    }
  })
}

function handleMessageSent() {
  navigateTo(`/chats/${sessionId.value}`, { replace: true })
}

function handleError(error: any) {
  console.error('New chat error:', error)
}

function getUserFriendlyMessage(error: any): string {
  if (error?.message) {
    return error.message
  }
  return t('errors.unexpectedCreateError')
}

definePageMeta({
  description: 'Start a new conversation',
})

useSeoMeta({
  title: 'New Chat',
  description: 'Start a new conversation',
})
</script>
