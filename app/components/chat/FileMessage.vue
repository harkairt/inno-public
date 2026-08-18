<template>
  <div class="space-y-2">
    <MarkdownContent
      v-if="payload?.text"
      :content="payload.text"
    />

    <div
      v-if="imageFiles.length > 0"
      v-viewer.rebuild="interactive ? { url: 'data-source' } : false"
      class="grid gap-1.5"
      :class="imageFiles.length === 1 ? 'grid-cols-1 max-w-[240px]' : 'grid-cols-2 max-w-[480px]'"
    >
      <FileEntry
        v-for="file in imageFiles"
        :key="file.id"
        :file="file"
        mode="thumbnail"
        :interactive="interactive"
      />
    </div>

    <div
      v-if="nonImageFiles.length > 0"
      class="flex flex-wrap gap-2"
    >
      <FileEntry
        v-for="file in nonImageFiles"
        :key="file.id"
        :file="file"
        mode="chip"
        :interactive="interactive"
      />
    </div>

    <MarkdownContent
      v-if="!payload"
      :content="messageText ?? ''"
    />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { FileMessagePayloadSchema } from '@/types/api/schemas'
import MarkdownContent from '@/app/components/chat/MarkdownContent.vue'
import FileEntry from '@/app/components/chat/FileEntry.vue'

const props = withDefaults(
  defineProps<{
    messageText: string | null | undefined
    interactive?: boolean
  }>(),
  { interactive: true },
)

const payload = computed(() => {
  if (!props.messageText) return null
  try {
    let parsed: unknown = props.messageText
    for (let i = 0; i < 5 && typeof parsed === 'string'; i++) {
      parsed = JSON.parse(parsed)
    }
    const result = FileMessagePayloadSchema.safeParse(parsed)
    return result.success ? result.data : null
  } catch {
    return null
  }
})

const imageFiles = computed(
  () => payload.value?.files.filter((f) => f.mimeType.startsWith('image/')) ?? [],
)

const nonImageFiles = computed(
  () => payload.value?.files.filter((f) => !f.mimeType.startsWith('image/')) ?? [],
)
</script>
