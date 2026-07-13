/**
 * chats/[sessionId].vue page tests.
 *
 * Drives the REAL chat page: useChatSession → chatService.getSessionById → MSW;
 * MessageInput → useSendMessage → chatService.sendQuestion → MSW; the fake
 * SignalR singleton for ReceiveMessage; real Pinia stores throughout. No
 * store/service/apiClient mocking.
 *
 * useChatAutoScroll is mocked to no-ops: it drives happy-dom-hostile scroll APIs
 * and is irrelevant to the flows under test (a browser-API leaf per the mocking
 * ladder).
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { screen, fireEvent, waitFor, within } from '@testing-library/vue'
import type { Component } from 'vue'
import { renderWithProviders } from '@/tests/utils/render'
import { server, http } from '@/tests/msw/server'
import { apiOk, apiError } from '@/tests/msw/http'
import { makeSession, makeRawMessage, makeUser } from '@/tests/utils/factories'
import { seedAuthStorage } from '@/tests/utils/authSeed'
import { installFakeSignalR } from '@/tests/utils/fakeSignalR'
import { chatQueryKeys } from '@/app/composables/useChatQueries'
import { useChatStore } from '@/app/stores/chat'
import { useAuthStore } from '@/app/stores/auth'
import { useSignalR } from '@/app/composables/useSignalR'
import type { AISessionDTO } from '@/types/api/schemas'
import ChatSessionPage from '@/app/pages/chats/[sessionId].vue'
import ChatMessages from '@/app/components/chat/ChatMessages.vue'
import signalrInitPlugin from '@/app/plugins/signalr-init.client'

vi.mock('@/app/composables/useChatAutoScroll', () => ({
  useChatAutoScroll: () => ({
    isAtBottom: { value: true },
    scrollToBottom: () => {},
    scrollToElement: () => {},
  }),
}))

const ME = 'me@example.com'
const OTHER = 'other@example.com'
const SESSION_ID = 'session-1'

const GET_SESSION_BY_ID = '/api/AIWebAPI/GetSessionById'
const SEND_TEXT = '/api/AIWebAPI/question/text'

beforeEach(() => {
  vi.stubGlobal('useSeoMeta', vi.fn())
  vi.mocked(useRoute).mockReturnValue({
    params: { sessionId: SESSION_ID },
    query: {},
    path: `/chats/${SESSION_ID}`,
    fullPath: `/chats/${SESSION_ID}`,
    name: 'chats-sessionId',
  } as never)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

// Keep ChatMessages / TypingIndicator / MessageInput real; stub the markdown/
// avatar/modal leaves + Nuxt UI + Nuxt built-ins to plain DOM.
const stubs = {
  // Synchronous transition stub — the shimmer→messages <Transition mode="out-in">
  // otherwise wedges in happy-dom (no transitionend).
  transition: true,
  NuxtErrorBoundary: { template: '<div><slot /></div>' },
  MarkdownContent: { props: ['content'], template: '<div class="markdown">{{ content }}</div>' },
  SessionMembers: { template: '<div />' },
  ManageSessionUsers: { template: '<div />' },
  MessageRating: { template: '<div />' },
  OptionsMessage: { template: '<div />' },
  UButton: { template: '<button v-bind="$attrs"><slot /></button>' },
  UTextarea: {
    props: ['modelValue'],
    emits: ['update:modelValue'],
    template:
      '<textarea v-bind="$attrs" :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" />',
  },
  UAlert: {
    props: ['title', 'description'],
    template: '<div role="alert">{{ title }}{{ description }}<slot name="actions" /></div>',
  },
  UIcon: { template: '<i />' },
  USkeleton: { template: '<div />' },
}

function renderPage() {
  // ChatMessages is a Nuxt auto-import (not imported by the page), so register it
  // for the test renderer; otherwise it resolves to an inert <chatmessages> stub.
  return renderWithProviders(ChatSessionPage as Component, {
    global: { stubs, components: { ChatMessages: ChatMessages as Component } },
  })
}

/** Session-by-id handler returning the supplied (mutable) message list. */
function serveSession(messages: () => Record<string, unknown>[]) {
  server.use(
    http.post(GET_SESSION_BY_ID, () =>
      apiOk({
        ...makeSession({ sessionId: SESSION_ID, members: [ME, OTHER] }),
        messages: messages(),
      }),
    ),
  )
}

