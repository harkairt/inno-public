<template>
  <div v-if="isMobile" class="flex flex-col h-dvh">
    <main class="flex-1 overflow-hidden" :class="{ 'pb-20': showBottomTabBar }">
      <slot />
    </main>
    <AppBottomTabBar v-if="showBottomTabBar" />
  </div>
  <div v-else class="flex h-dvh">
    <AppRail v-if="showRail" />
    <main class="flex-1 flex flex-col overflow-hidden">
      <slot />
    </main>
  </div>

</template>

<script setup lang="ts">
import { useNavigationVisibility } from '~/composables/useNavigationVisibility'
import AppBottomTabBar from '~/components/navigation/AppBottomTabBar.vue'
import AppRail from '~/components/navigation/AppRail.vue'

const { isMobile, showBottomTabBar, showRail } = useNavigationVisibility()
</script>
