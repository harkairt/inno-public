/**
 * Tests for createLogger — verifies each level delegates to the matching console
 * method and prefixes every line with the scope namespace.
 */
import { describe, it, expect, vi } from 'vitest'
import { createLogger } from '@/lib/utils/logger'

const LEVELS = ['debug', 'info', 'warn', 'error'] as const

describe('createLogger', () => {
  it.each(LEVELS)('%s routes to console.%s with the [scope] prefix', (level) => {
    const spy = vi.spyOn(globalThis.console, level).mockImplementation(() => {})
    const logger = createLogger('MyScope')

    logger[level]('hello', 42)

    expect(spy).toHaveBeenCalledWith('[MyScope]', 'hello', 42)
  })

  it('uses the exact scope it was created with', () => {
    const spy = vi.spyOn(globalThis.console, 'info').mockImplementation(() => {})

    createLogger('Alpha').info('a')
    createLogger('Beta').info('b')

    expect(spy).toHaveBeenNthCalledWith(1, '[Alpha]', 'a')
    expect(spy).toHaveBeenNthCalledWith(2, '[Beta]', 'b')
  })

  it('forwards zero extra args (prefix only)', () => {
    const spy = vi.spyOn(globalThis.console, 'warn').mockImplementation(() => {})

    createLogger('Empty').warn()

    expect(spy).toHaveBeenCalledWith('[Empty]')
  })
})
