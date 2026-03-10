<template>
  <div class="flex flex-1 h-full overflow-hidden">
    <ChatListPanel v-if="!isMobile" class="w-80 border-r border-[hsl(var(--border)/0.5)] flex-shrink-0" />
    <NuxtPage class="flex-1 min-w-0" />
  </div>
</template>

<script setup lang="ts">
import { useNavigationVisibility } from '~/composables/useNavigationVisibility'
import ChatListPanel from '~/components/chat/ChatListPanel.vue'

const { isMobile } = useNavigationVisibility()
</script>
