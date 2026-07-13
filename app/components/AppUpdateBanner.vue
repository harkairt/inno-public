<template>
  <Teleport to="body">
    <Transition
      enter-active-class="transition-transform duration-300 ease-out"
      enter-from-class="-translate-y-full"
      enter-to-class="translate-y-0"
      leave-active-class="transition-transform duration-200 ease-in"
      leave-from-class="translate-y-0"
      leave-to-class="-translate-y-full"
    >
      <div
        v-if="showBanner"
        class="fixed top-0 left-0 right-0 z-50"
      >
        <UAlert
          color="success"
          variant="solid"
          :title="t('pwa.updateAvailable')"
          :description="t('pwa.updateDescription')"
          :close="{ icon: 'i-heroicons-x-mark-20-solid', color: 'neutral', variant: 'link' }"
          :ui="{
            root: 'rounded-none',
            title: 'font-medium',
            description: 'text-sm opacity-90',
          }"
          @update:open="dismiss"
        >
          <template #actions>
            <UButton
              color="neutral"
              variant="solid"
              size="xs"
              :label="t('pwa.refresh')"
              @click="handleRefresh"
            />
          </template>
        </UAlert>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { usePWAUpdate } from '~/composables/usePWAUpdate'

const { t } = useI18n()
const { needRefresh, applyUpdate } = usePWAUpdate()

// Session-local dismissed state (resets on page reload)
const dismissed = ref(false)

const showBanner = computed(() => needRefresh.value && !dismissed.value)

const dismiss = () => {
  dismissed.value = true
}

const handleRefresh = async () => {
  await applyUpdate()
}
</script>
