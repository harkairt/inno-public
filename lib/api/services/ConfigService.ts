import type { Result } from 'neverthrow'
import { err, ok } from 'neverthrow'
import { apiClient } from '../client'
import { normalizeApiError } from '@/lib/errors/normalize'
import { AppError } from '@/lib/errors/types'
import type { InnoChatConfig } from '@/types/api/schemas'
import { InnoChatConfigSchema } from '@/types/api/schemas'
import type { ApiResponse } from '@/types/api/base'
import type { ExtendedInnoChatConfig, AgentInfo, UIConfiguration, FeatureFlags, ConfigHistoryResponse } from '@/types/api/admin-types'
import { ErrorCode } from '@/types/enums'

export class ConfigService {
  private config: InnoChatConfig | null = null
  private configPromise: Promise<Result<InnoChatConfig, AppError>> | null = null

  /**
   * Load runtime configuration from backend
   */
  async getConfig(): Promise<Result<InnoChatConfig, AppError>> {
    // Return cached config if available
    if (this.config) {
      return ok(this.config)
    }

    // Return in-flight promise if config is being loaded
    if (this.configPromise) {
      return this.configPromise
    }

    // Create and store the loading promise
    this.configPromise = this.loadConfig()

    try {
      const result = await this.configPromise
      return result
    } finally {
      this.configPromise = null
    }
  }

  /**
   * Internal method to load configuration
   */
  private async loadConfig(): Promise<Result<InnoChatConfig, AppError>> {
    try {
      const response = await apiClient.get<InnoChatConfig>(
        '/api/settings/config.json',
      )

      // Validate config
      const parseResult = InnoChatConfigSchema.safeParse(response.data)

      if (!parseResult.success) {
        return err(new AppError(
          ErrorCode.VALIDATION_ERROR,
          'Invalid configuration',
          undefined,
          parseResult.error,
        ))
      }

      this.config = parseResult.data
      return ok(parseResult.data)
    } catch (error) {
      return err(normalizeApiError(error))
    }
  }

  /**
   * Get cached configuration (returns null if not loaded)
   */
  getCachedConfig(): InnoChatConfig | null {
    return this.config
  }

  /**
   * Force refresh configuration
   */
  async refreshConfig(): Promise<Result<InnoChatConfig, AppError>> {
    this.config = null
    return this.getConfig()
  }

  /**
   * Get specific configuration value by path
   */
  async getConfigValue<T = unknown>(path: string): Promise<Result<T, AppError>> {
    const configResult = await this.getConfig()

    if (configResult.isErr()) {
      return err(configResult.error)
    }

    const config = configResult.value
    const value = this.getNestedValue(config, path)

    if (value === undefined) {
      return err(new AppError(ErrorCode.NOT_FOUND, `Configuration path '${path}' not found`))
    }

    return ok(value as T)
  }

  /**
   * Get agent configuration by ID
   */
  async getAgentConfig(agentId: number): Promise<Result<AgentInfo, AppError>> {
    const configResult = await this.getConfig()

    if (configResult.isErr()) {
      return err(configResult.error)
    }

    // For now, we need to cast to ExtendedInnoChatConfig to access agents
    const config = configResult.value as ExtendedInnoChatConfig
    const agent = config.agents.find(a => a.id === agentId)

    if (!agent) {
      return err(new AppError(ErrorCode.NOT_FOUND, `Agent with ID ${agentId} not found`))
    }

    return ok(agent)
  }

  /**
   * Get all available agents
   */
  // async getAvailableAgents(): Promise<Result<AgentInfo[], AppError>> {
  //   const configResult = await this.getConfig()

  //   if (configResult.isErr()) {
  //     return err(configResult.error)
  //   }

  //   // For now, we need to cast to ExtendedInnoChatConfig to access agents
  //   const config = configResult.value as ExtendedInnoChatConfig
  //   const activeAgents = config.agents.filter(agent => agent.isActive)
  //   return ok(activeAgents)
  // }

  /**
   * Get UI configuration
   */
  async getUIConfig(): Promise<Result<UIConfiguration, AppError>> {
    return this.getConfigValue<UIConfiguration>('ui')
  }

  /**
   * Get feature flags
   */
  async getFeatureFlags(): Promise<Result<FeatureFlags, AppError>> {
    return this.getConfigValue<FeatureFlags>('featureFlags')
  }

