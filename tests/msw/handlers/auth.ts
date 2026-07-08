import { http } from 'msw'
import { apiOk } from '../http'
import { makeUser } from '../../utils/factories'

// Payload shapes match types/api/schemas.ts + extractTokensFromResponse (camelCase).
export const authHandlers = [
  http.post('/api/authentication/login', () =>
    apiOk({ user: makeUser(), accessToken: 'access-token-1', refreshToken: 'refresh-token-1' }),
  ),
  http.post('/api/authentication/refresh-token', () =>
    apiOk({ accessToken: 'access-token-2', refreshToken: 'refresh-token-2' }),
  ),
  http.get('/api/authentication/profile', () => apiOk(makeUser())),
  http.patch('/api/authentication/forgotten-password', () => apiOk(null)),
  http.patch('/api/authentication/set-password', () => apiOk(null)),
]
