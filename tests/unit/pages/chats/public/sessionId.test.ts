/**
 * chats/public/[sessionId].vue page tests.
 *
 * In public mode getSessionById is unavailable, so this page NEVER fetches: the
 * session query is created with `enabled: false` and the page reads whatever the
 * Vue Query cache already holds (populated by the send mutation on the "new"
 * page). We therefore seed the query cache directly to render messages, and
 * leave it empty to exercise the "no cached session → redirect" branch.
 *
 * Public mode is driven through the REAL config store, seeded after render
 * (renderWithProviders owns the active Pinia). useChatAutoScroll is mocked — it
 * drives happy-dom-hostile scroll APIs irrelevant to these flows.
 *
 * The public header / "no nav rail" / publicAuthError error state belong to
 * app/layouts/public.vue (not this page) and are covered in the public/new
 * agentId test's layout describe.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { screen, waitFor, within } from '@testing-library/vue'
import type { Component } from 'vue'
import { renderWithProviders } from '@/tests/utils/render'
import { makeUser, makeSession, makeMessage } from '@/tests/utils/factories'
import { seedAuthStorage } from '@/tests/utils/authSeed'
import { useConfigStore } from '@/app/stores/config'
import { chatQueryKeys } from '@/app/composables/useChatQueries'
import type { AISessionDTO } from '@/types/api/schemas'
import PublicSessionPage from '@/app/pages/chats/public/[sessionId].vue'
import ChatMessages from '@/app/components/chat/ChatMessages.vue'

vi.mock('@/app/composables/useChatAutoScroll', () => ({
  useChatAutoScroll: () => ({
    isAtBottom: { value: true },
    scrollToBottom: () => {},
    scrollToElement: () => {},
  }),
}))

const ME = 'me@example.com'
const AGENT_ID = 5
const SESSION_ID = 's1'

const stubs = {
  MessageInput: { template: '<div data-testid="message-input-stub" />' },
  TypingIndicator: { template: '<div data-testid="typing-indicator-stub" />' },
  MarkdownContent: { props: ['content'], template: '<div class="markdown">{{ content }}</div>' },
  MessageRating: { template: '<div />' },
  OptionsMessage: { template: '<div />' },
  UIcon: { template: '<i />' },
}

function seedPublicConfig() {
  const configStore = useConfigStore()
  configStore.setConfig({ publicMode: 1, publicAgent: AGENT_ID })
  return configStore
}

function renderPage() {
  return renderWithProviders(PublicSessionPage as Component, {
    global: { stubs, components: { ChatMessages } },
  })
}

beforeEach(() => {
  vi.stubGlobal('useSeoMeta', vi.fn())
  vi.mocked(global.navigateTo).mockClear()
  vi.mocked(global.useRoute).mockReturnValue({
    params: { sessionId: SESSION_ID },
    query: {},
    path: `/chats/public/${SESSION_ID}`,
    fullPath: `/chats/public/${SESSION_ID}`,
    name: 'chats-public-sessionId',
  } as never)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('chats/public/[sessionId] page', () => {
  it('renders messages from the cached session (public mode has no fetch)', async () => {
    seedAuthStorage({ mode: 'sessionStorage', user: makeUser({ email: ME }) })

    const { queryClient } = renderPage()

    // Populate the cache the page reads from (session query is enabled:false).
    const session: AISessionDTO = {
      ...makeSession({
        sessionId: SESSION_ID,
        agentId: AGENT_ID,
        members: [ME, 'agent@example.com'],
      }),
      messages: [
        makeMessage({
          messageID: 'm1',
          messageText: 'Cached public hello',
          senderUserCode: 'agent@example.com',
        }),
      ],
    }
    queryClient.setQueryData(chatQueryKeys.session(SESSION_ID), session)
    seedPublicConfig()

    const container = await screen.findByTestId('messages-container')
    await waitFor(() => expect(within(container).getByText('Cached public hello')).toBeTruthy())
  })

  it('redirects to a fresh public chat when there is no cached session', async () => {
    seedAuthStorage({ mode: 'sessionStorage', user: makeUser({ email: ME }) })

    renderPage()
    // No cache seeded → session.value stays undefined → redirect to the canonical
    // public-chat entry URL for the configured agent.
    seedPublicConfig()

    await waitFor(() =>
      expect(vi.mocked(global.navigateTo)).toHaveBeenCalledWith(`/chats/public/new/${AGENT_ID}`, {
        replace: true,
      }),
    )
    // The spinner (redirecting) placeholder is shown, not the chat surface.
    expect(screen.queryByTestId('messages-container')).toBeNull()
  })
})
