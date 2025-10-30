<script setup lang="ts">
import type { AISessionHeaderDTO, UserDTO } from '@/types/api/schemas'
import SessionMembers from '~/components/chat/SessionMembers.vue'

interface UnreadChatSession extends AISessionHeaderDTO {
  unreadCount: number
}

const props = defineProps<{
  session: UnreadChatSession
  selectableUsers: UserDTO[]
}>()

const { t } = useI18n()

// Helper: Format relative date
const formatRelativeDate = (date: string | Date) => {
  const now = new Date()
  const messageDate = new Date(date)
  const diffInMs = now.getTime() - messageDate.getTime()
  const diffInHours = diffInMs / (1000 * 60 * 60)

  if (diffInHours < 24) {
    const hours = Math.floor(diffInHours)
    if (hours <= 0) return t('time.justNow')
    if (hours === 1) return t('time.oneHourAgo')
    return t('time.hoursAgo', { count: hours })
  } else {
    const days = Math.floor(diffInHours / 24)
    if (days === 1) return t('time.oneDayAgo')
    return t('time.daysAgo', { count: days })
  }
}

const relativeTime = computed(() => formatRelativeDate(props.session.insertDate))
</script>

<template>
  <UCard
    variant="subtle"
    class="cursor-pointer transition-all duration-200 hover:shadow-md hover:scale-[1.02] hover:outline hover:outline-1 hover:outline-[oklch(76.06%_0.090_119.68)] group"
    :ui="{ body: 'p-4' }"
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
