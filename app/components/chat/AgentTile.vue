<script setup lang="ts">
import type { UserDTO } from '@/types/api/schemas'

const props = defineProps<{
  agent: UserDTO
}>()

const { t } = useI18n()
const colorMode = useColorMode()

const avatarUrl = computed(() =>
  colorMode.value === 'dark' ? props.agent.darkImage : props.agent.image
)
</script>

<template>
  <UCard
    variant="subtle"
    class="cursor-pointer transition-all duration-200 hover:shadow-md hover:scale-[1.02] hover:outline hover:outline-1 hover:outline-[oklch(76.06%_0.090_119.68)] group"
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