  /**
   * Check if a feature is enabled
   */
  // async isFeatureEnabled(featureName: string): Promise<boolean> {
  //   const flagsResult = await this.getFeatureFlags()

  //   if (flagsResult.isErr()) {
  //     return false
  //   }

  //   return flagsResult.value[featureName] || false
  // }

  /**
   * Get API configuration
   */
  async getAPIConfig(): Promise<Result<Record<string, unknown>, AppError>> {
    return this.getConfigValue<Record<string, unknown>>('api')
  }

  /**
   * Get SignalR configuration
   */
  async getSignalRConfig(): Promise<Result<Record<string, unknown>, AppError>> {
    return this.getConfigValue<Record<string, unknown>>('signalr')
  }

  /**
   * Get authentication configuration
   */
  async getAuthConfig(): Promise<Result<Record<string, unknown>, AppError>> {
    return this.getConfigValue<Record<string, unknown>>('authentication')
  }

  /**
   * Get logging configuration
   */
  async getLoggingConfig(): Promise<Result<Record<string, unknown>, AppError>> {
    return this.getConfigValue<Record<string, unknown>>('logging')
  }

  /**
   * Get rate limiting configuration
   */
  async getRateLimitConfig(): Promise<Result<Record<string, unknown>, AppError>> {
    return this.getConfigValue<Record<string, unknown>>('rateLimit')
  }

  /**
   * Get cache configuration
   */
  async getCacheConfig(): Promise<Result<Record<string, unknown>, AppError>> {
    return this.getConfigValue<Record<string, unknown>>('cache')
  }

  /**
   * Update configuration (admin only)
   */
  async updateConfig(
    updates: Partial<InnoChatConfig>,
  ): Promise<Result<InnoChatConfig, AppError>> {
    try {
      const response = await apiClient.put<ApiResponse<InnoChatConfig>>(
        '/api/admin/config',
        updates,
      )

      if (!response.data.data) {
        return err(new AppError(ErrorCode.UPDATE_ERROR, 'Failed to update configuration'))
      }

      // Validate updated config
      const parseResult = InnoChatConfigSchema.safeParse(response.data.data)

      if (!parseResult.success) {
        return err(new AppError(
          ErrorCode.VALIDATION_ERROR,
          'Invalid configuration response',
          undefined,
          parseResult.error,
        ))
      }

      // Update cached config
      this.config = parseResult.data

      return ok(parseResult.data)
    } catch (error) {
      return err(normalizeApiError(error))
    }
  }

  /**
   * Update agent configuration (admin only)
   */
  async updateAgentConfig(
    agentId: number,
    agentConfig: Partial<AgentInfo>,
  ): Promise<Result<AgentInfo, AppError>> {
    try {
      const response = await apiClient.put<ApiResponse<AgentInfo>>(
        `/api/admin/config/agents/${agentId}`,
        agentConfig,
      )

      if (!response.data.data) {
        return err(new AppError(ErrorCode.UPDATE_ERROR, 'Failed to update agent configuration'))
      }

      // Refresh cached config
      await this.refreshConfig()

      return ok(response.data.data)
    } catch (error) {
      return err(normalizeApiError(error))
    }
  }

  /**
   * Update feature flags (admin only)
   */
  async updateFeatureFlags(
    flags: Record<string, boolean>,
  ): Promise<Result<Record<string, boolean>, AppError>> {
    try {
      const response = await apiClient.put<ApiResponse<Record<string, boolean>>>(
        '/api/admin/config/feature-flags',
        { flags },
      )

      if (!response.data.data) {
        return err(new AppError(ErrorCode.UPDATE_ERROR, 'Failed to update feature flags'))
      }

      // Refresh cached config
      await this.refreshConfig()

      return ok(response.data.data)
    } catch (error) {
      return err(normalizeApiError(error))
    }
  }

  /**
   * Export configuration (admin only)
   */
  async exportConfig(format: 'json' | 'yaml' = 'json'): Promise<Result<Blob, AppError>> {
    try {
      const response = await apiClient.get(
        `/api/admin/config/export`,
        {
          params: { format },
          responseType: 'blob',
        },
      )

      return ok(response.data)
    } catch (error) {
      return err(normalizeApiError(error))
    }
  }

