import { useQuery, useMutation, useQueryClient } from '@tanstack/vue-query'
import { userService } from '@/lib/api/services/UserService'
import { useAuthStore } from '@/app/stores/auth'
import { authQueryKeys } from './useAuth'
import type { UserDTO } from '@/types/api/schemas'
import type { UserStats } from '@/types/api/admin-types'
import type { AppError } from '@/lib/errors/types'

// Query keys
export const userQueryKeys = {
  all: ['users'] as const,
  selectable: () => [...userQueryKeys.all, 'selectable'] as const,
  list: (filters?: string) => [...userQueryKeys.all, 'list', filters] as const,
  search: (query: string) => [...userQueryKeys.all, 'search', query] as const,
  byId: (id: number) => [...userQueryKeys.all, 'id', id] as const,
  byEmail: (email: string) => [...userQueryKeys.all, 'email', email] as const,
  byRole: (role: string) => [...userQueryKeys.all, 'role', role] as const,
  online: () => [...userQueryKeys.all, 'online'] as const,
  stats: (id: number) => [...userQueryKeys.all, 'stats', id] as const,
  activity: (id: number) => [...userQueryKeys.all, 'activity', id] as const,
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

  return useQuery({
    queryKey: userQueryKeys.selectable(),
    queryFn: async (): Promise<UserDTO[]> => {
      if (!authStore.user) {
        throw new Error('User not authenticated')
      }

      const result = await userService.getSelectableUsers(
        options?.email || authStore.user.email
      )

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

/**
 * User search query composable
 * Searches for users by name or email
 */
export function useUserSearch(searchQuery: string, options?: {
  enabled?: boolean
  limit?: number
  debounceMs?: number
}) {
  const authStore = useAuthStore()
  const limit = options?.limit || 50

  return useQuery({
    queryKey: userQueryKeys.search(searchQuery),
    queryFn: async (): Promise<UserDTO[]> => {
      if (!authStore.user) {
        throw new Error('User not authenticated')
      }

      if (!searchQuery?.trim()) {
        return []
      }

      const result = await userService.searchUsers(searchQuery.trim(), limit)

      if (result.isErr()) {
        throw result.error
      }

      return result.value
    },
    enabled: options?.enabled ?? (authStore.isAuthenticated && !!searchQuery?.trim()),
    staleTime: 2 * 60 * 1000, // 2 minutes - search results can be cached briefly
    gcTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    retry: 1,
  })
}

/**
 * User by ID query composable
 * Fetches a specific user by ID
 */
export function useUserById(userId: number, options?: {
  enabled?: boolean
  staleTime?: number
}) {
  const _authStore = useAuthStore()

  return useQuery({
    queryKey: userQueryKeys.byId(userId),
    queryFn: async (): Promise<UserDTO> => {
      if (!userId) {
        throw new Error('User ID is required')
      }

      const result = await userService.getUserById(userId)

      if (result.isErr()) {
        throw result.error
      }

      return result.value
    },
    enabled: options?.enabled ?? !!userId,
    staleTime: options?.staleTime ?? 5 * 60 * 1000, // 5 minutes
    gcTime: 15 * 60 * 1000, // 15 minutes
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
    retry: 2,
  })
}

/**
 * User by email query composable
 * Fetches a specific user by email address
 */
export function useUserByEmail(email: string, options?: {
  enabled?: boolean
  staleTime?: number
}) {
  const _authStore = useAuthStore()

  return useQuery({
    queryKey: userQueryKeys.byEmail(email),
    queryFn: async (): Promise<UserDTO> => {
      if (!email?.trim()) {
        throw new Error('Email is required')
      }

      const result = await userService.getUserByEmail(email.trim())

      if (result.isErr()) {
        throw result.error
      }

      return result.value
    },
    enabled: options?.enabled ?? !!email?.trim(),
    staleTime: options?.staleTime ?? 5 * 60 * 1000, // 5 minutes
    gcTime: 15 * 60 * 1000, // 15 minutes
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
    retry: 2,
  })
}

/**
 * Users by role query composable
 * Fetches users filtered by role
 */
export function useUsersByRole(role: string, options?: {
  enabled?: boolean
  staleTime?: number
}) {
  const authStore = useAuthStore()

  return useQuery({
    queryKey: userQueryKeys.byRole(role),
    queryFn: async (): Promise<UserDTO[]> => {
      if (!authStore.user) {
        throw new Error('User not authenticated')
      }

      if (!role?.trim()) {
        return []
      }

      const result = await userService.getUsersByRole(role.trim())

      if (result.isErr()) {
        throw result.error
      }

      return result.value
    },
    enabled: options?.enabled ?? (authStore.isAuthenticated && !!role?.trim()),
    staleTime: options?.staleTime ?? 3 * 60 * 1000, // 3 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    retry: 2,
  })
}

/**
 * Online users query composable
 * Fetches currently online users
 */
export function useOnlineUsers(options?: {
  enabled?: boolean
  refetchInterval?: number
}) {
  const authStore = useAuthStore()

  return useQuery({
    queryKey: userQueryKeys.online(),
    queryFn: async (): Promise<UserDTO[]> => {
      if (!authStore.user) {
        throw new Error('User not authenticated')
      }

      const result = await userService.getOnlineUsers()

      if (result.isErr()) {
        throw result.error
      }

      return result.value
    },
    enabled: options?.enabled ?? authStore.isAuthenticated,
    staleTime: 30 * 1000, // 30 seconds - online status changes frequently
    gcTime: 2 * 60 * 1000, // 2 minutes
    refetchInterval: options?.refetchInterval ?? 60 * 1000, // Refresh every minute
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    retry: 3,
  })
}

/**
 * User statistics query composable
 * Fetches detailed statistics for a specific user
 */
export function useUserStats(userId: number, options?: {
  enabled?: boolean
  staleTime?: number
  refetchInterval?: number
}) {
  const _authStore = useAuthStore()

  return useQuery({
    queryKey: userQueryKeys.stats(userId),
    queryFn: async (): Promise<UserStats> => {
      if (!userId) {
        throw new Error('User ID is required')
      }

      const result = await userService.getUserStats(userId)

      if (result.isErr()) {
        throw result.error
      }

      return result.value
    },
    enabled: options?.enabled ?? !!userId,
    staleTime: options?.staleTime ?? 2 * 60 * 1000, // 2 minutes - stats change periodically
    gcTime: 5 * 60 * 1000, // 5 minutes
    refetchInterval: options?.refetchInterval ?? 5 * 60 * 1000, // Refresh every 5 minutes
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    retry: 2,
  })
}

/**
 * User activity infinite query composable
 * Fetches user's recent activity with pagination
 */
// export function useUserActivity(userId: number, options?: {
//   enabled?: boolean
//   pageSize?: number
//   staleTime?: number
// }) {
//   const authStore = useAuthStore()
//   const pageSize = options?.pageSize || 20

//   return useInfiniteQuery({
//     queryKey: userQueryKeys.activity(userId),
//     queryFn: async ({ pageParam = 0 }): Promise<{
//       activities: UserActivity[]
//       nextPage: number | null
//       hasMore: boolean
//     }> => {
//       if (!authStore.user) {
//         throw new Error('User not authenticated')
//       }

//       if (!userId) {
//         throw new Error('User ID is required')
//       }

//       const result = await userService.getUserActivity(userId, pageSize, pageParam * pageSize)

//       if (result.isErr()) {
//         throw result.error
//       }

//       const activities = result.value || []

//       return {
//         activities,
//         nextPage: activities.length === pageSize ? pageParam + 1 : null,
//         hasMore: activities.length === pageSize,
//       }
//     },
//     getNextPageParam: (lastPage) => lastPage.nextPage,
//     initialPageParam: 0,
//     enabled: options?.enabled ?? (authStore.isAuthenticated && !!userId),
//     staleTime: options?.staleTime ?? 60 * 1000, // 1 minute - activity changes frequently
//     gcTime: 3 * 60 * 1000, // 3 minutes
//     refetchOnWindowFocus: false,
//     refetchOnReconnect: true,
//     retry: 1,
//   })
// }

/**
 * Update user mutation composable
 * Handles updating user profile information
 */
export function useUpdateUser() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (params: { userId: number; updates: Partial<UserDTO> }): Promise<UserDTO> => {
      const result = await userService.updateUser(params.userId, params.updates)

      if (result.isErr()) {
        throw result.error
      }

      return result.value
    },

    onSuccess: (updatedUser, params) => {
      // Update user in cache
      queryClient.setQueryData(userQueryKeys.byId(params.userId), updatedUser)
      queryClient.setQueryData(userQueryKeys.byEmail(updatedUser.email), updatedUser)

      // Invalidate related queries
      queryClient.invalidateQueries({ queryKey: userQueryKeys.selectable() })
      queryClient.invalidateQueries({ queryKey: userQueryKeys.list() })
      // TODO: Invalidate role-based queries when role queries are implemented
      // queryClient.invalidateQueries({ queryKey: userQueryKeys.byRole() })

      // If updating current user, update auth cache too
      if (updatedUser.email) {
        queryClient.invalidateQueries({ queryKey: authQueryKeys.current() })
        queryClient.invalidateQueries({ queryKey: authQueryKeys.profile(updatedUser.email) })
      }
    },

    onError: (error: AppError) => {
      console.error('Update user failed:', error)
    },
  })
}

/**
 * Update user availability mutation composable
 * Handles updating user's availability status
 */
export function useUpdateUserAvailability() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (params: { userId: number; isAvailable: boolean }): Promise<UserDTO> => {
      const result = await userService.updateUserAvailability(params.userId, params.isAvailable)

      if (result.isErr()) {
        throw result.error
      }

      return result.value
    },

    onSuccess: (updatedUser, params) => {
      // Update user in cache
      queryClient.setQueryData(userQueryKeys.byId(params.userId), updatedUser)

      // Invalidate related queries
      queryClient.invalidateQueries({ queryKey: userQueryKeys.selectable() })
      queryClient.invalidateQueries({ queryKey: userQueryKeys.online() })
      queryClient.invalidateQueries({ queryKey: userQueryKeys.list() })

      // If updating current user, update auth cache too
      if (updatedUser.email) {
        queryClient.invalidateQueries({ queryKey: authQueryKeys.current() })
      }
    },

    onError: (error: AppError) => {
      console.error('Update user availability failed:', error)
    },
  })
}

