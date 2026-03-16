/**
 * Transcription Service
 * Handles communication with the Hugging Face Spaces Whisper transcription API
 * using @gradio/client for simplified API calls
 */

import { Client, handle_file } from '@gradio/client'
import type { Result } from 'neverthrow'
import { err, ok } from 'neverthrow'
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
    // Allow injection for testing, otherwise use runtime config
    if (serviceUrl !== undefined && apiKey !== undefined) {
      this.serviceUrl = serviceUrl
      this.apiKey = apiKey
      this.hfToken = hfToken ?? ''
    } else {
      const config = useRuntimeConfig()
      this.serviceUrl = config.public.transcriptionServiceUrl ?? ''
      // API keys are in server-only config; on client they'll be empty strings
      // A server API proxy should be used for production transcription calls
      this.apiKey = (config as unknown as { transcriptionApiKey: string }).transcriptionApiKey ?? ''
      this.hfToken = (config as unknown as { hfToken: string }).hfToken ?? ''
    }
  }

  /**
   * Initialize or get the Gradio client (lazy initialization)
   */
  private async getClient(): Promise<Client> {
    if (!this.client) {
      const options = this.hfToken ? { token: this.hfToken } : undefined
      // @ts-expect-error - @gradio/client types may not match runtime API
      this.client = await Client.connect(this.serviceUrl, options)
    }
    return this.client
  }

  /**
   * Transcribe audio blob to text using @gradio/client
   * @param audioBlob - Audio blob from MediaRecorder or file input
   * @param language - Language code (default: 'hungarian')
   */
  async transcribe(
    audioBlob: Blob,
    language: string = 'hungarian',
  ): Promise<Result<TranscriptionResponseDTO, AppError>> {
    try {
      // Validate blob size (max 25MB)
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

      // Use handle_file for blob upload + predict for transcription
      // Args order matches Gradio function: [audio_path, language, api_key]
      const result = await client.predict('/transcribe', [
        handle_file(audioBlob),
        language,
        this.apiKey,
      ])

      // Extract data from result - Gradio returns { data: [...] }
      const data = result.data as unknown[]
      const output = data[0]

      // Parse JSON string response from Gradio (the Python function returns json.dumps())
      const parsed = typeof output === 'string' ? JSON.parse(output) : output

      // Validate response with Zod
      const parseResult = TranscriptionResponseDTOSchema.safeParse(parsed)
      if (!parseResult.success) {
        return err(
          new AppError(
            ErrorCode.VALIDATION_ERROR,
            'Invalid transcription response',
            undefined,
            parseResult.error,
          ),
        )
      }

      // Check if transcription succeeded
      if (!parseResult.data.success) {
        return err(
          new AppError(
            ErrorCode.SERVER_ERROR,
            parseResult.data.error ?? 'Transcription failed',
          ),
        )
      }



      return ok(parseResult.data)
    } catch (error) {
      // Reset client on error to allow reconnection
      this.client = null
      return err(normalizeApiError(error))
    }
  }

  /**
   * Warm up the transcription service (call before recording)
   * This helps reduce cold start latency on Hugging Face Spaces
   */
  async warmUp(): Promise<Result<boolean, AppError>> {
    try {
      const client = await this.getClient()
      const result = await client.predict('/health', [this.apiKey])

      const data = result.data as unknown[]
      const output = data[0]
      const parsed = typeof output === 'string' ? JSON.parse(output) : output

      return ok(parsed?.status === 'healthy')
    } catch (error) {
      // Reset client on error to allow reconnection
      this.client = null
      return err(normalizeApiError(error))
    }
  }

  /**
   * Check if the service is configured
   */
  isConfigured(): boolean {
    return Boolean(this.serviceUrl && this.apiKey)
  }
}

// Singleton instance - use useTranscriptionService() composable for SSR safety
let _instance: TranscriptionService | null = null

export function useTranscriptionService(): TranscriptionService {
  _instance ??= new TranscriptionService();
  return _instance
}

// Export for direct import where needed
export const transcriptionService = new TranscriptionService()
