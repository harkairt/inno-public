import { computed, ref } from 'vue'
import { useSelectableUsers } from '~/composables/useUsers'
import { useChatSessions, useUnreadMessageCounts } from '~/composables/useChatQueries'
import { useClientSideUserSearch } from '~/composables/useClientSideUserSearch'
import { useChatListFilters, type ParticipantType } from '~/composables/useChatListFilters'
import { useUserFavorites } from '~/composables/useUserFavorites'
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

interface ChatListFilterContext {
  query: string
  participantType: ParticipantType
  unreadOnly: boolean
  favoritesOnly: boolean
  currentUserEmail: string
  users: UserDTO[] | undefined
  unreadCounts: GetUnreadMessagesDTO[] | undefined
  favoriteIds: readonly number[]
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

function getSessionPrimaryMemberInfo(
  session: AISessionHeaderDTO,
  currentEmail: string,
  allUsers: UserDTO[] | undefined,
): { isVirtual: boolean; userId: number | undefined } {
  const otherMembers = session.members.filter((m) => m !== currentEmail)
  const primaryEmail = otherMembers[0]
  if (!primaryEmail) return { isVirtual: false, userId: undefined }
  const detail = session.memberDetails?.find((m) => m.email === primaryEmail)
  const user = allUsers?.find((u) => u.email === primaryEmail)
  return {
    isVirtual: detail?.isVirtual ?? user?.isVirtual ?? false,
    userId: user?.id,
  }
}

function sortAndFilterSessions(
  sessions: AISessionHeaderDTO[] | undefined,
  query: string,
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

  return filtered.sort(
    (a, b) =>
      new Date(getSessionActivityDate(b)).getTime() - new Date(getSessionActivityDate(a)).getTime(),
  )
}

function applySessionFilters(
  sessions: AISessionHeaderDTO[] | undefined,
  filters: ChatListFilterContext,
): AISessionHeaderDTO[] {
  const result = sortAndFilterSessions(sessions, filters.query)
  if (filters.participantType === 'all' && !filters.unreadOnly && !filters.favoritesOnly) {
    return result
  }

  return result.filter((session) => {
    if (filters.participantType !== 'all' || filters.favoritesOnly) {
      const primary = getSessionPrimaryMemberInfo(session, filters.currentUserEmail, filters.users)
      if (filters.participantType === 'ai' && !primary.isVirtual) return false
      if (filters.participantType === 'people' && primary.isVirtual) return false
      if (
        filters.favoritesOnly &&
        (primary.userId === undefined || !filters.favoriteIds.includes(primary.userId))
      ) {
        return false
      }
    }

    if (
      filters.unreadOnly &&
      getUnreadCountFromEntries(filters.unreadCounts, session.sessionId) <= 0
    ) {
      return false
    }

    return true
  })
}

function applyDraftFilters(
  draftMessages: Record<string, string>,
  filters: ChatListFilterContext,
): DraftConversationListItem[] {
  if (filters.unreadOnly) return []

  const result = buildDraftItems(draftMessages, filters.users, filters.query)
  if (filters.participantType === 'all' && !filters.favoritesOnly) return result

  return result.filter((draft) => {
    if (filters.participantType !== 'all') {
      const user = filters.users?.find((candidate) => candidate.id === draft.userId)
      const isVirtual = user?.isVirtual ?? false
      if (filters.participantType === 'ai' && !isVirtual) return false
      if (filters.participantType === 'people' && isVirtual) return false
    }

    return !filters.favoritesOnly || filters.favoriteIds.includes(draft.userId)
  })
}

export function useChatListData() {
  const authStore = useAuthStore()
  const chatStore = useChatStore()
  const { formatRelativeDate, formatSessionDate } = useRelativeDate()

  const currentUserEmail = computed(() => authStore.user?.email ?? '')

  const { data: users, isLoading: isLoadingUsers, error: usersError } = useSelectableUsers()
  const { data: sessions, isLoading: isLoadingSessions, error: sessionsError } = useChatSessions()
  const { data: unreadCounts } = useUnreadMessageCounts()

  const {
    searchQuery: sessionSearchQuery,
    participantType,
    unreadOnly,
    favoritesOnly,
  } = useChatListFilters()
  const { favoriteIds } = useUserFavorites()

  const userSearchQuery = ref('')

  const { filteredUsers } = useClientSideUserSearch(users, userSearchQuery)

  const filterContext = computed<ChatListFilterContext>(() => ({
    query: sessionSearchQuery.value.trim().toLowerCase(),
    participantType: participantType.value,
    unreadOnly: unreadOnly.value,
    favoritesOnly: favoritesOnly.value,
    currentUserEmail: currentUserEmail.value,
    users: users.value,
    unreadCounts: unreadCounts.value,
    favoriteIds: favoriteIds.value,
  }))

  const filteredSessions = computed(() => applySessionFilters(sessions.value, filterContext.value))
  const filteredDraftSessions = computed(() =>
    applyDraftFilters(chatStore.draftMessages, filterContext.value),
  )

  const totalUnreadCount = computed(
    () => unreadCounts.value?.reduce((sum, entry) => sum + entry.unreadMessageCount, 0) ?? 0,
  )

  const getUnreadCount = (sessionId: string) =>
    getUnreadCountFromEntries(unreadCounts.value, sessionId)
  const getOtherMembers = (members: string[]) =>
    getOtherMembersForEmail(members, authStore.user?.email)

  const getMemberNames = (members: string[]) =>
    getMemberNamesFromList(members, authStore.user?.email, users.value, useI18n().t)

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
    getDisplayName,
    isPrimarySessionCheck,
    handleUserClick,
    clearDraftConversation: (draftKey: string) => chatStore.clearDraft(draftKey),
    formatRelativeDate,
    formatSessionDate,
    currentUserEmail,
  }
}
