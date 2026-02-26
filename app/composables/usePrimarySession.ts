import { computed, type Ref, type ComputedRef } from 'vue'
import type { AISessionDTO, AISessionHeaderDTO, UserDTO } from '@/types/api/schemas'

/**
 * Check if a session qualifies as a "primary session" between two real users.
 *
 * A primary session is:
 * 1. Has exactly 2 members
 * 2. Current user is one of the members
 * 3. The other member is a real user (isVirtual === false)
 * 4. Is the oldest session (by insertDate) between these two users
 */
function isPrimarySessionCheck(
  session: AISessionDTO | AISessionHeaderDTO,
  allSessions: AISessionHeaderDTO[],
  users: UserDTO[],
  currentUserEmail: string
): boolean {
  // Must have exactly 2 members
  if (session.members.length !== 2) {
    return false
  }

  // Current user must be a member
  if (!currentUserEmail || !session.members.includes(currentUserEmail)) {
    return false
  }

  // Get the other member's email
  const otherEmail = session.members.find(email => email !== currentUserEmail)
  if (!otherEmail) {
    return false
  }

  // Check if the other member is a real (non-virtual) user
  const memberDetail = session.memberDetails?.find(m => m.email === otherEmail)
  if (memberDetail) {
    if (memberDetail.isVirtual) return false
  } else {
    const user = users.find(u => u.email === otherEmail)
    if (!user || user.isVirtual) return false
  }

  // Find all 2-member sessions between current user and the other user
  const sessionsBetweenUsers = allSessions.filter(s => {
    if (s.members.length !== 2) return false
    return s.members.includes(currentUserEmail) && s.members.includes(otherEmail)
  })

  if (sessionsBetweenUsers.length === 0) {
    return false
  }

  // Sort by insertDate (oldest first)
  const sorted = [...sessionsBetweenUsers].sort((a, b) =>
    new Date(a.insertDate).getTime() - new Date(b.insertDate).getTime()
  )

  // This session is primary if it's the oldest one
  const oldestSession = sorted[0]
  return oldestSession ? oldestSession.sessionId === session.sessionId : false
}

/**
 * Get the other member's info from a 2-member session
 */
function getOtherMemberInfo(
  session: AISessionDTO | AISessionHeaderDTO,
  currentUserEmail: string,
  users: UserDTO[]
): { email: string; name: string; id: number | undefined } | null {
  if (session.members.length !== 2) {
    return null
  }

  const otherEmail = session.members.find(email => email !== currentUserEmail)
  if (!otherEmail) {
    return null
  }

  // Try to get name from memberDetails first
  const memberDetail = session.memberDetails?.find(m => m.email === otherEmail)
  const user = users.find(u => u.email === otherEmail)

  return {
    email: otherEmail,
    name: memberDetail?.name || user?.name || otherEmail,
    id: user?.id
  }
}

/**
 * Composable for primary session detection and display in the chat page.
 */
export function usePrimarySession(
  session: Ref<AISessionDTO | AISessionHeaderDTO | null | undefined>,
  allSessions: Ref<AISessionHeaderDTO[] | undefined>,
  selectableUsers: Ref<UserDTO[] | undefined>,
  currentUserEmail: Ref<string | undefined>
): {
  isPrimarySession: ComputedRef<boolean>
  otherMemberName: ComputedRef<string>
  otherMemberId: ComputedRef<number | undefined>
} {
  const isPrimarySession = computed(() => {
    if (!session.value || !allSessions.value || !selectableUsers.value || !currentUserEmail.value) {
      return false
    }
    return isPrimarySessionCheck(session.value, allSessions.value, selectableUsers.value, currentUserEmail.value)
  })

  const otherMemberInfo = computed(() => {
    if (!session.value || !currentUserEmail.value || !selectableUsers.value) {
      return null
    }
    return getOtherMemberInfo(session.value, currentUserEmail.value, selectableUsers.value)
  })

  const otherMemberName = computed(() => {
    return otherMemberInfo.value?.name ?? ''
  })

  const otherMemberId = computed(() => {
    return otherMemberInfo.value?.id
  })

  return {
    isPrimarySession,
    otherMemberName,
    otherMemberId
  }
}

/**
 * Get the primary session for a specific user (if one exists).
 * Used in sidebar when clicking a user to navigate to their primary session.
 */
export function getPrimarySessionForUser(
  userId: number,
  currentUserEmail: string,
  sessions: AISessionHeaderDTO[],
  users: UserDTO[]
): AISessionHeaderDTO | null {
  // Must have current user email
  if (!currentUserEmail) {
    return null
  }

  // Find the target user's email
  const targetUser = users.find(u => u.id === userId)
  if (!targetUser || targetUser.isVirtual) {
    return null
  }

  // Find all 2-member sessions between current user and target user
  const candidateSessions = sessions.filter(s => {
    if (s.members.length !== 2) return false
    return s.members.includes(currentUserEmail) && s.members.includes(targetUser.email)
  })

  if (candidateSessions.length === 0) {
    return null
  }

  // Filter to sessions where target user is real (current user is obviously real)
  const realSessions = candidateSessions.filter(s => {
    // Check if target user is real via memberDetails or users array
    const memberDetail = s.memberDetails?.find(m => m.email === targetUser.email)
    if (memberDetail) {
      return !memberDetail.isVirtual
    }
    // targetUser is already validated above as non-virtual
    return true
  })

  if (realSessions.length === 0) {
    return null
  }

  // Return the oldest session (the primary one)
  const sorted = [...realSessions].sort((a, b) =>
    new Date(a.insertDate).getTime() - new Date(b.insertDate).getTime()
  )

  return sorted[0] ?? null
}

/**
 * Get the display name for a session in the sidebar.
 * For primary sessions, returns the other member's name.
 * For regular sessions, returns the session name.
 */
export function getSessionDisplayName(
  session: AISessionHeaderDTO,
  currentUserEmail: string,
  sessions: AISessionHeaderDTO[],
  users: UserDTO[]
): string {
  // Check if this is a primary session
  const isPrimary = isPrimarySessionCheck(session, sessions, users, currentUserEmail)

  if (isPrimary) {
    const otherInfo = getOtherMemberInfo(session, currentUserEmail, users)
    if (otherInfo) {
      return otherInfo.name
    }
  }

  return session.sessionName
}

/**
 * Check if a session is a primary session (standalone helper for sidebar use).
 */
export function checkIsPrimarySession(
  session: AISessionHeaderDTO,
  sessions: AISessionHeaderDTO[],
  users: UserDTO[],
  currentUserEmail: string
): boolean {
  return isPrimarySessionCheck(session, sessions, users, currentUserEmail)
}
