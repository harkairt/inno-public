import { describe, it, expect } from 'vitest'
import { server, http, HttpResponse } from '@/tests/msw/server'
import { apiOk, apiError } from '@/tests/msw/http'
import { userService } from '@/lib/api/services/UserService'
import { makeUser } from '@/tests/utils/factories'

// MSW at the network boundary — no apiClient mock. UserDTO Zod validation runs
// for real; the ?email query param is asserted via a handler spy.

const USERS_PATH = '/api/user/get-selectable-users'

describe('UserService.getSelectableUsers', () => {
  it('returns validated UserDTOs on success and forwards the email query param', async () => {
    let capturedEmail: string | null = null
    server.use(
      http.get(USERS_PATH, ({ request }) => {
        capturedEmail = new URL(request.url).searchParams.get('email')
        return apiOk([makeUser({ email: 'test@example.com' })])
      }),
    )

    const result = await userService.getSelectableUsers('test@example.com')

    expect(result.isOk()).toBe(true)
    if (result.isOk()) {
      expect(result.value).toHaveLength(1)
      expect(result.value[0]?.email).toBe('test@example.com')
    }
    expect(capturedEmail).toBe('test@example.com')
  })

  it('returns empty array when no users', async () => {
    server.use(http.get(USERS_PATH, () => apiOk(null)))

    const result = await userService.getSelectableUsers('test@example.com')

    expect(result.isOk()).toBe(true)
    if (result.isOk()) expect(result.value).toHaveLength(0)
  })

  it('returns multiple users', async () => {
    server.use(
      http.get(USERS_PATH, () =>
        apiOk([makeUser({ email: 'user1@example.com' }), makeUser({ email: 'user2@example.com' })]),
      ),
    )

    const result = await userService.getSelectableUsers('admin@example.com')

    expect(result.isOk()).toBe(true)
    if (result.isOk()) expect(result.value).toHaveLength(2)
  })

  it('returns VALIDATION_ERROR for an invalid user shape', async () => {
    server.use(http.get(USERS_PATH, () => apiOk([{ id: 'not-a-number', name: 'Bad' }])))

    const result = await userService.getSelectableUsers('test@example.com')

    expect(result.isErr()).toBe(true)
  })

  it('returns an error on network failure', async () => {
    server.use(http.get(USERS_PATH, () => HttpResponse.error()))

    const result = await userService.getSelectableUsers('test@example.com')

    expect(result.isErr()).toBe(true)
  })

  it('returns an error on 401 unauthorized', async () => {
    server.use(http.get(USERS_PATH, () => apiError(401)))

    const result = await userService.getSelectableUsers('test@example.com')

    expect(result.isErr()).toBe(true)
  })
})
