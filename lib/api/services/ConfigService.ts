import type { Result } from 'neverthrow'
import { err, ok } from 'neverthrow'
import { apiClient } from '../client'
import { normalizeApiError } from '@/lib/errors/normalize'
import { AppError } from '@/lib/errors/types'
import type { InnoChatConfig } from '@/types/api/schemas'
import { InnoChatConfigSchema } from '@/types/api/schemas'
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
   * Clear cached configuration
   */
  clearCache(): void {
    this.config = null
    this.configPromise = null
  }
}

// Singleton
export const configService = new ConfigService()
