/**
 * New Chat Creation Tests
 *
 * Full journey past where users/list.spec.ts stops: users page → click a user
 * card → app/pages/chats/new/[userId].vue → first message creates the session
 * (client-generated UUID, route replaced with /chats/<sessionId>) → the mocked
 * AI reply renders in the conversation.
 *
 * Route mocks: mockAllApis (via the mockedAuthenticatedPage fixture) lays down
 * the happy path; mockNewSessionRoundTrip shadows question/text +
 * GetSessionById (LIFO) so the send resolves with a schema-valid reply and the
 * follow-up session refetch returns the created conversation.
 */

import { test, expect, mockNewSessionRoundTrip } from '../fixtures'
import { selectors } from '../selectors'
import { navigateToUsers } from '../actions/navigation.actions'
import { sendMessage } from '../actions/chat.actions'

// Client-side UUID session route (and NOT /chats/new/...).
const SESSION_URL = /\/chats\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

test.describe('New Chat With User', () => {
  test('creates a session from the users page and renders the reply @mobile', async ({
    mockedAuthenticatedPage: page,
  }) => {
    // Spy on the real backend send path so mock drift fails loud.
    const questionCalls: string[] = []
    page.on('request', (r) => {
      if (r.url().includes('/api/AIWebAPI/question/text')) questionCalls.push(r.url())
    })

    await mockNewSessionRoundTrip(page, 'Happy to help with your code!')

    // Users page → click the Code Helper agent card (id 101 — no primary
    // session exists for a virtual user, so this always goes to /chats/new/101).
    await navigateToUsers(page)
    await page.locator(selectors.users.userItem(101)).click()
    await expect(page).toHaveURL(/\/chats\/new\/101/)

    // New-chat page boots: selected user in the header, welcome message loaded.
    await expect(page.getByRole('heading', { name: 'Code Helper' })).toBeVisible()
    await expect(page.getByText('Welcome! How can I assist you today?')).toBeVisible()

    await sendMessage(page, 'Hi, I need help with a bug')

    // First send creates the session: route is replaced with the UUID session URL.
    await page.waitForURL(SESSION_URL, { timeout: 15_000 })

    // Round-trip renders: the sent message and the mocked AI reply. Scope to the
    // messages container — the question also becomes the session title/sidebar text.
    const messages = page.locator(selectors.chat.messagesContainer)
    await expect(messages.getByText('Hi, I need help with a bug').first()).toBeVisible({
      timeout: 15_000,
    })
    await expect(messages.getByText('Happy to help with your code!').first()).toBeVisible({
      timeout: 15_000,
    })
    expect(questionCalls).toHaveLength(1)
  })

  test('renders the new-chat page for a human user via direct navigation', async ({
    mockedAuthenticatedPage: page,
  }) => {
    // Admin User (id 2) is human and has no session in the mocked headers, so
    // /chats/new/2 renders the draft conversation (no redirect to /chats).
    await page.goto('/chats/new/2')

    await expect(page.getByRole('heading', { name: 'Admin User' })).toBeVisible()
    await expect(page.locator(selectors.chat.messageInput)).toBeVisible()
    await expect(page.locator(selectors.chat.sendButton)).toBeVisible()
  })
})
