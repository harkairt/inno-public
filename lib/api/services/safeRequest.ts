import type { z } from 'zod'
import type { Result } from 'neverthrow'
import { err, ok } from 'neverthrow'
import { apiClient } from '../client'
import {
  validateApiResponse,
  validateApiArray,
  requireData,
  validateMutationSuccess,
} from '../validation'
import { normalizeApiError } from '@/lib/errors/normalize'
import type { AppError } from '@/lib/errors/types'
import type { ApiResponse, MutationSuccess } from '@/types/api/base'
import type { ErrorCode } from '@/types/enums'

async function withErrorHandling<T>(
  fn: () => Promise<Result<T, AppError>>,
): Promise<Result<T, AppError>> {
  try {
    return await fn()
  } catch (error) {
    return err(normalizeApiError(error))
  }
}

interface SafePostOptions<S extends z.ZodType> {
  url: string
  body: unknown
  schema: S
  errorCode: ErrorCode
  errorMessage: string
}

export function safePost<S extends z.ZodType>(
  options: SafePostOptions<S>,
): Promise<Result<z.output<S>, AppError>> {
  const { url, body, schema, errorCode, errorMessage } = options
  return withErrorHandling(async () => {
    const response = await apiClient.post<ApiResponse<z.output<S>>>(url, body)
    const dataResult = requireData(response.data.data, errorCode, errorMessage)
    if (dataResult.isErr()) return dataResult
    return validateApiResponse(dataResult.value, schema, errorMessage)
  })
}

export function safePostArray<S extends z.ZodType>(
  url: string,
  body: unknown,
  schema: S,
  errorMessage: string,
): Promise<Result<z.output<S>[], AppError>> {
  return withErrorHandling(async () => {
    const response = await apiClient.post<ApiResponse<z.output<S>[]>>(url, body)
    return validateApiArray(response.data.data, schema, errorMessage)
  })
}

export function safeMutation(
  url: string,
  body: unknown,
): Promise<Result<MutationSuccess, AppError>> {
  return withErrorHandling(async () => {
    const response = await apiClient.post<ApiResponse<string>>(url, body)
    return validateMutationSuccess(response.data.data)
  })
}

export function safeVoid(url: string, body: unknown): Promise<Result<void, AppError>> {
  return withErrorHandling(async () => {
    await apiClient.post(url, body)
    return ok(undefined)
  })
}
