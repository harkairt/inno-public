import type { Result } from 'neverthrow'
import { err, ok } from 'neverthrow'
import { apiClient } from '../client'
import { normalizeApiError } from '@/lib/errors/normalize'
import { AppError } from '@/lib/errors/types'
import type { UserDTO } from '@/types/api/schemas'
import { UserDTOSchema } from '@/types/api/schemas'
import type { ApiResponse } from '@/types/api/base'
import type { UserStats, UserActivity } from '@/types/api/admin-types'
import { ErrorCode } from '@/types/enums'

export class UserService {
  /**
   * Get all selectable users (agents + real users)
   */
  async getSelectableUsers(email: string): Promise<Result<UserDTO[], AppError>> {
    try {
      const response = await apiClient.get<ApiResponse<UserDTO[]>>(
        '/api/user/get-selectable-users',
        { params: { email } },
      )

      const users = response.data.data || []

      // Validate each user with Zod
      const validatedUsers = []
      for (const user of users) {
        const parseResult = UserDTOSchema.safeParse(user)
        if (!parseResult.success) {
          return err(new AppError(
            ErrorCode.VALIDATION_ERROR,
            'Invalid user data format',
            undefined,
            parseResult.error,
          ))
        }
        validatedUsers.push(parseResult.data)
      }

      return ok(validatedUsers)
    } catch (error) {
      return err(normalizeApiError(error))
    }
  }

  /**
   * Get user by ID
   */
  async getUserById(userId: number): Promise<Result<UserDTO, AppError>> {
    try {
      const response = await apiClient.get<ApiResponse<UserDTO>>(
        `/api/user/${userId}`,
      )

      if (!response.data.data) {
        return err(new AppError(ErrorCode.NOT_FOUND, 'User not found'))
      }

      // Validate response with Zod
      const parseResult = UserDTOSchema.safeParse(response.data.data)

      if (!parseResult.success) {
        return err(new AppError(
          ErrorCode.VALIDATION_ERROR,
          'Invalid user data format',
          undefined,
          parseResult.error,
        ))
      }

      return ok(parseResult.data)
    } catch (error) {
      return err(normalizeApiError(error))
    }
  }

  /**
   * Get user by email
   */
  async getUserByEmail(email: string): Promise<Result<UserDTO, AppError>> {
    try {
      const response = await apiClient.get<ApiResponse<UserDTO[]>>(
        '/api/user/by-email',
        { params: { email } },
      )

      if (!response.data.data) {
        return err(new AppError(ErrorCode.NOT_FOUND, 'User not found'))
      }

      // Validate response with Zod
      const parseResult = UserDTOSchema.safeParse(response.data.data)

      if (!parseResult.success) {
        return err(new AppError(
          ErrorCode.VALIDATION_ERROR,
          'Invalid user data format',
          undefined,
          parseResult.error,
        ))
      }

      return ok(parseResult.data)
    } catch (error) {
      return err(normalizeApiError(error))
    }
  }

  /**
   * Search users by name or email
   */
  async searchUsers(query: string, limit: number = 50): Promise<Result<UserDTO[], AppError>> {
    try {
      const response = await apiClient.get<ApiResponse<UserDTO[]>>(
        '/api/user/search',
        { params: { query, limit } },
      )

      const users = response.data.data || []

      // Validate each user with Zod
      const validatedUsers = []
      for (const user of users) {
        const parseResult = UserDTOSchema.safeParse(user)
        if (!parseResult.success) {
          return err(new AppError(
            ErrorCode.VALIDATION_ERROR,
            'Invalid user data format',
            undefined,
            parseResult.error,
          ))
        }
        validatedUsers.push(parseResult.data)
      }

      return ok(validatedUsers)
    } catch (error) {
      return err(normalizeApiError(error))
    }
  }

  /**
   * Update user profile
   */
  async updateUser(
    userId: number,
    updates: Partial<UserDTO>,
  ): Promise<Result<UserDTO, AppError>> {
    try {
      const response = await apiClient.put<ApiResponse<UserDTO>>(
        `/api/user/${userId}`,
        updates,
      )

      if (!response.data.data) {
        return err(new AppError(ErrorCode.NOT_FOUND, 'User not found'))
      }

      // Validate response with Zod
      const parseResult = UserDTOSchema.safeParse(response.data.data)

      if (!parseResult.success) {
        return err(new AppError(
          ErrorCode.VALIDATION_ERROR,
          'Invalid user data format',
          undefined,
          parseResult.error,
        ))
      }

      return ok(parseResult.data)
    } catch (error) {
      return err(normalizeApiError(error))
    }
  }

  /**
   * Update user availability status
   */
  async updateUserAvailability(
    userId: number,
    isAvailable: boolean,
  ): Promise<Result<UserDTO, AppError>> {
    try {
      const response = await apiClient.patch<ApiResponse<UserDTO>>(
        `/api/user/${userId}/availability`,
        { isAvailable },
      )

      if (!response.data.data) {
        return err(new AppError(ErrorCode.NOT_FOUND, 'User not found'))
      }

      // Validate response with Zod
      const parseResult = UserDTOSchema.safeParse(response.data.data)

      if (!parseResult.success) {
        return err(new AppError(
          ErrorCode.VALIDATION_ERROR,
          'Invalid user data format',
          undefined,
          parseResult.error,
        ))
      }

      return ok(parseResult.data)
    } catch (error) {
      return err(normalizeApiError(error))
    }
  }

