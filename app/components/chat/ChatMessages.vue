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
      <div>
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
            class="flex flex-col w-full"
            :class="isUserMessage(message) ? 'items-end' : 'items-start'"
            @click="handleBubbleTap(message.messageID)"
          >
            <MessageBubble
              :message="message"
              :options-active="message.messageID === props.activeOptionsMessageId"
              :selected-answer="getSelectedAnswer(group.messages, messageIndex)"
              max-width-class="max-w-[95%] md:max-w-[85%]"
              :interactive="
                !props.pendingIds.has(message.messageID) && !props.failedIds.has(message.messageID)
              "
              :class="{ 'opacity-70': props.failedIds.has(message.messageID) }"
              @option-submitted="(answer) => emit('optionSubmitted', answer)"
              @preview-file="
                (file, messageId, messageDate) => emit('previewFile', file, messageId, messageDate)
              "
            >
              <template #header>
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
              </template>
            </MessageBubble>

            <div
              v-if="props.failedIds.has(message.messageID)"
              class="h-5 flex items-center pl-2 gap-2"
            >
              <button
                class="text-[10px] text-red-500 hover:text-red-600 transition-colors select-none"
                @click.stop="emit('retryMessage', message.messageID)"
              >
                {{ t('chat.messages.retry') }}
              </button>
              <button
                class="text-[10px] text-[hsl(var(--muted-foreground)/0.6)] hover:text-[hsl(var(--muted-foreground))] transition-colors select-none"
                @click.stop="emit('discardMessage', message.messageID)"
              >
                {{ t('chat.messages.discard') }}
              </button>
            </div>

            <div
              v-else
              :data-testid="`message-actions-${message.messageID}`"
              class="h-5 flex items-center pl-2"
            >
              <div
                v-if="!props.pendingIds.has(message.messageID)"
                :class="[
                  'flex items-center gap-1.5 px-1 transition-opacity duration-150',
                  isMobile
                    ? tappedMessageId === message.messageID
                      ? 'opacity-100'
                      : 'opacity-0 pointer-events-none'
                    : 'opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto',
                ]"
              >
                <span class="text-[10px] text-[hsl(var(--muted-foreground)/0.6)] select-none">
                  {{ formatActionBarDate(message.sendDate) }}
                </span>
                <button
                  class="text-[hsl(var(--muted-foreground)/0.5)] hover:text-[hsl(var(--muted-foreground))] transition-colors p-0.5 rounded"
                  :aria-label="t('chat.messages.copyMessage')"
                  @click.stop="handleCopy(message.messageID, message.messageText)"
                >
                  <UIcon
                    :name="
                      copiedMessageId === message.messageID
                        ? 'i-heroicons-check-20-solid'
                        : 'i-heroicons-square-2-stack'
                    "
                    class="size-3"
                  />
                </button>
                <button
                  v-if="!isMobile && message.messageID !== 'welcome'"
                  class="transition-colors p-0.5 rounded"
                  :class="
                    props.focusedIds.includes(message.messageID)
                      ? 'text-[hsl(var(--primary))]'
                      : 'text-[hsl(var(--muted-foreground)/0.5)] hover:text-[hsl(var(--muted-foreground))]'
                  "
                  :aria-label="
                    props.focusedIds.includes(message.messageID)
                      ? t('chat.focus.unfocusMessage')
                      : t('chat.focus.focusMessage')
                  "
                  @click.stop="emit('toggleFocus', message.messageID)"
                >
                  <UIcon
                    :name="
                      props.focusedIds.includes(message.messageID)
                        ? 'i-heroicons-bookmark-solid'
                        : 'i-heroicons-bookmark'
                    "
                    class="size-3"
                  />
                </button>
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
import { computed, onMounted, ref, watch } from 'vue'
import type { AISessionMessageDTO, ReceivedFile } from '@/types/api/schemas'
import { useAuthStore } from '@/app/stores/auth'
import { useMessagePresentation } from '@/app/composables/useMessagePresentation'
import MessageRating from '@/app/components/chat/MessageRating.vue'
import MessageBubble from '@/app/components/chat/MessageBubble.vue'

const { t, locale } = useI18n()
const { isMobile } = useNavigationVisibility()
const { isUserMessage, formatActionBarDate, handleCopy, copiedMessageId } = useMessagePresentation()