/**
 * Upload avatar mutation composable
 * Handles uploading user avatar images
 */
export function useUploadAvatar() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (params: {
      userId: number
      avatarFile: File
      isDarkMode?: boolean
    }): Promise<UserDTO> => {
      const result = await userService.uploadAvatar(
        params.userId,
        params.avatarFile,
        params.isDarkMode ?? false
      )

      if (result.isErr()) {
        throw result.error
      }

      return result.value
    },

    onSuccess: (updatedUser, params) => {
      // Update user in cache
      queryClient.setQueryData(userQueryKeys.byId(params.userId), updatedUser)

      // Invalidate related queries
      queryClient.invalidateQueries({ queryKey: userQueryKeys.selectable() })
      queryClient.invalidateQueries({ queryKey: userQueryKeys.list() })

      // If updating current user, update auth cache too
      if (updatedUser.email) {
        queryClient.invalidateQueries({ queryKey: authQueryKeys.current() })
      }
    },

    onError: (error: AppError) => {
      console.error('Upload avatar failed:', error)
    },
  })
}

/**
 * Deactivate user mutation composable
 * Handles deactivating user accounts
 */
export function useDeactivateUser() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (userId: number): Promise<void> => {
      const result = await userService.deactivateUser(userId)

      if (result.isErr()) {
        throw result.error
      }

      return result.value
    },

    onSuccess: (_, userId) => {
      // Remove user from cache
      queryClient.removeQueries({ queryKey: userQueryKeys.byId(userId) })

      // Invalidate related queries
      queryClient.invalidateQueries({ queryKey: userQueryKeys.selectable() })
      queryClient.invalidateQueries({ queryKey: userQueryKeys.list() })
      queryClient.invalidateQueries({ queryKey: userQueryKeys.online() })
    },

    onError: (error: AppError) => {
      console.error('Deactivate user failed:', error)
    },
  })
}

/**
 * Reactivate user mutation composable
 * Handles reactivating user accounts
 */
export function useReactivateUser() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (userId: number): Promise<UserDTO> => {
      const result = await userService.reactivateUser(userId)

      if (result.isErr()) {
        throw result.error
      }

      return result.value
    },

    onSuccess: (reactivatedUser, userId) => {
      // Update user in cache
      queryClient.setQueryData(userQueryKeys.byId(userId), reactivatedUser)

      // Invalidate related queries
      queryClient.invalidateQueries({ queryKey: userQueryKeys.selectable() })
      queryClient.invalidateQueries({ queryKey: userQueryKeys.list() })
      queryClient.invalidateQueries({ queryKey: userQueryKeys.online() })
    },

    onError: (error: AppError) => {
      console.error('Reactivate user failed:', error)
    },
  })
}