  /**
   * Upload user avatar
   */
  async uploadAvatar(
    userId: number,
    avatarFile: File,
    isDarkMode: boolean = false,
  ): Promise<Result<UserDTO, AppError>> {
    try {
      const formData = new FormData()
      formData.append('avatar', avatarFile)
      formData.append('isDarkMode', isDarkMode.toString())

      const response = await apiClient.post<ApiResponse<UserDTO>>(
        `/api/user/${userId}/avatar`,
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        },
      )

      if (!response.data.data) {
        return err(new AppError(ErrorCode.UPLOAD_ERROR, 'Failed to upload avatar'))
      }

      // Validate response with Zod
      const parseResult = UserDTOSchema.safeParse(response.data.data)

      if (!parseResult.success) {
        return err(new AppError(
          ErrorCode.VALIDATION_ERROR,
          'Invalid user data format',
          undefined,
          parseResult.error,
        ))
      }

      return ok(parseResult.data)
    } catch (error) {
      return err(normalizeApiError(error))
    }
  }

  /**
   * Get user statistics
   */
  async getUserStats(userId: number): Promise<Result<UserStats, AppError>> {
    try {
      const response = await apiClient.get<ApiResponse<UserStats>>(
        `/api/user/${userId}/stats`,
      )

      if (!response.data.data) {
        return err(new AppError(ErrorCode.NOT_FOUND, 'User statistics not found'))
      }

      return ok(response.data.data)
    } catch (error) {
      return err(normalizeApiError(error))
    }
  }

  /**
   * Get user's recent activity
   */
  async getUserActivity(
    userId: number,
    limit: number = 20,
  ): Promise<Result<UserActivity[], AppError>> {
    try {
      const response = await apiClient.get<ApiResponse<UserActivity[]>>(
        `/api/user/${userId}/activity`,
        { params: { limit } },
      )

      return ok(response.data.data || [])
    } catch (error) {
      return err(normalizeApiError(error))
    }
  }

  /**
   * Get users by role
   */
  async getUsersByRole(role: string): Promise<Result<UserDTO[], AppError>> {
    try {
      const response = await apiClient.get<ApiResponse<UserDTO[]>>(
        '/api/user/by-role',
        { params: { role } },
      )

      const users = response.data.data || []

      // Validate each user with Zod
      const validatedUsers = []
      for (const user of users) {
        const parseResult = UserDTOSchema.safeParse(user)
        if (!parseResult.success) {
          return err(new AppError(
            ErrorCode.VALIDATION_ERROR,
            'Invalid user data format',
            undefined,
            parseResult.error,
          ))
        }
        validatedUsers.push(parseResult.data)
      }

      return ok(validatedUsers)
    } catch (error) {
      return err(normalizeApiError(error))
    }
  }

  /**
   * Get online users
   */
  async getOnlineUsers(): Promise<Result<UserDTO[], AppError>> {
    try {
      const response = await apiClient.get<ApiResponse<UserDTO[]>>(
        '/api/user/online',
      )

      const users = response.data.data || []

      // Validate each user with Zod
      const validatedUsers = []
      for (const user of users) {
        const parseResult = UserDTOSchema.safeParse(user)
        if (!parseResult.success) {
          return err(new AppError(
            ErrorCode.VALIDATION_ERROR,
            'Invalid user data format',
            undefined,
            parseResult.error,
          ))
        }
        validatedUsers.push(parseResult.data)
      }

      return ok(validatedUsers)
    } catch (error) {
      return err(normalizeApiError(error))
    }
  }

  /**
   * Deactivate user account
   */
  async deactivateUser(userId: number): Promise<Result<void, AppError>> {
    try {
      await apiClient.post(`/api/user/${userId}/deactivate`)
      return ok(undefined)
    } catch (error) {
      return err(normalizeApiError(error))
    }
  }

  /**
   * Reactivate user account
   */
  async reactivateUser(userId: number): Promise<Result<UserDTO, AppError>> {
    try {
      const response = await apiClient.post<ApiResponse<UserDTO>>(
        `/api/user/${userId}/reactivate`,
      )

      if (!response.data.data) {
        return err(new AppError(ErrorCode.NOT_FOUND, 'User not found'))
      }

      // Validate response with Zod
      const parseResult = UserDTOSchema.safeParse(response.data.data)

      if (!parseResult.success) {
        return err(new AppError(
          ErrorCode.VALIDATION_ERROR,
          'Invalid user data format',
          undefined,
          parseResult.error,
        ))
      }

      return ok(parseResult.data)
    } catch (error) {
      return err(normalizeApiError(error))
    }
  }
}

// Singleton
export const userService = new UserService()