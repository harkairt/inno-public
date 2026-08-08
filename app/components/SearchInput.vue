<template>
  <UInput
    :model-value="modelValue"
    icon="i-heroicons-magnifying-glass"
    :placeholder="placeholder"
    :size="size"
    class="w-full"
    :ui="{ root: 'w-full', base: 'rounded-[12px]' }"
    v-bind="$attrs"
    @update:model-value="$emit('update:modelValue', $event)"
  />
</template>

<script setup lang="ts">
defineOptions({ inheritAttrs: false })

withDefaults(
  defineProps<{
    modelValue: string
    placeholder?: string
    size?: 'sm' | 'md' | 'lg' | 'xl'
  }>(),
  {
    size: 'lg',
  },
)

defineEmits<{
  'update:modelValue': [value: string]
}>()
</script>
