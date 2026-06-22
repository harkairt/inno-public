import type { Result } from 'neverthrow'
import { err, ok } from 'neverthrow'
import { apiClient } from '../client'
import { validateApiResponse, requireData } from '../validation'
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

const LOGIN_WARNING_ERRORS: Record<string, () => AppError> = {
  'Hibás felhasználónév / jelszó': () => new InvalidCredentialsError(),
}

function parseLoginResponse(
  response: ApiResponse<LoginResponseDTO['data']>,
): Result<NonNullable<LoginResponseDTO['data']>, AppError> {
  if (response.warning) {
    const errorFactory = LOGIN_WARNING_ERRORS[response.warning]
    if (errorFactory) {
      return err(errorFactory())
    }
    return err(new AuthenticationError(response.warning))
  }

  if (!response.data) {
    return err(new AppError(ErrorCode.UNAUTHORIZED, 'Invalid login response'))
  }

  return ok(response.data)
}

export class AuthService {
  async login(credentials: LoginRequestDTO): Promise<Result<LoginResponseDTO, AppError>> {
    try {
      const response = await apiClient.post<ApiResponse<LoginResponseDTO['data']>>(
        '/api/authentication/login',
        credentials,
      )

      const parsedResponse = parseLoginResponse(response.data)
      if (parsedResponse.isErr()) {
        return err(parsedResponse.error)
      }

      return validateApiResponse(
        {
          data: parsedResponse.value,
          warning: response.data.warning,
          success: response.data.success,
        },
        LoginResponseDTOSchema,
        'Invalid response from server',
      )
    } catch (error) {
      return err(normalizeApiError(error))
    }
  }

  async refreshToken(
    accessToken: string,
    refreshToken: string,
  ): Promise<Result<RefreshTokenResponseDTO, AppError>> {
    try {
      const response = await apiClient.post<ApiResponse<RefreshTokenResponseDTO>>(
        '/api/authentication/refresh-token',
        { accessToken, refreshToken },
      )

      return requireData(response.data.data, ErrorCode.UNAUTHORIZED, 'Failed to refresh token')
    } catch (error) {
      return err(normalizeApiError(error))
    }
  }

  async getProfile(email: string): Promise<Result<UserDTO, AppError>> {
    try {
      const response = await apiClient.get<ApiResponse<UserDTO>>('/api/authentication/profile', {
        params: { email },
      })

      const dataResult = requireData(response.data.data, ErrorCode.NOT_FOUND, 'User not found')
      if (dataResult.isErr()) return dataResult

      return validateApiResponse(dataResult.value, UserDTOSchema, 'Invalid user data from server')
    } catch (error) {
      return err(normalizeApiError(error))
    }
  }

  async forgottenPassword(email: string): Promise<Result<void, AppError>> {
    try {
      await apiClient.patch('/api/authentication/forgotten-password', { email })
      return ok(undefined)
    } catch (error) {
      return err(normalizeApiError(error))
    }
  }

  async setPassword(token: string, newPassword: string): Promise<Result<void, AppError>> {
    try {
      await apiClient.patch('/api/authentication/set-password', { token, newPassword })
      return ok(undefined)
    } catch (error) {
      return err(normalizeApiError(error))
    }
  }
}

// Singleton instance
export const authService = new AuthService()
