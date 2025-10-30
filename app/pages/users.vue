<template>
  <div class="users-page flex items-center justify-center h-full p-4">
    <p class="text-foreground text-center">
      {{ t('chat.selectUser') }}
    </p>
  </div>
</template>

<script setup lang="ts">
const { t } = useI18n()

// Apply authentication middleware
definePageMeta({
  middleware: defineNuxtRouteMiddleware(() => {
    const authStore = useAuthStore()
    if (!authStore.isAuthenticated) {
      return navigateTo('/login', { replace: true })
    }
  })
})
</script>

<style scoped>
.users-page {
  min-height: 100vh;
}
</style>
