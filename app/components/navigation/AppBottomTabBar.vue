<template>
  <nav
    role="navigation"
    :aria-label="t('navigation.mainNavigation')"
    class="fixed inset-x-0 bottom-0 z-50 border-t border-[#e7e5de] bg-[hsl(var(--card))] dark:border-[hsl(var(--border))]"
    style="padding-bottom: env(safe-area-inset-bottom)"
    data-testid="bottom-tab-bar"
  >
    <div class="flex h-16 items-center justify-around px-3">
      <NuxtLink
        v-for="item in navItems"
        :key="item.key"
        :to="item.to"
        class="flex h-full flex-1 items-center justify-center transition-colors duration-150"
        :class="
          isActive(item.activePrefix)
            ? 'text-[#16201f] dark:text-[hsl(var(--accent-foreground))]'
            : 'text-[#8e9793] dark:text-[hsl(var(--muted-foreground))]'
        "
        :aria-current="isActive(item.activePrefix) ? 'page' : undefined"
        :aria-label="item.label"
        :data-testid="`tab-${item.key}`"
      >
        <span
          v-if="item.key !== 'profile'"
          class="flex size-[38px] items-center justify-center rounded-[11px]"
          :class="
            isActive(item.activePrefix)
              ? 'bg-[#f0efea] dark:bg-[hsl(var(--accent))]'
              : 'hover:bg-[#f0efea] dark:hover:bg-[hsl(var(--accent))]'
          "
        >
          <UIcon
            :name="isActive(item.activePrefix) ? item.activeIcon : item.icon"
            class="size-6"
            :class="isActive(item.activePrefix) ? 'text-[#0e5c5c]' : undefined"
            aria-hidden="true"
          />
        </span>
        <UserAvatar
          v-else
          :image="authStore.user?.image"
          :dark-image="authStore.user?.darkImage"
          :alt="authStore.userDisplayName"
          :round="false"
          size="sm"
          class="size-[34px] border-2 text-xs font-bold transition-shadow duration-150"
          :class="
            isActive(item.activePrefix)
              ? 'border-[#0e5c5c] shadow-[0_0_0_3px_#e1efec]'
              : 'border-[#e7e5de] dark:border-[hsl(var(--border))]'
          "
        >
          {{ userInitials }}
        </UserAvatar>
      </NuxtLink>
    </div>
  </nav>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import UserAvatar from '~/components/UserAvatar.vue'
import { useAuthStore } from '~/stores/auth'
import { useChatStore } from '~/stores/chat'

const { t } = useI18n()
const route = useRoute()
const authStore = useAuthStore()
const chatStore = useChatStore()

const chatsLink = computed(() =>
  chatStore.activeSessionId ? `/chats/${chatStore.activeSessionId}` : '/chats',
)

const navItems = computed(() => [
  {
    key: 'chats',
    to: chatsLink.value,
    activePrefix: '/chats',
    icon: 'i-ph-chats',
    activeIcon: 'i-ph-chats-fill',
    label: t('navigation.conversations'),
  },
  {
    key: 'users',
    to: '/users',
    activePrefix: '/users',
    icon: 'i-ph-users-three',
    activeIcon: 'i-ph-users-three-fill',
    label: t('navigation.users'),
  },
  {
    key: 'profile',
    to: '/profile',
    activePrefix: '/profile',
    icon: '',
    activeIcon: '',
    label: t('navigation.profile'),
  },
])

const userInitials = computed(() => initialsFromName(authStore.user?.name))

function initialsFromName(name?: string | null): string {
  const words = name?.trim().split(/\s+/).filter(Boolean) ?? []
  if (words.length === 0) return 'U'
  if (words.length === 1) return words[0]?.slice(0, 2).toUpperCase() ?? 'U'
  return `${words[0]?.[0] ?? ''}${words.at(-1)?.[0] ?? ''}`.toUpperCase()
}

function isActive(to: string): boolean {
  return route.path.startsWith(to)
}
</script>
