<template>
  <div
    v-if="attachments.length > 0"
    class="flex flex-wrap gap-2"
    data-testid="file-attachment-list"
  >
    <div
      v-for="attachment in attachments"
      :key="attachment.id"
      class="flex items-center gap-2 px-2.5 py-1.5 rounded-lg border border-[hsl(var(--border)/0.5)] bg-[hsl(var(--muted)/0.3)] text-sm max-w-[240px]"
      :data-testid="`attachment-${attachment.id}`"
    >
      <img
        v-if="isImage(attachment) && previewUrls.get(attachment.id)"
        :src="previewUrls.get(attachment.id)"
        :alt="attachment.fileName"
        class="w-8 h-8 object-cover rounded shrink-0"
      />
      <UIcon
        v-else
        name="i-heroicons-paper-clip-20-solid"
        class="w-4 h-4 text-[hsl(var(--muted-foreground))] shrink-0"
      />

      <span class="truncate flex-1 min-w-0">{{ attachment.fileName }}</span>

      <div
        v-if="attachment.status === 'uploading'"
        class="w-4 h-4 shrink-0"
      >
        <UIcon
          name="i-heroicons-arrow-path-20-solid"
          class="w-4 h-4 animate-spin text-[hsl(var(--muted-foreground))]"
        />
      </div>

      <UIcon
        v-else-if="attachment.status === 'ready'"
        name="i-heroicons-check-circle-20-solid"
        class="w-4 h-4 text-emerald-500 shrink-0"
      />

      <template v-else-if="attachment.status === 'failed'">
        <UIcon
          name="i-heroicons-exclamation-circle-20-solid"
          class="w-4 h-4 text-rose-500 shrink-0"
        />
        <button
          type="button"
          class="shrink-0 text-rose-500 hover:text-rose-600"
          :aria-label="t('chat.messageInput.retryUpload')"
          data-testid="retry-upload-button"
          @click="emit('retry', attachment.id)"
        >
          <UIcon
            name="i-heroicons-arrow-path-20-solid"
            class="w-3.5 h-3.5"
          />
        </button>
      </template>

      <button
        type="button"
        class="shrink-0 text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
        :aria-label="t('chat.messageInput.removeAttachment')"
        data-testid="remove-attachment-button"
        @click="emit('remove', attachment.id)"
      >
        <UIcon
          name="i-heroicons-x-mark-20-solid"
          class="w-3.5 h-3.5"
        />
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, watch } from 'vue'
import type { StagedAttachment } from '@/types/fileAttachment'

const { t } = useI18n()

const props = defineProps<{
  attachments: StagedAttachment[]
}>()

const emit = defineEmits<{
  remove: [id: string]
  retry: [id: string]
}>()

const previewUrls = ref(new Map<string, string>())

function isImage(attachment: StagedAttachment): boolean {
  return attachment.mimeType.startsWith('image/')
}

watch(
  () => props.attachments,
  (newAttachments) => {
    const currentIds = new Set(newAttachments.map((a) => a.id))

    for (const [id, url] of previewUrls.value) {
      if (!currentIds.has(id)) {
        URL.revokeObjectURL(url)
        previewUrls.value.delete(id)
      }
    }

    for (const attachment of newAttachments) {
      if (isImage(attachment) && !previewUrls.value.has(attachment.id)) {
        previewUrls.value.set(attachment.id, URL.createObjectURL(attachment.file))
      }
    }
  },
  { immediate: true, deep: true },
)

onBeforeUnmount(() => {
  for (const url of previewUrls.value.values()) {
    URL.revokeObjectURL(url)
  }
})
</script>
