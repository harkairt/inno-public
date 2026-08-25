import { computed } from 'vue'
import { useAuthStore } from '~/stores/auth'
import { useChatStore } from '~/stores/chat'
import { getInitials } from '@/app/utils/user'

export interface NavItem {
  key: string
  to: string
  activePrefix: string
  icon: string
  activeIcon: string
  label: string
}

export function useNavigation() {
  const { t } = useI18n()
  const route = useRoute()
  const authStore = useAuthStore()
  const chatStore = useChatStore()

  const chatsLink = computed(() =>
    chatStore.activeSessionId ? `/chats/${chatStore.activeSessionId}` : '/chats',
  )

  const navItems = computed((): NavItem[] => [
    {
      key: 'chats',
      to: chatsLink.value,
      activePrefix: '/chats',
      icon: 'i-ph-chats',
      activeIcon: 'i-ph-chats-fill',
      label: t('navigation.conversations'),
    },
    {
      key: 'users',
      to: '/users',
      activePrefix: '/users',
      icon: 'i-ph-users-three',
      activeIcon: 'i-ph-users-three-fill',
      label: t('navigation.users'),
    },
  ])

  const userInitials = computed(() => getInitials(authStore.user?.name))

  const profileLabel = computed(() => `${authStore.userDisplayName} — ${t('navigation.profile')}`)

  function isActive(prefix: string): boolean {
    return route.path.startsWith(prefix)
  }

  return { navItems, chatsLink, userInitials, profileLabel, isActive, authStore }
}
