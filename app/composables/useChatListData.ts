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
import { getSessionActivityDate } from '@/app/utils/session'
import type { AISessionHeaderDTO, GetUnreadMessagesDTO, UserDTO } from '@/types/api/schemas'

export interface DraftConversationListItem {
  draftId: string
  draftKey: string
  userId: number
  userName: string
  userEmail: string
  preview: string
  route: string
}

function getUnreadCountFromEntries(
  entries: GetUnreadMessagesDTO[] | undefined,
  sessionId: string,
): number {
  if (!entries) return 0
  const entry = entries.find((u) => u.sessionId === sessionId)
  return entry?.unreadMessageCount ?? 0
}

function getOtherMembersForEmail(members: string[], email: string | undefined): string[] {
  if (!email) return members
  return members.filter((m) => m !== email)
}

function getMemberNamesFromList(
  members: string[],
  email: string | undefined,
  allUsers: UserDTO[] | undefined,
  t: (key: string) => string,
): string {
  const otherMembers = getOtherMembersForEmail(members, email)
  if (otherMembers.length === 0) return t('sidebar.you')

  const names = otherMembers.slice(0, 2).map((memberEmail) => {
    const user = allUsers?.find((u) => u.email === memberEmail)
    return user?.name?.split(' ')[0] ?? memberEmail.split('@')[0]
  })

  if (otherMembers.length > 2) {
    return `${names.join(', ')} +${otherMembers.length - 2}`
  }
  return names.join(', ')
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

function buildDraftItems(
  draftMessages: Record<string, string>,
  allUsers: UserDTO[] | undefined,
  query: string,
): DraftConversationListItem[] {
  if (!allUsers) return []

  const drafts = Object.entries(draftMessages)
    .filter(([key, text]) => key.startsWith('new-') && text.trim().length > 0)
    .flatMap(([key, text]) => {
      const userIdPart = key.replace(/^new-/, '')
      const userId = Number.parseInt(userIdPart, 10)
      if (!Number.isFinite(userId)) return []

      const user = allUsers.find((u) => u.id === userId)
      if (!user) return []

      const preview = text.trim().replace(/\s+/g, ' ')
      return [
        {
          draftId: `draft-${key}`,
          draftKey: key,
          userId,
          userName: user.name || user.email,
          userEmail: user.email,
          preview,
          route: `/chats/new/${userId}`,
        },
      ]
    })

  if (!query) return drafts

  return drafts.filter(
    (draft) =>
      draft.userName.toLowerCase().includes(query) ||
      draft.userEmail.toLowerCase().includes(query) ||
      draft.preview.toLowerCase().includes(query),
  )
}

function sortAndFilterSessions(
  sessions: AISessionHeaderDTO[] | undefined,
  query: string,
  unreadCounts: GetUnreadMessagesDTO[] | undefined,
): AISessionHeaderDTO[] {
  if (!sessions) return []

  const filtered = query
    ? sessions.filter(
        (session) =>
          session.sessionName.toLowerCase().includes(query) ||
          session.agentId.toString().includes(query) ||
          session.members.some((email) => email.toLowerCase().includes(query)),
      )
    : [...sessions]

  return filtered.sort((a, b) => {
    const unreadA = getUnreadCountFromEntries(unreadCounts, a.sessionId)
    const unreadB = getUnreadCountFromEntries(unreadCounts, b.sessionId)

    if (unreadA > 0 && unreadB === 0) return -1
    if (unreadB > 0 && unreadA === 0) return 1

    return (
      new Date(getSessionActivityDate(b)).getTime() - new Date(getSessionActivityDate(a)).getTime()
    )
  })
}

export function useChatListData() {
  const authStore = useAuthStore()
  const chatStore = useChatStore()
  const { formatRelativeDate } = useRelativeDate()

  const currentUserEmail = computed(() => authStore.user?.email ?? '')

  const { data: users, isLoading: isLoadingUsers, error: usersError } = useSelectableUsers()
  const { data: sessions, isLoading: isLoadingSessions, error: sessionsError } = useChatSessions()
  const { data: unreadCounts } = useUnreadMessageCounts()

  const userSearchQuery = ref('')
  const sessionSearchQuery = ref('')

  const { filteredUsers } = useClientSideUserSearch(users, userSearchQuery)

  const filteredSessions = computed(() =>
    sortAndFilterSessions(
      sessions.value,
      sessionSearchQuery.value.toLowerCase(),
      unreadCounts.value,
    ),
  )

  const filteredDraftSessions = computed<DraftConversationListItem[]>(() =>
    buildDraftItems(
      chatStore.draftMessages,
      users.value,
      sessionSearchQuery.value.toLowerCase().trim(),
    ),
  )

  const totalUnreadCount = computed(
    () => unreadCounts.value?.reduce((sum, entry) => sum + entry.unreadMessageCount, 0) ?? 0,
  )

  const getUnreadCount = (sessionId: string) =>
    getUnreadCountFromEntries(unreadCounts.value, sessionId)
  const getOtherMembers = (members: string[]) =>
    getOtherMembersForEmail(members, authStore.user?.email)

  function getMemberNames(members: string[]): string {
    return getMemberNamesFromList(members, authStore.user?.email, users.value, useI18n().t)
  }

  type SessionHeader = Parameters<typeof getSessionDisplayName>[0]
  type PrimaryCheckSession = Parameters<typeof checkIsPrimarySession>[0]

  const getDisplayName = (session: SessionHeader & { sessionName: string }) =>
    !sessions.value || !users.value
      ? session.sessionName
      : getSessionDisplayName(session, currentUserEmail.value, sessions.value, users.value)

  const isPrimarySessionCheck = (session: PrimaryCheckSession) =>
    !!(sessions.value && users.value && currentUserEmail.value) &&
    checkIsPrimarySession(session, sessions.value, users.value, currentUserEmail.value)

  function handleUserClick(userId: number): string | null {
    if (!sessions.value || !users.value) return `/chats/new/${userId}`
    const ps = getPrimarySessionForUser(userId, currentUserEmail.value, sessions.value, users.value)
    return ps ? `/chats/${ps.sessionId}` : `/chats/new/${userId}`
  }

  return {
    users,
    sessions,
    unreadCounts,
    isLoadingUsers,
    isLoadingSessions,
    usersError,
    sessionsError,
    userSearchQuery,
    sessionSearchQuery,
    filteredUsers,
    filteredSessions,
    filteredDraftSessions,
    totalUnreadCount,
    getUnreadCount,
    getOtherMembers,
    getMemberNames,
    getInitials,
    getDisplayName,
    isPrimarySessionCheck,
    handleUserClick,
    clearDraftConversation: (draftKey: string) => chatStore.clearDraft(draftKey),
    formatRelativeDate,
    currentUserEmail,
  }
}
