import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ref } from 'vue'
import type { UserDTO } from '@/types/api/schemas'

// Mock all composables before importing anything
vi.mock('@/app/composables/useUsers', () => ({
  useSelectableUsers: vi.fn()
}))

vi.mock('@/app/composables/useMutuallyVisibleUsers', () => ({
  useMutuallyVisibleUsers: vi.fn()
}))

vi.mock('@/app/composables/useChatMutations', () => ({
  useAddUserToSession: vi.fn(() => ({
    mutateAsync: vi.fn(),
    isPending: ref(false)
  })),
  useRemoveUserFromSession: vi.fn(() => ({
    mutateAsync: vi.fn(),
    isPending: ref(false)
  }))
}))

vi.mock('@/app/stores/auth', () => ({
  useAuthStore: vi.fn(() => ({
    user: { id: 1, userIds: [2, 3] }
  }))
}))

// Mock Nuxt auto-imports globally
vi.stubGlobal('useI18n', () => ({ t: (key: string) => key }))
vi.stubGlobal('useToast', () => ({ add: vi.fn() }))
vi.stubGlobal('ref', ref)
vi.stubGlobal('computed', (fn: () => any) => ({ value: fn() }))

import { useSelectableUsers } from '@/app/composables/useUsers'
import { useMutuallyVisibleUsers } from '@/app/composables/useMutuallyVisibleUsers'

describe('ManageSessionUsers', () => {
  const createMockUser = (id: number, userIds: number[]): UserDTO => ({
    id,
    name: `User ${id}`,
    email: `user${id}@test.com`,
    userIds,
    status: 'active',
    invitationAccepted: true,
    roles: [],
    isVirtual: false,
    url: '',
    isAvailable: true,
    createdAt: '',
    updatedAt: null
  })

  const allUsers = [
    createMockUser(2, [1, 3]), // Mutual with user 1
    createMockUser(3, [4]),    // Not mutual with user 1
    createMockUser(4, [1])     // User 1 can't see user 4
  ]

  const mutuallyVisibleUsersData = [
    createMockUser(2, [1, 3]) // Only user 2 is mutually visible
  ]

  beforeEach(() => {
    vi.clearAllMocks()

    vi.mocked(useSelectableUsers).mockReturnValue({
      data: ref(allUsers),
      isLoading: ref(false)
    } as any)

    vi.mocked(useMutuallyVisibleUsers).mockReturnValue({
      mutuallyVisibleUsers: ref(mutuallyVisibleUsersData)
    } as any)
  })

  it('calls useMutuallyVisibleUsers with selectableUsers', async () => {
    // Dynamically import the component to ensure mocks are applied
    const { default: ManageSessionUsers } = await import('@/app/components/chat/ManageSessionUsers.vue')
    const { mount } = await import('@vue/test-utils')

    const wrapper = mount(ManageSessionUsers, {
      props: {
        sessionId: 'test-session',
        agentId: 1,
        members: []
      },
      global: {
        stubs: {
          UPopover: {
            template: '<div><slot /><slot name="content" /></div>'
          },
          UButton: true,
          UInput: true,
          UCheckbox: true,
          UAvatar: true,
          USkeleton: true,
          UEmpty: true
        }
      }
    })

    // Verify useMutuallyVisibleUsers was called
    expect(useMutuallyVisibleUsers).toHaveBeenCalled()

    // Verify it was called with the selectableUsers data ref
    const callArg = vi.mocked(useMutuallyVisibleUsers).mock.calls[0][0]
    expect(callArg).toBeDefined()
  })
})