interface Props {
  messages?: AISessionMessageDTO[]
  welcomeMessage?: string
  agentId?: number
  agentName?: string
  welcomeMessageDate?: string
  hideSenderNames?: boolean
  memberCount?: number
  activeOptionsMessageId?: string
  skipEntranceAnimation?: boolean
  focusedIds?: readonly string[]
  pendingIds?: Set<string>
  failedIds?: Set<string>
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
  focusedIds: () => [],
  pendingIds: () => new Set<string>(),
  failedIds: () => new Set<string>(),
})

const emit = defineEmits<{
  optionSubmitted: [answer: string]
  toggleFocus: [messageId: string]
  retryMessage: [messageId: string]
  discardMessage: [messageId: string]
  previewFile: [file: ReceivedFile, messageId: string, messageDate: string]
}>()

const authStore = useAuthStore()
const tappedMessageId = ref<string | null>(null)

function handleBubbleTap(messageId: string) {
  if (!isMobile.value) return
  tappedMessageId.value = tappedMessageId.value === messageId ? null : messageId
}

// Find the user's answer to an Options message by looking at the next user message after it
function getSelectedAnswer(
  messages: AISessionMessageDTO[],
  currentIndex: number,
): string | undefined {
  const userEmail = authStore.user?.email
  for (let i = currentIndex + 1; i < messages.length; i++) {
    if (messages[i]!.senderUserCode === userEmail) {
      return messages[i]!.messageText ?? undefined
    }
  }
  return undefined
}

// Show sender name only for other people's messages in group chats (3+ members)
const showSenderName = (message: AISessionMessageDTO) => {
  if (props.hideSenderNames) return false
  if (isUserMessage(message)) return false
  return props.memberCount > 2
}

// Create welcome message if provided
const welcomeMessageObj = computed((): AISessionMessageDTO | null => {
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

// Entrance animation: animate incoming messages the first time they appear (initial
// load AND later arrivals like AI replies), not just the first paint. On mount, own
// messages animate too, so a revisited session's history staggers in coherently. After
// mount, own messages are excluded — a just-sent message appears instantly because the
// user acted, and its optimistic temp id is swapped for a server id on reconciliation,
// which would otherwise replay the entrance.
// Messages already seen — or pre-existing on navigation (skipEntranceAnimation) — appear instantly.
const STAGGER_COUNT = 8
const STAGGER_STEP_MS = 50
const ANIMATION_DURATION_MS = 300

const seenMessageIds = ref(new Set<string>())
const messageEnterDelays = ref(new Map<string, string>())

function animateNewMessages(msgs: AISessionMessageDTO[], includeOwn = false) {
  const fresh = msgs.filter(
    (m) =>
      (includeOwn || !isUserMessage(m)) &&
      !seenMessageIds.value.has(m.messageID) &&
      !messageEnterDelays.value.has(m.messageID),
  )
  if (fresh.length === 0) return

  const from = Math.max(0, fresh.length - STAGGER_COUNT)
  fresh.forEach((m, i) => {
    const fromEnd = fresh.length - 1 - i
    const delay = i >= from ? fromEnd * STAGGER_STEP_MS : 0
    messageEnterDelays.value.set(m.messageID, `${delay}ms`)
  })

  const ids = fresh.map((m) => m.messageID)
  const maxDelay = Math.min(fresh.length, STAGGER_COUNT) * STAGGER_STEP_MS
  // Retire the animation once done so re-renders don't re-trigger it.
  setTimeout(
    () => {
      ids.forEach((id) => {
        messageEnterDelays.value.delete(id)
        seenMessageIds.value.add(id)
      })
    },
    maxDelay + ANIMATION_DURATION_MS + 100,
  )
}

onMounted(() => {
  if (props.skipEntranceAnimation) {
    // Arrived from /chats/new/* — these messages were already on screen; don't replay.
    allMessages.value.forEach((m) => seenMessageIds.value.add(m.messageID))
  } else {
    animateNewMessages(allMessages.value, true)
  }
})

watch(
  () => allMessages.value.map((m) => m.messageID).join(','),
  () => animateNewMessages(allMessages.value),
)

// Group messages by date
const messageGroups = computed(() => {
  if (!allMessages.value || allMessages.value.length === 0) {
    return []
  }

  const groups = new Map<string, { messages: AISessionMessageDTO[]; timestamp: number }>()

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
