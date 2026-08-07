<template>
  <nav
    role="navigation"
    :aria-label="t('navigation.mainNavigation')"
    class="fixed bottom-0 inset-x-0 z-50 border-t border-[hsl(var(--border))] bg-[hsl(var(--card))]"
    style="padding-bottom: env(safe-area-inset-bottom)"
    data-testid="bottom-tab-bar"
  >
    <div class="flex items-center justify-around h-16">
      <NuxtLink
        v-for="item in navItems"
        :key="item.to"
        :to="item.to"
        class="flex flex-col items-center justify-center gap-1 flex-1 h-full transition-colors duration-150"
        :class="
          isActive(item.to) ? 'text-[hsl(var(--primary))]' : 'text-[hsl(var(--muted-foreground))]'
        "
        :aria-current="isActive(item.to) ? 'page' : undefined"
        :aria-label="item.label"
        :data-testid="`tab-${item.key}`"
      >
        <div class="relative">
          <UChip
            v-if="item.key === 'chats'"
            :text="badgeText"
            :show="totalUnreadCount > 0"
            size="sm"
            color="error"
            :inset="false"
          >
            <UIcon
              :name="item.icon"
              class="size-6"
            />
          </UChip>
          <UIcon
            v-else
            :name="item.icon"
            class="size-6"
          />
        </div>
        <span class="text-[10px] font-medium leading-none">{{ item.label }}</span>
      </NuxtLink>
    </div>
  </nav>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useChatListData } from '~/composables/useChatListData'

const { t } = useI18n()
const route = useRoute()
const { totalUnreadCount } = useChatListData()

const navItems = computed(() => [
  {
    key: 'chats',
    to: '/chats',
    icon: 'i-heroicons-chat-bubble-left-right',
    label: t('navigation.chats'),
  },
  {
    key: 'users',
    to: '/users',
    icon: 'i-heroicons-users',
    label: t('navigation.users'),
  },
  {
    key: 'profile',
    to: '/profile',
    icon: 'i-heroicons-user-circle',
    label: t('navigation.profile'),
  },
])

const badgeText = computed(() => {
  if (totalUnreadCount.value > 99) return '99+'
  return totalUnreadCount.value
})

function isActive(to: string): boolean {
  return route.path.startsWith(to)
}
</script>
