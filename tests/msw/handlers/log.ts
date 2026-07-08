import { http } from 'msw'
import { apiOk } from '../http'

// Fire-and-forget logging sink (LogService.ts POSTs /api/Log/log) — keeps
// onUnhandledRequest: 'error' from tripping on background log calls.
export const logHandlers = [http.post('/api/Log/log', () => apiOk(null))]
