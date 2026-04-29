<template>
  <div class="space-y-3">
    <!-- Question text -->
    <MarkdownContent v-if="payload.Text" :content="payload.Text" />

    <!-- Combobox (single-select only) -->
    <div v-if="isCombobox" class="grid grid-cols-1" :class="selectedCombobox === CUSTOM_SENTINEL ? 'grid-rows-[auto_auto]' : 'grid-rows-[auto_0fr]'" @focusin="handleGridFocus">
      <USelect
        v-model="selectedCombobox"
        :items="comboboxItems"
        :disabled="!isActive"
        :content="{ side: 'top' }"
        class="w-full"
      />
      <div ref="plainTextWrapper" class="overflow-hidden min-h-0">
        <div class="pt-3">
          <UInput
            v-model="plainText"
            :placeholder="t('chat.options.plainTextPlaceholder')"
            :disabled="!isActive"
            class="w-full"
          />
        </div>
      </div>
    </div>

    <!-- Single-select radio list -->
    <div v-else-if="!payload.MultiSelectEnabled" class="space-y-1.5">
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
        @click="isActive && selectSingle(item.Value)"
      >
        <div
          class="w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors"
          :class="selectedSingle === item.Value
            ? 'border-[hsl(var(--primary))] bg-[hsl(var(--primary))]'
            : 'border-[hsl(var(--muted-foreground))]'"
        >
          <div v-if="selectedSingle === item.Value" class="w-1.5 h-1.5 rounded-full bg-white" />
        </div>
        <span class="text-sm">{{ item.Value }}</span>
      </div>
      <div
        v-if="payload.IsPlainTextEnabled"
        class="px-3 py-2 rounded-lg border border-[hsl(var(--foreground))] transition-all duration-150"
        :class="[
          isActive ? 'hover:bg-[hsl(var(--accent))] cursor-pointer' : 'cursor-default',
          selectedSingle === CUSTOM_SENTINEL ? 'shadow-[inset_0_0_0_1.5px_hsl(var(--foreground))]' : '',
          !isActive && selectedSingle !== CUSTOM_SENTINEL ? 'opacity-50' : ''
        ]"
        @click="isActive && selectSingle(CUSTOM_SENTINEL)"
      >
        <template v-if="selectedSingle === CUSTOM_SENTINEL">
          <UInput
            v-model="plainText"
            :placeholder="t('chat.options.plainTextPlaceholder')"
            :disabled="!isActive"
            variant="none"
            class="w-full"
            @click.stop
          />
        </template>
        <span v-else class="text-sm">{{ t('chat.options.customOption') }}</span>
      </div>
    </div>

    <!-- Multi-select list -->
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
import { ref, computed, watch, watchEffect, useTemplateRef } from 'vue'
import type { OptionsMessagePayload } from '@/types/api/schemas'
import { OptionsUIControlType } from '@/types/enums'
import MarkdownContent from '@/app/components/chat/MarkdownContent.vue'

const CUSTOM_SENTINEL = '__custom__'

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
const selectedCombobox = ref<string>('')
const plainText = ref<string>('')
const plainTextWrapper = useTemplateRef<HTMLDivElement>('plainTextWrapper')
let pendingFocusRedirect = false

watch(selectedCombobox, (val) => {
  pendingFocusRedirect = val === CUSTOM_SENTINEL
})

function handleGridFocus(e: FocusEvent) {
  if (!pendingFocusRedirect) return
  const input = plainTextWrapper.value?.querySelector<HTMLInputElement>('input')
  if (input && e.target !== input) {
    pendingFocusRedirect = false
    input.focus()
  }
}

const isCombobox = computed(
  () => !props.payload.MultiSelectEnabled && props.payload.UIControlType === OptionsUIControlType.Combobox,
)

const comboboxItems = computed(() => {
  const items = props.payload.Items.map(item => ({ label: item.Value, value: item.Value }))
  if (props.payload.IsPlainTextEnabled) {
    items.push({ label: t('chat.options.customOption'), value: CUSTOM_SENTINEL })
  }
  return items
})

watchEffect(() => {
  if (props.selectedAnswer && !props.isActive) {
    if (props.payload.MultiSelectEnabled) {
      selectedMultiple.value = props.selectedAnswer.split(', ').filter(v =>
        props.payload.Items.some(item => item.Value === v),
      )
    } else {
      const matchesItem = props.payload.Items.some(item => item.Value === props.selectedAnswer)
      if (matchesItem) {
        if (isCombobox.value) {
          selectedCombobox.value = props.selectedAnswer
        } else {
          selectedSingle.value = props.selectedAnswer
        }
      } else if (props.payload.IsPlainTextEnabled) {
        plainText.value = props.selectedAnswer
        if (isCombobox.value) {
          selectedCombobox.value = CUSTOM_SENTINEL
        } else {
          selectedSingle.value = CUSTOM_SENTINEL
        }
      }
    }
  }
})

const hasSelection = computed(() => {
  if (props.payload.MultiSelectEnabled) return selectedMultiple.value.length > 0
  if (isCombobox.value) {
    if (selectedCombobox.value === CUSTOM_SENTINEL) return plainText.value.trim() !== ''
    return selectedCombobox.value !== ''
  }
  if (selectedSingle.value === CUSTOM_SENTINEL) return plainText.value.trim() !== ''
  return selectedSingle.value !== ''
})

function selectSingle(value: string) {
  selectedSingle.value = value
  if (value !== CUSTOM_SENTINEL) {
    plainText.value = ''
  }
}

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
  if (props.payload.MultiSelectEnabled) {
    emit('submit', selectedMultiple.value.join(', '))
    return
  }
  const isCustom = isCombobox.value
    ? selectedCombobox.value === CUSTOM_SENTINEL
    : selectedSingle.value === CUSTOM_SENTINEL
  emit('submit', isCustom ? plainText.value.trim() : (isCombobox.value ? selectedCombobox.value : selectedSingle.value))
}
</script>
