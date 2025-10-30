import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'

// Mock the UsersExpandableTile component
vi.mock('@/app/components/chats/UsersExpandableTile.vue', () => ({
  default: {
    name: 'UsersExpandableTile',
    template: '<div data-testid="users-expandable-tile"></div>'
  }
}))

describe('ChatsSidebar', () => {
  it('renders the sidebar with correct structure', async () => {
    // Import the component
    const { default: ChatsSidebar } = await import('@/app/components/chats/ChatsSidebar.vue')

    const wrapper = mount(ChatsSidebar)

    // Check if it renders the aside element with correct classes
    const sidebar = wrapper.find('aside')
    expect(sidebar.exists()).toBe(true)
    expect(sidebar.classes()).toContain('sidebar')
    expect(sidebar.classes()).toContain('border-r')
    expect(sidebar.classes()).toContain('border-gray-200')
    expect(sidebar.classes()).toContain('bg-white')
    expect(sidebar.classes()).toContain('h-full')
    expect(sidebar.classes()).toContain('overflow-y-auto')
  })

  it('displays the chats header', async () => {
    const { default: ChatsSidebar } = await import('@/app/components/chats/ChatsSidebar.vue')

    const wrapper = mount(ChatsSidebar)

    const header = wrapper.find('h2')
    expect(header.exists()).toBe(true)
    expect(header.text()).toBe('Chats')
    expect(header.classes()).toContain('text-xl')
    expect(header.classes()).toContain('font-semibold')
    expect(header.classes()).toContain('mb-4')
  })

  it('renders the UsersExpandableTile component', async () => {
    const { default: ChatsSidebar } = await import('@/app/components/chats/ChatsSidebar.vue')

    const wrapper = mount(ChatsSidebar)

    const usersTile = wrapper.find('[data-testid="users-expandable-tile"]')
    expect(usersTile.exists()).toBe(true)
  })

  it('has the correct container structure', async () => {
    const { default: ChatsSidebar } = await import('@/app/components/chats/ChatsSidebar.vue')

    const wrapper = mount(ChatsSidebar)

    const container = wrapper.find('.p-4')
    expect(container.exists()).toBe(true)
  })
})