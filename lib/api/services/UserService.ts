import type { Result } from 'neverthrow'
import { err } from 'neverthrow'
import { apiClient } from '../client'
import { validateApiArray } from '../validation'
import { normalizeApiError } from '@/lib/errors/normalize'
import type { AppError } from '@/lib/errors/types'
import type { UserDTO } from '@/types/api/schemas'
import { UserDTOSchema } from '@/types/api/schemas'
import type { ApiResponse } from '@/types/api/base'

export class UserService {
  async getSelectableUsers(email: string): Promise<Result<UserDTO[], AppError>> {
    try {
      const response = await apiClient.get<ApiResponse<UserDTO[]>>(
        '/api/user/get-selectable-users',
        { params: { email } },
      )

      return validateApiArray(response.data.data, UserDTOSchema, 'Invalid user data format')
    } catch (error) {
      return err(normalizeApiError(error))
    }
  }
}

// Singleton
export const userService = new UserService()
