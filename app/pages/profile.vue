<template>
  <div class="flex flex-col h-full overflow-y-auto" data-testid="profile-page">
    <div class="max-w-lg mx-auto w-full p-6 space-y-8">
      <!-- User Info -->
      <div class="flex items-center gap-4" data-testid="profile-user-info">
        <UserAvatar
          :image="authStore.userAvatar"
          :dark-image="authStore.userDarkAvatar"
          :alt="authStore.userDisplayName"
          size="xl"
        />
        <div class="min-w-0">
          <h1 class="text-xl font-semibold truncate">{{ authStore.userDisplayName }}</h1>
          <p class="text-sm text-[hsl(var(--muted-foreground))] truncate">{{ authStore.user?.email }}</p>
        </div>
      </div>

      <!-- Settings -->
      <div class="bg-[hsl(var(--card))] rounded-xl border border-[hsl(var(--border)/0.5)] divide-y divide-[hsl(var(--border)/0.3)]">
        <!-- Locale Toggle -->
        <div class="flex items-center justify-between px-4 py-3.5" data-testid="profile-locale-toggle">
          <div class="flex items-center gap-3">
            <UIcon name="i-heroicons-language" class="size-5 text-[hsl(var(--muted-foreground))]" />
            <span class="text-sm font-medium">{{ t('profile.language') }}</span>
          </div>
          <USelect
            :model-value="locale"
            :items="localeOptions"
            size="sm"
            class="w-28"
            @update:model-value="setLocale($event as 'en' | 'hu')"
          />
        </div>

        <!-- Color Mode Toggle -->
        <div class="flex items-center justify-between px-4 py-3.5" data-testid="profile-color-mode-toggle">
          <div class="flex items-center gap-3">
            <UIcon
              :name="colorMode.value === 'dark' ? 'i-heroicons-moon' : 'i-heroicons-sun'"
              class="size-5 text-[hsl(var(--muted-foreground))]"
            />
            <span class="text-sm font-medium">{{ t('profile.colorMode') }}</span>
          </div>
          <USelect
            :model-value="colorMode.preference"
            :items="colorModeOptions"
            size="sm"
            class="w-28"
            @update:model-value="colorMode.preference = $event as string"
          />
        </div>

        <!-- SignalR Connection Status -->
        <div class="flex items-center justify-between px-4 py-3.5" data-testid="profile-signalr-status">
          <div class="flex items-center gap-3">
            <UIcon name="i-heroicons-signal" class="size-5 text-[hsl(var(--muted-foreground))]" />
            <span class="text-sm font-medium">{{ t('profile.connectionStatus') }}</span>
          </div>
          <div class="flex items-center gap-2">
            <span
              class="size-2 rounded-full"
              :class="statusDotColor"
            />
            <span class="text-sm" :class="statusColor">
              {{ statusMessage }}
            </span>
          </div>
        </div>
      </div>

      <!-- Logout -->
      <UButton
        color="error"
        variant="soft"
        block
        size="lg"
        :loading="isLoggingOut"
        icon="i-heroicons-arrow-right-start-on-rectangle"
        data-testid="profile-logout-button"
        @click="handleLogout"
      >
        {{ t('sidebar.logout') }}
      </UButton>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useAuthStore } from '~/stores/auth'
import { useSignalRConnectionMonitor } from '~/composables/useSignalR'
import UserAvatar from '~/components/UserAvatar.vue'

const { t, locale, setLocale } = useI18n()
const colorMode = useColorMode()
const authStore = useAuthStore()
const { statusMessage, statusColor: statusTextColor, state: signalrState } = useSignalRConnectionMonitor()

const isLoggingOut = ref(false)

const localeOptions = [
  { label: 'English', value: 'en' },
  { label: 'Magyar', value: 'hu' },
]

const colorModeOptions = computed(() => [
  { label: t('profile.colorModeLight'), value: 'light' },
  { label: t('profile.colorModeDark'), value: 'dark' },
  { label: t('profile.colorModeSystem'), value: 'system' },
])

const statusColor = statusTextColor

const statusDotColor = computed(() => {
  switch (signalrState.value) {
    case 'connected': return 'bg-green-500'
    case 'connecting':
    case 'reconnecting': return 'bg-yellow-500'
    case 'failed': return 'bg-red-500'
    default: return 'bg-gray-400'
  }
})

async function handleLogout() {
  isLoggingOut.value = true
  await authStore.logout()
  await navigateTo('/login', { replace: true })
}
</script>
