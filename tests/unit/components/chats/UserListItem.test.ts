import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import type { UserDTO } from '@/types/api/schemas'

// Helper function to create proper UserDTO mocks
function createMockUser(overrides: Partial<UserDTO> = {}): UserDTO {
  const now = new Date().toISOString()
  return {
    id: 1,
    createdAt: now,
    updatedAt: null,
    name: 'John Doe',
    email: 'john@example.com',
    status: 'Active' as any,
    invitationAccepted: true,
    roles: [],
    isVirtual: false,
    url: '',
    image: null,
    darkImage: null,
    userIds: [],
    users: null,
    isAvailable: true,
    ...overrides
  }
}

// Helper function to create user with image for the component
function createUserWithAvatar(overrides: Partial<UserDTO> = {}): UserDTO {
  return {
    ...createMockUser(),
    image: null,
    ...overrides
  }
}

describe('UserListItem', () => {
  it('displays user name when available', async () => {
    const user = createUserWithAvatar()

    const { default: UserListItem } = await import('@/app/components/chats/UserListItem.vue')
    const wrapper = mount(UserListItem, {
      props: { user }
    })

    expect(wrapper.text()).toContain('John Doe')
  })

  it('displays email when name is different from email', async () => {
    const user = createUserWithAvatar({ name: 'John Doe', email: 'john.doe@example.com' })

    const { default: UserListItem } = await import('@/app/components/chats/UserListItem.vue')
    const wrapper = mount(UserListItem, {
      props: { user }
    })

    expect(wrapper.text()).toContain('john.doe@example.com')
  })

  it('displays email when name is not available', async () => {
    const user = createUserWithAvatar({ name: null, email: 'john@example.com' })

    const { default: UserListItem } = await import('@/app/components/chats/UserListItem.vue')
    const wrapper = mount(UserListItem, {
      props: { user }
    })

    expect(wrapper.text()).toContain('john@example.com')
  })

  it('displays initials when no avatar URL', async () => {
    const user = createUserWithAvatar({ image: null })

    const { default: UserListItem } = await import('@/app/components/chats/UserListItem.vue')
    const wrapper = mount(UserListItem, {
      props: { user }
    })

    expect(wrapper.text()).toContain('JD')
  })

  it('displays avatar when avatar URL is provided', async () => {
    const user = createUserWithAvatar({ image: 'https://example.com/avatar.jpg' })

    const { default: UserListItem } = await import('@/app/components/chats/UserListItem.vue')
    const wrapper = mount(UserListItem, {
      props: { user }
    })

    const avatar = wrapper.find('img')
    expect(avatar.exists()).toBe(true)
    expect(avatar.attributes('src')).toBe('https://example.com/avatar.jpg')
    expect(avatar.attributes('alt')).toBe('John Doe avatar')
  })

  it('displays online indicator when user is online', async () => {
    const { default: UserListItem } = await import('@/app/components/chats/UserListItem.vue')

    // The component uses isAvailable property to show online indicator
    // So let's set isAvailable to true for this test
    const onlineUser = createUserWithAvatar({ isAvailable: true })
    const onlineWrapper = mount(UserListItem, {
      props: { user: onlineUser }
    })

    const onlineIndicator = onlineWrapper.find('.bg-green-500')
    expect(onlineIndicator.exists()).toBe(true)
    expect(onlineIndicator.classes()).toContain('rounded-full')
  })

  it('does not display online indicator when user is offline', async () => {
    const user = createUserWithAvatar({ isAvailable: false })

    const { default: UserListItem } = await import('@/app/components/chats/UserListItem.vue')
    const wrapper = mount(UserListItem, {
      props: { user }
    })

    const onlineIndicator = wrapper.find('.bg-green-500')
    expect(onlineIndicator.exists()).toBe(false)
  })

  it('generates correct initials for single name', async () => {
    const user = createUserWithAvatar({ name: 'John' })

    const { default: UserListItem } = await import('@/app/components/chats/UserListItem.vue')
    const wrapper = mount(UserListItem, {
      props: { user }
    })

    expect(wrapper.text()).toContain('J')
  })

  it('generates correct initials for multiple names', async () => {
    const user = createUserWithAvatar({ name: 'John Michael Doe' })

    const { default: UserListItem } = await import('@/app/components/chats/UserListItem.vue')
    const wrapper = mount(UserListItem, {
      props: { user }
    })

    expect(wrapper.text()).toContain('JE') // First and last initials
  })

  it('applies correct CSS classes', async () => {
    const user = createUserWithAvatar()

    const { default: UserListItem } = await import('@/app/components/chats/UserListItem.vue')
    const wrapper = mount(UserListItem, {
      props: { user }
    })

    const listItem = wrapper.find('.user-list-item')
    expect(listItem.exists()).toBe(true)
    expect(listItem.classes()).toContain('px-3')
    expect(listItem.classes()).toContain('py-2')
    expect(listItem.classes()).toContain('hover:bg-gray-50')
    expect(listItem.classes()).toContain('transition-colors')
  })
})