import type { Result } from 'neverthrow'
import { err, ok } from 'neverthrow'
import { apiClient } from '../client'
import { normalizeApiError } from '@/lib/errors/normalize'
import { AppError } from '@/lib/errors/types'
import type { UserDTO } from '@/types/api/schemas'
import { UserDTOSchema } from '@/types/api/schemas'
import type { ApiResponse } from '@/types/api/base'
import type {
  SystemStats,
  SystemLogsResponse,
  ActiveSession,
  UserSessionsResponse,
  AgentConfig,
  ApiUsageStats,
  SystemHealth
} from '@/types/api/admin-types'
import { ErrorCode } from '@/types/enums'

export class AdminService {
  /**
   * Get all users (admin only)
   */
  async getAllUsers(
    page: number = 1,
    pageSize: number = 50,
    search?: string,
    role?: string,
  ): Promise<Result<{ users: UserDTO[]; total: number; page: number; pageSize: number }, AppError>> {
    try {
      const response = await apiClient.get<ApiResponse<{ users: UserDTO[]; total: number; page: number; pageSize: number }>>(
        '/api/admin/users',
        {
          params: {
            page,
            pageSize,
            search: search || undefined,
            role: role || undefined,
          },
        },
      )

      if (!response.data.data) {
        return ok({ users: [], total: 0, page, pageSize })
      }

      const { users, ...pagination } = response.data.data

      // Validate each user with Zod
      const validatedUsers = []
      for (const user of users || []) {
        const parseResult = UserDTOSchema.safeParse(user)
        if (!parseResult.success) {
          return err(new AppError(
            ErrorCode.VALIDATION_ERROR,
            'Invalid user data format',
            400,
            parseResult.error,
          ))
        }
        validatedUsers.push(parseResult.data)
      }

      return ok({
        users: validatedUsers,
        ...pagination,
      })
    } catch (error) {
      return err(normalizeApiError(error))
    }
  }

  /**
   * Create new user (admin only)
   */
  async createUser(userData: {
    name: string
    email: string
    password: string
    roles: string[]
    isVirtual?: boolean
    isAvailable?: boolean
  }): Promise<Result<UserDTO, AppError>> {
    try {
      const response = await apiClient.post<ApiResponse<UserDTO>>(
        '/api/admin/users',
        userData,
      )

      if (!response.data.data) {
        return err(new AppError(ErrorCode.SERVER_ERROR, 'Failed to create user', 500))
      }

      // Validate response with Zod
      const parseResult = UserDTOSchema.safeParse(response.data.data)

      if (!parseResult.success) {
        return err(new AppError(
          ErrorCode.VALIDATION_ERROR,
          'Invalid user data format',
          400,
          parseResult.error,
        ))
      }

      return ok(parseResult.data)
    } catch (error) {
      return err(normalizeApiError(error))
    }
  }

  /**
   * Delete user (admin only)
   */
  async deleteUser(userId: number): Promise<Result<void, AppError>> {
    try {
      await apiClient.delete(`/api/admin/users/${userId}`)
      return ok(undefined)
    } catch (error) {
      return err(normalizeApiError(error))
    }
  }

  /**
   * Get system statistics (admin only)
   */
  async getSystemStats(): Promise<Result<SystemStats, AppError>> {
    try {
      const response = await apiClient.get<ApiResponse<SystemStats>>(
        '/api/admin/stats',
      )

      if (!response.data.data) {
        return err(new AppError(ErrorCode.NOT_FOUND, 'System statistics not found', 404))
      }

      return ok(response.data.data)
    } catch (error) {
      return err(normalizeApiError(error))
    }
  }

  /**
   * Get system logs (admin only)
   */
  async getSystemLogs(
    level: 'debug' | 'info' | 'warn' | 'error' = 'info',
    page: number = 1,
    pageSize: number = 100,
    startDate?: string,
    endDate?: string,
  ): Promise<Result<SystemLogsResponse, AppError>> {
    try {
      const response = await apiClient.get<ApiResponse<SystemLogsResponse>>(
        '/api/admin/logs',
        {
          params: {
            level,
            page,
            pageSize,
            startDate: startDate || undefined,
            endDate: endDate || undefined,
          },
        },
      )

      if (!response.data.data) {
        return ok({ logs: [], total: 0, page, pageSize })
      }

      return ok(response.data.data)
    } catch (error) {
      return err(normalizeApiError(error))
    }
  }

  /**
   * Get active sessions (admin only)
   */
  async getActiveSessions(): Promise<Result<ActiveSession[], AppError>> {
    try {
      const response = await apiClient.get<ApiResponse<ActiveSession[]>>(
        '/api/admin/sessions/active',
      )

      return ok(response.data.data || [])
    } catch (error) {
      return err(normalizeApiError(error))
    }
  }

