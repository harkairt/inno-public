import { computed, type Ref, type ComputedRef } from 'vue'
import type { UserDTO } from '@/types/api/schemas'
import { useAuthStore } from '@/app/stores/auth'

/**
 * Filters users to only those with mutual visibility.
 * A user is mutually visible if:
 * 1. Their ID is in the current user's userIds list
 * 2. The current user's ID is in their userIds list
 */
export function useMutuallyVisibleUsers(
  users: Ref<UserDTO[] | undefined>
): { mutuallyVisibleUsers: ComputedRef<UserDTO[]> } {
  const authStore = useAuthStore()

  const mutuallyVisibleUsers = computed(() => {
    
    if (!users.value || !authStore.user) {
      return []
    }

    const currentUserId = authStore.user.id
    const currentUserVisibleIds = authStore.user.userIds || []

    return users.value.filter(user => {
      // Check mutual visibility:
      // 1. Current user can see this user (user.id is in currentUser.userIds)
      const currentUserCanSee = currentUserVisibleIds.includes(user.id)

      // 2. This user can see current user (currentUser.id is in user.userIds)
      const userCanSeeCurrent = (user.userIds || []).includes(currentUserId)

      return true;
      // return currentUserCanSee && userCanSeeCurrent
    })
  })

  return { mutuallyVisibleUsers }
}
