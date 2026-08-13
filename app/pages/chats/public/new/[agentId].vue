<template>
  <div class="flex flex-col h-full min-h-0 overflow-hidden">
    <!-- Chat Content Area -->
    <div
      ref="messagesContainer"
      class="flex-1 overflow-y-auto min-h-0 py-4 flex flex-col"
    >
      <div class="max-w-(--container-chat) mx-auto w-full px-4 md:px-[26px] flex flex-col flex-1">
        <div class="flex-1" />
        <ChatMessages
          :messages="messages"
          :welcome-message="trimmedWelcomeMessage"
          :welcome-message-date="chatStartTime"
          :agent-id="agentId"
          :agent-name="agentName"
          :hide-sender-names="true"
        >
          <template #empty />
        </ChatMessages>
      </div>
    </div>

    <!-- Typing Indicator -->
    <TypingIndicator
      :typing-users="typingUsers"
      :thinking-agents="thinkingAgents"
    />

    <!-- Message Input -->
    <MessageInput
      :session-id="sessionId"
      :draft-key="`public-${agentId}`"
      :agent-id="agentId"
      :selected-agent-id="agentId"
      :members="members"
      :disable-signal-r="true"
      :disable-voice="true"
      :disable-file-upload="true"
      :disabled="!canSend"
      @scroll-to-bottom="scrollToBottom"
    />
  </div>
</template>

<script setup lang="ts">
import { useWelcomeMessage, useChatSession } from '@/app/composables/useChatQueries'
import { useSendMessage } from '@/app/composables/useChatMutations'
import { useAuthStore } from '@/app/stores/auth'
import { useChatStore } from '@/app/stores/chat'
import { usePublicMode } from '@/app/composables/usePublicMode'
import { usePublicChatAgent } from '@/app/composables/usePublicChatAgent'
import { generateUUID } from '@/lib/utils/uuid'
import MessageInput from '@/app/components/chat/MessageInput.vue'
import ChatMessages from '@/app/components/chat/ChatMessages.vue'
import TypingIndicator from '@/app/components/chat/TypingIndicator.vue'

const route = useRoute()
const authStore = useAuthStore()
const chatStore = useChatStore()
const { publicAgentId, isValidPublicAgent, getPublicChatUrl } = usePublicMode()

// Extract agent ID from route
const routeAgentId = computed(() => Number(route.params.agentId))

// Validate agent ID - redirect if invalid
watchEffect(() => {
  if (!isValidPublicAgent(routeAgentId.value)) {
    const correctUrl = getPublicChatUrl()
    if (correctUrl) {
      navigateTo(correctUrl, { replace: true })
    }
  }
})

// Use the configured agent ID
const agentId = computed(() => publicAgentId.value ?? routeAgentId.value)

// Generate a fresh session ID for each new chat
const sessionId = ref(generateUUID())

// Register navigation callback for when server confirms the new session
chatStore.onNewSessionConfirmed(sessionId.value, () => {
  chatStore.clearDraft(`public-${agentId.value}`)
  chatStore.skipNextEntranceAnimation = true
  navigateTo(`/chats/public/${sessionId.value}`, { replace: true })
})

onUnmounted(() => {
  chatStore.removeNewSessionCallback(sessionId.value)
})

// Capture chat start time for welcome message ordering (must be before any user messages)
const chatStartTime = new Date().toISOString()

// Fetch agent info using startPublicChat endpoint
const { data: publicChatData } = usePublicChatAgent(agentId, {
  enabled: computed(() => !!agentId.value && authStore.isAuthenticated),
})

// Get agent name from public chat data
const agentName = computed(() => publicChatData.value?.agent?.name)

// Fetch welcome message for the agent
const { data: welcomeMsg } = useWelcomeMessage(agentId, {
  enabled: computed(() => !!agentId.value && authStore.isAuthenticated),
  // The session doesn't exist server-side yet, so the backend still gets an empty id.
  sessionId: '',
  // Scope the cache to this conversation: remounting the page mints a fresh UUID, so
  // every new conversation re-fetches the greeting instead of reusing the previous one.
  cacheScope: sessionId,
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

// Members for this session (user email + agent email from startPublicChat)
const members = computed(() => {
  if (!authStore.user?.email) return []
  const agentEmail = publicChatData.value?.agent?.email
  if (!agentEmail) return [authStore.user.email]
  return [authStore.user.email, agentEmail]
})

// Session doesn't exist on server until first message is sent.
// Once messages arrive, enable the query so SignalR invalidations trigger refetch.
const sessionQueryEnabled = ref(false)
const { data: sessionData } = useChatSession(sessionId.value, {
  enabled: sessionQueryEnabled,
})

const messages = computed(() => {
  const queryMessages = sessionData.value?.messages || []
  const failedMessages = chatStore.getFailedMessages(sessionId.value)
  return [...queryMessages, ...failedMessages]
})

watch(
  () => messages.value.length > 0,
  (hasMessages) => {
    if (hasMessages) sessionQueryEnabled.value = true
  },
)

// Send mutation for disabling button while pending
const mutation = useSendMessage()

// Disable send button while waiting for AI response
const canSend = computed(() => !mutation.isPending.value)

// Typing indicator users
const typingUsers = computed(() => chatStore.getTypingUsers(sessionId.value))
const thinkingAgents = computed(() => chatStore.getThinkingAgents(sessionId.value))

// Messages container ref for scrolling
const messagesContainer = ref<HTMLElement | null>(null)

function scrollToBottom() {
  nextTick(() => {
    if (messagesContainer.value) {
      messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight
    }
  })
}

// Page meta
definePageMeta({
  layout: 'public',
  key: (route) => route.fullPath,
})

useSeoMeta({
  title: 'Chat',
})
</script>
