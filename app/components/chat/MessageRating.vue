<template>
  <div class="flex items-center gap-2">
    <!-- Thumbs Up -->
    <button
      type="button"
      :disabled="props.isRated || isPending"
      class="transition-all duration-200"
      :class="[
        props.isRated && props.rating === 1
          ? 'text-gray-600 dark:text-gray-300 cursor-default'
          : props.isRated
            ? 'text-gray-300 dark:text-gray-600 cursor-default'
            : 'text-gray-600 dark:text-gray-300 hover:bg-[hsl(var(--accent))] rounded-md hover:scale-110 cursor-pointer'
      ]"
      :aria-label="t('chat.rating.thumbsUp')"
      @click="handleRate(true)"
    >
      <UIcon
        :name="props.isRated && props.rating === 1 ? 'i-heroicons-hand-thumb-up-20-solid' : 'i-heroicons-hand-thumb-up'"
        :class="['size-4', { 'animate-rating-pop': justRatedPositive }]"
      />
    </button>

    <!-- Thumbs Down -->
    <button
      type="button"
      :disabled="props.isRated || isPending"
      class="transition-all duration-200"
      :class="[
        props.isRated && props.rating === 0
          ? 'text-gray-600 dark:text-gray-300 cursor-default'
          : props.isRated
            ? 'text-gray-300 dark:text-gray-600 cursor-default'
            : 'text-gray-600 dark:text-gray-300 hover:bg-[hsl(var(--accent))] rounded-md hover:scale-110 cursor-pointer'
      ]"
      :aria-label="t('chat.rating.thumbsDown')"
      @click="handleRate(false)"
    >
      <UIcon
        :name="props.isRated && props.rating === 0 ? 'i-heroicons-hand-thumb-down-20-solid' : 'i-heroicons-hand-thumb-down'"
        :class="['size-4', { 'animate-rating-pop': justRatedNegative }]"
      />
    </button>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'

const { t } = useI18n()
const rateMessageMutation = useRateMessage()

interface Props {
  messageId: string
  sessionId: string
  agentId: number
  isRated: boolean
  rating: number | null
}

const props = defineProps<Props>()

const isPending = computed(() => rateMessageMutation.isPending.value)
const justRatedPositive = ref(false)
const justRatedNegative = ref(false)

function handleRate(positive: boolean) {
  if (props.isRated || isPending.value) return

  // Trigger animation
  if (positive) {
    justRatedPositive.value = true
  } else {
    justRatedNegative.value = true
  }

  // Reset animation after it completes
  setTimeout(() => {
    justRatedPositive.value = false
    justRatedNegative.value = false
  }, 400)

  rateMessageMutation.mutate({
    sessionId: props.sessionId,
    messageId: props.messageId,
    rating: positive,
    agentId: props.agentId,
  })
}
</script>

<style scoped>
@keyframes rating-pop {
  0% {
    transform: scale(1) rotate(0deg);
  }
  50% {
    transform: scale(1.4) rotate(-10deg);
  }
  100% {
    transform: scale(1) rotate(0deg);
  }
}

.animate-rating-pop {
  animation: rating-pop 0.4s cubic-bezier(0.68, -0.55, 0.265, 1.55);
}
</style>