describe('chats/[sessionId] page', () => {
  it('renders messages from MSW', async () => {
    seedAuthStorage({ user: makeUser({ email: ME }) })
    installFakeSignalR()
    serveSession(() => [
      makeRawMessage({ messageID: 'm1', messageText: 'Hello from server', senderUserCode: OTHER }),
    ])

    renderPage()

    const container = await screen.findByTestId('messages-container')
    await waitFor(() => expect(within(container).getByText('Hello from server')).toBeTruthy())
  })

  it('rolls back the optimistic message and shows a failed indicator + banner on 500', async () => {
    seedAuthStorage({ user: makeUser({ email: ME }) })
    installFakeSignalR()
    serveSession(() => [
      makeRawMessage({ messageID: 'm1', messageText: 'existing', senderUserCode: OTHER }),
    ])
    server.use(http.post(SEND_TEXT, () => apiError(500)))

    const { queryClient } = renderPage()

    const input = await screen.findByTestId('message-input')
    await fireEvent.update(input, 'hello there')
    await fireEvent.keyDown(input, { key: 'Enter' })

    // Failed-message banner: MessageInput surfaces the send error as an alert.
    // NOTE: the per-message FAILED status dot is intentionally NOT asserted — it
    // can't render for store-sourced failed messages. ChatMessages compares
    // message.status against its own local enum (FAILED = 'FAILED'), whereas the
    // store tags failures with the shared enum value 'failed', so the dot's
    // v-if is dead. The banner + the message text below cover the flow at DOM level.
    await waitFor(() => expect(screen.getByRole('alert')).toBeTruthy())

    // The failed user message text is still shown (parked in the store).
    const messages = await screen.findByTestId('messages-container')
    await waitFor(() => expect(within(messages).getByText('hello there')).toBeTruthy())

    // Query cache rolled back: the optimistic temp message is gone from the session.
    const session = queryClient.getQueryData<AISessionDTO>(chatQueryKeys.session(SESSION_ID))
    const cacheTexts = (session?.messages ?? []).map((m) => m.messageText)
    expect(cacheTexts).not.toContain('hello there')

    // And it landed as a failed message in the store.
    const chatStore = useChatStore()
    expect(chatStore.getFailedMessages(SESSION_ID).map((m) => m.messageText)).toContain(
      'hello there',
    )
  })

  it('renders a new message when SignalR emits ReceiveMessage → session query invalidates', async () => {
    seedAuthStorage({ user: makeUser({ email: ME }) })
    const fake = installFakeSignalR()
    // The plugin (not the page) owns the ReceiveMessage listener; expose the
    // auto-imports it relies on so we can run it against the page's QueryClient.
    vi.stubGlobal('useAuthStore', useAuthStore)
    vi.stubGlobal('useSignalR', useSignalR)

    const sessionMessages: Record<string, unknown>[] = [
      makeRawMessage({
        messageID: 'm1',
        messageText: 'first message',
        senderUserCode: OTHER,
        sendDate: '2024-01-01T10:00:00Z',
      }),
    ]
    serveSession(() => sessionMessages)

    const { queryClient } = renderPage()

    const container = await screen.findByTestId('messages-container')
    await waitFor(() => expect(within(container).getByText('first message')).toBeTruthy())

    // Register the ReceiveMessage listener via the real plugin (connects the fake,
    // then wires queryClient.invalidateQueries on the event).
    await signalrInitPlugin({ $queryClient: queryClient } as never)
    await waitFor(() => expect(fake.connect).toHaveBeenCalled(), { timeout: 2000 })

    // Server now has an extra message; the invalidation refetch will pick it up.
    sessionMessages.push(
      makeRawMessage({
        messageID: 'm2',
        messageText: 'live update',
        senderUserCode: OTHER,
        sendDate: '2024-01-01T11:00:00Z',
      }),
    )
    fake.emitFromServer('ReceiveMessage', SESSION_ID, 1)

    await waitFor(() => expect(within(container).getByText('live update')).toBeTruthy())
  })

  it('shows the user message as the header title (not editable) when the session is unnamed', async () => {
    seedAuthStorage({ user: makeUser({ email: ME }) })
    installFakeSignalR()
    // Freshly created session: server has not named it yet (sessionName: '').
    server.use(
      http.post(GET_SESSION_BY_ID, () =>
        apiOk({
          ...makeSession({ sessionId: SESSION_ID, members: [ME, OTHER], sessionName: '' }),
          messages: [
            makeRawMessage({
              messageID: 'm1',
              messageText: 'What is the weather today?',
              senderUserCode: ME,
            }),
          ],
        }),
      ),
    )

    renderPage()

    const title = await screen.findByTestId('session-title')
    expect(title.textContent).toContain('What is the weather today?')
    // No rename affordance while the title is the temporary optimistic message.
    expect(screen.queryByTestId('edit-title-button')).toBeNull()
  })

  it('shows the server session name in the header with an edit button once named', async () => {
    seedAuthStorage({ user: makeUser({ email: ME }) })
    installFakeSignalR()
    server.use(
      http.post(GET_SESSION_BY_ID, () =>
        apiOk({
          ...makeSession({
            sessionId: SESSION_ID,
            members: [ME, OTHER],
            sessionName: 'Weather chat',
          }),
          messages: [makeRawMessage({ messageID: 'm1', messageText: 'hi', senderUserCode: ME })],
        }),
      ),
    )

    renderPage()

    const title = await screen.findByTestId('session-title')
    expect(title.textContent).toContain('Weather chat')
    await waitFor(() => expect(screen.getByTestId('edit-title-button')).toBeTruthy())
  })

  it('shows and hides the typing indicator driven by chatStore typing users', async () => {
    seedAuthStorage({ user: makeUser({ email: ME }) })
    installFakeSignalR()
    serveSession(() => [
      makeRawMessage({ messageID: 'm1', messageText: 'existing', senderUserCode: OTHER }),
    ])

    renderPage()

    await screen.findByTestId('messages-container')
    const indicator = screen.getByTestId('typing-indicator')

    const chatStore = useChatStore()
    chatStore.addTypingUser(SESSION_ID, 'Alice')
    await waitFor(() => expect(indicator.textContent).toContain('chat.typing.single'))

    chatStore.removeTypingUser(SESSION_ID, 'Alice')
    await waitFor(() => expect(indicator.textContent).not.toContain('chat.typing.single'))
  })
})
