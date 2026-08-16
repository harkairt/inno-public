<template>
  <div class="flex items-center gap-0.5">
    <!-- Display first 3 member avatars -->
    <UserAvatar
      v-for="(member, index) in memberDetails"
      :key="member.email"
      :image="member.image"
      :dark-image="member.darkImage"
      :alt="member.name || member.email"
      :round="member.isVirtual"
      :size="size"
      :style="!hasAvatar(member.image) ? getAvatarStyle(member.email) : undefined"
      :class="{ [overlapClass]: index > 0 }"
    >
      {{ getInitials(member.name || member.email) }}
    </UserAvatar>

    <!-- Show "+N more" text if more than 3 members -->
    <span
      v-if="remainingCount > 0"
      class="text-xs text-muted ml-1"
    >
      +{{ remainingCount }}
    </span>
  </div>
</template>

<script setup lang="ts">
import type { UserDTO } from '@/types/api/schemas'
import { getInitials, getAvatarStyle, hasAvatar } from '@/app/utils/user'

const props = withDefaults(
  defineProps<{
    members: string[]
    selectableUsers: UserDTO[]
    size?: '3xs' | '2xs' | 'xs' | 'sm' | 'md'
  }>(),
  {
    size: 'sm',
  },
)

// Compute overlap class based on size
const overlapClass = computed(() => {
  switch (props.size) {
    case '3xs':
    case '2xs':
      return '-ml-1'
    case 'xs':
      return '-ml-1.5'
    default:
      return '-ml-2'
  }
})

// Show only first 3 members as avatars
const visibleMembers = computed(() => props.members.slice(0, 3))

// Calculate how many members are not shown
const remainingCount = computed(() => Math.max(0, props.members.length - 3))

// Map email addresses to full UserDTO objects for avatar/name display
const memberDetails = computed(() =>
  visibleMembers.value
    .map((email) => props.selectableUsers.find((u) => u.email === email))
    .filter((user): user is UserDTO => user !== undefined),
)
</script>
