import { Client, handle_file } from '@gradio/client'
import type { Result } from 'neverthrow'
import { err, ok } from 'neverthrow'
import { validateApiResponse } from '../validation'
import { normalizeApiError } from '@/lib/errors/normalize'
import { AppError } from '@/lib/errors/types'
import type { TranscriptionResponseDTO } from '@/types/api/transcription'
import { TranscriptionResponseDTOSchema } from '@/types/api/transcription'
import { ErrorCode } from '@/types/enums'

export class TranscriptionService {
  private serviceUrl: string
  private apiKey: string
  private hfToken: string
  private client: Client | null = null

  constructor(serviceUrl?: string, apiKey?: string, hfToken?: string) {
    if (serviceUrl !== undefined && apiKey !== undefined) {
      this.serviceUrl = serviceUrl
      this.apiKey = apiKey
      this.hfToken = hfToken ?? ''
    } else {
      const config = useRuntimeConfig()
      this.serviceUrl = config.public.transcriptionServiceUrl ?? ''
      this.apiKey = (config as unknown as { transcriptionApiKey: string }).transcriptionApiKey ?? ''
      this.hfToken = (config as unknown as { hfToken: string }).hfToken ?? ''
    }
  }

  private async getClient(): Promise<Client> {
    if (!this.client) {
      const options = this.hfToken ? { token: this.hfToken } : undefined
      // @ts-expect-error - @gradio/client types may not match runtime API
      this.client = await Client.connect(this.serviceUrl, options)
    }
    return this.client
  }

  async transcribe(
    audioBlob: Blob,
    language: string = 'hungarian',
  ): Promise<Result<TranscriptionResponseDTO, AppError>> {
    try {
      if (audioBlob.size > 25 * 1024 * 1024) {
        return err(
          new AppError(
            ErrorCode.VALIDATION_ERROR,
            'Audio file too large. Maximum size is 25MB.',
            413,
          ),
        )
      }

      const client = await this.getClient()
      const result = await client.predict('/transcribe', [
        handle_file(audioBlob),
        language,
        this.apiKey,
      ])

      const data = result.data as unknown[]
      const output = data[0]
      const parsed: unknown = typeof output === 'string' ? JSON.parse(output) : output

      const validated = validateApiResponse(
        parsed,
        TranscriptionResponseDTOSchema,
        'Invalid transcription response',
      )
      if (validated.isErr()) return validated

      if (!validated.value.success) {
        return err(
          new AppError(ErrorCode.SERVER_ERROR, validated.value.error ?? 'Transcription failed'),
        )
      }

      return validated
    } catch (error) {
      this.client = null
      return err(normalizeApiError(error))
    }
  }

  async warmUp(): Promise<Result<boolean, AppError>> {
    try {
      const client = await this.getClient()
      const result = await client.predict('/health', [this.apiKey])

      const data = result.data as unknown[]
      const output = data[0]
      const parsed: unknown = typeof output === 'string' ? JSON.parse(output) : output

      const isHealthy =
        typeof parsed === 'object' &&
        parsed !== null &&
        'status' in parsed &&
        (parsed as { status: unknown }).status === 'healthy'
      return ok(isHealthy)
    } catch (error) {
      this.client = null
      return err(normalizeApiError(error))
    }
  }

  isConfigured(): boolean {
    return Boolean(this.serviceUrl && this.apiKey)
  }
}

let _instance: TranscriptionService | null = null

export function useTranscriptionService(): TranscriptionService {
  _instance ??= new TranscriptionService()
  return _instance
}
