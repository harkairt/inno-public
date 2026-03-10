import { computed } from 'vue'
import { useWindowSize } from '@vueuse/core'
import { useRoute } from 'vue-router'
import { useAuthStore } from '~/stores/auth'
import { usePublicMode } from '~/composables/usePublicMode'

const MOBILE_BREAKPOINT = 768

export const useNavigationVisibility = () => {
  const { width } = useWindowSize()
  const route = useRoute()
  const authStore = useAuthStore()
  const { isPublicMode } = usePublicMode()

  const isMobile = computed(() => width.value < MOBILE_BREAKPOINT)

  const isActiveChat = computed(() => {
    const name = route.name as string | undefined
    if (!name) return false
    return name === 'chats-sessionId' || name === 'chats-new-userId'
  })

  const showBottomTabBar = computed(
    () => isMobile.value && !isActiveChat.value && !isPublicMode.value && authStore.isAuthenticated,
  )

  const showRail = computed(
    () => !isMobile.value && !isPublicMode.value && authStore.isAuthenticated,
  )

  return {
    isMobile,
    isActiveChat,
    showBottomTabBar,
    showRail,
  }
}
