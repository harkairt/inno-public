import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import { useAuthStore } from '@/app/stores/auth'
import { authService } from '@/lib/api/services/AuthService'
import type { User } from '@/types/domain/models'
import type { LoginRequestDTO } from '@/types/api/schemas'
import type { AppError } from '@/lib/errors/types'

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
    mutationFn: async (credentials: LoginRequestDTO): Promise<User> => {
      const result = await authStore.login(credentials)

      if (result.isErr()) {
        throw result.error
      }

      return result.value
    },
    onSuccess: (user) => {
      // Invalidate current user query to trigger refetch
      queryClient.invalidateQueries({ queryKey: authQueryKeys.current() })

      // Set the current user query data immediately
      queryClient.setQueryData(authQueryKeys.current(), user)
    },
    onError: (error: AppError) => {
      console.error('Login failed:', error)
      // Clear any existing user data on failed login
      queryClient.setQueryData(authQueryKeys.current(), null)
      queryClient.removeQueries({ queryKey: authQueryKeys.profile('TODO') })
    },
  })
}

/**
 * Logout mutation composable
 * Wraps auth store logout with proper cache cleanup
 */
export function useLogout() {
  const authStore = useAuthStore()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (): Promise<void> => {
      await authStore.logout()
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
      console.error('Logout failed:', error)
      // Even if logout API fails, clear local data
      queryClient.removeQueries({ queryKey: authQueryKeys.all })
      queryClient.setQueryData(authQueryKeys.current(), null)
    },
  })
}

/**
 * Current user query composable
 * Provides reactive access to the current authenticated user
 */
export function useCurrentUser(options?: {
  enabled?: boolean
  refetchOnWindowFocus?: boolean
  refetchOnReconnect?: boolean
}) {
  const authStore = useAuthStore()

  return useQuery({
    queryKey: authQueryKeys.current(),
    queryFn: async (): Promise<User | null> => {
      // If user is already in store, return it immediately
      if (authStore.user) {
        return authStore.user
      }

      // If not authenticated, try to check with server
      const result = await authService.checkAuth()

      if (result.isErr()) {
        throw result.error
      }

      // Update store with fresh user data
      await authStore.fetchProfile(result.value.email)
      return authStore.user
    },
    enabled: options?.enabled ?? authStore.isAuthenticated,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
    refetchOnWindowFocus: options?.refetchOnWindowFocus ?? false,
    refetchOnReconnect: options?.refetchOnReconnect ?? true,
    retry: (failureCount, error) => {
      // Don't retry on auth errors
      if (error && typeof error === 'object' && 'code' in error) {
        const appError = error as AppError
        if (appError.code === 'UNAUTHORIZED' || appError.code === 'FORBIDDEN') {
          return false
        }
      }
      return failureCount < 2
    },
  })
}

/**
 * User profile query composable
 * Fetches user profile by email with caching
 */
export function useUserProfile(email: string, options?: {
  enabled?: boolean
  staleTime?: number
}) {
  const authStore = useAuthStore()

  return useQuery({
    queryKey: authQueryKeys.profile(email),
    queryFn: async (): Promise<User> => {
      // If requesting current user's profile and it's already in store, return it
      if (authStore.user?.email === email && authStore.user) {
        return authStore.user
      }

      const result = await authService.getProfile(email)

      if (result.isErr()) {
        throw result.error
      }

      return authStore.mapUserDTOToUser(result.value)
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
      console.error('Token refresh failed:', error)

      // Clear auth data on refresh failure
      queryClient.removeQueries({ queryKey: authQueryKeys.all })
      queryClient.setQueryData(authQueryKeys.current(), null)

      // Clear auth store
      authStore.clearAuth()
    },
  })
}

/**
 * Update profile mutation composable
 * Handles user profile updates
 */
export function useUpdateProfile() {
  const _authStore = useAuthStore()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (params: { email: string; updates: Partial<User> }): Promise<User> => {
      const result = await authService.updateProfile(params.email, params.updates)

      if (result.isErr()) {
        throw result.error
      }

      return _authStore.mapUserDTOToUser(result.value)
    },
    onSuccess: (updatedUser, params) => {
      // Invalidate and refetch current user data
      queryClient.invalidateQueries({ queryKey: authQueryKeys.current() })
      queryClient.invalidateQueries({ queryKey: authQueryKeys.profile(params.email) })
    },
    onError: (error: AppError) => {
      console.error('Profile update failed:', error)
    },
  })
}

/**
 * Change password mutation composable
 * Handles password changes
 */
export function useChangePassword() {
  return useMutation({
    mutationFn: async (params: {
      email: string
      currentPassword: string
      newPassword: string
    }): Promise<void> => {
      const result = await authService.changePassword(
        params.email,
        params.currentPassword,
        params.newPassword
      )

      if (result.isErr()) {
        throw result.error
      }

      return result.value
    },
    onError: (error: AppError) => {
      console.error('Password change failed:', error)
    },
  })
}

/**
 * Password reset request mutation composable
 * Handles password reset requests
 */
export function useRequestPasswordReset() {
  return useMutation({
    mutationFn: async (email: string): Promise<void> => {
      const result = await authService.requestPasswordReset(email)

      if (result.isErr()) {
        throw result.error
      }

      return result.value
    },
    onError: (error: AppError) => {
      console.error('Password reset request failed:', error)
    },
  })
}

/**
 * Password reset mutation composable
 * Handles password reset with token
 */
export function useResetPassword() {
  return useMutation({
    mutationFn: async (params: { token: string; newPassword: string }): Promise<void> => {
      const result = await authService.resetPassword(params.token, params.newPassword)

      if (result.isErr()) {
        throw result.error
      }

      return result.value
    },
    onError: (error: AppError) => {
      console.error('Password reset failed:', error)
    },
  })
}

/**
 * Email verification mutation composable
 * Handles email verification
 */
export function useVerifyEmail() {
  return useMutation({
    mutationFn: async (token: string): Promise<void> => {
      const result = await authService.verifyEmail(token)

      if (result.isErr()) {
        throw result.error
      }

      return result.value
    },
    onSuccess: () => {
      // Invalidate current user query to refresh verification status
      const queryClient = useQueryClient()
      queryClient.invalidateQueries({ queryKey: authQueryKeys.current() })
    },
    onError: (error: AppError) => {
      console.error('Email verification failed:', error)
    },
  })
}