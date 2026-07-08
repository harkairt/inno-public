/**
 * users.vue page tests.
 *
 * Drives the REAL user-list view: useChatListData → useSelectableUsers /
 * useChatSessions / useUnreadMessageCounts → real services → MSW at the network
 * boundary. Nothing here mocks the store, service, or apiClient. The page reads
 * the selectable-user list, renders it, and filters it client-side via
 * useClientSideUserSearch as the search input changes.
 */
import { describe, it, expect, vi } from 'vitest'
import { screen, fireEvent, waitFor } from '@testing-library/vue'
import type { Component } from 'vue'
import { renderWithProviders } from '@/tests/utils/render'
import { server, http } from '@/tests/msw/server'
import { apiOk, apiError } from '@/tests/msw/http'
import { makeUser } from '@/tests/utils/factories'
import { seedAuthStorage } from '@/tests/utils/authSeed'
import UsersPage from '@/app/pages/users.vue'

const GET_USERS = '/api/user/get-selectable-users'

// Minimal Nuxt UI + heavy-child stubs. UInput must support v-model so typing
// drives userSearchQuery; UEmpty must surface its description text.
const stubs = {
  UserAvatar: { template: '<div data-testid="user-avatar" />' },
  UInput: {
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

function renderPage() {
  return renderWithProviders(UsersPage as Component, { global: { stubs } })
}

describe('users page', () => {
  it('renders the selectable-user list from MSW', async () => {
    seedAuthStorage({ user: makeUser({ email: 'me@example.com' }) })
    server.use(
      http.get(GET_USERS, () =>
        apiOk([
          makeUser({ id: 101, name: 'Alice Smith', email: 'alice@example.com' }),
          makeUser({ id: 102, name: 'Bob Jones', email: 'bob@example.com' }),
        ]),
      ),
    )

    renderPage()

    expect(await screen.findByTestId('user-item-101')).toBeTruthy()
    expect(screen.getByText('Alice Smith')).toBeTruthy()
    expect(screen.getByText('Bob Jones')).toBeTruthy()
  })

  it('shows the email for a real user and the AI-agent label for a virtual one', async () => {
    seedAuthStorage({ user: makeUser({ email: 'me@example.com' }) })
    server.use(
      http.get(GET_USERS, () =>
        apiOk([
          makeUser({ id: 201, name: 'Real Person', email: 'real@example.com', isVirtual: false }),
          makeUser({ id: 202, name: 'Helper Bot', isVirtual: true }),
        ]),
      ),
    )

    renderPage()

    expect(await screen.findByText('real@example.com')).toBeTruthy()
    // Virtual users render the translated 'users.aiAgent' key (t returns the key).
    expect(screen.getByText('users.aiAgent')).toBeTruthy()
  })

  it('renders the empty state when there are no users', async () => {
    seedAuthStorage({ user: makeUser({ email: 'me@example.com' }) })
    server.use(http.get(GET_USERS, () => apiOk([])))

    renderPage()

    await waitFor(() => expect(screen.getByTestId('users-empty')).toBeTruthy())
    expect(screen.getByTestId('users-empty').textContent).toContain('sidebar.noUsersFound')
    expect(screen.queryByTestId('user-item-101')).toBeNull()
  })

  it('narrows the list client-side as the search query changes', async () => {
    seedAuthStorage({ user: makeUser({ email: 'me@example.com' }) })
    server.use(
      http.get(GET_USERS, () =>
        apiOk([
          makeUser({ id: 301, name: 'Alice Smith', email: 'alice@example.com' }),
          makeUser({ id: 302, name: 'Bob Jones', email: 'bob@example.com' }),
        ]),
      ),
    )

    renderPage()

    // Both present initially.
    await screen.findByTestId('user-item-301')
    expect(screen.getByTestId('user-item-302')).toBeTruthy()

    await fireEvent.update(screen.getByTestId('user-search-input'), 'alice')

    await waitFor(() => expect(screen.queryByTestId('user-item-302')).toBeNull())
    expect(screen.getByTestId('user-item-301')).toBeTruthy()
  })

  it('shows an error alert when the user query fails', async () => {
    seedAuthStorage({ user: makeUser({ email: 'me@example.com' }) })
    server.use(http.get(GET_USERS, () => apiError(500)))

    renderPage()

    // useSelectableUsers overrides the test client's retry:false with retry:2,
    // so the error state only settles after the backoff — allow for it.
    expect(await screen.findByRole('alert', {}, { timeout: 5000 })).toBeTruthy()
  })

  it('navigates via the router when a user is clicked', async () => {
    seedAuthStorage({ user: makeUser({ email: 'me@example.com' }) })
    const push = vi.fn()
    vi.mocked(useRouter).mockReturnValue({
      push,
      replace: vi.fn(),
      go: vi.fn(),
      back: vi.fn(),
      forward: vi.fn(),
    } as never)
    server.use(
      http.get(GET_USERS, () =>
        apiOk([makeUser({ id: 401, name: 'Click Me', email: 'click@example.com' })]),
      ),
    )

    renderPage()

    await fireEvent.click(await screen.findByTestId('user-item-401'))

    // No existing session for this user → handleUserClick returns /chats/new/<id>.
    await waitFor(() => expect(push).toHaveBeenCalledWith('/chats/new/401'))
  })
})
