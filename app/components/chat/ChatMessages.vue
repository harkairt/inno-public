<template>
  <div class="space-y-4" data-testid="messages-container">
    <!-- Message Groups -->
    <div
      v-for="group in messageGroups"
      :key="group.date"
      class="space-y-3"
    >
      <!-- Date Separator -->
      <div class="flex items-center justify-center my-6">
        <div class="bg-[hsl(var(--muted))] px-4 py-1.5 rounded-full">
          <span class="text-xs font-medium text-[hsl(var(--muted-foreground))]">{{ group.date }}</span>
        </div>
      </div>

      <!-- Messages in this group with staggered animation -->
      <TransitionGroup
        appear
        class="space-y-3"
        tag="div"
        @before-enter="onBeforeEnter"
        @enter="onEnter"
      >
        <div
          v-for="(message, index) in group.messages"
          :key="message.messageID"
          :data-testid="`message-${message.messageID}`"
          :data-index="group.messages.length - 1 - index"
          class="flex"
          :class="{
            'justify-end': isUserMessage(message),
            'justify-start': !isUserMessage(message),
          }"
        >
          <div
            class="max-w-xs lg:max-w-md xl:max-w-lg px-4 py-3"
            :class="{
              'bg-[oklch(88.07%_0.043_117.32)] text-black rounded-2xl rounded-br-md': isUserMessage(message),
              'bg-[hsl(var(--muted))] text-[hsl(var(--foreground))] rounded-2xl rounded-bl-md border border-[hsl(var(--border))]': !isUserMessage(message),
            }"
          >
            <!-- Sender Name -->
            <div
              class="text-xs font-medium mb-1.5"
              :class="{
                'opacity-80': isUserMessage(message),
                'text-[hsl(var(--muted-foreground))]': !isUserMessage(message),
              }"
            >
              {{ message.senderName }}
            </div>

            <!-- Message Content -->
            <div class="text-sm whitespace-pre-wrap break-words leading-relaxed">
              {{ message.messageText }}
            </div>

            <!-- Message Status and Time -->
            <div
              class="flex items-center justify-between mt-2 text-xs opacity-70"
            >
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
      </TransitionGroup>
    </div>

    <!-- Empty State (only show if no messages AND no welcome message) -->
    <div v-if="!allMessages || allMessages.length === 0" class="text-center py-8">
      <UEmpty
        :title="t('chat.messages.noMessages')"
        :description="t('chat.messages.emptyState')"
        icon="i-heroicons-chat-bubble-left-right"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { AISessionMessageDTO } from '@/types/api/schemas'
import { useAuthStore } from '@/app/stores/auth'

const { t, locale } = useI18n()

enum MessageStatus {
  PENDING = 'PENDING',
  SENT = 'SENT',
  FAILED = 'FAILED',
}

// Extended message type for optimistic updates
type ExtendedMessage = AISessionMessageDTO & {
  status?: MessageStatus
}

interface MessageGroup {
  date: string
  messages: ExtendedMessage[]
}

interface Props {
  messages?: ExtendedMessage[]
  welcomeMessage?: string
  agentId?: number
  agentName?: string
  welcomeMessageDate?: string
}

const props = withDefaults(defineProps<Props>(), {
  messages: () => [],
  welcomeMessage: undefined,
  agentId: undefined,
  agentName: undefined,
  welcomeMessageDate: undefined,
})

const authStore = useAuthStore()

// Helper to determine if a message is from the current user
const isUserMessage = (message: ExtendedMessage) => {
  return message.senderUserCode === authStore.user?.email
}

// Create welcome message if provided
const welcomeMessageObj = computed((): ExtendedMessage | null => {
  if (!props.welcomeMessage) return null

  return {
    messageID: 'welcome',
    messageText: props.welcomeMessage,
    messageType: 0, // AIAnswerType.Text
    senderUserCode: props.agentId?.toString() || 'agent',
    senderName: props.agentName || 'Agent', // This should probably be i18n too, but it's used as a fallback
    sendDate: props.welcomeMessageDate || new Date().toISOString(),
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

  const groups: Map<string, ExtendedMessage[]> = new Map()

  allMessages.value.forEach((message) => {
    const date = formatDate(new Date(message.sendDate))
    if (!groups.has(date)) {
      groups.set(date, [])
    }
    groups.get(date)!.push(message)
  })

  // Convert to array and sort messages within each group by time
  const result: MessageGroup[] = []
  groups.forEach((messages, date) => {
    result.push({
      date,
      messages: messages.sort((a, b) =>
        new Date(a.sendDate).getTime() - new Date(b.sendDate).getTime()
      ),
    })
  })

  // Sort groups by date (most recent first)
  return result.sort((a, b) => {
    const dateA = new Date(a.date)
    const dateB = new Date(b.date)
    if (dateA.toDateString() === dateB.toDateString()) {
      return 0 // Same day, keep original order
    }
    return dateB.getTime() - dateA.getTime() // Most recent first
  })
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
      weekday: 'long'
    })
  } else {
    return date.toLocaleDateString(locale.value, {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
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
      hour12: false
    })
  } catch (error) {
    console.warn('Error formatting time:', dateString, error)
    return ''
  }
}

// Staggered animation hooks for TransitionGroup
function onBeforeEnter(el: Element) {
  const element = el as HTMLElement
  element.style.opacity = '0'
  element.style.transform = 'translateY(12px)'
}

function onEnter(el: Element, done: () => void) {
  const element = el as HTMLElement
  const index = Number(element.dataset.index) || 0
  const delay = index * 50

  setTimeout(() => {
    element.style.transition = 'opacity 0.2s ease-out, transform 0.2s ease-out'
    element.style.opacity = '1'
    element.style.transform = 'translateY(0)'
    setTimeout(done, 200)
  }, delay)
}
</script>
