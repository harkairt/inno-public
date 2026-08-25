<template>
  <div
    v-if="visible"
    class="absolute inset-0 z-10 flex items-center justify-center bg-[hsl(var(--primary)/0.1)] border-2 border-dashed border-[hsl(var(--primary))] rounded-lg pointer-events-none"
  >
    <span class="text-sm font-medium text-[hsl(var(--primary))]">
      {{ t('chat.messageInput.dropZone') }}
    </span>
  </div>
</template>

<script setup lang="ts">
const { t } = useI18n()

defineProps<{
  visible: boolean
}>()
</script>
