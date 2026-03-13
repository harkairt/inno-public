<template>
  <UApp :locale="currentUiLocale">
    <div>
      <a href="#main-content" class="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:p-3 focus:bg-[hsl(var(--background))] focus:text-[hsl(var(--foreground))] focus:rounded-md focus:shadow-lg focus:top-2 focus:left-2">
        {{ t('common.skipToContent') }}
      </a>
      <NuxtRouteAnnouncer />
      <NuxtLayout>
        <NuxtPage :transition="{ name: 'fade' }" />
      </NuxtLayout>
      <UNotifications />
      <AppUpdateBanner />
    </div>
  </UApp>
</template>

<script setup lang="ts">
import * as locales from '@nuxt/ui/locale'

const { locale, t } = useI18n()

type LocaleKey = keyof typeof locales

const currentUiLocale = computed(() => {
  const localeKey = locale.value as LocaleKey
  return locales[localeKey] ?? locales.en
})
</script>
