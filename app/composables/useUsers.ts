import { useQuery } from '@tanstack/vue-query'
import { userService } from '@/lib/api/services/UserService'
import { useAuthStore } from '@/app/stores/auth'
import type { UserDTO } from '@/types/api/schemas'

// Query keys
export const userQueryKeys = {
  all: ['users'] as const,
  selectable: () => [...userQueryKeys.all, 'selectable'] as const,
}

/**
 * Selectable users query composable
 * Fetches users that can be selected for chat sessions (agents + real users)
 */
export function useSelectableUsers(options?: {
  email?: string
  enabled?: boolean
  staleTime?: number
  refetchInterval?: number
}) {
  const authStore = useAuthStore()

  // eslint-disable-next-line @tanstack/query/exhaustive-deps -- email is an optional override, not a cache discriminator
  return useQuery({
    queryKey: userQueryKeys.selectable(),
    queryFn: async (): Promise<UserDTO[]> => {
      if (!authStore.user) {
        throw new Error('User not authenticated')
      }

      const result = await userService.getSelectableUsers(options?.email ?? authStore.user.email)

      if (result.isErr()) {
        throw result.error
      }

      return result.value
    },
    enabled: options?.enabled ?? authStore.isAuthenticated,
    staleTime: options?.staleTime ?? 5 * 60 * 1000, // 5 minutes - user list doesn't change often
    gcTime: 15 * 60 * 1000, // 15 minutes
    refetchInterval: options?.refetchInterval ?? 10 * 60 * 1000, // Refresh every 10 minutes
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    retry: 2,
  })
}
