/**
 * Tests the envelope/data validation helpers: validateApiResponse,
 * validateApiArray, and requireData. Covers the happy path plus the malformed /
 * missing branches that map to VALIDATION_ERROR AppErrors.
 */
import { describe, it, expect } from 'vitest'
import { z } from 'zod'
import { validateApiResponse, validateApiArray, requireData } from '@/lib/api/validation'
import { AppError } from '@/lib/errors/types'
import { ErrorCode } from '@/types/enums'

const itemSchema = z.object({ id: z.number(), name: z.string() })

describe('validateApiResponse', () => {
  it('returns ok with the parsed value on a valid shape', () => {
    const result = validateApiResponse({ id: 1, name: 'a' }, itemSchema)
    expect(result.isOk()).toBe(true)
    if (result.isOk()) expect(result.value).toEqual({ id: 1, name: 'a' })
  })

  it('returns a VALIDATION_ERROR AppError on a malformed shape', () => {
    const result = validateApiResponse({ id: 'not-a-number' }, itemSchema)
    expect(result.isErr()).toBe(true)
    if (result.isErr()) {
      expect(result.error).toBeInstanceOf(AppError)
      expect(result.error.code).toBe(ErrorCode.VALIDATION_ERROR)
      expect(result.error.message).toBe('Invalid data format')
      // The underlying ZodError is attached as details.
      expect(result.error.details).toBeInstanceOf(z.ZodError)
    }
  })

  it('uses a custom invalid message when provided', () => {
    const result = validateApiResponse(null, itemSchema, 'boom')
    expect(result.isErr()).toBe(true)
    if (result.isErr()) expect(result.error.message).toBe('boom')
  })
})

describe('validateApiArray', () => {
  it('validates every item and returns them in order', () => {
    const result = validateApiArray(
      [
        { id: 1, name: 'a' },
        { id: 2, name: 'b' },
      ],
      itemSchema,
    )
    expect(result.isOk()).toBe(true)
    if (result.isOk()) expect(result.value).toHaveLength(2)
  })

  it('treats null/undefined input as an empty array', () => {
    const nullResult = validateApiArray(null, itemSchema)
    const undefinedResult = validateApiArray(undefined, itemSchema)
    expect(nullResult.isOk() && nullResult.value).toEqual([])
    expect(undefinedResult.isOk() && undefinedResult.value).toEqual([])
  })

  it('fails on the first invalid item', () => {
    const result = validateApiArray([{ id: 1, name: 'a' }, { id: 'x' }], itemSchema)
    expect(result.isErr()).toBe(true)
    if (result.isErr()) expect(result.error.code).toBe(ErrorCode.VALIDATION_ERROR)
  })
})

describe('requireData', () => {
  it('returns ok when data is present (including falsy-but-defined values)', () => {
    expect(requireData(0, ErrorCode.EMPTY_RESPONSE, 'x').isOk()).toBe(true)
    expect(requireData('', ErrorCode.EMPTY_RESPONSE, 'x').isOk()).toBe(true)
    expect(requireData(false, ErrorCode.EMPTY_RESPONSE, 'x').isOk()).toBe(true)
  })

  it('errors with the given code/message on null', () => {
    const result = requireData(null, ErrorCode.EMPTY_RESPONSE, 'missing')
    expect(result.isErr()).toBe(true)
    if (result.isErr()) {
      expect(result.error.code).toBe(ErrorCode.EMPTY_RESPONSE)
      expect(result.error.message).toBe('missing')
    }
  })

  it('errors on undefined', () => {
    expect(requireData(undefined, ErrorCode.NOT_FOUND, 'missing').isErr()).toBe(true)
  })
})
