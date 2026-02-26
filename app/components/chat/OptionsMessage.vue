<template>
  <div class="space-y-3">
    <!-- Question text -->
    <p v-if="payload.Text" class="text-sm text-[hsl(var(--muted-foreground))]">
      {{ payload.Text }}
    </p>

    <!-- Single-select items (radio style) -->
    <div v-if="!payload.MultiSelectEnabled" class="space-y-1.5">
      <div
        v-for="item in payload.Items"
        :key="item.Key"
        class="flex items-center gap-2.5 px-3 py-2 rounded-lg border cursor-pointer transition-all duration-150"
        :class="[
          isActive ? 'hover:bg-[hsl(var(--accent))] cursor-pointer' : 'opacity-50 cursor-default pointer-events-none',
          selectedSingle === item.Value
            ? 'border-[hsl(var(--primary))] bg-[hsl(var(--accent))]'
            : 'border-[hsl(var(--border))]'
        ]"
        @click="isActive && (selectedSingle = item.Value)"
      >
        <!-- Radio indicator -->
        <div
          class="w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors"
          :class="selectedSingle === item.Value
            ? 'border-[hsl(var(--primary))] bg-[hsl(var(--primary))]'
            : 'border-[hsl(var(--muted-foreground))]'"
        >
          <div
            v-if="selectedSingle === item.Value"
            class="w-1.5 h-1.5 rounded-full bg-white"
          />
        </div>
        <span class="text-sm">{{ item.Value }}</span>
      </div>
    </div>

    <!-- Multi-select items (checkbox style) -->
    <div v-else class="space-y-1.5">
      <div
        v-for="item in payload.Items"
        :key="item.Key"
        class="flex items-center gap-2.5 px-3 py-2 rounded-lg border transition-all duration-150"
        :class="[
          isActive ? 'hover:bg-[hsl(var(--accent))] cursor-pointer' : 'opacity-50 cursor-default pointer-events-none',
          selectedMultiple.includes(item.Value)
            ? 'border-[hsl(var(--primary))] bg-[hsl(var(--accent))]'
            : 'border-[hsl(var(--border))]'
        ]"
        @click="isActive && toggleMultiple(item.Value)"
      >
        <!-- Checkbox indicator -->
        <div
          class="w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors"
          :class="selectedMultiple.includes(item.Value)
            ? 'border-[hsl(var(--primary))] bg-[hsl(var(--primary))]'
            : 'border-[hsl(var(--muted-foreground))]'"
        >
          <UIcon
            v-if="selectedMultiple.includes(item.Value)"
            name="i-heroicons-check"
            class="size-2.5 text-white"
          />
        </div>
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
import { ref, computed } from 'vue'
import type { OptionsMessagePayload } from '@/types/api/schemas'

const { t } = useI18n()

interface Props {
  payload: OptionsMessagePayload
  isActive: boolean
}

const props = defineProps<Props>()
const emit = defineEmits<{
  submit: [answer: string]
}>()

const selectedSingle = ref<string>('')
const selectedMultiple = ref<string[]>([])

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
