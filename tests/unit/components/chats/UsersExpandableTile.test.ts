import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { ref, nextTick } from 'vue'
import type { Component } from 'vue'

// Mock the useSelectableUsers composable
const mockUseSelectableUsers = vi.fn()
vi.mock('@/composables/useUsers', () => ({
  useSelectableUsers: mockUseSelectableUsers,
}))

// Mock the useClientSideUserSearch composable
const mockUseClientSideUserSearch = vi.fn()
vi.mock('@/composables/useClientSideUserSearch', () => ({
  useClientSideUserSearch: mockUseClientSideUserSearch,
}))

// Mock the UserListItem component
vi.mock('@/app/components/chats/UserListItem.vue', () => ({
  default: {
    name: 'UserListItem',
    props: ['user'],
    template: '<div data-testid="user-item">{{ user.name }}</div>',
  },
}))

async function importUsersExpandableTile(): Promise<Component> {
  const mod = (await import('@/app/components/chats/UsersExpandableTile.vue')) as {
    default: Component
  }
  return mod.default
}

describe('UsersExpandableTile', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders loading state when fetching users', async () => {
    // Arrange
    mockUseSelectableUsers.mockReturnValue({
      data: ref(undefined),
      isLoading: ref(true),
      isError: ref(false),
      error: ref(null),
      refetch: vi.fn(),
    })

    // Import and mount component
    const UsersExpandableTile = await importUsersExpandableTile()
    const wrapper = mount(UsersExpandableTile)

    // Assert
    expect(wrapper.text()).toContain('Loading users...')
    expect(wrapper.find('[data-testid="loading-spinner"]').exists()).toBe(true)
  })

  it('renders error state when fetch fails', async () => {
    // Arrange
    mockUseSelectableUsers.mockReturnValue({
      data: ref(undefined),
      isLoading: ref(false),
      isError: ref(true),
      error: ref(new Error('Failed to fetch users')),
      refetch: vi.fn(),
    })

    // Import and mount component
    const UsersExpandableTile = await importUsersExpandableTile()
    const wrapper = mount(UsersExpandableTile)

    // Assert
    expect(wrapper.text()).toContain('Failed to load users')
    expect(wrapper.find('button').text()).toContain('Retry')
  })

  it('renders users list when data is loaded', async () => {
    // Arrange
    const mockUsers = [
      { id: 1, name: 'John Doe', email: 'john@example.com' },
      { id: 2, name: 'Jane Smith', email: 'jane@example.com' },
    ]

    mockUseSelectableUsers.mockReturnValue({
      data: ref(mockUsers),
      isLoading: ref(false),
      isError: ref(false),
      error: ref(null),
      refetch: vi.fn(),
    })

    mockUseClientSideUserSearch.mockReturnValue({
      filteredUsers: ref(mockUsers),
    })

    // Import and mount component
    const UsersExpandableTile = await importUsersExpandableTile()
    const wrapper = mount(UsersExpandableTile)

    // Assert
    expect(wrapper.find('[data-testid="search-input"]').exists()).toBe(true)
    expect(wrapper.findAll('[data-testid="user-item"]')).toHaveLength(2)
  })

  it('renders empty state when no users available', async () => {
    // Arrange
    mockUseSelectableUsers.mockReturnValue({
      data: ref([]),
      isLoading: ref(false),
      isError: ref(false),
      error: ref(null),
      refetch: vi.fn(),
    })

    mockUseClientSideUserSearch.mockReturnValue({
      filteredUsers: ref([]),
    })

    // Import and mount component
    const UsersExpandableTile = await importUsersExpandableTile()
    const wrapper = mount(UsersExpandableTile)

    // Assert
    expect(wrapper.text()).toContain('No users available')
  })

  it('renders no results state when search has no matches', async () => {
    // Arrange
    const mockUsers = [{ id: 1, name: 'John Doe', email: 'john@example.com' }]

    mockUseSelectableUsers.mockReturnValue({
      data: ref(mockUsers),
      isLoading: ref(false),
      isError: ref(false),
      error: ref(null),
      refetch: vi.fn(),
    })

    mockUseClientSideUserSearch.mockReturnValue({
      filteredUsers: ref([]),
    })

    // Import and mount component
    const UsersExpandableTile = await importUsersExpandableTile()
    const wrapper = mount(UsersExpandableTile)

    // Simulate search query
    await wrapper.find('[data-testid="search-input"]').setValue('nonexistent')
    await nextTick()

    // Assert
    expect(wrapper.text()).toContain('No users match "nonexistent"')
  })

  it('toggles expanded state when header is clicked', async () => {
    // Arrange
    mockUseSelectableUsers.mockReturnValue({
      data: ref([]),
      isLoading: ref(false),
      isError: ref(false),
      error: ref(null),
      refetch: vi.fn(),
    })

    mockUseClientSideUserSearch.mockReturnValue({
      filteredUsers: ref([]),
    })

    // Import and mount component
    const UsersExpandableTile = await importUsersExpandableTile()
    const wrapper = mount(UsersExpandableTile)

    // Initially expanded
    expect(wrapper.find('[data-testid="tile-content"]').exists()).toBe(true)

    // Click header to collapse
    await wrapper.find('[data-testid="tile-header"]').trigger('click')
    await nextTick()

    // Should be collapsed
    expect(wrapper.find('[data-testid="tile-content"]').exists()).toBe(false)

    // Click header to expand again
    await wrapper.find('[data-testid="tile-header"]').trigger('click')
    await nextTick()

    // Should be expanded again
    expect(wrapper.find('[data-testid="tile-content"]').exists()).toBe(true)
  })
})
