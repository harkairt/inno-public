<template>
  <div class="space-y-3">
    <!-- Question text -->
    <MarkdownContent
      v-if="payload.Text"
      :content="payload.Text"
    />

    <!-- Combobox (single-select only) -->
    <div
      v-if="isCombobox"
      class="grid grid-cols-1"
      :class="
        selectedCombobox === CUSTOM_SENTINEL ? 'grid-rows-[auto_auto]' : 'grid-rows-[auto_0fr]'
      "
      @focusin="handleGridFocus"
    >
      <USelect
        v-model="selectedCombobox"
        :items="comboboxItems"
        :disabled="!isActive"
        :content="{ side: 'top' }"
        class="w-full"
      />
      <div
        ref="plainTextWrapper"
        class="overflow-hidden min-h-0"
      >
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
    <div
      v-else-if="!payload.MultiSelectEnabled"
      class="space-y-1.5"
    >
      <div
        v-for="item in payload.Items"
        :key="item.Key"
        class="flex items-start gap-2.5 px-3 py-2 rounded-lg border cursor-pointer transition-all duration-150"
        :class="[
          isActive
            ? 'hover:bg-[hsl(var(--accent))] cursor-pointer'
            : 'opacity-50 cursor-default pointer-events-none',
          selectedSingle === item.Value
            ? 'border-[hsl(var(--primary))] bg-[hsl(var(--accent))]'
            : 'border-[hsl(var(--border))]',
        ]"
        @click="onSingleRowClick($event, item.Value)"
      >
        <div
          class="w-4 h-4 mt-0.5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors"
          :class="
            selectedSingle === item.Value
              ? 'border-[hsl(var(--primary))] bg-[hsl(var(--primary))]'
              : 'border-[hsl(var(--muted-foreground))]'
          "
        >
          <div
            v-if="selectedSingle === item.Value"
            class="w-1.5 h-1.5 rounded-full bg-white"
          />
        </div>
        <div class="option-markdown min-w-0 flex-1">
          <MarkdownContent :content="item.Value" />
        </div>
      </div>
      <div
        v-if="payload.IsPlainTextEnabled"
        class="inline-plain-text flex items-center gap-2.5 px-3 py-2 rounded-lg border cursor-text transition-all duration-150"
        :class="[
          isActive
            ? 'hover:bg-[hsl(var(--accent))]'
            : 'opacity-50 cursor-default pointer-events-none',
          selectedSingle === CUSTOM_SENTINEL
            ? 'border-[hsl(var(--primary))] bg-[hsl(var(--accent))]'
            : 'border-[hsl(var(--border))]',
        ]"
        @click="focusPlainTextInput('single')"
      >
        <div
          class="w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors"
          :class="
            selectedSingle === CUSTOM_SENTINEL
              ? 'border-[hsl(var(--primary))] bg-[hsl(var(--primary))]'
              : 'border-[hsl(var(--muted-foreground))]'
          "
        >
          <div
            v-if="selectedSingle === CUSTOM_SENTINEL"
            class="w-1.5 h-1.5 rounded-full bg-white"
          />
        </div>
        <UInput
          ref="singlePlainTextInput"
          v-model="plainText"
          :placeholder="t('chat.options.plainTextPlaceholder')"
          :disabled="!isActive"
          variant="none"
          class="min-w-0 flex-1 -my-1 [&_input]:px-0"
        />
      </div>
    </div>

    <!-- Multi-select list -->
    <div
      v-else
      class="space-y-1.5"
    >
      <div
        v-for="item in payload.Items"
        :key="item.Key"
        class="flex items-start gap-2.5 px-3 py-2 rounded-lg border transition-all duration-150"
        :class="[
          isActive
            ? 'hover:bg-[hsl(var(--accent))] cursor-pointer'
            : 'opacity-50 cursor-default pointer-events-none',
          selectedMultiple.includes(item.Value)
            ? 'border-[hsl(var(--primary))] bg-[hsl(var(--accent))]'
            : 'border-[hsl(var(--border))]',
        ]"
        @click="onMultiRowClick($event, item.Value)"
      >
        <div
          class="w-4 h-4 mt-0.5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors"
          :class="
            selectedMultiple.includes(item.Value)
              ? 'border-[hsl(var(--primary))] bg-[hsl(var(--primary))]'
              : 'border-[hsl(var(--muted-foreground))]'
          "
        >
          <UIcon
            v-if="selectedMultiple.includes(item.Value)"
            name="i-heroicons-check"
            class="size-2.5 text-white"
          />
        </div>
        <div class="option-markdown min-w-0 flex-1">
          <MarkdownContent :content="item.Value" />
        </div>
      </div>
      <div
        v-if="payload.IsPlainTextEnabled"
        class="inline-plain-text flex items-center gap-2.5 px-3 py-2 rounded-lg border cursor-text transition-all duration-150"
        :class="[
          isActive
            ? 'hover:bg-[hsl(var(--accent))]'
            : 'opacity-50 cursor-default pointer-events-none',
          selectedMultiple.includes(CUSTOM_SENTINEL)
            ? 'border-[hsl(var(--primary))] bg-[hsl(var(--accent))]'
            : 'border-[hsl(var(--border))]',
        ]"
        @click="focusPlainTextInput('multi')"
      >
        <div
          class="w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors"
          :class="
            selectedMultiple.includes(CUSTOM_SENTINEL)
              ? 'border-[hsl(var(--primary))] bg-[hsl(var(--primary))]'
              : 'border-[hsl(var(--muted-foreground))]'
          "
        >
          <UIcon
            v-if="selectedMultiple.includes(CUSTOM_SENTINEL)"
            name="i-heroicons-check"
            class="size-2.5 text-white"
          />
        </div>
        <UInput
          ref="multiPlainTextInput"
          v-model="plainText"
          :placeholder="t('chat.options.plainTextPlaceholder')"
          :disabled="!isActive"
          variant="none"
          class="min-w-0 flex-1 -my-1 [&_input]:px-0"
        />
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
import { useMarkdown } from '@/app/composables/useMarkdown'
import { restoreMultiSelectAnswer } from '@/app/utils/optionAnswer'

