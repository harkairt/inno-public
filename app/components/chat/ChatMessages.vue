<template>
  <div
    class="space-y-4"
    data-testid="messages-container"
    role="log"
    aria-live="polite"
    :aria-label="t('chat.messages.ariaLabel')"
  >
    <!-- Message Groups -->
    <div
      v-for="group in messageGroups"
      :key="group.date"
      class="space-y-3"
    >
      <!-- Date Separator -->
      <div class="flex items-center gap-4 my-6 px-1">
        <span
          role="heading"
          aria-level="2"
          class="text-[11px] font-medium tracking-wide uppercase text-[hsl(var(--muted-foreground)/0.7)] shrink-0"
          >{{ group.date }}</span
        >
        <div class="flex-1 h-px bg-[hsl(var(--border)/0.4)]" />
      </div>

      <!-- Messages in this group -->
      <div class="space-y-3">
        <div
          v-for="(message, messageIndex) in group.messages"
          :key="message.messageID"
          :data-testid="`message-${message.messageID}`"
          class="group flex"
          :class="{
            'justify-end': isUserMessage(message),
            'justify-start': !isUserMessage(message),
            'message-enter-stagger': messageEnterDelays.has(message.messageID),
          }"
          :style="
            messageEnterDelays.has(message.messageID)
              ? { animationDelay: messageEnterDelays.get(message.messageID) }
              : undefined
          "
        >
          <div
            class="max-w-[95%] md:max-w-[75%] sm:max-w-[70%] px-3 py-2"
            :class="{
              'rounded-br-md': isUserMessage(message),
              'rounded-bl-md': !isUserMessage(message),
            }"
            :style="isUserMessage(message) ? ownMessageStyle : partnerMessageStyle"
          >
            <!-- Sender Name + Rating Controls -->
            <div
              v-if="showSenderName(message)"
              class="flex items-start justify-between gap-2"
            >
              <div
                class="text-xs font-medium mb-1.5"
                :class="{
                  'opacity-80': isUserMessage(message),
                  'text-[hsl(var(--muted-foreground))]': !isUserMessage(message),
                }"
              >
                {{ message.senderName }}
              </div>

              <!-- Rating Controls (AI messages only, not welcome message) -->
              <!-- TEMPORARILY HIDDEN: Thumbs up/down rating feature -->
              <div
                v-if="false && !isUserMessage(message) && message.messageID !== 'welcome'"
                class="transition-opacity duration-200 -mt-1 -mr-1"
                :class="message.isRated ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'"
              >
                <MessageRating
                  :message-id="message.messageID"
                  :session-id="message.sessionId"
                  :agent-id="props.agentId ?? 0"
                  :is-rated="message.isRated"
                  :rating="message.rating ?? null"
                />
              </div>
            </div>

            <!-- Message Content -->
            <template v-if="message.messageType === AIAnswerType.Options">
              <MarkdownContent
                v-if="!parseOptionsPayload(message.messageText)"
                :content="message.messageText"
              />
              <OptionsMessage
                v-else
                :payload="parseOptionsPayload(message.messageText)!"
                :is-active="message.messageID === props.activeOptionsMessageId"
                :selected-answer="getSelectedAnswer(group.messages, messageIndex)"
                @submit="(answer) => emit('optionSubmitted', answer)"
              />
            </template>
            <MarkdownContent
              v-else
              :content="message.messageText"
            />

            <!-- Message Status and Time -->
            <div class="flex items-center justify-between mt-2 text-xs opacity-70">
              <span>{{ formatTime(message.sendDate) }}</span>

              <!-- Message Status for user messages -->
              <div
                v-if="isUserMessage(message) && message.status"
                class="flex items-center ml-2"
              >
                <div
                  v-if="message.status === MessageStatus.PENDING"
                  class="w-2 h-2 bg-amber-400 dark:bg-amber-300 rounded-full animate-pulse"
                  :title="t('chat.messages.sending')"
                />
                <div
                  v-else-if="message.status === MessageStatus.SENT"
                  class="w-2 h-2 bg-emerald-400 dark:bg-emerald-300 rounded-full"
                  :title="t('chat.messages.sent')"
                />
                <div
                  v-else-if="message.status === MessageStatus.FAILED"
                  class="w-2 h-2 bg-rose-400 dark:bg-rose-300 rounded-full"
                  :title="t('chat.messages.failedToSend')"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Empty State (only show default if no messages AND slot not provided) -->
    <template v-if="!allMessages || allMessages.length === 0">
      <slot
        v-if="$slots.empty"
        name="empty"
      />
      <div
        v-else
        class="text-center py-8"
      >
        <UEmpty
          :title="t('chat.messages.noMessages')"
          :description="t('chat.messages.emptyState')"
          icon="i-heroicons-chat-bubble-left-right"
        />
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, type CSSProperties } from 'vue'
import type { AISessionMessageDTO } from '@/types/api/schemas'
import { parseOptionsPayload } from '@/types/api/schemas'
import { useAuthStore } from '@/app/stores/auth'
import { AIAnswerType } from '@/types/enums'
import MessageRating from '@/app/components/chat/MessageRating.vue'
import MarkdownContent from '@/app/components/chat/MarkdownContent.vue'
import OptionsMessage from '@/app/components/chat/OptionsMessage.vue'

