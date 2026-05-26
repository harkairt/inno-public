import type { Result } from 'neverthrow'
import { err, ok } from 'neverthrow'
import { apiClient } from '../client'
import { normalizeApiError } from '@/lib/errors/normalize'
import { AppError } from '@/lib/errors/types'
import type { UserDTO } from '@/types/api/schemas'
import { UserDTOSchema } from '@/types/api/schemas'
import type { ApiResponse } from '@/types/api/base'
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

      const users = response.data.data ?? []

      // Validate each user with Zod
      const validatedUsers = []
      for (const user of users) {
        const parseResult = UserDTOSchema.safeParse(user)
        if (!parseResult.success) {
          return err(
            new AppError(
              ErrorCode.VALIDATION_ERROR,
              'Invalid user data format',
              undefined,
              parseResult.error,
            ),
          )
        }
        validatedUsers.push(parseResult.data)
      }

      return ok(validatedUsers)
    } catch (error) {
      return err(normalizeApiError(error))
    }
  }
}

// Singleton
export const userService = new UserService()
