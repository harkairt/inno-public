<template>
  <div
    class="flex flex-col h-full overflow-y-auto"
    data-testid="profile-page"
  >
    <div class="max-w-lg mx-auto w-full p-6 space-y-8">
      <!-- User Info -->
      <div
        class="flex items-center gap-4"
        data-testid="profile-user-info"
      >
        <UserAvatar
          :image="authStore.userAvatar"
          :dark-image="authStore.userDarkAvatar"
          :alt="authStore.userDisplayName"
          :round="false"
          size="xl"
        />
        <div class="min-w-0">
          <h1 class="text-xl font-semibold truncate">{{ authStore.userDisplayName }}</h1>
          <p class="text-sm text-[hsl(var(--muted-foreground))] truncate">
            {{ authStore.user?.email }}
          </p>
        </div>
      </div>

      <!-- Settings -->
      <div
        class="bg-[hsl(var(--card))] rounded-xl border border-[hsl(var(--border)/0.5)] divide-y divide-[hsl(var(--border)/0.3)]"
      >
        <!-- Locale Toggle -->
        <SettingsRow
          icon="i-heroicons-language"
          :label="t('profile.language')"
          data-testid="profile-locale-toggle"
        >
          <USelect
            :model-value="locale"
            :items="localeOptions"
            size="sm"
            class="w-28"
            @update:model-value="setLocale($event as 'en' | 'hu')"
          />
        </SettingsRow>

        <!-- Color Mode Toggle -->
        <SettingsRow
          :icon="colorMode.value === 'dark' ? 'i-heroicons-moon' : 'i-heroicons-sun'"
          :label="t('profile.colorMode')"
          data-testid="profile-color-mode-toggle"
        >
          <USelect
            :model-value="colorMode.preference"
            :items="colorModeOptions"
            size="sm"
            class="w-28"
            @update:model-value="colorMode.preference = $event as string"
          />
        </SettingsRow>

        <!-- Chat Font Face -->
        <SettingsRow
          icon="i-heroicons-pencil-square"
          :label="t('profile.chatFont')"
          data-testid="profile-font-face"
        >
          <UTabs
            :model-value="activeFontFaceTab"
            :items="fontFaceTabs"
            :content="false"
            variant="pill"
            size="xs"
            @update:model-value="handleFontFaceChange"
          />
        </SettingsRow>

        <!-- Chat Font Size -->
        <SettingsRow
          icon="i-heroicons-arrows-up-down"
          :label="t('profile.chatFontSize')"
          data-testid="profile-font-size"
        >
          <div class="inline-flex items-baseline gap-0.5 rounded-lg bg-(--ui-bg-elevated) p-1">
            <button
              v-for="opt in FONT_SIZE_OPTIONS"
              :key="opt.value"
              type="button"
              class="grid place-items-center rounded-md size-7 transition-colors font-medium"
              :class="
                activeFontSizeTab === opt.value
                  ? 'bg-(--ui-primary) text-(--ui-bg) shadow-xs'
                  : 'text-(--ui-text-muted) hover:text-(--ui-text)'
              "
              :style="{ fontSize: `${opt.rem}rem` }"
              @click="handleFontSizeChange(opt.value)"
            >
              A
            </button>
          </div>
        </SettingsRow>

        <!-- SignalR Connection Status -->
        <SettingsRow
          icon="i-heroicons-signal"
          :label="t('profile.connectionStatus')"
          data-testid="profile-signalr-status"
        >
          <div class="flex items-center gap-2">
            <span
              class="size-2 rounded-full"
              :class="statusDotColor"
            />
            <span
              class="text-sm"
              :class="statusColor"
            >
              {{ statusMessage }}
            </span>
          </div>
        </SettingsRow>

        <!-- Build Info -->
        <SettingsRow
          icon="i-heroicons-information-circle"
          :label="t('profile.build-info')"
          data-testid="profile-build-info"
        >
          <div class="flex flex-col items-end">
            <span class="text-sm text-[hsl(var(--muted-foreground))] font-mono">
              {{ runtimeConfig.public.buildVersion }}
            </span>
            <span class="text-xs text-[hsl(var(--muted-foreground))]">
              {{ formattedBuildTimestamp }}
            </span>
          </div>
        </SettingsRow>
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
import {
  useUiPreferences,
  FONT_OPTIONS,
  FONT_SIZE_OPTIONS,
  DEFAULT_FONT_FACE,
  serverConfigFontSizeToPreset,
  type FontFace,
  type FontSize,
} from '~/composables/useUiPreferences'
import { useConfigStore } from '~/stores/config'
import UserAvatar from '~/components/UserAvatar.vue'
import SettingsRow from '~/components/SettingsRow.vue'

const { t, locale, setLocale } = useI18n()
const colorMode = useColorMode()
const runtimeConfig = useRuntimeConfig()
const authStore = useAuthStore()
const configStore = useConfigStore()
const {
  statusMessage,
  statusColor: statusTextColor,
  state: signalrState,
} = useSignalRConnectionMonitor()
const { fontFace, fontSize, setFontFace, setFontSize } = useUiPreferences()

const isLoggingOut = ref(false)

const localeOptions = [
  { label: 'English', value: 'en' },
  { label: 'Magyar', value: 'hu' },
]

const fontFaceTabs = FONT_OPTIONS.map((opt) => ({
  label: opt.label,
  value: opt.value,
}))

const activeFontFaceTab = computed(() => fontFace.value ?? DEFAULT_FONT_FACE)

const activeFontSizeTab = computed(() => {
  if (fontSize.value) return fontSize.value
  const serverPx = configStore.config.messageTextOwnSize
  return serverConfigFontSizeToPreset(serverPx)
})

function handleFontFaceChange(value: string | number) {
  setFontFace(String(value) as FontFace)
}

function handleFontSizeChange(value: string | number) {
  setFontSize(String(value) as FontSize)
}

const formattedBuildTimestamp = computed(() => {
  const ts = runtimeConfig.public.buildTimestamp
  if (!ts) return ''
  const d = new Date(ts as string)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}, ${pad(d.getHours())}:${pad(d.getMinutes())}`
})

const colorModeOptions = computed(() => [
  { label: t('profile.colorModeLight'), value: 'light' },
  { label: t('profile.colorModeDark'), value: 'dark' },
  { label: t('profile.colorModeSystem'), value: 'system' },
])

const statusColor = statusTextColor

const statusDotColor = computed(() => {
  switch (signalrState.value) {
    case 'connected':
      return 'bg-green-500'
    case 'connecting':
    case 'reconnecting':
      return 'bg-yellow-500'
    case 'failed':
      return 'bg-red-500'
    default:
      return 'bg-gray-400'
  }
})

async function handleLogout() {
  isLoggingOut.value = true
  await authStore.logout()
  await navigateTo('/login', { replace: true })
}
</script>
