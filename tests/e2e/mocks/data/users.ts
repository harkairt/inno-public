/**
 * Mock user data for E2E tests
 * Data matches Zod UserDTO schema
 */

// UserDTO type definition (matches schema from types/api/schemas.ts)
interface UserDTO {
  id: number
  createdAt: string
  updatedAt: string | null
  name: string
  email: string
  passwordHash: string | null
  status: 'active' | 'inactive' | 'suspended' | 'pending'
  invitationAccepted: boolean
  roles: string[]
  isVirtual: boolean
  url: string
  image?: string | null
  darkImage?: string | null
  userIds: number[]
  users?: unknown[] | null
  isAvailable: boolean
}

export const mockUsers = {
  regularUser: {
    id: 1,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: null,
    name: 'Test User',
    email: 'test@example.com',
    passwordHash: null,
    status: 'active',
    invitationAccepted: true,
    roles: ['user'],
    isVirtual: false,
    url: '/users/1',
    image: null,
    darkImage: null,
    userIds: [],
    users: null,
    isAvailable: true,
  } satisfies UserDTO,

  adminUser: {
    id: 2,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: null,
    name: 'Admin User',
    email: 'admin@example.com',
    passwordHash: null,
    status: 'active',
    invitationAccepted: true,
    roles: ['admin', 'user'],
    isVirtual: false,
    url: '/users/2',
    image: null,
    darkImage: null,
    userIds: [],
    users: null,
    isAvailable: true,
  } satisfies UserDTO,

  virtualAgent: {
    id: 100,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: null,
    name: 'AI Assistant',
    email: 'ai@virtual.agent',
    passwordHash: null,
    status: 'active',
    invitationAccepted: true,
    roles: ['agent'],
    isVirtual: true,
    url: '/agents/100',
    image: '/images/agent.png',
    darkImage: '/images/agent-dark.png',
    userIds: [],
    users: null,
    isAvailable: true,
  } satisfies UserDTO,

  virtualAgent2: {
    id: 101,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: null,
    name: 'Code Helper',
    email: 'code@virtual.agent',
    passwordHash: null,
    status: 'active',
    invitationAccepted: true,
    roles: ['agent'],
    isVirtual: true,
    url: '/agents/101',
    image: '/images/code-agent.png',
    darkImage: '/images/code-agent-dark.png',
    userIds: [],
    users: null,
    isAvailable: true,
  } satisfies UserDTO,

  inactiveUser: {
    id: 3,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: null,
    name: 'Inactive User',
    email: 'inactive@example.com',
    passwordHash: null,
    status: 'inactive',
    invitationAccepted: false,
    roles: ['user'],
    isVirtual: false,
    url: '/users/3',
    image: null,
    darkImage: null,
    userIds: [],
    users: null,
    isAvailable: false,
  } satisfies UserDTO,
}

// Helper to create a custom user
export function createMockUser(overrides: Partial<UserDTO>): UserDTO {
  return {
    ...mockUsers.regularUser,
    ...overrides,
  }
}

// Array of all virtual agents for tests
export const mockVirtualAgents = [mockUsers.virtualAgent, mockUsers.virtualAgent2]

// Array of selectable users (non-virtual)
export const mockSelectableUsers = [mockUsers.regularUser, mockUsers.adminUser]

// All users combined
export const mockAllUsers = [...mockSelectableUsers, ...mockVirtualAgents]
