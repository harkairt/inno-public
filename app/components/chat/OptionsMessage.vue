<template>
  <div class="space-y-3">
    <!-- Question text -->
    <MarkdownContent v-if="payload.Text" :content="payload.Text" />

    <!-- Single-select items -->
    <div v-if="!payload.MultiSelectEnabled" class="space-y-1.5">
      <div
        v-for="item in payload.Items"
        :key="item.Key"
        class="flex items-center justify-center px-3 py-2 rounded-lg border border-[hsl(var(--foreground))] transition-all duration-150"
        :class="[
          isActive ? 'hover:bg-[hsl(var(--accent))] cursor-pointer' : 'cursor-default',
          selectedSingle === item.Value ? 'shadow-[inset_0_0_0_1.5px_hsl(var(--foreground))]' : '',
          !isActive && selectedSingle !== item.Value ? 'opacity-50' : ''
        ]"
        @click="isActive && (selectedSingle = item.Value)"
      >
        <span class="text-sm">{{ item.Value }}</span>
      </div>
    </div>

    <!-- Multi-select items -->
    <div v-else class="space-y-1.5">
      <div
        v-for="item in payload.Items"
        :key="item.Key"
        class="flex items-center justify-center px-3 py-2 rounded-lg border border-[hsl(var(--foreground))] transition-all duration-150"
        :class="[
          isActive ? 'hover:bg-[hsl(var(--accent))] cursor-pointer' : 'cursor-default',
          selectedMultiple.includes(item.Value) ? 'shadow-[inset_0_0_0_1.5px_hsl(var(--foreground))]' : '',
          !isActive && !selectedMultiple.includes(item.Value) ? 'opacity-50' : ''
        ]"
        @click="isActive && toggleMultiple(item.Value)"
      >
        <span class="text-sm">{{ item.Value }}</span>
      </div>
    </div>

    <!-- Submit button (only shown when active) -->
    <UButton
      v-if="isActive"
      size="sm"
      :disabled="!hasSelection"
      class="mt-2"
      @click="handleSubmit"
    >
      {{ t('chat.options.submit') }}
    </UButton>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watchEffect } from 'vue'
import type { OptionsMessagePayload } from '@/types/api/schemas'
import MarkdownContent from '@/app/components/chat/MarkdownContent.vue'

const { t } = useI18n()

interface Props {
  payload: OptionsMessagePayload
  isActive: boolean
  selectedAnswer?: string
}

const props = withDefaults(defineProps<Props>(), {
  selectedAnswer: undefined,
})
const emit = defineEmits<{
  submit: [answer: string]
}>()

const selectedSingle = ref<string>('')
const selectedMultiple = ref<string[]>([])

// Pre-select the answer for previously answered options messages
watchEffect(() => {
  if (props.selectedAnswer && !props.isActive) {
    if (props.payload.MultiSelectEnabled) {
      selectedMultiple.value = props.selectedAnswer.split(', ').filter(v =>
        props.payload.Items.some(item => item.Value === v),
      )
    } else {
      selectedSingle.value = props.selectedAnswer
    }
  }
})

const hasSelection = computed(() => {
  if (props.payload.MultiSelectEnabled) {
    return selectedMultiple.value.length > 0
  }
  return selectedSingle.value !== ''
})

function toggleMultiple(value: string) {
  const idx = selectedMultiple.value.indexOf(value)
  if (idx === -1) {
    selectedMultiple.value.push(value)
  } else {
    selectedMultiple.value.splice(idx, 1)
  }
}

function handleSubmit() {
  if (!hasSelection.value) return
  const answer = props.payload.MultiSelectEnabled
    ? selectedMultiple.value.join(', ')
    : selectedSingle.value
  emit('submit', answer)
}
</script>
