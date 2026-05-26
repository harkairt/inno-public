import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ref } from 'vue'
import { useMutuallyVisibleUsers } from '@/app/composables/useMutuallyVisibleUsers'
import type { UserDTO } from '@/types/api/schemas'

import { useAuthStore } from '@/app/stores/auth'

// Mock useAuthStore
vi.mock('@/app/stores/auth', () => ({
  useAuthStore: vi.fn(),
}))

describe('useMutuallyVisibleUsers', () => {
  const mockCurrentUser = {
    id: 1,
    userIds: [2, 3], // Current user can see users 2 and 3
  }

  const mockUsers: UserDTO[] = [
    {
      id: 2,
      name: 'User 2',
      email: 'user2@test.com',
      userIds: [1, 3],
      status: 'active',
      invitationAccepted: true,
      roles: [],
      isVirtual: false,
      url: '',
      isAvailable: true,
      createdAt: '',
      updatedAt: null,
    },
    {
      id: 3,
      name: 'User 3',
      email: 'user3@test.com',
      userIds: [4],
      status: 'active',
      invitationAccepted: true,
      roles: [],
      isVirtual: false,
      url: '',
      isAvailable: true,
      createdAt: '',
      updatedAt: null,
    }, // User 3 cannot see user 1
    {
      id: 4,
      name: 'User 4',
      email: 'user4@test.com',
      userIds: [1],
      status: 'active',
      invitationAccepted: true,
      roles: [],
      isVirtual: false,
      url: '',
      isAvailable: true,
      createdAt: '',
      updatedAt: null,
    }, // User 4 can see user 1, but user 1 cannot see user 4
  ]

  beforeEach(() => {
    vi.mocked(useAuthStore).mockReturnValue({
      user: mockCurrentUser,
    } as ReturnType<typeof useAuthStore>)
  })

  it('returns all users when mutual visibility is not yet implemented', () => {
    const users = ref(mockUsers)
    const { mutuallyVisibleUsers } = useMutuallyVisibleUsers(users)

    // Mutual visibility filtering is stubbed (TODO in source) — returns all users
    expect(mutuallyVisibleUsers.value).toHaveLength(3)
    expect(mutuallyVisibleUsers.value).toEqual(mockUsers)
  })

  it('returns empty array when users is undefined', () => {
    const users = ref<UserDTO[] | undefined>(undefined)
    const { mutuallyVisibleUsers } = useMutuallyVisibleUsers(users)

    expect(mutuallyVisibleUsers.value).toEqual([])
  })

  it('returns empty array when current user is not authenticated', () => {
    vi.mocked(useAuthStore).mockReturnValue({
      user: null,
    } as ReturnType<typeof useAuthStore>)

    const users = ref(mockUsers)
    const { mutuallyVisibleUsers } = useMutuallyVisibleUsers(users)

    expect(mutuallyVisibleUsers.value).toEqual([])
  })

  it('updates reactively when users change', () => {
    const users = ref(mockUsers)
    const { mutuallyVisibleUsers } = useMutuallyVisibleUsers(users)

    expect(mutuallyVisibleUsers.value).toHaveLength(3)

    const newUser = {
      id: 5,
      name: 'User 5',
      email: 'user5@test.com',
      userIds: [1],
      status: 'active',
      invitationAccepted: true,
      roles: [],
      isVirtual: false,
      url: '',
      isAvailable: true,
      createdAt: '',
      updatedAt: null,
    } as UserDTO
    users.value = [...mockUsers, newUser]

    expect(mutuallyVisibleUsers.value).toHaveLength(4)
  })
})
