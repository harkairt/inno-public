import type { Result } from 'neverthrow'
import { err, ok } from 'neverthrow'
import { apiClient } from '../client'
import { validateApiResponse } from '../validation'
import { normalizeApiError } from '@/lib/errors/normalize'
import type { AppError } from '@/lib/errors/types'
import type { InnoChatConfig } from '@/types/api/schemas'
import { InnoChatConfigSchema } from '@/types/api/schemas'

class ConfigService {
  private config: InnoChatConfig | null = null
  private configPromise: Promise<Result<InnoChatConfig, AppError>> | null = null

  async getConfig(): Promise<Result<InnoChatConfig, AppError>> {
    if (this.config) {
      return ok(this.config)
    }

    if (this.configPromise) {
      return this.configPromise
    }

    this.configPromise = this.loadConfig()

    try {
      const result = await this.configPromise
      return result
    } finally {
      this.configPromise = null
    }
  }

  private async loadConfig(): Promise<Result<InnoChatConfig, AppError>> {
    try {
      const response = await apiClient.get<InnoChatConfig>('/api/settings/config.json')

      const result = validateApiResponse(
        response.data,
        InnoChatConfigSchema,
        'Invalid configuration',
      )
      if (result.isOk()) {
        this.config = result.value
      }
      return result
    } catch (error) {
      return err(normalizeApiError(error))
    }
  }

  getCachedConfig(): InnoChatConfig | null {
    return this.config
  }

  async refreshConfig(): Promise<Result<InnoChatConfig, AppError>> {
    this.config = null
    return this.getConfig()
  }

  clearCache(): void {
    this.config = null
    this.configPromise = null
  }
}

// Singleton
export const configService = new ConfigService()
