<template>
  <!-- Loading state: show spinner while config is loading -->
  <div v-if="!configStore.isLoaded" class="h-dvh flex items-center justify-center bg-[hsl(var(--background))]">
    <div class="flex flex-col items-center gap-3">
      <div class="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  </div>

  <!-- Error state: show error message if public auth failed -->
  <div v-else-if="hasPublicAuthError" class="h-dvh flex items-center justify-center bg-[hsl(var(--background))] px-4">
    <div class="text-center max-w-md">
      <div class="text-4xl mb-4">😔</div>
      <h1 class="text-xl font-semibold text-foreground mb-2">
        {{ t('public.authError.title') }}
      </h1>
      <p class="text-muted-foreground">
        {{ t('public.authError.description') }}
      </p>
    </div>
  </div>

  <!-- Main content: minimal full-height container -->
  <div v-else class="h-dvh flex flex-col bg-[hsl(var(--background))]">
    <PublicChatHeader
      v-if="publicChatData?.agent"
      :agent-name="publicChatData.agent.name"
      :agent-image="publicChatData.agent.image"
      :agent-dark-image="publicChatData.agent.darkImage"
      :agent-id="publicAgentId"
    />
    <slot />
  </div>
</template>

<script setup lang="ts">
import { useConfigStore } from '@/app/stores/config'
import { usePublicMode } from '@/app/composables/usePublicMode'
import { usePublicChatAgent } from '@/app/composables/usePublicChatAgent'
import { useAuthStore } from '@/app/stores/auth'
import PublicChatHeader from '@/app/components/chat/PublicChatHeader.vue'

const { t, setLocale } = useI18n()

const configStore = useConfigStore()
const authStore = useAuthStore()
const { hasPublicAuthError, publicAgentId } = usePublicMode()

// Fetch agent info for the header
const { data: publicChatData } = usePublicChatAgent(publicAgentId, {
  enabled: computed(() => !!publicAgentId.value && authStore.isAuthenticated)
})

// Set locale to Hungarian for public mode
onMounted(() => {
  setLocale('hu')
})
</script>
