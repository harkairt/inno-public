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
import { useNavigation } from '~/composables/useNavigation'

const { t } = useI18n()
const { navItems: baseNavItems, userInitials, isActive, authStore } = useNavigation()

const navItems = computed(() => [
  ...baseNavItems.value,
  {
    key: 'profile',
    to: '/profile',
    activePrefix: '/profile',
    icon: '',
    activeIcon: '',
    label: t('navigation.profile'),
  },
])
</script>