  /**
   * Manage user roles (admin only)
   */
  async updateUserRoles(
    userId: number,
    roles: string[],
  ): Promise<Result<UserDTO, AppError>> {
    try {
      const response = await apiClient.put<ApiResponse<UserDTO>>(
        `/api/admin/users/${userId}/roles`,
        { roles },
      )

      if (!response.data.data) {
        return err(new AppError(ErrorCode.NOT_FOUND, 'User not found', 404))
      }

      // Validate response with Zod
      const parseResult = UserDTOSchema.safeParse(response.data.data)

      if (!parseResult.success) {
        return err(new AppError(
          ErrorCode.VALIDATION_ERROR,
          'Invalid user data format',
          400,
          parseResult.error,
        ))
      }

      return ok(parseResult.data)
    } catch (error) {
      return err(normalizeApiError(error))
    }
  }

  /**
   * Reset user password (admin only)
   */
  async resetUserPassword(
    userId: number,
    newPassword: string,
  ): Promise<Result<void, AppError>> {
    try {
      await apiClient.post(`/api/admin/users/${userId}/reset-password`, {
        newPassword,
      })
      return ok(undefined)
    } catch (error) {
      return err(normalizeApiError(error))
    }
  }

  /**
   * Force logout user (admin only)
   */
  async forceLogoutUser(userId: number): Promise<Result<void, AppError>> {
    try {
      await apiClient.post(`/api/admin/users/${userId}/force-logout`)
      return ok(undefined)
    } catch (error) {
      return err(normalizeApiError(error))
    }
  }

  /**
   * Get user sessions (admin only)
   */
  async getUserSessions(
    userId: number,
    page: number = 1,
    pageSize: number = 20,
  ): Promise<Result<UserSessionsResponse, AppError>> {
    try {
      const response = await apiClient.get<ApiResponse<UserSessionsResponse>>(
        `/api/admin/users/${userId}/sessions`,
        {
          params: { page, pageSize },
        },
      )

      if (!response.data.data) {
        return ok({ sessions: [], total: 0, page, pageSize })
      }

      return ok(response.data.data)
    } catch (error) {
      return err(normalizeApiError(error))
    }
  }

  /**
   * Get AI agents configuration (admin only)
   */
  async getAgentsConfig(): Promise<Result<AgentConfig[], AppError>> {
    try {
      const response = await apiClient.get<ApiResponse<AgentConfig[]>>(
        '/api/admin/agents',
      )

      return ok(response.data.data || [])
    } catch (error) {
      return err(normalizeApiError(error))
    }
  }

  /**
   * Update AI agent configuration (admin only)
   */
  async updateAgentConfig(
    agentId: number,
    config: {
      name?: string
      description?: string
      isActive?: boolean
      capabilities?: string[]
      maxTokens?: number
      temperature?: number
      systemPrompt?: string
      welcomeMessage?: string
    },
  ): Promise<Result<void, AppError>> {
    try {
      await apiClient.put(`/api/admin/agents/${agentId}`, config)
      return ok(undefined)
    } catch (error) {
      return err(normalizeApiError(error))
    }
  }

  /**
   * Get system health status (admin only)
   */
  async getSystemHealth(): Promise<Result<SystemHealth, AppError>> {
    try {
      const response = await apiClient.get<ApiResponse<SystemHealth>>(
        '/api/admin/health',
      )

      if (!response.data.data) {
        return err(new AppError(ErrorCode.NOT_FOUND, 'Health status not available', 404))
      }

      return ok(response.data.data)
    } catch (error) {
      return err(normalizeApiError(error))
    }
  }

  /**
   * Export system data (admin only)
   */
  async exportSystemData(
    type: 'users' | 'sessions' | 'messages' | 'all',
    format: 'json' | 'csv' = 'json',
    startDate?: string,
    endDate?: string,
  ): Promise<Result<Blob, AppError>> {
    try {
      const response = await apiClient.get(
        '/api/admin/export',
        {
          params: {
            type,
            format,
            startDate: startDate || undefined,
            endDate: endDate || undefined,
          },
          responseType: 'blob',
        },
      )

      return ok(response.data)
    } catch (error) {
      return err(normalizeApiError(error))
    }
  }

  /**
   * Get API usage statistics (admin only)
   */
  async getApiUsageStats(
    period: 'hour' | 'day' | 'week' | 'month' = 'day',
  ): Promise<Result<ApiUsageStats[], AppError>> {
    try {
      const response = await apiClient.get<ApiResponse<ApiUsageStats[]>>(
        '/api/admin/api-usage',
        {
          params: { period },
        },
      )

      return ok(response.data.data || [])
    } catch (error) {
      return err(normalizeApiError(error))
    }
  }

  /**
   * Ban/unban user (admin only)
   */
  async setUserBanStatus(
    userId: number,
    isBanned: boolean,
    reason?: string,
  ): Promise<Result<UserDTO, AppError>> {
    try {
      const response = await apiClient.post<ApiResponse<UserDTO>>(
        `/api/admin/users/${userId}/ban`,
        { isBanned, reason },
      )

      if (!response.data.data) {
        return err(new AppError(ErrorCode.NOT_FOUND, 'User not found', 404))
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
export const adminService = new AdminService()