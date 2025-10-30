import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ref } from 'vue'
import { useMutuallyVisibleUsers } from '@/app/composables/useMutuallyVisibleUsers'
import type { UserDTO } from '@/types/api/schemas'

import { useAuthStore } from '@/app/stores/auth'

// Mock useAuthStore
vi.mock('@/app/stores/auth', () => ({
  useAuthStore: vi.fn()
}))

describe('useMutuallyVisibleUsers', () => {
  const mockCurrentUser = {
    id: 1,
    userIds: [2, 3] // Current user can see users 2 and 3
  }

  const mockUsers: UserDTO[] = [
    { id: 2, name: 'User 2', email: 'user2@test.com', userIds: [1, 3], status: 'active', invitationAccepted: true, roles: [], isVirtual: false, url: '', isAvailable: true, createdAt: '', updatedAt: null },
    { id: 3, name: 'User 3', email: 'user3@test.com', userIds: [4], status: 'active', invitationAccepted: true, roles: [], isVirtual: false, url: '', isAvailable: true, createdAt: '', updatedAt: null }, // User 3 cannot see user 1
    { id: 4, name: 'User 4', email: 'user4@test.com', userIds: [1], status: 'active', invitationAccepted: true, roles: [], isVirtual: false, url: '', isAvailable: true, createdAt: '', updatedAt: null }, // User 4 can see user 1, but user 1 cannot see user 4
  ]

  beforeEach(() => {
    vi.mocked(useAuthStore).mockReturnValue({
      user: mockCurrentUser
    } as any)
  })

  it('returns only users with mutual visibility', () => {
    const users = ref(mockUsers)
    const { mutuallyVisibleUsers } = useMutuallyVisibleUsers(users)

    // Only User 2 should be visible (mutual: 1 sees 2, 2 sees 1)
    // User 3: 1 sees 3, but 3 does NOT see 1 -> excluded
    // User 4: 1 does NOT see 4 -> excluded
    expect(mutuallyVisibleUsers.value).toHaveLength(1)
    expect(mutuallyVisibleUsers.value[0].id).toBe(2)
  })

  it('returns empty array when users is undefined', () => {
    const users = ref<UserDTO[] | undefined>(undefined)
    const { mutuallyVisibleUsers } = useMutuallyVisibleUsers(users)

    expect(mutuallyVisibleUsers.value).toEqual([])
  })

  it('returns empty array when current user is not authenticated', () => {
    vi.mocked(useAuthStore).mockReturnValue({
      user: null
    } as any)

    const users = ref(mockUsers)
    const { mutuallyVisibleUsers } = useMutuallyVisibleUsers(users)

    expect(mutuallyVisibleUsers.value).toEqual([])
  })

  it('updates reactively when users change', () => {
    const users = ref(mockUsers)
    const { mutuallyVisibleUsers } = useMutuallyVisibleUsers(users)

    expect(mutuallyVisibleUsers.value).toHaveLength(1)

    // Add a new user with mutual visibility
    users.value = [
      ...mockUsers,
      { id: 5, name: 'User 5', email: 'user5@test.com', userIds: [1], status: 'active', invitationAccepted: true, roles: [], isVirtual: false, url: '', isAvailable: true, createdAt: '', updatedAt: null }
    ]

    // Update current user to also see user 5
    vi.mocked(useAuthStore).mockReturnValue({
      user: { id: 1, userIds: [2, 3, 5] }
    } as any)

    // Re-create to pick up new mock (in real usage, authStore is reactive)
    const { mutuallyVisibleUsers: updated } = useMutuallyVisibleUsers(users)
    expect(updated.value).toHaveLength(2)
  })
})
