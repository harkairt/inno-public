<template>
  <nav
    role="navigation"
    :aria-label="t('navigation.mainNavigation')"
    class="w-16 h-dvh flex flex-col items-center border-r border-[hsl(var(--border)/0.5)] bg-[hsl(var(--background))] flex-shrink-0"
    data-testid="app-rail"
  >
    <div class="flex flex-col items-center gap-1 pt-4 flex-1">
      <template
        v-for="item in navItems"
        :key="item.to"
      >
        <UTooltip
          :text="item.label"
          :content="{ side: 'right' }"
        >
          <UChip
            v-if="item.key === 'chats'"
            :text="badgeText"
            :show="totalUnreadCount > 0"
            size="sm"
            color="error"
            :inset="false"
          >
            <UButton
              :icon="item.icon"
              square
              size="lg"
              :variant="isActive(item.to) ? 'soft' : 'ghost'"
              :color="isActive(item.to) ? 'primary' : 'neutral'"
              :aria-current="isActive(item.to) ? 'page' : undefined"
              :aria-label="item.label"
              :data-testid="`rail-${item.key}`"
              @click="navigateTo(item.to)"
            />
          </UChip>
          <UButton
            v-else
            :icon="item.icon"
            square
            size="lg"
            :variant="isActive(item.to) ? 'soft' : 'ghost'"
            :color="isActive(item.to) ? 'primary' : 'neutral'"
            :aria-current="isActive(item.to) ? 'page' : undefined"
            :aria-label="item.label"
            :data-testid="`rail-${item.key}`"
            @click="navigateTo(item.to)"
          />
        </UTooltip>
      </template>
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
