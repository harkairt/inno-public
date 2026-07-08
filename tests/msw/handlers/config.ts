import { http, HttpResponse } from 'msw'
import { DEFAULT_CONFIG } from '@/lib/config/defaults'

// ConfigService.loadConfig validates response.data DIRECTLY (no ApiResponse
// envelope) — config.json is served raw, so DON'T wrap it in apiOk().
export const configHandlers = [
  http.get('/api/settings/config.json', () => HttpResponse.json({ ...DEFAULT_CONFIG })),
]
