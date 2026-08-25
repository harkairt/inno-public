<template>
  <div
    class="flex flex-col flex-1 h-full bg-white"
    :style="{ minWidth: `${contentWidth}px` }"
  >
    <div
      class="flex items-center gap-2 px-3 py-2 border-b border-[hsl(var(--border)/0.5)] flex-shrink-0 min-h-[44px]"
    >
      <button
        class="text-[hsl(var(--muted-foreground))] hover:text-foreground transition-colors rounded flex items-center justify-center size-8 flex-shrink-0"
        :aria-label="t('chat.focus.toggleSidebar')"
        @click="emit('close')"
      >
        <UIcon
          name="i-heroicons-x-mark-20-solid"
          class="size-5"
        />
      </button>
      <h2 class="text-sm font-semibold text-foreground truncate flex-1">
        {{ t('chat.focus.sidebarTitle') }}
      </h2>
      <button
        v-if="focusedMessages.length > 0"
        class="text-xs text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--destructive))] transition-colors px-2 rounded flex items-center h-8 flex-shrink-0"
        @click="emit('clearAll')"
      >
        {{ t('chat.focus.clearAll') }}
      </button>
    </div>

    <div
      v-if="focusedMessages.length === 0"
      class="flex-1 flex items-center justify-center p-4"
    >
      <div class="text-center">
        <UIcon
          name="i-heroicons-bookmark"
          class="size-8 text-[hsl(var(--muted-foreground)/0.4)] mx-auto mb-2"
        />
        <p class="text-sm font-medium text-[hsl(var(--muted-foreground)/0.7)]">
          {{ t('chat.focus.emptyTitle') }}
        </p>
        <p class="text-xs text-[hsl(var(--muted-foreground)/0.5)] mt-1">
          {{ t('chat.focus.emptyDescription') }}
        </p>
      </div>
    </div>

    <div
      v-else
      ref="scrollContainer"
      class="flex-1 overflow-y-auto py-3 px-3 space-y-3"
    >
      <div
        v-for="message in focusedMessages"
        :key="message.messageID"
        :data-focus-id="message.messageID"
        class="flex flex-col"
        :class="isUserMessage(message) ? 'items-end' : 'items-start'"
      >
        <MessageBubble
          :message="message"
          :selected-answer="getSelectedAnswer(message)"
        />

        <div class="h-5 flex items-center pl-2">
          <div class="flex items-center gap-1.5 px-1">
            <span class="text-[10px] text-[hsl(var(--muted-foreground)/0.6)] select-none">
              {{ formatActionBarDate(message.sendDate) }}
            </span>
            <button
              class="text-[hsl(var(--muted-foreground)/0.5)] hover:text-[hsl(var(--muted-foreground))] transition-colors p-0.5 rounded"
              :aria-label="t('chat.messages.copyMessage')"
              @click="handleCopy(message.messageID, message.messageText)"
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
              class="text-[hsl(var(--primary))] hover:text-[hsl(var(--destructive))] transition-colors p-0.5 rounded"
              :aria-label="t('chat.focus.unfocusMessage')"
              @click="emit('toggleFocus', message.messageID)"
            >
              <UIcon
                name="i-heroicons-bookmark-solid"
                class="size-3"
              />
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import type { AISessionMessageDTO } from '@/types/api/schemas'
import { useMessagePresentation } from '@/app/composables/useMessagePresentation'
import { useAuthStore } from '~/stores/auth'
import MessageBubble from '@/app/components/chat/MessageBubble.vue'

const { t } = useI18n()
const authStore = useAuthStore()
const { isUserMessage, formatActionBarDate, handleCopy, copiedMessageId } = useMessagePresentation()

function getSelectedAnswer(message: AISessionMessageDTO): string | undefined {
  const userEmail = authStore.user?.email
  const msgIndex = props.messages.findIndex((m) => m.messageID === message.messageID)
  if (msgIndex === -1) return undefined
  for (let i = msgIndex + 1; i < props.messages.length; i++) {
    if (props.messages[i]!.senderUserCode === userEmail) {
      return props.messages[i]!.messageText ?? undefined
    }
  }
  return undefined
}

interface Props {
  messages: AISessionMessageDTO[]
  focusedIds: readonly string[]
  contentWidth: number
}

const props = defineProps<Props>()

const emit = defineEmits<{
  toggleFocus: [messageId: string]
  clearAll: []
  close: []
}>()

const scrollContainer = ref<HTMLElement>()

const focusedMessages = computed(() =>
  props.messages
    .filter((m) => props.focusedIds.includes(m.messageID))
    .sort((a, b) => new Date(a.sendDate).getTime() - new Date(b.sendDate).getTime()),
)

watch(
  () => props.focusedIds,
  (newIds, oldIds) => {
    const added = newIds.find((id) => !oldIds.includes(id))
    if (!added) return
    void nextTick(() => {
      scrollContainer.value
        ?.querySelector(`[data-focus-id="${CSS.escape(added)}"]`)
        ?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    })
  },
)
</script>
