import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useAuthStore } from '@/app/stores/auth'

// Mock the auth store
vi.mock('@/app/stores/auth', () => ({
  useAuthStore: vi.fn()
}))

// Mock navigateTo
const mockNavigateTo = vi.fn()
vi.mock('#app', () => ({
  navigateTo: mockNavigateTo,
  defineNuxtRouteMiddleware: (fn: Function) => fn
}))

describe('auth middleware', () => {
  let mockAuthStore: any

  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()

    mockAuthStore = {
      isAuthenticated: false
    }
    vi.mocked(useAuthStore).mockReturnValue(mockAuthStore)
  })

  it('redirects to login when user is not authenticated', async () => {
    // Arrange
    mockAuthStore.isAuthenticated = false

    // Import after mocking
    const authMiddleware = await import('@/app/middleware/auth.global')
    const middleware = authMiddleware.default

    // Act
    await middleware(
      { path: '/chats' },
      { path: '/' }
    )

    // Assert
    expect(mockNavigateTo).toHaveBeenCalledWith('/login', {
      replace: true
    })
  })

  it('allows access when user is authenticated', async () => {
    // Arrange
    mockAuthStore.isAuthenticated = true

    // Import after mocking
    const authMiddleware = await import('@/app/middleware/auth.global')
    const middleware = authMiddleware.default

    // Act
    const result = await middleware(
      { path: '/chats' },
      { path: '/login' }
    )

    // Assert
    expect(mockNavigateTo).not.toHaveBeenCalled()
    expect(result).toBeUndefined()
  })

  it('works for any protected route', async () => {
    // Arrange
    mockAuthStore.isAuthenticated = false

    // Import after mocking
    const authMiddleware = await import('@/app/middleware/auth.global')
    const middleware = authMiddleware.default

    // Act
    await middleware(
      { path: '/some-protected-route' },
      { path: '/login' }
    )

    // Assert
    expect(mockNavigateTo).toHaveBeenCalledWith('/login', {
      replace: true
    })
  })
})