  /**
   * Import configuration (admin only)
   */
  async importConfig(
    configFile: File,
    format: 'json' | 'yaml' = 'json',
  ): Promise<Result<InnoChatConfig, AppError>> {
    try {
      const formData = new FormData()
      formData.append('config', configFile)
      formData.append('format', format)

      const response = await apiClient.post<ApiResponse<InnoChatConfig>>(
        '/api/admin/config/import',
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        },
      )

      if (!response.data.data) {
        return err(new AppError(ErrorCode.IMPORT_ERROR, 'Failed to import configuration'))
      }

      // Validate imported config
      const parseResult = InnoChatConfigSchema.safeParse(response.data.data)

      if (!parseResult.success) {
        return err(new AppError(
          ErrorCode.VALIDATION_ERROR,
          'Invalid imported configuration',
          undefined,
          parseResult.error,
        ))
      }

      // Update cached config
      this.config = parseResult.data

      return ok(parseResult.data)
    } catch (error) {
      return err(normalizeApiError(error))
    }
  }

  /**
   * Reset configuration to defaults (admin only)
   */
  async resetConfig(): Promise<Result<InnoChatConfig, AppError>> {
    try {
      const response = await apiClient.post<ApiResponse<InnoChatConfig>>(
        '/api/admin/config/reset',
      )

      if (!response.data.data) {
        return err(new AppError(ErrorCode.RESET_ERROR, 'Failed to reset configuration'))
      }

      // Validate reset config
      const parseResult = InnoChatConfigSchema.safeParse(response.data.data)

      if (!parseResult.success) {
        return err(new AppError(
          ErrorCode.VALIDATION_ERROR,
          'Invalid reset configuration',
          undefined,
          parseResult.error,
        ))
      }

      // Update cached config
      this.config = parseResult.data

      return ok(parseResult.data)
    } catch (error) {
      return err(normalizeApiError(error))
    }
  }

  /**
   * Validate configuration
   */
  async validateConfig(config: ExtendedInnoChatConfig): Promise<Result<boolean, AppError>> {
    try {
      const response = await apiClient.post<ApiResponse<boolean>>(
        '/api/admin/config/validate',
        { config },
      )

      return ok(response.data.data || false)
    } catch (error) {
      return err(normalizeApiError(error))
    }
  }

  /**
   * Get configuration history (admin only)
   */
  async getConfigHistory(
    page: number = 1,
    pageSize: number = 20,
  ): Promise<Result<ConfigHistoryResponse, AppError>> {
    try {
      const response = await apiClient.get<ApiResponse<ConfigHistoryResponse>>(
        '/api/admin/config/history',
        {
          params: { page, pageSize },
        },
      )

      if (!response.data.data) {
        return ok({ history: [], total: 0, page, pageSize })
      }

      return ok(response.data.data)
    } catch (error) {
      return err(normalizeApiError(error))
    }
  }

  /**
   * Restore configuration to a previous version (admin only)
   */
  async restoreConfigVersion(versionId: string): Promise<Result<InnoChatConfig, AppError>> {
    try {
      const response = await apiClient.post<ApiResponse<InnoChatConfig>>(
        `/api/admin/config/restore/${versionId}`,
      )

      if (!response.data.data) {
        return err(new AppError(ErrorCode.RESTORE_ERROR, 'Failed to restore configuration'))
      }

      // Validate restored config
      const parseResult = InnoChatConfigSchema.safeParse(response.data.data)

      if (!parseResult.success) {
        return err(new AppError(
          ErrorCode.VALIDATION_ERROR,
          'Invalid restored configuration',
          undefined,
          parseResult.error,
        ))
      }

      // Update cached config
      this.config = parseResult.data

      return ok(parseResult.data)
    } catch (error) {
      return err(normalizeApiError(error))
    }
  }

  /**
   * Helper method to get nested value from object
   */
  private getNestedValue(obj: Record<string, unknown>, path: string): unknown {
    return path.split('.').reduce((current: unknown, key: string) => {
      return current && typeof current === 'object' && current !== null && key in current 
        ? (current as Record<string, unknown>)[key] 
        : undefined
    }, obj as unknown)
  }

  /**
   * Clear cached configuration
   */
  clearCache(): void {
    this.config = null
    this.configPromise = null
  }
}

// Singleton
export const configService = new ConfigService()