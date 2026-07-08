import { describe, it, expect } from 'vitest'
import { server, http, HttpResponse } from '@/tests/msw/server'
import { apiOk, apiError } from '@/tests/msw/http'
import { logService } from '@/lib/api/services/LogService'
import { LogLevel } from '@/types/enums'

// MSW at the network boundary — no apiClient mock. LogService is fire-and-forget:
// it never awaits the POST and swallows all failures.
const LOG_PATH = '/api/Log/log'

/** Capture the next /api/Log/log body; resolves once the wire is hit. */
function captureLogBody() {
  let resolve!: (v: unknown) => void
  const body = new Promise<unknown>((r) => (resolve = r))
  server.use(
    http.post(LOG_PATH, async ({ request }) => {
      resolve(await request.json())
      return apiOk(null)
    }),
  )
  return body
}

describe('LogService.log', () => {
  it('POSTs the LogInfoDTO body shape', async () => {
    const body = captureLogBody()

    await logService.log({
      loglevel: LogLevel.Info,
      title: 'hello',
      details: 'world',
      source: 'client',
    })

    expect(await body).toEqual({
      loglevel: LogLevel.Info,
      title: 'hello',
      details: 'world',
      source: 'client',
    })
  })

  it('debug() maps to a Debug-level entry with source=client', async () => {
    const body = captureLogBody()

    await logService.debug('a message', 'some data')

    expect(await body).toEqual({
      loglevel: LogLevel.Debug,
      title: 'a message',
      details: 'some data',
      source: 'client',
    })
  })

  it('error() serializes an Error into the details field', async () => {
    const body = captureLogBody()

    await logService.error('boom', new Error('kaboom'))

    const parsed = (await body) as { loglevel: number; title: string; details: string }
    expect(parsed.loglevel).toBe(LogLevel.Error)
    expect(parsed.title).toBe('boom')
    expect(JSON.parse(parsed.details)).toMatchObject({
      error: { message: 'kaboom', name: 'Error' },
    })
  })
})

describe('LogService fire-and-forget', () => {
  it('does not throw or reject when the backend returns 500', async () => {
    server.use(http.post(LOG_PATH, () => apiError(500)))

    await expect(
      logService.log({ loglevel: LogLevel.Error, title: 'x', source: 'client' }),
    ).resolves.toBeUndefined()
  })

  it('does not throw when the backend is unreachable', async () => {
    server.use(http.post(LOG_PATH, () => HttpResponse.error()))

    await expect(logService.warn('unreachable')).resolves.toBeUndefined()
  })
})
