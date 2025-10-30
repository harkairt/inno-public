import { computed, type Ref, type ComputedRef } from 'vue'
import type { UserDTO } from '@/types/api/schemas'

/**
 * Client-side user search composable
 * Filters users based on search query without API calls
 */
export function useClientSideUserSearch(
  users: Ref<UserDTO[] | undefined>,
  searchQuery: Ref<string>
): { filteredUsers: ComputedRef<UserDTO[]> } {
  const filteredUsers = computed(() => {
    if (!users.value) {
      return []
    }

    const query = searchQuery.value.trim().toLowerCase()
    if (!query) {
      return users.value
    }

    return users.value.filter(user => {
      // Search in name field (primary)
      if (user.name?.toLowerCase().includes(query)) {
        return true
      }

      // Search in email field (secondary)
      if (user.email?.toLowerCase().includes(query)) {
        return true
      }

      return false
    })
  })

  return { filteredUsers }
}