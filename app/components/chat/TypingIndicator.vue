<template>
  <div
    class="h-6 max-w-(--container-chat) mx-auto w-full px-4 md:px-[26px]"
    data-testid="typing-indicator"
    role="status"
    aria-live="polite"
  >
    <Transition name="typing-indicator">
      <span
        v-if="typingText"
        class="text-xs text-[hsl(var(--muted-foreground))] italic"
      >
        {{ typingText }}{{ animatedDots }}
      </span>
    </Transition>
  </div>
</template>

<script setup lang="ts">
const props = defineProps<{
  typingUsers: string[]
}>()

const { t } = useI18n()

const typingText = computed(() => {
  if (props.typingUsers.length === 0) return ''
  if (props.typingUsers.length === 1) {
    return t('chat.typing.single', { name: props.typingUsers[0] })
  }
  if (props.typingUsers.length === 2) {
    return t('chat.typing.double', {
      name1: props.typingUsers[0],
      name2: props.typingUsers[1],
    })
  }
  return t('chat.typing.multiple', { count: props.typingUsers.length })
})

// Animated dots: cycles through ".", "..", "..."
const dotCount = ref(1)
let dotsInterval: ReturnType<typeof setInterval> | null = null

watch(
  () => props.typingUsers.length > 0,
  (isTyping) => {
    if (isTyping) {
      dotCount.value = 1
      dotsInterval = setInterval(() => {
        dotCount.value = (dotCount.value % 3) + 1
      }, 500)
    } else {
      if (dotsInterval) {
        clearInterval(dotsInterval)
        dotsInterval = null
      }
    }
  },
  { immediate: true },
)

onUnmounted(() => {
  if (dotsInterval) clearInterval(dotsInterval)
})

const animatedDots = computed(() => '.'.repeat(dotCount.value))
</script>

<style scoped>
.typing-indicator-enter-active {
  transition: all 0.2s ease-out;
}

.typing-indicator-leave-active {
  transition: all 0.15s ease-in;
}

.typing-indicator-enter-from {
  opacity: 0;
  transform: translateY(4px);
}

.typing-indicator-leave-to {
  opacity: 0;
}
</style>
