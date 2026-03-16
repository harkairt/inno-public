<template>
  <UApp :locale="currentUiLocale">
    <div>
      <NuxtRouteAnnouncer />
      <NuxtLayout>
        <NuxtPage />
      </NuxtLayout>
      <UNotifications />
      <AppUpdateBanner />
    </div>
  </UApp>
</template>

<script setup lang="ts">
import * as locales from '@nuxt/ui/locale'

const { locale } = useI18n()

type LocaleKey = keyof typeof locales

const currentUiLocale = computed(() => {
  const localeKey = locale.value as LocaleKey
  return locales[localeKey] ?? locales.en
})
</script>
