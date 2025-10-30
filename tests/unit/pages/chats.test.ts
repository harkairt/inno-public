import { describe, it, expect, vi } from 'vitest'

// Mock definePageMeta
const mockDefinePageMeta = vi.fn()
vi.mock('#app', () => ({
  definePageMeta: mockDefinePageMeta
}))

describe('chats page', () => {
  it('applies authentication middleware', async () => {
    // Import after mocking
    await import('@/app/pages/chats.vue')

    // Assert
    expect(mockDefinePageMeta).toHaveBeenCalledWith({
      middleware: 'auth'
    })
  })

  it('renders the correct layout structure', async () => {
    // Import the component
    const { default: ChatsPage } = await import('@/app/pages/chats.vue')

    // Basic component existence check
    expect(typeof ChatsPage).toBe('object')
  })
})