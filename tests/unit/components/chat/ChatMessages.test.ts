import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/vue'
import type { Component } from 'vue'
import type { AISessionMessageDTO } from '@/types/api/schemas'

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
  beforeEach(() => {
    vi.clearAllMocks()
  })

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
  beforeEach(() => {
    vi.clearAllMocks()
  })

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
  beforeEach(() => {
    vi.clearAllMocks()
  })

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
})

describe('ChatMessages — user vs partner alignment', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

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
  beforeEach(() => {
    vi.clearAllMocks()
  })

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
  beforeEach(() => {
    vi.clearAllMocks()
  })

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

describe('ChatMessages — date grouping', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

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
