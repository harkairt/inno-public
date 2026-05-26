<script setup lang="ts">
import type { AISessionHeaderDTO, UserDTO } from '@/types/api/schemas'
import SessionMembers from '~/components/chat/SessionMembers.vue'
import { useRelativeDate } from '~/composables/useRelativeDate'

interface UnreadChatSession extends AISessionHeaderDTO {
  unreadCount: number
}

const props = defineProps<{
  session: UnreadChatSession
  selectableUsers: UserDTO[]
}>()

const { formatRelativeDate } = useRelativeDate()

const relativeTime = computed(() => formatRelativeDate(props.session.insertDate))
</script>

<template>
  <UCard
    variant="subtle"
    class="cursor-pointer transition-all duration-200 hover:shadow-md hover:scale-[1.01] hover:outline hover:outline-1 hover:outline-[hsl(var(--primary)/0.3)] group"
    :ui="{ body: 'p-4' }"
    :data-testid="`unread-card-${session.sessionId}`"
  >
    <!-- Row 1: Avatars with badge + Session Name -->
    <div class="flex items-center gap-3">
      <div class="relative">
        <SessionMembers
          :members="session.members"
          :selectable-users="selectableUsers"
        />
        <UBadge
          color="error"
          variant="solid"
          size="xs"
          class="absolute -top-1 -right-1"
        >
          {{ session.unreadCount }}
        </UBadge>
      </div>
      <p class="font-medium text-default truncate flex-1">
        {{ session.sessionName }}
      </p>
    </div>

    <!-- Row 2: Time + Chevron -->
    <div class="flex items-center justify-between mt-2">
      <p class="text-sm text-muted-foreground">
        {{ relativeTime }}
      </p>
    </div>
  </UCard>
</template>
