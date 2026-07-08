/**
 * Tests the QueryClient singleton lifecycle: lazy creation, override via
 * setQueryClient, and reset to null. resetAllState() nulls the singleton in the
 * global beforeEach, so each test here starts from a clean slate.
 */
import { describe, it, expect } from 'vitest'
import { QueryClient } from '@tanstack/vue-query'
import { getQueryClient, setQueryClient, createQueryClient } from '@/lib/queryClientSingleton'
import { AppError } from '@/lib/errors/types'
import { ErrorCode } from '@/types/enums'

describe('queryClientSingleton', () => {
  it('lazily creates a QueryClient on first get', () => {
    const client = getQueryClient()
    expect(client).toBeInstanceOf(QueryClient)
  })

  it('returns the same instance across calls (singleton)', () => {
    const first = getQueryClient()
    const second = getQueryClient()
    expect(second).toBe(first)
  })

  it('setQueryClient overrides the instance getQueryClient returns', () => {
    const injected = createQueryClient()
    setQueryClient(injected)
    expect(getQueryClient()).toBe(injected)
  })

  it('setQueryClient(null) resets so the next get lazily creates a fresh one', () => {
    const first = getQueryClient()
    setQueryClient(null)
    const next = getQueryClient()
    expect(next).not.toBe(first)
    expect(next).toBeInstanceOf(QueryClient)
  })
})

describe('createQueryClient defaults', () => {
  it('always builds a distinct client', () => {
    expect(createQueryClient()).not.toBe(createQueryClient())
  })

  it('does not retry validation-error mutations', () => {
    const client = createQueryClient()
    const retry = client.getDefaultOptions().mutations?.retry as (
      count: number,
      error: unknown,
    ) => boolean

    const validationError = new AppError(ErrorCode.VALIDATION_ERROR, 'bad')
    expect(retry(0, validationError)).toBe(false)
  })

  it('does not retry 4xx mutations but retries other errors below the cap', () => {
    const client = createQueryClient()
    const retry = client.getDefaultOptions().mutations?.retry as (
      count: number,
      error: unknown,
    ) => boolean

    const clientError = new AppError(ErrorCode.NOT_FOUND, 'nope', 404)
    expect(retry(0, clientError)).toBe(false)

    const serverError = new AppError(ErrorCode.SERVER_ERROR, 'boom', 500)
    expect(retry(0, serverError)).toBe(true)
    // Cap: stop retrying at failureCount >= 2.
    expect(retry(2, serverError)).toBe(false)
  })
})
