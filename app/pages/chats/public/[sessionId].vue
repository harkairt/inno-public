<template>
  <div class="flex flex-col h-full min-h-0 overflow-hidden">
    <!-- Chat Content -->
    <template v-if="session">
      <div ref="messagesContainer" class="flex-1 overflow-y-auto min-h-0 p-4 flex flex-col">
        <div class="flex-1" />
        <ChatMessages
          :messages="messages"
          :welcome-message="trimmedWelcomeMessage"
          :welcome-message-date="welcomeMessageDate"
          :agent-id="agentId"
          :agent-name="agentName"
          :hide-sender-names="true"
        >
          <template #empty />
        </ChatMessages>
      </div>

      <!-- Typing Indicator -->
      <TypingIndicator :typing-users="typingUsers" />

      <!-- Message Input -->
      <MessageInput
        :session-id="sessionId"
        :agent-id="agentId"
        :selected-agent-id="agentId"
        :members="session?.members || []"
        :disable-signal-r="true"
        :disable-voice="true"
        :disabled="!canSend"
        @message-sent="handleMessageSent"
        @scroll-to-bottom="scrollToBottom"
      />
    </template>

    <!-- Spinner shown while redirecting (no cached session) -->
    <div v-else class="flex items-center justify-center h-full">
      <div class="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { useChatSession, useWelcomeMessage } from '@/app/composables/useChatQueries'
import { useSendMessage } from '@/app/composables/useChatMutations'
import { useAuthStore } from '@/app/stores/auth'
import { useChatStore } from '@/app/stores/chat'
import { usePublicMode } from '@/app/composables/usePublicMode'
import { usePublicChatAgent } from '@/app/composables/usePublicChatAgent'
import MessageInput from '@/app/components/chat/MessageInput.vue'
import ChatMessages from '@/app/components/chat/ChatMessages.vue'
import TypingIndicator from '@/app/components/chat/TypingIndicator.vue'

const route = useRoute()
const authStore = useAuthStore()
const chatStore = useChatStore()
const { publicAgentId, getPublicChatUrl } = usePublicMode()

const sessionId = route.params.sessionId as string

// Session data comes from Vue Query cache (populated by useSendMessage mutation).
// getSessionById is not available in public mode, so disable the query.
const { data: session } = useChatSession(sessionId, { enabled: false })

// Redirect to new public chat if no cached session data (e.g. direct navigation or page refresh)
watchEffect(() => {
  if (!session.value) {
    const url = getPublicChatUrl()
    if (url) {
      navigateTo(url, { replace: true })
    }
  }
})

// Agent ID from config or session
const agentId = computed(() => publicAgentId.value ?? session.value?.agentId ?? 0)

// Fetch agent info using startPublicChat endpoint (same pattern as new/[agentId].vue)
const { data: publicChatData } = usePublicChatAgent(agentId, {
  enabled: computed(() => !!agentId.value && authStore.isAuthenticated)
})

// Get agent name from public chat data
const agentName = computed(() => publicChatData.value?.agent?.name)

// Fetch welcome message for the agent
const { data: welcomeMsg } = useWelcomeMessage(agentId, {
  enabled: computed(() => !!agentId.value && authStore.isAuthenticated),
  sessionId
})

// Trim quotes from welcome message
const trimmedWelcomeMessage = computed(() => {
  if (!welcomeMsg.value?.message) return undefined
  let msg = welcomeMsg.value.message
  if (msg.startsWith('"') && msg.endsWith('"')) {
    msg = msg.slice(1, -1)
  }
  return msg
})

// Use a timestamp slightly before the first message for welcome message ordering
const welcomeMessageDate = computed(() => {
  const firstMessage = session.value?.messages?.[0]
  if (!firstMessage?.sendDate) return undefined
  // Subtract 1 second to ensure welcome message sorts before first user message
  const date = new Date(firstMessage.sendDate)
  date.setSeconds(date.getSeconds() - 1)
  return date.toISOString()
})

// Combine session messages with any failed messages from store
const messages = computed(() => {
  const queryMessages = session.value?.messages || []
  const failedMessages = chatStore.getFailedMessages(sessionId)
  return [...queryMessages, ...failedMessages]
})

// Send mutation for disabling button while pending
const mutation = useSendMessage()

// Disable send button while waiting for AI response
const canSend = computed(() => !mutation.isPending.value)

// Typing indicator users
const typingUsers = computed(() => chatStore.getTypingUsers(sessionId))

// Messages container ref for scrolling
const messagesContainer = ref<HTMLElement | null>(null)

function scrollToBottom() {
  nextTick(() => {
    if (messagesContainer.value) {
      messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight
    }
  })
}

// Handle message sent
function handleMessageSent() {
  // Scroll to bottom after message sent
  scrollToBottom()
}

// Auto-scroll when new messages arrive
watch(
  () => messages.value.length,
  (newLength, oldLength) => {
    if (newLength > (oldLength || 0)) {
      scrollToBottom()
    }
  }
)

// Page meta
definePageMeta({
  layout: 'public',
  key: route => route.fullPath,
})

useSeoMeta({
  title: 'Chat',
})
</script>
