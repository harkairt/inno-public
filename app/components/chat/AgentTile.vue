<script setup lang="ts">
import type { UserDTO } from '@/types/api/schemas'
import { sanitizeFileUrl } from '@/app/utils/url'

const props = defineProps<{
  agent: UserDTO
}>()

const { t } = useI18n()
const colorMode = useColorMode()
const {
  public: { apiBaseUrl },
} = useRuntimeConfig()

const avatarUrl = computed(() => {
  const raw = colorMode.value === 'dark' ? props.agent.darkImage : props.agent.image
  return raw ? sanitizeFileUrl(raw, apiBaseUrl as string) : null
})
</script>

<template>
  <UCard
    variant="subtle"
    class="cursor-pointer transition-all duration-200 hover:shadow-md hover:scale-[1.01] hover:outline hover:outline-1 hover:outline-[hsl(var(--primary)/0.3)] group"
    :ui="{ body: 'p-4' }"
    :data-testid="`agent-tile-${agent.id}`"
  >
    <div class="flex items-center gap-3">
      <UAvatar
        :src="avatarUrl || undefined"
        :alt="agent.name"
        size="lg"
        class="ring-2 ring-primary/20 group-hover:ring-primary/40 transition-all"
      />
      <div class="flex-1 min-w-0">
        <p class="font-medium text-default truncate">{{ agent.name }}</p>
        <p class="text-sm text-muted-foreground">{{ t('emptyPage.aiAssistant') }}</p>
      </div>
    </div>
  </UCard>
</template>
