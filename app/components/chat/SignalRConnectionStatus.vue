<script setup lang="ts">
import { useSignalRConnectionMonitor } from '@/app/composables/useSignalR'

const { statusMessage, isConnected, isConnecting, isReconnecting, reconnectAttempts } =
  useSignalRConnectionMonitor()

// Props for controlling display based on sidebar state
interface Props {
  collapsed?: boolean
}

defineProps<Props>()

// Icon based on connection state
const statusIcon = computed(() => {
  if (isConnected.value) return 'i-heroicons-signal'
  if (isConnecting.value || isReconnecting.value) return 'i-heroicons-arrow-path'
  return 'i-heroicons-signal-slash'
})

// Color classes for different states
const statusColorClass = computed(() => {
  if (isConnected.value) return 'text-green-500'
  if (isConnecting.value || isReconnecting.value) return 'text-yellow-500'
  return 'text-red-500'
})

// Show reconnect attempts when reconnecting
const displayMessage = computed(() => {
  if (isReconnecting.value && reconnectAttempts.value > 0) {
    return `Reconnecting (${reconnectAttempts.value})...`
  }
  return statusMessage.value
})
</script>

<template>
  <div class="flex items-center px-3 py-2">
    <UTooltip
      :text="displayMessage"
      :content="{ side: collapsed ? 'right' : 'top' }"
    >
      <UIcon
        :name="statusIcon"
        :class="[statusColorClass, isConnecting || isReconnecting ? 'animate-spin' : '']"
        size="16"
        :aria-label="displayMessage"
      />
    </UTooltip>
  </div>
</template>

<style scoped>
/* Optional: pulse animation for reconnecting state */
.animate-spin {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}
</style>
