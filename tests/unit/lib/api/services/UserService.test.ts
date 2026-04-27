import { describe, it, expect, vi, beforeEach } from 'vitest'
import { userService } from '@/lib/api/services/UserService'
import { apiClient } from '@/lib/api/client'
import { makeApiResponse, makeAxiosError } from '@/tests/utils/factories'

vi.mock('@/lib/api/client', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
  }
}))

vi.mock('@/lib/errors/normalize', () => ({
  normalizeApiError: vi.fn((e) => e)
}))

function makeRawUser(overrides = {}) {
  return {
    id: 1,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: null,
    name: 'Test User',
    email: 'test@example.com',
    status: 'active',
    invitationAccepted: true,
    roles: ['user'],
    isVirtual: false,
    url: null,
    image: null,
    darkImage: null,
    userIds: [],
    users: null,
    isAvailable: true,
    ...overrides,
  }
}

describe('UserService.getSelectableUsers', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns array of validated UserDTOs on success', async () => {
    vi.mocked(apiClient.get).mockResolvedValue(makeApiResponse([makeRawUser()]))

    const result = await userService.getSelectableUsers('test@example.com')

    expect(result.isOk()).toBe(true)
    if (result.isOk()) {
      expect(result.value).toHaveLength(1)
      expect(result.value[0]?.email).toBe('test@example.com')
    }

    expect(apiClient.get).toHaveBeenCalledWith(
      '/api/user/get-selectable-users',
      { params: { email: 'test@example.com' } }
    )
  })

  it('returns empty array when no users', async () => {
    vi.mocked(apiClient.get).mockResolvedValue(makeApiResponse(null))

    const result = await userService.getSelectableUsers('test@example.com')

    expect(result.isOk()).toBe(true)
    if (result.isOk()) {
      expect(result.value).toHaveLength(0)
    }
  })

  it('returns multiple users', async () => {
    vi.mocked(apiClient.get).mockResolvedValue(
      makeApiResponse([
        makeRawUser({ id: 1, email: 'user1@example.com' }),
        makeRawUser({ id: 2, email: 'user2@example.com' }),
      ])
    )

    const result = await userService.getSelectableUsers('admin@example.com')

    expect(result.isOk()).toBe(true)
    if (result.isOk()) {
      expect(result.value).toHaveLength(2)
    }
  })

  it('returns VALIDATION_ERROR for invalid user shape', async () => {
    vi.mocked(apiClient.get).mockResolvedValue(
      makeApiResponse([{ id: 'not-a-number', name: 'Bad' }])
    )

    const result = await userService.getSelectableUsers('test@example.com')

    expect(result.isErr()).toBe(true)
  })

  it('returns error on network failure', async () => {
    vi.mocked(apiClient.get).mockRejectedValue(makeAxiosError(500))

    const result = await userService.getSelectableUsers('test@example.com')

    expect(result.isErr()).toBe(true)
  })

  it('returns error on 401 unauthorized', async () => {
    vi.mocked(apiClient.get).mockRejectedValue(makeAxiosError(401, 'UNAUTHORIZED'))

    const result = await userService.getSelectableUsers('test@example.com')

    expect(result.isErr()).toBe(true)
  })
})
