<template>
  <header
    class="flex items-center justify-between px-4 py-3 border-b border-[hsl(var(--border))] bg-[hsl(var(--card))]"
  >
    <!-- Agent info -->
    <div class="flex items-center gap-3">
      <UserAvatar
        :image="agentImage"
        :dark-image="agentDarkImage"
        :alt="agentName ?? undefined"
        size="md"
      />
      <span class="font-medium text-[hsl(var(--foreground))]">{{ agentName }}</span>
    </div>

    <!-- New chat button -->
    <UButton
      icon="i-heroicons-plus"
      variant="ghost"
      size="md"
      @click="startNewChat"
    />
  </header>
</template>

<script setup lang="ts">
import UserAvatar from '@/app/components/UserAvatar.vue'

defineProps<{
  agentName?: string | null
  agentImage?: string | null
  agentDarkImage?: string | null
  agentId: number | null
}>()

const router = useRouter()

function startNewChat() {
  const { publicAgentId } = usePublicMode()
  const agentId = publicAgentId.value
  if (agentId) {
    void router.push(`/chats/public/new/${agentId}`)
  }
}
</script>
