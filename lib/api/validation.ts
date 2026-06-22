import type { z } from 'zod'
import type { Result } from 'neverthrow'
import { ok, err } from 'neverthrow'
import { AppError } from '@/lib/errors/types'
import { ErrorCode } from '@/types/enums'

export { validateMutationSuccess, MutationSuccessResponseSchema } from '@/types/api/schemas'

export function validateApiResponse<S extends z.ZodType>(
  data: unknown,
  schema: S,
  invalidMessage = 'Invalid data format',
): Result<z.output<S>, AppError> {
  const parseResult = schema.safeParse(data)
  if (!parseResult.success) {
    return err(
      new AppError(ErrorCode.VALIDATION_ERROR, invalidMessage, undefined, parseResult.error),
    )
  }
  return ok(parseResult.data)
}

export function validateApiArray<S extends z.ZodType>(
  items: unknown[] | null | undefined,
  schema: S,
  invalidMessage = 'Invalid data format',
): Result<z.output<S>[], AppError> {
  const arr = items ?? []
  const validated: z.output<S>[] = []
  for (const item of arr) {
    const parseResult = schema.safeParse(item)
    if (!parseResult.success) {
      return err(
        new AppError(ErrorCode.VALIDATION_ERROR, invalidMessage, undefined, parseResult.error),
      )
    }
    validated.push(parseResult.data)
  }
  return ok(validated)
}

export function requireData<T>(
  data: T | null | undefined,
  code: ErrorCode,
  message: string,
): Result<T, AppError> {
  if (data === null || data === undefined) {
    return err(new AppError(code, message))
  }
  return ok(data)
}
