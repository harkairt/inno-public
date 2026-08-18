<template>
  <div class="group relative">
    <NuxtLink
      :to="`/chats/${session.sessionId}`"
      class="sidebar-item flex items-center gap-3"
      :class="{ 'sidebar-item-active': isActive }"
      :data-testid="`session-item-${session.sessionId}`"
    >
      <div class="relative flex-shrink-0">
        <UserAvatar
          :image="primaryMember?.image"
          :dark-image="primaryMember?.darkImage"
          :alt="primaryMemberName"
          :round="isVirtual"
          size="md"
          :style="!hasAvatar(primaryMember?.image) ? avatarStyle : undefined"
        >
          {{ initials }}
        </UserAvatar>
        <span
          v-if="primaryMember && isFavoriteMember"
          class="absolute -right-0.5 -top-0.5 grid size-3.5 place-items-center rounded-full border-2 border-[hsl(var(--background))] bg-[hsl(var(--amber))]"
          role="img"
          :aria-label="t('users.favorite')"
        >
          <UIcon
            name="i-heroicons-star-solid"
            class="size-[7px] text-white"
            aria-hidden="true"
          />
        </span>
        <span
          v-if="primaryMember && isVirtual"
          class="absolute -right-0.5 -bottom-0.5 grid size-3.5 place-items-center rounded-full border-2 border-[hsl(var(--background))] bg-[hsl(var(--success))]"
          role="img"
          :aria-label="t('users.aiAgent')"
        >
          <SparkleIcon class="size-[7px] text-white" />
        </span>
        <span
          v-else-if="primaryMember"
          class="absolute -right-0.5 -bottom-0.5 size-3.5 rounded-full border-2 border-[hsl(var(--background))]"
          :class="primaryMember.isAvailable ? 'bg-[hsl(var(--success))]' : 'bg-[hsl(var(--ink-3))]'"
          role="img"
          :aria-label="primaryMember.isAvailable ? t('users.available') : t('users.unavailable')"
        />
      </div>

      <div class="flex-1 min-w-0">
        <div class="relative">
          <h3
            :class="[
              'font-display-family text-sm tracking-tight truncate transition-[padding] duration-150',
              unreadCount > 0 ? 'font-bold' : 'font-medium',
              isMobile ? 'pr-6' : 'group-hover:pr-6',
            ]"
          >
            {{ memberNames }}
          </h3>
          <div
            class="absolute right-0 top-1/2 -translate-y-1/2 transition-opacity"
            :class="isMobile ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'"
          >
            <SessionItemMenu
              :session-id="session.sessionId"
              :session-name="session.sessionName"
              :agent-id="session.agentId"
              :is-primary-session="isPrimarySession"
            />
          </div>
        </div>
        <div class="flex items-center mt-0.5">
          <p class="text-xs text-muted tracking-wide line-clamp-1 flex-1 min-w-0">
            {{ displayName }}
          </p>
          <span class="text-xs text-muted whitespace-nowrap flex-shrink-0 ml-1.5">
            {{ formattedDate }}
          </span>
          <div
            class="flex items-center flex-shrink-0 overflow-hidden transition-all duration-300 ease-out"
            :class="unreadCount > 0 ? 'max-w-10 ml-1.5 opacity-100' : 'max-w-0 ml-0 opacity-0'"
          >
            <span class="unread-badge whitespace-nowrap">
              {{ unreadCount || '\u00A0' }}
            </span>
          </div>
        </div>
      </div>
    </NuxtLink>
  </div>
</template>

<script setup lang="ts">
import type { AISessionHeaderDTO, UserDTO } from '@/types/api/schemas'
import { getInitials, getAvatarStyle, hasAvatar } from '@/app/utils/user'
import { getSessionActivityDate } from '@/app/utils/session'
import { useRelativeDate } from '~/composables/useRelativeDate'
import UserAvatar from '~/components/UserAvatar.vue'
import SessionItemMenu from '~/components/chat/SessionItemMenu.vue'
import SparkleIcon from '~/components/icons/SparkleIcon.vue'
import { useUserFavorites } from '~/composables/useUserFavorites'

const props = defineProps<{
  session: AISessionHeaderDTO
  users: UserDTO[]
  isActive: boolean
  unreadCount: number
  displayName: string
  memberNames: string
  otherMembers: string[]
  isPrimarySession: boolean
  isMobile: boolean
}>()

const { t } = useI18n()
const { formatSessionDate } = useRelativeDate()
const { isFavorite } = useUserFavorites()

const primaryMemberEmail0 = computed(() => props.otherMembers[0])

const primaryMember = computed(() => props.users.find((u) => u.email === primaryMemberEmail0.value))

const primaryMemberDetail = computed(() =>
  props.session.memberDetails?.find((m) => m.email === primaryMemberEmail0.value),
)

const isVirtual = computed(
  () => primaryMemberDetail.value?.isVirtual ?? primaryMember.value?.isVirtual ?? false,
)

const isFavoriteMember = computed(() => {
  const id = primaryMember.value?.id
  return id !== undefined && isFavorite(id)
})

const primaryMemberName = computed(() => primaryMember.value?.name ?? props.otherMembers[0] ?? '')

const primaryMemberEmail = computed(() => primaryMember.value?.email ?? props.otherMembers[0] ?? '')

const avatarStyle = computed(() => getAvatarStyle(primaryMemberEmail.value))

const initials = computed(() => getInitials(primaryMemberName.value))

const formattedDate = computed(() => formatSessionDate(getSessionActivityDate(props.session)))
</script>
