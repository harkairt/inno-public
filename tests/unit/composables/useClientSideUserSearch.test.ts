import { describe, it, expect } from 'vitest'
import { ref, nextTick } from 'vue'
import { useClientSideUserSearch } from '@/app/composables/useClientSideUserSearch'
import type { UserDTO } from '@/types/api/schemas'

describe('useClientSideUserSearch', () => {
  const mockUsers = ref<UserDTO[]>([
    {
      id: 1,
      email: 'john.doe@example.com',
      name: 'John Doe',
      avatarUrl: null,
      isOnline: true,
      role: 'user',
      isAvailable: true
    },
    {
      id: 2,
      email: 'jane.smith@example.com',
      name: 'Jane Smith',
      avatarUrl: 'https://example.com/jane.jpg',
      isOnline: false,
      role: 'agent',
      isAvailable: true
    },
    {
      id: 3,
      email: 'bob.wilson@example.com',
      name: 'Bob Wilson',
      avatarUrl: null,
      isOnline: true,
      role: 'user',
      isAvailable: false
    },
    {
      id: 4,
      email: 'alice.johnson@example.com',
      name: 'Alice Johnson',
      avatarUrl: null,
      isOnline: false,
      role: 'agent',
      isAvailable: true
    }
  ])

  it('returns all users when search query is empty', () => {
    const searchQuery = ref('')
    const { filteredUsers } = useClientSideUserSearch(mockUsers, searchQuery)

    expect(filteredUsers.value).toHaveLength(4)
    expect(filteredUsers.value).toEqual(mockUsers.value)
  })

  it('filters users by name case-insensitively', () => {
    const searchQuery = ref('JOHN')
    const { filteredUsers } = useClientSideUserSearch(mockUsers, searchQuery)

    expect(filteredUsers.value).toHaveLength(1)
    expect(filteredUsers.value[0].name).toBe('John Doe')
  })

  it('filters users by email case-insensitively', () => {
    const searchQuery = ref('jane.smith')
    const { filteredUsers } = useClientSideUserSearch(mockUsers, searchQuery)

    expect(filteredUsers.value).toHaveLength(1)
    expect(filteredUsers.value[0].email).toBe('jane.smith@example.com')
  })

  it('returns empty array when no matches', () => {
    const searchQuery = ref('nonexistent')
    const { filteredUsers } = useClientSideUserSearch(mockUsers, searchQuery)

    expect(filteredUsers.value).toHaveLength(0)
  })

  it('trims whitespace from search query', () => {
    const searchQuery = ref('  alice  ')
    const { filteredUsers } = useClientSideUserSearch(mockUsers, searchQuery)

    expect(filteredUsers.value).toHaveLength(1)
    expect(filteredUsers.value[0].name).toBe('Alice Johnson')
  })

  it('handles partial name matches', () => {
    const searchQuery = ref('Wil')
    const { filteredUsers } = useClientSideUserSearch(mockUsers, searchQuery)

    expect(filteredUsers.value).toHaveLength(1)
    expect(filteredUsers.value[0].name).toBe('Bob Wilson')
  })

  it('handles partial email matches', () => {
    const searchQuery = ref('@example')
    const { filteredUsers } = useClientSideUserSearch(mockUsers, searchQuery)

    expect(filteredUsers.value).toHaveLength(4) // All users match
  })

  it('handles special characters in search query', () => {
    const searchQuery = ref('john.doe@example.com')
    const { filteredUsers } = useClientSideUserSearch(mockUsers, searchQuery)

    expect(filteredUsers.value).toHaveLength(1)
    expect(filteredUsers.value[0].email).toBe('john.doe@example.com')
  })

  it('handles null/undefined user names gracefully', () => {
    const usersWithNullName = ref<UserDTO[]>([
      {
        id: 1,
        email: 'null@example.com',
        name: null,
        avatarUrl: null,
        isOnline: false,
        role: 'user',
        isAvailable: true
      },
      {
        id: 2,
        email: 'valid@example.com',
        name: 'Valid Name',
        avatarUrl: null,
        isOnline: false,
        role: 'user',
        isAvailable: true
      }
    ])

    const searchQuery = ref('valid')
    const { filteredUsers } = useClientSideUserSearch(usersWithNullName, searchQuery)

    expect(filteredUsers.value).toHaveLength(1)
    expect(filteredUsers.value[0].name).toBe('Valid Name')
  })

  it('filters by name over email when both match', () => {
    const searchQuery = ref('john')
    const { filteredUsers } = useClientSideUserSearch(mockUsers, searchQuery)

    expect(filteredUsers.value).toHaveLength(2) // John Doe and Alice Johnson (both have 'john' in name/email)
  })

  it('handles empty users array', () => {
    const emptyUsers = ref<UserDTO[]>([])
    const searchQuery = ref('anything')
    const { filteredUsers } = useClientSideUserSearch(emptyUsers, searchQuery)

    expect(filteredUsers.value).toHaveLength(0)
  })

  it('handles undefined users array', () => {
    const undefinedUsers = ref<UserDTO[] | undefined>(undefined)
    const searchQuery = ref('anything')
    const { filteredUsers } = useClientSideUserSearch(undefinedUsers, searchQuery)

    expect(filteredUsers.value).toHaveLength(0)
  })

  it('is reactive to search query changes', async () => {
    const searchQuery = ref('')
    const { filteredUsers } = useClientSideUserSearch(mockUsers, searchQuery)

    expect(filteredUsers.value).toHaveLength(4)

    searchQuery.value = 'Jane'
    await nextTick()

    expect(filteredUsers.value).toHaveLength(1)
    expect(filteredUsers.value[0].name).toBe('Jane Smith')
  })
})