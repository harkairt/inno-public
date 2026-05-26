import type { Result } from 'neverthrow'
import { err, ok } from 'neverthrow'
import { apiClient } from '../client'
import { normalizeApiError } from '@/lib/errors/normalize'
import { AppError, AuthenticationError, InvalidCredentialsError } from '@/lib/errors/types'
import type {
  LoginRequestDTO,
  LoginResponseDTO,
  RefreshTokenResponseDTO,
  UserDTO,
} from '@/types/api/schemas'
import { LoginResponseDTOSchema, UserDTOSchema } from '@/types/api/schemas'
import type { ApiResponse } from '@/types/api/base'
import { ErrorCode } from '@/types/enums'

/**
 * Known server warning messages and their error mappings
 */
const LOGIN_WARNING_ERRORS: Record<string, () => AppError> = {
  'Hibás felhasználónév / jelszó': () => new InvalidCredentialsError(),
}

/**
 * Parse login API response and return appropriate error or success
 */
function parseLoginResponse(
  response: ApiResponse<LoginResponseDTO['data']>,
): Result<NonNullable<LoginResponseDTO['data']>, AppError> {
  // Check for warning field - server uses this for auth failures
  if (response.warning) {
    const errorFactory = LOGIN_WARNING_ERRORS[response.warning]
    if (errorFactory) {
      return err(errorFactory())
    }
    // Unknown warning - return as generic auth error with message
    return err(new AuthenticationError(response.warning))
  }

  // Check for missing data
  if (!response.data) {
    return err(new AppError(ErrorCode.UNAUTHORIZED, 'Invalid login response'))
  }

  return ok(response.data)
}

export class AuthService {
  /**
   * Login with email and password
   * Returns Result<LoginResponseDTO, AppError> for explicit error handling
   */
  async login(credentials: LoginRequestDTO): Promise<Result<LoginResponseDTO, AppError>> {
    try {
      const response = await apiClient.post<ApiResponse<LoginResponseDTO['data']>>(
        '/api/authentication/login',
        credentials,
      )

      // Parse response and map warnings to errors
      const parsedResponse = parseLoginResponse(response.data)
      if (parsedResponse.isErr()) {
        return err(parsedResponse.error)
      }

      // Validate response with Zod
      const validationResult = LoginResponseDTOSchema.safeParse({
        data: parsedResponse.value,
        warning: response.data.warning,
        success: response.data.success,
      })

      if (!validationResult.success) {
        return err(
          new AppError(
            ErrorCode.VALIDATION_ERROR,
            'Invalid response from server',
            undefined,
            validationResult.error,
          ),
        )
      }

      return ok(validationResult.data)
    } catch (error) {
      return err(normalizeApiError(error))
    }
  }

  /**
   * Refresh access token using accessToken and refreshToken
   */
  async refreshToken(
    accessToken: string,
    refreshToken: string,
  ): Promise<Result<RefreshTokenResponseDTO, AppError>> {
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
   * Get current user profile
   */
  async getProfile(email: string): Promise<Result<UserDTO, AppError>> {
    try {
      const response = await apiClient.get<ApiResponse<UserDTO>>('/api/authentication/profile', {
        params: { email },
      })

      if (!response.data.data) {
        return err(new AppError(ErrorCode.NOT_FOUND, 'User not found'))
      }

      // Validate response with Zod
      const parseResult = UserDTOSchema.safeParse(response.data.data)

      if (!parseResult.success) {
        return err(
          new AppError(
            ErrorCode.VALIDATION_ERROR,
            'Invalid user data from server',
            undefined,
            parseResult.error,
          ),
        )
      }

      return ok(parseResult.data)
    } catch (error) {
      return err(normalizeApiError(error))
    }
  }

  /**
   * Request forgotten password reset
   */
  async forgottenPassword(email: string): Promise<Result<void, AppError>> {
    try {
      await apiClient.patch('/api/authentication/forgotten-password', {
        email,
      })
      return ok(undefined)
    } catch (error) {
      return err(normalizeApiError(error))
    }
  }

  /**
   * Set new password (after forgotten password flow)
   */
  async setPassword(token: string, newPassword: string): Promise<Result<void, AppError>> {
    try {
      await apiClient.patch('/api/authentication/set-password', {
        token,
        newPassword,
      })
      return ok(undefined)
    } catch (error) {
      return err(normalizeApiError(error))
    }
  }
}

// Singleton instance
export const authService = new AuthService()
