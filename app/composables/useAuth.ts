import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import { useAuthStore } from '@/app/stores/auth'
import { authService } from '@/lib/api/services/AuthService'
import { createLogger } from '@/lib/utils/logger'
import type { LoginRequestDTO, UserDTO } from '@/types/api/schemas'
import type { AppError } from '@/lib/errors/types'

const logger = createLogger('useAuth')

// Query keys
export const authQueryKeys = {
  all: ['auth'] as const,
  user: () => [...authQueryKeys.all, 'user'] as const,
  current: () => [...authQueryKeys.user(), 'current'] as const,
  profile: (email: string) => [...authQueryKeys.user(), email] as const,
}

/**
 * Login mutation composable
 * Wraps auth store login with Vue Query for better caching and state management
 */
export function useLogin() {
  const authStore = useAuthStore()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (credentials: LoginRequestDTO): Promise<UserDTO> => {
      const result = await authStore.login(credentials)

      if (result.isErr()) {
        throw result.error
      }

      return result.value
    },
    onSuccess: (user) => {
      // Invalidate current user query to trigger refetch
      void queryClient.invalidateQueries({ queryKey: authQueryKeys.current() })

      // Set the current user query data immediately
      queryClient.setQueryData(authQueryKeys.current(), user)
    },
    onError: (error: AppError) => {
      logger.error('Login failed:', error)
      // Clear any existing user data on failed login
      queryClient.setQueryData(authQueryKeys.current(), null)
    },
  })
}

/**
 * Logout mutation composable
 * Clears client-side auth state (no backend logout endpoint)
 */
export function useLogout() {
  const authStore = useAuthStore()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (): Promise<void> => {
      // Clear auth store (client-side only)
      authStore.clearAuth()
    },
    onSuccess: () => {
      // Clear all auth-related queries
      queryClient.removeQueries({ queryKey: authQueryKeys.all })

      // Clear current user data
      queryClient.setQueryData(authQueryKeys.current(), null)

      // Optionally clear all queries for security
      queryClient.clear()
    },
    onError: (error: AppError) => {
      logger.error('Logout failed:', error)
      // Even if something fails, clear local data
      queryClient.removeQueries({ queryKey: authQueryKeys.all })
      queryClient.setQueryData(authQueryKeys.current(), null)
    },
  })
}

/**
 * Current user query composable
 * Provides reactive access to the current authenticated user from store
 */
export function useCurrentUser(options?: {
  enabled?: boolean
  refetchOnWindowFocus?: boolean
  refetchOnReconnect?: boolean
}) {
  const authStore = useAuthStore()

  return useQuery({
    queryKey: authQueryKeys.current(),
    queryFn: async (): Promise<UserDTO | null> => {
      return authStore.user
    },
    enabled: options?.enabled ?? authStore.isAuthenticated,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
    refetchOnWindowFocus: options?.refetchOnWindowFocus ?? false,
    refetchOnReconnect: options?.refetchOnReconnect ?? true,
  })
}

/**
 * User profile query composable
 * Fetches user profile by email with caching
 */
export function useUserProfile(
  email: string,
  options?: {
    enabled?: boolean
    staleTime?: number
  },
) {
  const authStore = useAuthStore()

  return useQuery({
    queryKey: authQueryKeys.profile(email),
    queryFn: async (): Promise<UserDTO> => {
      if (authStore.user?.email === email && authStore.user) {
        return authStore.user
      }

      const result = await authService.getProfile(email)

      if (result.isErr()) {
        throw result.error
      }

      return result.value
    },
    enabled: options?.enabled ?? !!email,
    staleTime: options?.staleTime ?? 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
    refetchOnWindowFocus: false,
  })
}

/**
 * Token refresh mutation composable
 * Handles automatic token refresh
 */
export function useRefreshToken() {
  const authStore = useAuthStore()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (): Promise<void> => {
      const result = await authStore.refreshAuthToken()

      if (result.isErr()) {
        throw result.error
      }

      return result.value
    },
    onSuccess: () => {
      // Token refreshed successfully, no need to invalidate queries
      // User data remains the same
    },
    onError: (error: AppError) => {
      logger.error('Token refresh failed:', error)

      // Clear auth data on refresh failure
      queryClient.removeQueries({ queryKey: authQueryKeys.all })
      queryClient.setQueryData(authQueryKeys.current(), null)

      // Clear auth store
      authStore.clearAuth()
    },
  })
}

/**
 * Forgotten password mutation composable
 * Handles forgotten password requests
 */
export function useForgottenPassword() {
  return useMutation({
    mutationFn: async (email: string): Promise<void> => {
      const result = await authService.forgottenPassword(email)

      if (result.isErr()) {
        throw result.error
      }

      return result.value
    },
    onError: (error: AppError) => {
      logger.error('Forgotten password request failed:', error)
    },
  })
}

/**
 * Set password mutation composable
 * Handles password reset with token
 */
export function useSetPassword() {
  return useMutation({
    mutationFn: async (params: { token: string; newPassword: string }): Promise<void> => {
      const result = await authService.setPassword(params.token, params.newPassword)

      if (result.isErr()) {
        throw result.error
      }

      return result.value
    },
    onError: (error: AppError) => {
      logger.error('Set password failed:', error)
    },
  })
}
