import type { Result } from 'neverthrow'
import { err, ok } from 'neverthrow'
import { apiClient } from '../client'
import { normalizeApiError } from '@/lib/errors/normalize'
import { AppError } from '@/lib/errors/types'
import type {
  LoginRequestDTO,
  LoginResponseDTO,
  RefreshTokenResponseDTO,
  UserDTO,
} from '@/types/api/schemas'
import { LoginResponseDTOSchema, UserDTOSchema } from '@/types/api/schemas'
import type { ApiResponse } from '@/types/api/base'
import { ErrorCode } from '@/types/enums'

export class AuthService {
  /**
   * Login with email and password
   * Returns Result<LoginResponseDTO, AppError> for explicit error handling
   */
  async login(
    credentials: LoginRequestDTO,
  ): Promise<Result<LoginResponseDTO, AppError>> {
    try {
      const response = await apiClient.post<ApiResponse<LoginResponseDTO>>(
        '/api/authentication/login',
        credentials,
      )

      if (!response.data.data) {
        return err(new AppError(ErrorCode.UNAUTHORIZED, 'Invalid login response'))
      }

      // Validate response with Zod
      const parseResult = LoginResponseDTOSchema.safeParse(response.data)

      if (!parseResult.success) {
        return err(new AppError(
          ErrorCode.VALIDATION_ERROR,
          'Invalid response from server',
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
   * Refresh access token using accessToken and refreshToken
   */
  async refreshToken(accessToken: string, refreshToken: string): Promise<Result<RefreshTokenResponseDTO, AppError>> {
    try {
      const response = await apiClient.post<ApiResponse<RefreshTokenResponseDTO>>(
        '/api/authentication/refresh-token',
        {
          accessToken,
          refreshToken,
        },
      )

      if (!response.data.data) {
        return err(new AppError(ErrorCode.UNAUTHORIZED, 'Failed to refresh token'))
      }

      return ok(response.data.data)
    } catch (error) {
      return err(normalizeApiError(error))
    }
  }

  /**
   * Logout (clears cookies on backend)
   */
  async logout(): Promise<Result<void, AppError>> {
    try {
      await apiClient.post('/api/authentication/logout')
      return ok(undefined)
    } catch (error) {
      return err(normalizeApiError(error))
    }
  }

  /**
   * Get current user profile
   */
  async getProfile(email: string): Promise<Result<UserDTO, AppError>> {
    try {
      const response = await apiClient.get<ApiResponse<UserDTO>>(
        '/api/authentication/profile',
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
          'Invalid user data from server',
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
   * Update user profile
   */
  async updateProfile(
    email: string,
    updates: Partial<UserDTO>,
  ): Promise<Result<UserDTO, AppError>> {
    try {
      const response = await apiClient.put<ApiResponse<UserDTO>>(
        '/api/authentication/profile',
        { email, ...updates },
      )

      if (!response.data.data) {
        return err(new AppError(ErrorCode.NOT_FOUND, 'User not found'))
      }

      // Validate response with Zod
      const parseResult = UserDTOSchema.safeParse(response.data.data)

      if (!parseResult.success) {
        return err(new AppError(
          ErrorCode.VALIDATION_ERROR,
          'Invalid user data from server',
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
   * Change password
   */
  async changePassword(
    email: string,
    currentPassword: string,
    newPassword: string,
  ): Promise<Result<void, AppError>> {
    try {
      await apiClient.post('/api/authentication/change-password', {
        email,
        currentPassword,
        newPassword,
      })
      return ok(undefined)
    } catch (error) {
      return err(normalizeApiError(error))
    }
  }

  /**
   * Request password reset
   */
  async requestPasswordReset(email: string): Promise<Result<void, AppError>> {
    try {
      await apiClient.post('/api/authentication/request-password-reset', {
        email,
      })
      return ok(undefined)
    } catch (error) {
      return err(normalizeApiError(error))
    }
  }

  /**
   * Reset password with token
   */
  async resetPassword(
    token: string,
    newPassword: string,
  ): Promise<Result<void, AppError>> {
    try {
      await apiClient.post('/api/authentication/reset-password', {
        token,
        newPassword,
      })
      return ok(undefined)
    } catch (error) {
      return err(normalizeApiError(error))
    }
  }

  /**
   * Verify email address
   */
  async verifyEmail(token: string): Promise<Result<void, AppError>> {
    try {
      await apiClient.post('/api/authentication/verify-email', {
        token,
      })
      return ok(undefined)
    } catch (error) {
      return err(normalizeApiError(error))
    }
  }

  /**
   * Check if user is authenticated (validates current session)
   */
  async checkAuth(): Promise<Result<UserDTO, AppError>> {
    try {
      const response = await apiClient.get<ApiResponse<UserDTO>>(
        '/api/authentication/check',
      )

      if (!response.data.data) {
        return err(new AppError(ErrorCode.UNAUTHORIZED, 'Not authenticated'))
      }

      // Validate response with Zod
      const parseResult = UserDTOSchema.safeParse(response.data.data)

      if (!parseResult.success) {
        return err(new AppError(
          ErrorCode.VALIDATION_ERROR,
          'Invalid user data from server',
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

// Singleton instance
export const authService = new AuthService()