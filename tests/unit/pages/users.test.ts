/**
 * users.vue page tests.
 *
 * Drives the real directory view through useChatListData and the API services,
 * with MSW at the network boundary. Nuxt UI primitives are stubbed only where
 * their browser rendering is unrelated to the directory behavior.
 */
import { describe, it, expect, vi } from 'vitest'
import { screen, fireEvent, waitFor, within } from '@testing-library/vue'
import type { Component } from 'vue'
import { renderWithProviders } from '@/tests/utils/render'
import { server, http } from '@/tests/msw/server'
import { apiOk, apiError } from '@/tests/msw/http'
import { makeUser } from '@/tests/utils/factories'
import { seedAuthStorage } from '@/tests/utils/authSeed'
import UsersPage from '@/app/pages/users.vue'

const GET_USERS = '/api/user/get-selectable-users'

const stubs = {
  UserAvatar: { template: '<div data-testid="user-avatar" />' },
  UIcon: { props: ['name'], template: '<i :data-icon="name" />' },
  UInput: {
    props: ['modelValue'],
    emits: ['update:modelValue'],
    template:
      '<input v-bind="$attrs" :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" />',
  },
  SearchInput: {
    props: ['modelValue'],
    emits: ['update:modelValue'],
    template:
      '<input v-bind="$attrs" :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" />',
  },
  USkeleton: { template: '<div class="skeleton" />' },
  UAlert: { template: '<div role="alert"><slot /></div>' },
  UEmpty: {
    props: ['description'],
    template: '<div data-testid="users-empty">{{ description }}</div>',
  },
}

function renderPage(authUserId = 900) {
  seedAuthStorage({ user: makeUser({ id: authUserId, email: `me-${authUserId}@example.com` }) })
  return renderWithProviders(UsersPage as Component, { global: { stubs } })
}

function mockUsers(users: ReturnType<typeof makeUser>[]) {
  server.use(http.get(GET_USERS, () => apiOk(users)))
}

