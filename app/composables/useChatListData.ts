import { computed, ref } from 'vue'
import { useSelectableUsers } from '~/composables/useUsers'
import { useChatSessions, useUnreadMessageCounts } from '~/composables/useChatQueries'
import { useClientSideUserSearch } from '~/composables/useClientSideUserSearch'
import { useAuthStore } from '~/stores/auth'
import { useChatStore } from '~/stores/chat'
import { useRelativeDate } from '~/composables/useRelativeDate'
import {
  getSessionDisplayName,
  checkIsPrimarySession,
  getPrimarySessionForUser,
} from '~/composables/usePrimarySession'

export interface DraftConversationListItem {
  draftId: string
  draftKey: string
  userId: number
  userName: string
  userEmail: string
  preview: string
  route: string
}

export function useChatListData() {
  const authStore = useAuthStore()
  const chatStore = useChatStore()
  const { formatRelativeDate } = useRelativeDate()

  const currentUserEmail = computed(() => authStore.user?.email ?? '')

  // TanStack Query data
  const { data: users, isLoading: isLoadingUsers, error: usersError } = useSelectableUsers()
  const { data: sessions, isLoading: isLoadingSessions, error: sessionsError } = useChatSessions()
  const { data: unreadCounts } = useUnreadMessageCounts()

  // Search state
  const userSearchQuery = ref('')
  const sessionSearchQuery = ref('')

  // Filtered users
  const { filteredUsers } = useClientSideUserSearch(users, userSearchQuery)

  // Filtered + sorted sessions
  const filteredSessions = computed(() => {
    if (!sessions.value) return []

    const query = sessionSearchQuery.value.toLowerCase()
    const filtered = query
      ? sessions.value.filter(session =>
          session.sessionName.toLowerCase().includes(query)
          || session.agentId.toString().includes(query)
          || session.members.some(email => email.toLowerCase().includes(query)),
        )
      : [...sessions.value]

    return filtered.sort((a, b) => {
      const unreadA = getUnreadCount(a.sessionId)
      const unreadB = getUnreadCount(b.sessionId)

      if (unreadA > 0 && unreadB === 0) return -1
      if (unreadB > 0 && unreadA === 0) return 1

      return new Date(b.insertDate).getTime() - new Date(a.insertDate).getTime()
    })
  })

  const filteredDraftSessions = computed<DraftConversationListItem[]>(() => {
    if (!users.value) return []

    const query = sessionSearchQuery.value.toLowerCase().trim()
    const drafts = Object.entries(chatStore.draftMessages)
      .filter(([key, text]) => key.startsWith('new-') && text.trim().length > 0)
      .flatMap(([key, text]) => {
        const userIdPart = key.replace(/^new-/, '')
        const userId = Number.parseInt(userIdPart, 10)
        if (!Number.isFinite(userId)) return []

        const user = users.value?.find(u => u.id === userId)
        if (!user) return []

        const preview = text.trim().replace(/\s+/g, ' ')
        return [{
          draftId: `draft-${key}`,
          draftKey: key,
          userId,
          userName: user.name || user.email,
          userEmail: user.email,
          preview,
          route: `/chats/new/${userId}`,
        }]
      })

    if (!query) return drafts

    return drafts.filter(draft =>
      draft.userName.toLowerCase().includes(query)
      || draft.userEmail.toLowerCase().includes(query)
      || draft.preview.toLowerCase().includes(query),
    )
  })

  // Total unread count across all sessions
  const totalUnreadCount = computed(() => {
    if (!unreadCounts.value) return 0
    return unreadCounts.value.reduce((sum, entry) => sum + entry.unreadMessageCount, 0)
  })

  function getUnreadCount(sessionId: string): number {
    if (!unreadCounts.value) return 0
    const entry = unreadCounts.value.find(u => u.sessionId === sessionId)
    return entry?.unreadMessageCount ?? 0
  }

  function getOtherMembers(members: string[]): string[] {
    const email = authStore.user?.email
    if (!email) return members
    return members.filter(m => m !== email)
  }

  function getMemberNames(members: string[]): string {
    const { t } = useI18n()
    const otherMembers = getOtherMembers(members)
    if (otherMembers.length === 0) return t('sidebar.you')

    const names = otherMembers.slice(0, 2).map((email) => {
      const user = users.value?.find(u => u.email === email)
      return user?.name?.split(' ')[0] ?? email.split('@')[0]
    })

    if (otherMembers.length > 2) {
      return `${names.join(', ')} +${otherMembers.length - 2}`
    }
    return names.join(', ')
  }

  function getInitials(name: string): string {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2)
  }

  function getDisplayName(session: { sessionId: string; sessionName: string; members: string[]; memberDetails?: { email: string; name: string; isVirtual: boolean }[] | null; insertDate: string }): string {
    if (!sessions.value || !users.value) {
      return session.sessionName
    }
    return getSessionDisplayName(session as Parameters<typeof getSessionDisplayName>[0], currentUserEmail.value, sessions.value, users.value)
  }

  function isPrimarySessionCheck_(session: { sessionId: string; members: string[]; memberDetails?: { email: string; name: string; isVirtual: boolean }[] | null; insertDate: string }): boolean {
    if (!sessions.value || !users.value || !currentUserEmail.value) {
      return false
    }
    return checkIsPrimarySession(session as Parameters<typeof checkIsPrimarySession>[0], sessions.value, users.value, currentUserEmail.value)
  }

  function handleUserClick(userId: number): string | null {
    if (!sessions.value || !users.value) {
      return `/chats/new/${userId}`
    }

    const primarySession = getPrimarySessionForUser(userId, currentUserEmail.value, sessions.value, users.value)
    if (primarySession) {
      return `/chats/${primarySession.sessionId}`
    }
    return `/chats/new/${userId}`
  }

  function clearDraftConversation(draftKey: string) {
    chatStore.clearDraft(draftKey)
  }

  return {
    // Query data
    users,
    sessions,
    unreadCounts,
    isLoadingUsers,
    isLoadingSessions,
    usersError,
    sessionsError,

    // Search
    userSearchQuery,
    sessionSearchQuery,
    filteredUsers,
    filteredSessions,
    filteredDraftSessions,

    // Counts
    totalUnreadCount,

    // Helpers
    getUnreadCount,
    getOtherMembers,
    getMemberNames,
    getInitials,
    getDisplayName,
    isPrimarySessionCheck: isPrimarySessionCheck_,
    handleUserClick,
    clearDraftConversation,
    formatRelativeDate,
    currentUserEmail,
  }
}
