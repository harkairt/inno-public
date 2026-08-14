<template>
  <div class="flex flex-col h-full">
    <!-- Mobile: full-page session list -->
    <ChatListPanel v-if="isMobile" />

    <!-- Desktop: centered icon (session list is in parent wrapper) -->
    <div
      v-else
      class="flex-1 flex items-center justify-center"
    >
      <UIcon
        name="i-ph-chats"
        class="size-48 text-[var(--ui-primary)]"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { useNavigationVisibility } from '~/composables/useNavigationVisibility'
import { useChatStore } from '~/stores/chat'
import ChatListPanel from '~/components/chat/ChatListPanel.vue'

const { isMobile } = useNavigationVisibility()
const chatStore = useChatStore()

chatStore.setActiveSession(null)

definePageMeta({
  title: 'Chat History',
  description: 'View your previous chat conversations',
})

useSeoMeta({
  title: 'Chat History',
  description: 'View and manage your previous conversations',
})
</script>
