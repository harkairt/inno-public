import { HttpResponse } from 'msw'

/** Wrap payload in the backend ApiResponse<T> envelope. */
export function apiOk<T>(data: T, init?: ResponseInit) {
  return HttpResponse.json({ data, success: null, warning: null, error: null }, init)
}

/** Error response with envelope + HTTP status. */
export function apiError(status: number, code?: string, message?: string) {
  return HttpResponse.json(
    { data: null, success: null, warning: null, error: code ? { code, message } : null },
    { status },
  )
}

/** Bare non-envelope error (for endpoints that return raw problem details). */
export function httpError(status: number) {
  return new HttpResponse(null, { status })
}

/**
 * Mutation endpoints (SetSessionName, DeleteSessionById) return a JSON *string*
 * that MutationSuccessResponseSchema parses; "kész." signals success.
 */
export function mutationOk() {
  return apiOk(JSON.stringify({ message: 'kész.' }))
}
