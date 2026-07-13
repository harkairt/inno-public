import { server, http } from '@/tests/msw/server'

/**
 * Register a POST handler that counts every hit before delegating to `respond`.
 * Returns a live `{ count }` object so integration tests can assert exact
 * network-boundary fetch deltas (the count the user actually sees), decoupled
 * from which invalidateQueries call produced them. `resetHandlers()` in the
 * global afterEach tears the handler down.
 */
export function trackPostCalls(path: string, respond: () => Response): { count: number } {
  const counter = { count: 0 }
  server.use(
    http.post(path, () => {
      counter.count++
      return respond()
    }),
  )
  return counter
}