describe('users page', () => {
  it('renders the localized directory shell and selectable users', async () => {
    mockUsers([
      makeUser({ id: 101, name: 'Alice Smith', email: 'alice@example.com' }),
      makeUser({ id: 102, name: 'Helper Bot', isVirtual: true }),
    ])

    renderPage()

    expect(screen.getByText('users.title')).toBeTruthy()
    expect(screen.getByText('users.subtitle')).toBeTruthy()
    expect(await screen.findByTestId('user-item-101')).toBeTruthy()
    expect(screen.getByText('Alice Smith')).toBeTruthy()
    expect(screen.getByText('Helper Bot')).toBeTruthy()
    expect(screen.getByTestId('users-result-count').textContent).toBe('2')
  })

  it('shows email for a person and the AI label and badge for an agent', async () => {
    mockUsers([
      makeUser({ id: 201, name: 'Real Person', email: 'real@example.com', isVirtual: false }),
      makeUser({ id: 202, name: 'Helper Bot', isVirtual: true }),
    ])

    renderPage()

    expect(await screen.findByText('real@example.com')).toBeTruthy()
    expect(screen.getByText('users.aiAgent')).toBeTruthy()
    expect(within(screen.getByTestId('user-item-202')).getByText('AI')).toBeTruthy()
  })

  it('renders accessible green and gray availability indicators', async () => {
    mockUsers([
      makeUser({ id: 211, name: 'Available', isAvailable: true }),
      makeUser({ id: 212, name: 'Unavailable', isAvailable: false }),
    ])

    renderPage()

    const available = await screen.findByTestId('user-availability-211')
    const unavailable = screen.getByTestId('user-availability-212')
    expect(available.getAttribute('aria-label')).toBe('users.available')
    expect(unavailable.getAttribute('aria-label')).toBe('users.unavailable')
    expect(available.className).toContain('bg-[hsl(var(--success))]')
    expect(unavailable.className).toContain('bg-[hsl(var(--ink-3))]')
  })

  it('combines name/email search with agent and person filters', async () => {
    mockUsers([
      makeUser({ id: 301, name: 'Alice Smith', email: 'alice@example.com', isVirtual: false }),
      makeUser({ id: 302, name: 'Alice Agent', email: 'agent@example.com', isVirtual: true }),
      makeUser({ id: 303, name: 'Bob Jones', email: 'bob@example.com', isVirtual: false }),
    ])

    renderPage()
    await screen.findByTestId('user-item-301')

    await fireEvent.update(screen.getByTestId('user-search-input'), 'alice')
    expect(screen.queryByTestId('user-item-303')).toBeNull()
    expect(screen.getByTestId('users-result-count').textContent).toBe('2')

    await fireEvent.click(screen.getByTestId('user-filter-ai'))
    expect(screen.queryByTestId('user-item-301')).toBeNull()
    expect(screen.getByTestId('user-item-302')).toBeTruthy()
    expect(screen.getByTestId('users-result-count').textContent).toBe('1')

    await fireEvent.click(screen.getByTestId('user-filter-human'))
    expect(screen.getByTestId('user-item-301')).toBeTruthy()
    expect(screen.queryByTestId('user-item-302')).toBeNull()
  })

  it('persists favorites, filters to them, and preserves API order', async () => {
    mockUsers([
      makeUser({ id: 401, name: 'First User' }),
      makeUser({ id: 402, name: 'Second User' }),
      makeUser({ id: 403, name: 'Third User' }),
    ])

    renderPage(77)
    await screen.findByTestId('user-item-401')

    await fireEvent.click(screen.getByTestId('favorite-user-403'))
    await fireEvent.click(screen.getByTestId('favorite-user-401'))

    const stored = JSON.parse(localStorage.getItem('innochat-user-favorites:77') ?? 'null') as {
      version: number
      userIds: number[]
    }
    expect(stored).toEqual({ version: 1, userIds: [403, 401] })

    const allCards = screen
      .getByTestId('users-grid')
      .querySelectorAll<HTMLElement>('[data-testid^="user-item-"]')
    expect([...allCards].map((card) => card.dataset.testid)).toEqual([
      'user-item-401',
      'user-item-402',
      'user-item-403',
    ])

    await fireEvent.click(screen.getByTestId('user-filter-favorites'))
    const favoriteCards = screen
      .getByTestId('users-grid')
      .querySelectorAll<HTMLElement>('[data-testid^="user-item-"]')
    expect([...favoriteCards].map((card) => card.dataset.testid)).toEqual([
      'user-item-401',
      'user-item-403',
    ])
  })

  it('does not navigate when the favorite control is used', async () => {
    const push = vi.fn()
    vi.mocked(useRouter).mockReturnValue({
      push,
      replace: vi.fn(),
      go: vi.fn(),
      back: vi.fn(),
      forward: vi.fn(),
    } as never)
    mockUsers([makeUser({ id: 451, name: 'Favorite Me' })])

    renderPage()
    await fireEvent.click(await screen.findByTestId('favorite-user-451'))

    expect(push).not.toHaveBeenCalled()
    expect(screen.getByTestId('favorite-user-451').getAttribute('aria-pressed')).toBe('true')
  })

  it('shows contextual empty states', async () => {
    mockUsers([makeUser({ id: 501, name: 'Only User' })])
    renderPage()
    await screen.findByTestId('user-item-501')

    await fireEvent.click(screen.getByTestId('user-filter-favorites'))
    expect(screen.getByTestId('users-empty').textContent).toContain('users.noFavorites')

    await fireEvent.update(screen.getByTestId('user-search-input'), 'missing')
    expect(screen.getByTestId('users-empty').textContent).toContain('users.noSearchResults')
  })

  it('renders the generic empty state when the API returns no users', async () => {
    mockUsers([])
    renderPage()

    await waitFor(() => expect(screen.getByTestId('users-empty')).toBeTruthy())
    expect(screen.getByTestId('users-empty').textContent).toContain('users.noUsers')
  })

  it('shows an error alert when the user query fails', async () => {
    server.use(http.get(GET_USERS, () => apiError(500)))
    renderPage()

    expect(await screen.findByRole('alert', {}, { timeout: 5000 })).toBeTruthy()
  })

  it('opens the existing route resolver from the conversation button', async () => {
    const push = vi.fn()
    vi.mocked(useRouter).mockReturnValue({
      push,
      replace: vi.fn(),
      go: vi.fn(),
      back: vi.fn(),
      forward: vi.fn(),
    } as never)
    mockUsers([makeUser({ id: 601, name: 'Open Me', email: 'open@example.com' })])

    renderPage()
    await fireEvent.click(await screen.findByTestId('open-conversation-601'))

    await waitFor(() => expect(push).toHaveBeenCalledWith('/chats/new/601'))
  })
})
