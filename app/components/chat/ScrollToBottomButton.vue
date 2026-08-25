<template>
  <div class="max-w-(--container-chat) mx-auto w-full px-4 md:px-[26px]">
    <div class="flex justify-end pr-3">
      <Transition
        enter-active-class="transition-opacity duration-200 ease-out"
        enter-from-class="opacity-0"
        enter-to-class="opacity-100"
        leave-active-class="transition-opacity duration-150 ease-in"
        leave-from-class="opacity-100"
        leave-to-class="opacity-0"
      >
        <div v-if="visible">
          <UButton
            icon="i-heroicons-chevron-down-20-solid"
            color="primary"
            variant="solid"
            size="lg"
            class="shrink-0 !rounded-xl shadow-md pointer-events-auto opacity-40 hover:opacity-100 focus-visible:opacity-100 transition-opacity"
            :aria-label="$t('chat.scrollToBottom')"
            data-testid="scroll-to-bottom-button"
            @click="$emit('click')"
          />
        </div>
      </Transition>
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  visible: boolean
}>()

defineEmits<{
  click: []
}>()
</script>
