import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/vue'
import type { Component } from 'vue'
import type { AISessionMessageDTO } from '@/types/api/schemas'
import { useFakeTimersSafe, advance, useRealTimers } from '@/tests/utils/timers'

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockUser = { email: 'user@test.com', name: 'Test User', id: 1 }

vi.mock('@/app/stores/auth', () => ({
  useAuthStore: vi.fn(() => ({ user: mockUser })),
}))

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

let msgCounter = 0

function makeMessage(
  overrides: Partial<AISessionMessageDTO & { status?: string }> = {},
): AISessionMessageDTO {
  msgCounter++
  return {
    messageID: `msg-${msgCounter}`,
    messageText: `Message ${msgCounter}`,
    messageType: 0,
    senderUserCode: 'partner@test.com',
    senderName: 'Partner',
    sendDate: new Date('2024-01-15T10:00:00Z').toISOString(),
    isRated: false,
    rating: null,
    readByUsers: [],
    sessionId: 'session-1',
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// Render helper
// ---------------------------------------------------------------------------

async function renderMessages(props: Record<string, unknown> = {}) {
  msgCounter = 0
  const { default: ChatMessages } = (await import('~/components/chat/ChatMessages.vue')) as {
    default: Component
  }

  return render(ChatMessages, {
    props: {
      skipEntranceAnimation: true,
      ...props,
    },
    global: {
      stubs: {
        MarkdownContent: {
          name: 'MarkdownContent',
          props: ['content'],
          template: '<div data-testid="markdown-content">{{ content }}</div>',
        },
        OptionsMessage: {
          name: 'OptionsMessage',
          props: ['payload', 'isActive', 'selectedAnswer'],
          template: '<div data-testid="options-message" />',
        },
        MessageRating: true,
        UEmpty: {
          name: 'UEmpty',
          props: ['title', 'description', 'icon'],
          template: '<div data-testid="empty-state">{{ title }}</div>',
        },
      },
    },
  })
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ChatMessages — container', () => {
  it('renders messages container', async () => {
    await renderMessages({ messages: [] })
    expect(screen.getByTestId('messages-container')).toBeTruthy()
  })

  it('has log role for screen readers', async () => {
    await renderMessages({ messages: [] })
    expect(screen.getByRole('log')).toBeTruthy()
  })
})

describe('ChatMessages — empty state', () => {
  it('shows empty state when no messages', async () => {
    await renderMessages({ messages: [] })
    expect(screen.getByTestId('empty-state')).toBeTruthy()
  })

  it('does not show empty state when messages exist', async () => {
    await renderMessages({ messages: [makeMessage()] })
    expect(screen.queryByTestId('empty-state')).toBeNull()
  })
})

describe('ChatMessages — message rendering', () => {
  it('renders message text content', async () => {
    const messages = [makeMessage({ messageText: 'Hello world' })]
    await renderMessages({ messages })
    expect(screen.getByText('Hello world')).toBeTruthy()
  })

  it('renders individual message wrapper with data-testid', async () => {
    const messages = [makeMessage({ messageID: 'abc-123', messageText: 'Test' })]
    await renderMessages({ messages })
    expect(screen.getByTestId('message-abc-123')).toBeTruthy()
  })

  it('renders multiple messages', async () => {
    const messages = [
      makeMessage({ messageText: 'First' }),
      makeMessage({ messageText: 'Second' }),
      makeMessage({ messageText: 'Third' }),
    ]
    await renderMessages({ messages })
    expect(screen.getByText('First')).toBeTruthy()
    expect(screen.getByText('Second')).toBeTruthy()
    expect(screen.getByText('Third')).toBeTruthy()
  })

  it('keeps the action-bar space but hides its controls for a pending message', async () => {
    const message = makeMessage({ messageID: 'pending-message' })
    await renderMessages({ messages: [message], pendingIds: new Set([message.messageID]) })

    const actionBar = screen.getByTestId('message-actions-pending-message')
    expect(actionBar.classList.contains('h-5')).toBe(true)
    expect(screen.queryByRole('button', { name: 'chat.messages.copyMessage' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'chat.focus.focusMessage' })).toBeNull()
  })
})

describe('ChatMessages — user vs partner alignment', () => {
  it('aligns own messages to the right', async () => {
    const messages = [makeMessage({ senderUserCode: 'user@test.com', messageID: 'own-msg' })]
    await renderMessages({ messages })
    const wrapper = screen.getByTestId('message-own-msg')
    expect(wrapper.classList.contains('justify-end')).toBe(true)
  })

  it('aligns partner messages to the left', async () => {
    const messages = [makeMessage({ senderUserCode: 'partner@test.com', messageID: 'partner-msg' })]
    await renderMessages({ messages })
    const wrapper = screen.getByTestId('message-partner-msg')
    expect(wrapper.classList.contains('justify-start')).toBe(true)
  })
})

describe('ChatMessages — sender name', () => {
  it('shows sender name for partner messages when memberCount > 2', async () => {
    const messages = [makeMessage({ senderUserCode: 'partner@test.com', senderName: 'Alice' })]
    await renderMessages({ messages, memberCount: 3 })
    expect(screen.getByText('Alice')).toBeTruthy()
  })

  it('hides sender name when memberCount <= 2 (1:1 chat)', async () => {
    const messages = [makeMessage({ senderUserCode: 'partner@test.com', senderName: 'Alice' })]
    await renderMessages({ messages, memberCount: 2 })
    expect(screen.queryByText('Alice')).toBeNull()
  })

  it('hides sender name for own messages even in group chat', async () => {
    const messages = [makeMessage({ senderUserCode: 'user@test.com', senderName: 'Me' })]
    await renderMessages({ messages, memberCount: 5 })
    expect(screen.queryByText('Me')).toBeNull()
  })

  it('hides sender names when hideSenderNames is true', async () => {
    const messages = [makeMessage({ senderUserCode: 'partner@test.com', senderName: 'Alice' })]
    await renderMessages({ messages, memberCount: 3, hideSenderNames: true })
    expect(screen.queryByText('Alice')).toBeNull()
  })
})

describe('ChatMessages — welcome message', () => {
  it('prepends welcome message when provided', async () => {
    const messages = [makeMessage({ messageText: 'Regular message' })]
    await renderMessages({ messages, welcomeMessage: 'Welcome! How can I help?' })
    expect(screen.getByText('Welcome! How can I help?')).toBeTruthy()
    expect(screen.getByText('Regular message')).toBeTruthy()
  })

  it('shows only welcome message when messages array is empty', async () => {
    await renderMessages({ messages: [], welcomeMessage: 'Hello there!' })
    expect(screen.getByText('Hello there!')).toBeTruthy()
    expect(screen.queryByTestId('empty-state')).toBeNull()
  })

  it('does not render welcome section when welcomeMessage is not provided', async () => {
    await renderMessages({ messages: [makeMessage({ messageText: 'Only message' })] })
    // Just 1 message rendered, no extra prepended entry
    const markdownContents = screen.getAllByTestId('markdown-content')
    expect(markdownContents).toHaveLength(1)
  })
})

describe('ChatMessages — entrance animation', () => {
  it('does not animate pre-existing messages when skipEntranceAnimation is true', async () => {
    // Arriving from /chats/new/* — messages already on screen must not replay.
    const messages = [makeMessage({ senderUserCode: 'partner@test.com', messageID: 'seeded' })]
    await renderMessages({ messages, skipEntranceAnimation: true })
    const wrapper = screen.getByTestId('message-seeded')
    expect(wrapper.classList.contains('message-enter-stagger')).toBe(false)
  })

  it('animates incoming messages on initial load when not skipping', async () => {
    const messages = [makeMessage({ senderUserCode: 'partner@test.com', messageID: 'incoming' })]
    await renderMessages({ messages, skipEntranceAnimation: false })
    const wrapper = screen.getByTestId('message-incoming')
    expect(wrapper.classList.contains('message-enter-stagger')).toBe(true)
    expect(wrapper.style.animationDelay).toBe('0ms')
  })

  it('animates own messages on initial load', async () => {
    // On mount, own messages stagger in with the rest so a revisited session's
    // history animates coherently regardless of sender.
    const messages = [makeMessage({ senderUserCode: 'user@test.com', messageID: 'mine' })]
    await renderMessages({ messages, skipEntranceAnimation: false })
    const wrapper = screen.getByTestId('message-mine')
    expect(wrapper.classList.contains('message-enter-stagger')).toBe(true)
  })

  it('does not animate an own message that arrives after mount', async () => {
    // Post-mount own messages appear instantly: the user acted, and their optimistic
    // temp id is later swapped for a server id, which would otherwise replay the entrance.
    const first = makeMessage({ senderUserCode: 'partner@test.com', messageID: 'first' })
    const { rerender } = await renderMessages({ messages: [first], skipEntranceAnimation: false })

    const mine = makeMessage({ senderUserCode: 'user@test.com', messageID: 'mine' })
    await rerender({ messages: [first, mine], skipEntranceAnimation: false })

    await waitFor(() => {
      expect(screen.getByTestId('message-mine')).toBeTruthy()
    })
    expect(screen.getByTestId('message-mine').classList.contains('message-enter-stagger')).toBe(
      false,
    )
  })

  it('animates an incoming reply that arrives after mount, but not the own message already there', async () => {
    // Regression: after navigating from /chats/new/* (skip=true), the AI reply must
    // still animate while the just-sent own message stays put.
    const own = makeMessage({ senderUserCode: 'user@test.com', messageID: 'mine' })
    const { rerender } = await renderMessages({ messages: [own], skipEntranceAnimation: true })

    const reply = makeMessage({ senderUserCode: 'partner@test.com', messageID: 'reply' })
    await rerender({ messages: [own, reply], skipEntranceAnimation: true })

    await waitFor(() => {
      expect(screen.getByTestId('message-reply').classList.contains('message-enter-stagger')).toBe(
        true,
      )
    })
    expect(screen.getByTestId('message-mine').classList.contains('message-enter-stagger')).toBe(
      false,
    )
  })

  it('retires the animation class after the animation completes', async () => {
    useFakeTimersSafe()
    try {
      const messages = [makeMessage({ senderUserCode: 'partner@test.com', messageID: 'incoming' })]
      await renderMessages({ messages, skipEntranceAnimation: false })
      expect(
        screen.getByTestId('message-incoming').classList.contains('message-enter-stagger'),
      ).toBe(true)

      await advance(8 * 50 + 300 + 100)

      await waitFor(() => {
        expect(
          screen.getByTestId('message-incoming').classList.contains('message-enter-stagger'),
        ).toBe(false)
      })
    } finally {
      useRealTimers()
    }
  })
})

describe('ChatMessages — date grouping', () => {
  it('shows date heading for message groups', async () => {
    const messages = [makeMessage({ sendDate: new Date('2024-01-15T10:00:00Z').toISOString() })]
    await renderMessages({ messages })
    // Date separator has role="heading"
    const headings = screen.getAllByRole('heading')
    expect(headings.length).toBeGreaterThan(0)
  })

  it('groups messages from the same day under one heading', async () => {
    const messages = [
      makeMessage({ sendDate: new Date('2024-01-15T09:00:00Z').toISOString() }),
      makeMessage({ sendDate: new Date('2024-01-15T11:00:00Z').toISOString() }),
    ]
    await renderMessages({ messages })
    const headings = screen.getAllByRole('heading')
    expect(headings).toHaveLength(1)
  })

  it('creates separate date groups for messages on different days', async () => {
    const messages = [
      makeMessage({ sendDate: new Date('2024-01-14T10:00:00Z').toISOString() }),
      makeMessage({ sendDate: new Date('2024-01-15T10:00:00Z').toISOString() }),
    ]
    await renderMessages({ messages })
    const headings = screen.getAllByRole('heading')
    expect(headings).toHaveLength(2)
  })
})
