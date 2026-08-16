<template>
  <div
    class="flex h-full flex-shrink-0 overflow-hidden"
    :class="[
      sidebarOpen ? 'border-l border-[hsl(var(--border)/0.5)]' : 'border-l border-transparent',
      !isResizing && 'transition-[width,border-color] duration-300 ease-in-out',
    ]"
    :style="{ width: sidebarOpen ? `${sidebarWidth}px` : '0px' }"
  >
    <div
      class="w-1 cursor-col-resize hover:bg-[hsl(var(--primary)/0.3)] active:bg-[hsl(var(--primary)/0.5)] transition-colors flex-shrink-0"
      @mousedown="onResizeStart"
      @touchstart="onResizeStart"
    />

    <div
      class="flex flex-col flex-1 h-full"
      :style="{ minWidth: `${sidebarWidth - 4}px` }"
    >
      <div
        class="flex items-center justify-between px-3 py-2 border-b border-[hsl(var(--border)/0.5)] flex-shrink-0"
      >
        <h2 class="text-sm font-semibold text-foreground truncate">
          {{ t('chat.focus.sidebarTitle') }}
        </h2>
        <div class="flex items-center gap-1">
          <button
            v-if="focusedMessages.length > 0"
            class="text-xs text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--destructive))] transition-colors px-2 rounded flex items-center h-8"
            @click="emit('clearAll')"
          >
            {{ t('chat.focus.clearAll') }}
          </button>
          <button
            class="text-[hsl(var(--muted-foreground))] hover:text-foreground transition-colors rounded flex items-center justify-center size-8"
            :aria-label="t('chat.focus.toggleSidebar')"
            @click="emit('update:sidebarOpen', false)"
          >
            <UIcon
              name="i-heroicons-x-mark-20-solid"
              class="size-5"
            />
          </button>
        </div>
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
        class="flex-1 overflow-y-auto py-3 px-3 space-y-3"
      >
        <div
          v-for="message in focusedMessages"
          :key="message.messageID"
          class="flex flex-col"
          :class="isUserMessage(message) ? 'items-end' : 'items-start'"
        >
          <div
            class="message-bubble px-3.5 py-1"
            :class="hasRichContent(message) ? 'w-full' : 'w-fit max-w-full'"
            :style="isUserMessage(message) ? ownMessageStyle : partnerMessageStyle"
          >
            <template
              v-if="
                message.messageType === AIAnswerType.Options &&
                parseOptionsPayload(message.messageText)
              "
            >
              <OptionsMessage
                :payload="parseOptionsPayload(message.messageText)!"
                :is-active="false"
                :selected-answer="getSelectedAnswer(message)"
              />
            </template>
            <FileMessage
              v-else-if="message.messageType === AIAnswerType.File"
              :message-text="message.messageText"
            />
            <MarkdownContent
              v-else
              :content="message.messageText"
            />
          </div>

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
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { AISessionMessageDTO } from '@/types/api/schemas'
import { parseOptionsPayload } from '@/types/api/schemas'
import { AIAnswerType } from '@/types/enums'
import { useMessagePresentation } from '@/app/composables/useMessagePresentation'
import { usePanelResize } from '~/composables/usePanelResize'
import { useAuthStore } from '~/stores/auth'
import MarkdownContent from '@/app/components/chat/MarkdownContent.vue'
import OptionsMessage from '@/app/components/chat/OptionsMessage.vue'
import FileMessage from '@/app/components/chat/FileMessage.vue'

const { t } = useI18n()
const authStore = useAuthStore()
const {
  ownMessageStyle,
  partnerMessageStyle,
  isUserMessage,
  formatActionBarDate,
  handleCopy,
  copiedMessageId,
} = useMessagePresentation()

const WIDE_CONTENT_MARKERS = [
  '```echarts',
  '```chart.js',
  '```bar-race',
  '```rows',
  '```h-rows',
  '```pivot',
]
const MD_TABLE_RE = /^\|.+\|/m

function hasRichContent(message: AISessionMessageDTO): boolean {
  if (message.messageType === AIAnswerType.Options) return true
  if (message.messageType === AIAnswerType.DataTable) return true
  if (message.messageType === AIAnswerType.File) return true
  const text = message.messageText
  if (!text) return false
  return WIDE_CONTENT_MARKERS.some((marker) => text.includes(marker)) || MD_TABLE_RE.test(text)
}

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
  sidebarOpen: boolean
}

const props = defineProps<Props>()

const emit = defineEmits<{
  toggleFocus: [messageId: string]
  clearAll: []
  'update:sidebarOpen': [value: boolean]
}>()

const {
  width: sidebarWidth,
  isResizing,
  onResizeStart,
} = usePanelResize({
  defaultWidth: 380,
  minWidth: 280,
  maxWidthFraction: 0.5,
  direction: 'right',
})

const focusedMessages = computed(() =>
  props.messages
    .filter((m) => props.focusedIds.includes(m.messageID))
    .sort((a, b) => new Date(a.sendDate).getTime() - new Date(b.sendDate).getTime()),
)
</script>

<style scoped>
.message-bubble {
  overflow-wrap: break-word;
  word-break: break-word;
}
</style>
