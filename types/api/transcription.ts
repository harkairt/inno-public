import { z } from 'zod'

// ============================================================================
// TRANSCRIPTION SCHEMAS
// ============================================================================

export const TranscriptionChunkSchema = z.object({
  timestamp: z.tuple([z.number(), z.number()]),
  text: z.string(),
})

export const TranscriptionResponseDTOSchema = z.object({
  success: z.boolean(),
  text: z.string(),
  chunks: z.array(TranscriptionChunkSchema).optional(),
  error: z.string().optional(),
})

export const HealthCheckResponseSchema = z.object({
  status: z.string(),
  model_loaded: z.boolean().optional(),
  model: z.string().optional(),
  device: z.string().optional(),
  message: z.string().optional(),
})

// ============================================================================
// TYPE INFERENCE
// ============================================================================

export type TranscriptionChunk = z.infer<typeof TranscriptionChunkSchema>
export type TranscriptionResponseDTO = z.infer<typeof TranscriptionResponseDTOSchema>
export type HealthCheckResponse = z.infer<typeof HealthCheckResponseSchema>
