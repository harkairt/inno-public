<template>
  <div class="flex flex-1 h-full overflow-hidden">
    <ChatListPanel v-if="!isMobile" class="w-80 border-r border-[hsl(var(--border)/0.5)] flex-shrink-0" />
    <div class="relative flex-1 min-w-0 overflow-hidden">
      <NuxtPage v-slot="{ Component }">
        <Transition :name="slideDirection === 'none' ? '' : `slide-${slideDirection}`">
          <div :key="$route.path" class="h-full">
            <component :is="Component" />
          </div>
        </Transition>
      </NuxtPage>
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

  console.log('[slide-transition]', { fromName, toName, isMobile: isMobile.value })

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

  console.log('[slide-transition] direction:', slideDirection.value)
})
</script>
