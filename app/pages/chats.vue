<template>
  <div class="flex flex-1 h-full overflow-hidden">
    <ChatListPanel
      v-if="!isMobile"
      class="w-80 border-r border-[hsl(var(--border)/0.5)] flex-shrink-0"
    />
    <div class="relative flex-1 min-w-0 overflow-hidden">
      <RouterView v-slot="{ Component, route }">
        <Transition :name="slideDirection === 'none' ? '' : `slide-${slideDirection}`">
          <div
            :key="route.path"
            class="h-full bg-[hsl(var(--background))]"
          >
            <component :is="Component" />
          </div>
        </Transition>
      </RouterView>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useNavigationVisibility } from '~/composables/useNavigationVisibility'
import ChatListPanel from '~/components/chat/ChatListPanel.vue'

const { isMobile } = useNavigationVisibility()
const router = useRouter()
const slideDirection = ref<'left' | 'right' | 'none'>('none')

router.beforeEach((to, from) => {
  const fromName = String(from.name ?? '')
  const toName = String(to.name ?? '')

  if (!isMobile.value) {
    slideDirection.value = 'none'
    return
  }

  const isList = (name: string) => name === 'chats'
  const isDetail = (name: string) => name === 'chats-sessionId' || name === 'chats-new-userId'

  if (isList(fromName) && isDetail(toName)) {
    slideDirection.value = 'left'
  } else if (isDetail(fromName) && isList(toName)) {
    slideDirection.value = 'right'
  } else {
    slideDirection.value = 'none'
  }
})
</script>

<style>
/* Shared active state for simultaneous enter/leave */
.slide-left-enter-active,
.slide-left-leave-active,
.slide-right-enter-active,
.slide-right-leave-active {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  transition:
    transform 250ms cubic-bezier(0.4, 0, 0.2, 1),
    opacity 250ms cubic-bezier(0.4, 0, 0.2, 1);
  will-change: transform, opacity;
}

/* Slide left: push forward (list → detail) */
/* Entering page slides in from right (opaque, on top) */
.slide-left-enter-from {
  transform: translateX(100%);
  z-index: 1;
  opacity: 1;
}
.slide-left-enter-to {
  transform: translateX(0);
  z-index: 1;
  opacity: 1;
}
/* Leaving page shifts left and fades out (underneath) */
.slide-left-leave-from {
  transform: translateX(0);
  z-index: 0;
  opacity: 1;
}
.slide-left-leave-to {
  transform: translateX(-33%);
  z-index: 0;
  opacity: 0;
}

/* Slide right: pop back (detail → list) */
/* Entering page (list) fades in from left offset */
.slide-right-enter-from {
  transform: translateX(-33%);
  z-index: 0;
  opacity: 0;
}
.slide-right-enter-to {
  transform: translateX(0);
  z-index: 0;
  opacity: 1;
}
/* Leaving page (detail) slides out to right, on top */
.slide-right-leave-from {
  transform: translateX(0);
  z-index: 1;
  opacity: 1;
}
.slide-right-leave-to {
  transform: translateX(100%);
  z-index: 1;
  opacity: 1;
}
</style>
