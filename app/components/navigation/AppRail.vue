<template>
  <nav
    role="navigation"
    :aria-label="t('navigation.mainNavigation')"
    class="w-[74px] h-dvh shrink-0 flex flex-col items-center border-r border-[#e7e5de] bg-[hsl(var(--card))] py-4 dark:border-[hsl(var(--border))]"
    data-testid="app-rail"
  >
    <div
      role="img"
      aria-label="InnoChat"
      class="size-[42px] shrink-0 rounded-[13px] bg-[linear-gradient(150deg,#0e5c5c,#14867a)] shadow-[0_6px_16px_rgba(14,92,92,0.28)]"
      data-testid="rail-logo"
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        aria-hidden="true"
        class="size-6 m-[9px]"
      >
        <path
          d="M12 12.2V5M12 12.2 5.4 17.4M12 12.2l6.6 5.2"
          stroke="#fff"
          stroke-width="1.6"
          stroke-linecap="round"
        />
        <circle
          cx="12"
          cy="5"
          r="2.4"
          fill="#fff"
        />
        <circle
          cx="5.4"
          cy="17.4"
          r="2.4"
          fill="#fff"
          opacity=".85"
        />
        <circle
          cx="18.6"
          cy="17.4"
          r="2.4"
          fill="#F2C14E"
        />
        <circle
          cx="12"
          cy="12.2"
          r="1.7"
          fill="#fff"
          opacity=".65"
        />
      </svg>
    </div>

    <div class="mt-5 flex flex-col items-center gap-1">
      <UTooltip
        v-for="item in navItems"
        :key="item.to"
        :text="item.label"
        :content="{ side: 'right' }"
      >
        <NuxtLink
          :to="item.to"
          class="flex size-[46px] items-center justify-center rounded-[13px] text-[23px] transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[hsl(var(--ring))]"
          :class="
            isActive(item.activePrefix)
              ? 'bg-[#f0efea] text-[#16201f] dark:bg-[hsl(var(--accent))] dark:text-[hsl(var(--accent-foreground))]'
              : 'text-[#8e9793] hover:bg-[#f0efea] hover:text-[#16201f] dark:text-[hsl(var(--muted-foreground))] dark:hover:bg-[hsl(var(--accent))] dark:hover:text-[hsl(var(--accent-foreground))]'
          "
          :aria-current="isActive(item.activePrefix) ? 'page' : undefined"
          :aria-label="item.label"
          :data-testid="`rail-${item.key}`"
        >
          <UIcon
            :name="isActive(item.activePrefix) ? item.activeIcon : item.icon"
            class="size-6"
            :class="isActive(item.activePrefix) ? 'text-[#0e5c5c]' : undefined"
            aria-hidden="true"
          />
        </NuxtLink>
      </UTooltip>
    </div>

    <UTooltip
      :text="profileLabel"
      :content="{ side: 'right' }"
      class="mt-auto"
    >
      <NuxtLink
        to="/profile"
        :aria-current="isActive('/profile') ? 'page' : undefined"
        :aria-label="profileLabel"
        data-testid="rail-profile"
      >
        <UserAvatar
          :image="authStore.user?.image"
          :dark-image="authStore.user?.darkImage"
          :alt="authStore.userDisplayName"
          :round="false"
          size="lg"
          class="size-11 border-2 text-sm font-bold transition-shadow duration-150"
          :class="
            isActive('/profile')
              ? 'border-[#0e5c5c] shadow-[0_0_0_3px_#e1efec]'
              : 'border-[#e7e5de] hover:border-[#0e5c5c] dark:border-[hsl(var(--border))]'
          "
        >
          {{ userInitials }}
        </UserAvatar>
      </NuxtLink>
    </UTooltip>
  </nav>
</template>

<script setup lang="ts">
import UserAvatar from '~/components/UserAvatar.vue'
import { useNavigation } from '~/composables/useNavigation'

const { t } = useI18n()
const { navItems, userInitials, profileLabel, isActive, authStore } = useNavigation()
</script>
