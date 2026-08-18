<template>
  <div
    v-if="attachments.length > 0"
    class="flex flex-wrap gap-2"
    data-testid="file-attachment-list"
  >
    <div
      v-for="attachment in attachments"
      :key="attachment.id"
      class="group/attach relative flex items-center gap-2 px-2.5 h-10 rounded-lg border border-[hsl(var(--border)/0.5)] bg-[hsl(var(--muted)/0.3)] text-sm max-w-[240px]"
      :data-testid="`attachment-${attachment.id}`"
    >
      <img
        v-if="isImage(attachment) && previewUrls.get(attachment.id)"
        :src="previewUrls.get(attachment.id)"
        :alt="attachment.fileName"
        class="w-7 h-7 object-cover rounded shrink-0"
      />
      <UIcon
        v-else
        :name="fileTypeIcon(attachment)"
        class="w-7 h-7 shrink-0"
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

      <button
        type="button"
        class="absolute -top-2 -right-2 flex items-center justify-center w-5 h-5 opacity-0 group-hover/attach:opacity-100 transition-opacity rounded-full bg-[hsl(var(--muted))] border border-[hsl(var(--border))] text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
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
import { fileTypeIcon } from '@/app/utils/fileIcon'

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
