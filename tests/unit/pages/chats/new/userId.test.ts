/**
 * chats/new/[userId].vue page tests.
 *
 * Drives the REAL new-chat page: useSelectableUsers → userService →
 * MSW (/api/user/get-selectable-users); real Pinia stores throughout.
 *
 * The "session creation" flow here is client-side: the page mints a UUID for
 * the not-yet-created session. The first message send lands an optimistic pending
 * message, which flips the message list from empty to non-empty; a watcher then
 * navigates to /chats/<sessionId>. We drive that by adding a pending message
 * through the real chatStore and assert the navigation.
 *
 * generateUUID is mocked so the minted sessionId is known to the test.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { screen, waitFor } from '@testing-library/vue'
import type { Component } from 'vue'
import { renderWithProviders } from '@/tests/utils/render'
import { server, http } from '@/tests/msw/server'
import { apiOk } from '@/tests/msw/http'
import { makeUser, makeMessage } from '@/tests/utils/factories'
import { seedAuthStorage } from '@/tests/utils/authSeed'
import { useChatStore } from '@/app/stores/chat'
import NewChatPage from '@/app/pages/chats/new/[userId].vue'
import ChatMessages from '@/app/components/chat/ChatMessages.vue'

const SESSION_UUID = 'minted-session-uuid'

// The page mints the new sessionId via generateUUID; pin it so we know the
// navigation target and which callback key to confirm.
vi.mock('@/lib/utils/uuid', () => ({ generateUUID: () => SESSION_UUID }))

const ME = 'me@example.com'
const USER_ID = 42
const GET_SELECTABLE = '/api/user/get-selectable-users'

const stubs = {
  NuxtErrorBoundary: { template: '<div><slot /></div>' },
  MessageInput: { template: '<div data-testid="message-input-stub" />' },
  TypingIndicator: { template: '<div data-testid="typing-indicator-stub" />' },
  ScrollToBottomButton: { template: '<div />' },
  MarkdownContent: { props: ['content'], template: '<div class="markdown">{{ content }}</div>' },
  MessageRating: { template: '<div />' },
  OptionsMessage: { template: '<div />' },
  UButton: { template: '<button v-bind="$attrs"><slot /></button>' },
  UAlert: { props: ['title', 'description'], template: '<div role="alert" />' },
  UIcon: { template: '<i />' },
  USkeleton: { template: '<div />' },
}

/** Serve the selectable-users list (drives selectedUser resolution). */
function serveSelectableUsers(users: unknown[]) {
  server.use(http.get(GET_SELECTABLE, () => apiOk(users)))
}

function renderPage() {
  return renderWithProviders(NewChatPage as Component, {
    global: { stubs, components: { ChatMessages: ChatMessages as Component } },
  })
}

beforeEach(() => {
  vi.stubGlobal('useSeoMeta', vi.fn())
  vi.mocked(navigateTo).mockClear()
  vi.mocked(useRoute).mockReturnValue({
    params: { userId: String(USER_ID) },
    query: {},
    path: `/chats/new/${USER_ID}`,
    fullPath: `/chats/new/${USER_ID}`,
    name: 'chats-new-userId',
  } as never)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('chats/new/[userId] page', () => {
  it('renders the selected user header once the user list loads', async () => {
    seedAuthStorage({ user: makeUser({ email: ME }) })
    serveSelectableUsers([
      makeUser({ id: USER_ID, name: 'Agent Smith', email: 'agent@example.com', isVirtual: true }),
    ])

    renderPage()

    expect(await screen.findByText('Agent Smith')).toBeTruthy()
  })

  it('navigates to the created session once the first message is sent', async () => {
    seedAuthStorage({ user: makeUser({ email: ME }) })
    serveSelectableUsers([
      makeUser({ id: USER_ID, name: 'Agent Smith', email: 'agent@example.com', isVirtual: true }),
    ])

    renderPage()

    // Wait for the page to resolve the user (the message-list watcher is now armed).
    await screen.findByText('Agent Smith')

    // Simulate the first message being sent: an optimistic pending message lands,
    // flipping the message list from empty to non-empty and triggering navigation.
    const chatStore = useChatStore()
    chatStore.addPendingMessage(
      SESSION_UUID,
      makeMessage({ sessionId: SESSION_UUID, messageText: 'first message', senderUserCode: ME }),
    )

    await waitFor(() =>
      expect(vi.mocked(navigateTo)).toHaveBeenCalledWith(`/chats/${SESSION_UUID}`, {
        replace: true,
      }),
    )
  })

  it('clears the draft and sets the skip-animation flag when navigating on first message', async () => {
    seedAuthStorage({ user: makeUser({ email: ME }) })
    serveSelectableUsers([
      makeUser({ id: USER_ID, name: 'Agent Smith', email: 'agent@example.com', isVirtual: true }),
    ])

    renderPage()
    await screen.findByText('Agent Smith')

    // Acquire the page's store (renderWithProviders installs a fresh Pinia) and
    // seed a draft under the new-chat key so we can assert it gets cleared.
    const chatStore = useChatStore()
    chatStore.saveDraft(`new-${USER_ID}`, 'half-typed message')

    chatStore.addPendingMessage(
      SESSION_UUID,
      makeMessage({ sessionId: SESSION_UUID, messageText: 'first message', senderUserCode: ME }),
    )

    await waitFor(() =>
      expect(vi.mocked(navigateTo)).toHaveBeenCalledWith(`/chats/${SESSION_UUID}`, {
        replace: true,
      }),
    )
    // Side effects the ChatSession landing page relies on.
    expect(chatStore.getDraft(`new-${USER_ID}`)).toBe('')
    expect(chatStore.skipNextEntranceAnimation).toBe(true)
  })

  it('navigates exactly once — a second message does not re-navigate', async () => {
    seedAuthStorage({ user: makeUser({ email: ME }) })
    serveSelectableUsers([
      makeUser({ id: USER_ID, name: 'Agent Smith', email: 'agent@example.com', isVirtual: true }),
    ])

    renderPage()
    await screen.findByText('Agent Smith')

    // Acquire the page's store after render (fresh Pinia per renderWithProviders).
    const chatStore = useChatStore()
    // First message: 0 → 1, navigation fires.
    chatStore.addPendingMessage(
      SESSION_UUID,
      makeMessage({ sessionId: SESSION_UUID, messageText: 'first', senderUserCode: ME }),
    )
    await waitFor(() =>
      expect(vi.mocked(navigateTo)).toHaveBeenCalledWith(`/chats/${SESSION_UUID}`, {
        replace: true,
      }),
    )

    // Second message: 1 → 2. The `oldLen === 0` guard must suppress a re-navigation.
    chatStore.addPendingMessage(
      SESSION_UUID,
      makeMessage({ sessionId: SESSION_UUID, messageText: 'second', senderUserCode: ME }),
    )
    await Promise.resolve()

    const navToSession = vi
      .mocked(navigateTo)
      .mock.calls.filter(([target]) => target === `/chats/${SESSION_UUID}`)
    expect(navToSession).toHaveLength(1)
  })

  it('redirects to /chats when the userId does not match any selectable user', async () => {
    seedAuthStorage({ user: makeUser({ email: ME }) })
    // List loads but contains no user with id === USER_ID → watchEffect bails out.
    serveSelectableUsers([makeUser({ id: 999, name: 'Someone Else' })])

    renderPage()

    await waitFor(() =>
      expect(vi.mocked(navigateTo)).toHaveBeenCalledWith('/chats', { replace: true }),
    )
  })
})
