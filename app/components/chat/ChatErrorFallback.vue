<template>
  <div
    class="flex items-center justify-center p-6"
    :class="fullScreen ? 'min-h-screen bg-background' : 'h-full'"
  >
    <div class="text-center max-w-md">
      <UAlert
        variant="soft"
        :title="title"
        :description="description"
        class="mb-4"
      >
        <template #actions>
          <div class="flex space-x-2">
            <UButton
              v-if="showRetry"
              size="xs"
              variant="outline"
              @click="emit('retry')"
            >
              {{ t('errors.tryAgain') }}
            </UButton>
            <UButton
              size="xs"
              variant="outline"
              @click="navigateTo('/chats')"
            >
              {{ t('errors.backToChats') }}
            </UButton>
          </div>
        </template>
      </UAlert>
    </div>
  </div>
</template>

<script setup lang="ts">
const { t } = useI18n()

defineProps<{
  title: string
  description: string
  fullScreen?: boolean
  showRetry?: boolean
}>()

const emit = defineEmits<{
  retry: []
}>()
</script>