const { t, locale } = useI18n()

// Config-driven message styles using CSS variables
const ownMessageStyle = computed<CSSProperties>(() => ({
  backgroundColor: 'var(--config-own-message-bg)',
  fontSize: 'var(--config-own-message-font-size)',
  fontStyle: 'var(--config-own-message-font-style)' as CSSProperties['fontStyle'],
  fontWeight: 'var(--config-own-message-font-weight)' as CSSProperties['fontWeight'],
  borderWidth: 'var(--config-message-border-width)',
  borderColor: 'var(--config-message-border-color)',
  borderStyle: 'var(--config-message-border-style)' as CSSProperties['borderStyle'],
  borderRadius: 'var(--config-message-border-radius)',
  color: 'hsl(var(--foreground))',
}))

const partnerMessageStyle = computed<CSSProperties>(() => ({
  backgroundColor: 'var(--config-partner-message-bg)',
  fontSize: 'var(--config-partner-message-font-size)',
  fontStyle: 'var(--config-partner-message-font-style)' as CSSProperties['fontStyle'],
  fontWeight: 'var(--config-partner-message-font-weight)' as CSSProperties['fontWeight'],
  borderWidth: 'var(--config-message-border-width)',
  borderColor: 'var(--config-message-border-color)',
  borderStyle: 'var(--config-message-border-style)' as CSSProperties['borderStyle'],
  borderRadius: 'var(--config-message-border-radius)',
  color: 'hsl(var(--foreground))',
}))

enum MessageStatus {
  PENDING = 'PENDING',
  SENT = 'SENT',
  FAILED = 'FAILED',
}

// Extended message type for optimistic updates
type ExtendedMessage = AISessionMessageDTO & {
  status?: MessageStatus
}

interface Props {
  messages?: ExtendedMessage[]
  welcomeMessage?: string
  agentId?: number
  agentName?: string
  welcomeMessageDate?: string
  hideSenderNames?: boolean
  memberCount?: number
  activeOptionsMessageId?: string
  skipEntranceAnimation?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  messages: () => [],
  welcomeMessage: undefined,
  agentId: undefined,
  agentName: undefined,
  welcomeMessageDate: undefined,
  hideSenderNames: false,
  memberCount: 2,
  activeOptionsMessageId: undefined,
  skipEntranceAnimation: false,
})

const emit = defineEmits<{
  optionSubmitted: [answer: string]
}>()

const authStore = useAuthStore()

// Staggered entrance animation for initial load
const STAGGER_COUNT = 8
const STAGGER_STEP_MS = 50
const ANIMATION_DURATION_MS = 300

const isInitialRender = ref(!props.skipEntranceAnimation)

onMounted(() => {
  setTimeout(
    () => {
      isInitialRender.value = false
    },
    STAGGER_COUNT * STAGGER_STEP_MS + ANIMATION_DURATION_MS + 100,
  )
})

