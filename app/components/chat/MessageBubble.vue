<template>
  <div
    class="message-bubble px-2.5 py-2.5"
    :class="[
      wide ? 'max-w-full' : maxWidthClass,
      {
        'rounded-br-md': isOwn,
        'rounded-bl-md': !isOwn,
      },
    ]"
    :style="isOwn ? ownMessageStyle : partnerMessageStyle"
  >
    <slot name="header" />

    <template v-if="message.messageType === AIAnswerType.Options">
      <MarkdownContent
        v-if="!parseOptionsPayload(message.messageText)"
        :content="message.messageText"
      />
      <OptionsMessage
        v-else
        :payload="parseOptionsPayload(message.messageText)!"
        :is-active="optionsActive"
        :selected-answer="selectedAnswer"
        @submit="(answer: string) => emit('optionSubmitted', answer)"
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
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { AISessionMessageDTO } from '@/types/api/schemas'
import { parseOptionsPayload } from '@/types/api/schemas'
import { AIAnswerType } from '@/types/enums'
import { useMessagePresentation } from '@/app/composables/useMessagePresentation'
import { hasWideContent } from '@/app/utils/messageContent'
import MarkdownContent from '@/app/components/chat/MarkdownContent.vue'
import OptionsMessage from '@/app/components/chat/OptionsMessage.vue'
import FileMessage from '@/app/components/chat/FileMessage.vue'

const { ownMessageStyle, partnerMessageStyle, isUserMessage } = useMessagePresentation()

const props = withDefaults(
  defineProps<{
    message: AISessionMessageDTO
    optionsActive?: boolean
    selectedAnswer?: string
    maxWidthClass?: string
  }>(),
  {
    optionsActive: false,
    selectedAnswer: undefined,
    maxWidthClass: 'w-fit max-w-full',
  },
)

const emit = defineEmits<{
  optionSubmitted: [answer: string]
}>()

const isOwn = computed(() => isUserMessage(props.message))
const wide = computed(() => hasWideContent(props.message))
</script>

<style scoped>
.message-bubble {
  overflow-wrap: break-word;
  word-break: break-word;
}
</style>