const CUSTOM_SENTINEL = '__custom__'

const { t } = useI18n()
const { toPlainText } = useMarkdown()

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
const singlePlainTextInput = useTemplateRef('singlePlainTextInput')
const multiPlainTextInput = useTemplateRef('multiPlainTextInput')
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

function focusPlainTextInput(mode: 'single' | 'multi') {
  if (!props.isActive) return
  const inputRef = mode === 'single' ? singlePlainTextInput : multiPlainTextInput
  const el = (inputRef.value as { $el?: HTMLElement })?.$el
  const input = el?.querySelector<HTMLInputElement>('input') ?? el?.closest('input')
  input?.focus()
}

watch(plainText, (val) => {
  if (!props.payload.IsPlainTextEnabled) return
  const hasText = val.trim() !== ''

  if (props.payload.MultiSelectEnabled) {
    const idx = selectedMultiple.value.indexOf(CUSTOM_SENTINEL)
    if (hasText && idx === -1) {
      selectedMultiple.value.push(CUSTOM_SENTINEL)
    } else if (!hasText && idx !== -1) {
      selectedMultiple.value.splice(idx, 1)
    }
  } else if (!isCombobox.value) {
    if (hasText) {
      selectedSingle.value = CUSTOM_SENTINEL
    } else if (selectedSingle.value === CUSTOM_SENTINEL) {
      selectedSingle.value = ''
    }
  }
})

const isCombobox = computed(
  () =>
    !props.payload.MultiSelectEnabled &&
    props.payload.UIControlType === OptionsUIControlType.Combobox,
)

const comboboxItems = computed(() => {
  const items = props.payload.Items.map((item) => ({
    label: toPlainText(item.Value),
    value: item.Value,
  }))
  if (props.payload.IsPlainTextEnabled) {
    items.push({ label: t('chat.options.customOption'), value: CUSTOM_SENTINEL })
  }
  return items
})

function restoreMultiSelect(answer: string) {
  const { matched, unmatched } = restoreMultiSelectAnswer(
    answer,
    props.payload.Items.map((item) => item.Value),
  )

  selectedMultiple.value = matched
  if (unmatched.length > 0 && props.payload.IsPlainTextEnabled) {
    plainText.value = unmatched.join(', ')
    selectedMultiple.value.push(CUSTOM_SENTINEL)
  }
}

function restoreSingleSelect(answer: string) {
  const matchesItem = props.payload.Items.some((item) => item.Value === answer)
  const target = isCombobox.value ? selectedCombobox : selectedSingle

  if (matchesItem) {
    target.value = answer
    return
  }

  if (props.payload.IsPlainTextEnabled) {
    plainText.value = answer
    target.value = CUSTOM_SENTINEL
  }
}

watchEffect(() => {
  if (!props.selectedAnswer || props.isActive) return

  if (props.payload.MultiSelectEnabled) {
    restoreMultiSelect(props.selectedAnswer)
  } else {
    restoreSingleSelect(props.selectedAnswer)
  }
})

const hasSelection = computed(() => {
  if (props.payload.MultiSelectEnabled) {
    const nonCustom = selectedMultiple.value.filter((v) => v !== CUSTOM_SENTINEL)
    const hasCustom =
      selectedMultiple.value.includes(CUSTOM_SENTINEL) && plainText.value.trim() !== ''
    return nonCustom.length > 0 || hasCustom
  }
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

function isMarkdownInteraction(e: MouseEvent): boolean {
  return e.target instanceof Element && e.target.closest('a, img') !== null
}

function onSingleRowClick(e: MouseEvent, value: string) {
  if (!props.isActive || isMarkdownInteraction(e)) return
  selectSingle(value)
}

function onMultiRowClick(e: MouseEvent, value: string) {
  if (!props.isActive || isMarkdownInteraction(e)) return
  toggleMultiple(value)
}

function handleSubmit() {
  if (!hasSelection.value) return
  if (props.payload.MultiSelectEnabled) {
    const answers = selectedMultiple.value.map((v) =>
      v === CUSTOM_SENTINEL ? plainText.value.trim() : v,
    )
    emit('submit', answers.filter(Boolean).join(', '))
    return
  }
  const isCustom = isCombobox.value
    ? selectedCombobox.value === CUSTOM_SENTINEL
    : selectedSingle.value === CUSTOM_SENTINEL
  const selectedValue = isCombobox.value ? selectedCombobox.value : selectedSingle.value
  emit('submit', isCustom ? plainText.value.trim() : selectedValue)
}
</script>