const messageEnterDelays = computed<Map<string, string>>(() => {
  if (!isInitialRender.value) return new Map()
  const msgs = allMessages.value
  const count = msgs.length
  const from = Math.max(0, count - STAGGER_COUNT)
  const delays = new Map<string, string>()
  for (let i = from; i < count; i++) {
    const fromEnd = count - 1 - i
    delays.set(msgs[i]!.messageID, `${fromEnd * STAGGER_STEP_MS}ms`)
  }
  return delays
})

// Helper to determine if a message is from the current user
const isUserMessage = (message: ExtendedMessage) => {
  return message.senderUserCode === authStore.user?.email
}

// Find the user's answer to an Options message by looking at the next user message after it
function getSelectedAnswer(messages: ExtendedMessage[], currentIndex: number): string | undefined {
  const userEmail = authStore.user?.email
  for (let i = currentIndex + 1; i < messages.length; i++) {
    if (messages[i]!.senderUserCode === userEmail) {
      return messages[i]!.messageText ?? undefined
    }
  }
  return undefined
}

// Show sender name only for other people's messages in group chats (3+ members)
const showSenderName = (message: ExtendedMessage) => {
  if (props.hideSenderNames) return false
  if (isUserMessage(message)) return false
  return props.memberCount > 2
}

// Create welcome message if provided
const welcomeMessageObj = computed((): ExtendedMessage | null => {
  if (!props.welcomeMessage) return null

  return {
    messageID: 'welcome',
    messageText: props.welcomeMessage,
    messageType: 0, // AIAnswerType.Text
    senderUserCode: props.agentId?.toString() ?? 'agent',
    senderName: props.agentName ?? 'Agent', // This should probably be i18n too, but it's used as a fallback
    sendDate: props.welcomeMessageDate ?? new Date().toISOString(),
    isRated: false,
    rating: null,
    readByUsers: [],
    sessionId: '',
    status: MessageStatus.SENT,
  }
})

// Combine welcome message with regular messages
const allMessages = computed(() => {
  const messages = props.messages || []
  if (welcomeMessageObj.value) {
    return [welcomeMessageObj.value, ...messages]
  }
  return messages
})

// Group messages by date
const messageGroups = computed(() => {
  if (!allMessages.value || allMessages.value.length === 0) {
    return []
  }

  const groups = new Map<string, { messages: ExtendedMessage[]; timestamp: number }>()

  allMessages.value.forEach((message) => {
    const dateObj = new Date(message.sendDate)
    const dateKey = formatDate(dateObj)
    if (!groups.has(dateKey)) {
      groups.set(dateKey, { messages: [], timestamp: dateObj.getTime() })
    }
    groups.get(dateKey)!.messages.push(message)
  })

  return Array.from(groups.entries())
    .sort(([, a], [, b]) => a.timestamp - b.timestamp)
    .map(([date, { messages }]) => ({
      date,
      messages: messages.sort(
        (a, b) => new Date(a.sendDate).getTime() - new Date(b.sendDate).getTime(),
      ),
    }))
})

function formatDate(date: Date): string {
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)

  const messageDate = new Date(date.getFullYear(), date.getMonth(), date.getDate())

  if (messageDate.getTime() === today.getTime()) {
    return t('time.today')
  } else if (messageDate.getTime() === yesterday.getTime()) {
    return t('time.yesterday')
  } else if (date.getFullYear() === now.getFullYear()) {
    return date.toLocaleDateString(locale.value, {
      month: 'short',
      day: 'numeric',
      weekday: 'long',
    })
  } else {
    return date.toLocaleDateString(locale.value, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  }
}

function formatTime(dateString: string): string {
  try {
    const date = new Date(dateString)
    if (isNaN(date.getTime())) {
      return ''
    }
    return date.toLocaleTimeString(locale.value, {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    })
  } catch {
    return ''
  }
}
</script>

<style scoped>
.message-enter-stagger {
  animation: message-enter 0.3s ease both;
}

@keyframes message-enter {
  from {
    opacity: 0;
    transform: translateY(8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>
