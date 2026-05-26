import { describe, it, expect, vi, beforeEach } from 'vitest'
import { chatService } from '@/lib/api/services/ChatService'
import { apiClient } from '@/lib/api/client'
import { AIAnswerType } from '@/types/enums'
import { makeApiResponse, makeAxiosError } from '@/tests/utils/factories'

vi.mock('@/lib/api/client', () => ({
  apiClient: {
    post: vi.fn(),
    get: vi.fn(),
  },
}))

vi.mock('@/lib/errors/normalize', () => ({
  normalizeApiError: vi.fn((error: unknown) => error),
}))

// ---------------------------------------------------------------------------
// Shared test fixtures
// ---------------------------------------------------------------------------

const mockQuestion = {
  userCode: 'testuser',
  sessionId: 'session-1',
  agentId: 1,
  members: ['testuser'],
  question: 'What is the answer?',
  group: 'default',
  pquestionType: 0,
  options: [],
}

const mockRawMessage = {
  messageID: 'msg-1',
  messageText: 'AI response',
  messageType: 'text',
  isRated: false,
  rating: null,
  readByUsers: null,
  sendDate: '2024-01-01T00:00:00Z',
  senderName: 'AI',
  senderUserCode: 'ai',
  sessionId: 'session-1',
  dataTable: null,
  options: null,
}

const mockRawSession = {
  sessionId: 'session-1',
  sessionName: 'Test Session',
  agentId: 1,
  agentImage: null,
  agentDarkImage: null,
  insertDate: '2024-01-01T00:00:00Z',
  members: ['testuser'],
  memberDetails: null,
  userCode: 'testuser',
}

// ---------------------------------------------------------------------------
// sendQuestion
// ---------------------------------------------------------------------------

describe('ChatService.sendQuestion', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns parsed AISessionMessageDTO on success', async () => {
    vi.mocked(apiClient.post).mockResolvedValue(makeApiResponse(mockRawMessage))

    const result = await chatService.sendQuestion(mockQuestion)

    expect(result.isOk()).toBe(true)
    if (result.isOk()) {
      expect(result.value.messageID).toBe('msg-1')
      expect(result.value.messageType).toBe(AIAnswerType.Text)
    }
  })

  it('returns EMPTY_RESPONSE error when data is null', async () => {
    vi.mocked(apiClient.post).mockResolvedValue(makeApiResponse(null))

    const result = await chatService.sendQuestion(mockQuestion)

    expect(result.isErr()).toBe(true)
  })

  it('returns error on network failure', async () => {
    vi.mocked(apiClient.post).mockRejectedValue(makeAxiosError(500))

    const result = await chatService.sendQuestion(mockQuestion)

    expect(result.isErr()).toBe(true)
  })

  it('returns VALIDATION_ERROR when response shape is invalid', async () => {
    vi.mocked(apiClient.post).mockResolvedValue(makeApiResponse({ invalid: true }))

    const result = await chatService.sendQuestion(mockQuestion)

    expect(result.isErr()).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// getWelcomeMessage
// ---------------------------------------------------------------------------

describe('ChatService.getWelcomeMessage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns welcome message on success', async () => {
    vi.mocked(apiClient.post).mockResolvedValue(makeApiResponse({ message: 'Welcome!' }))

    const result = await chatService.getWelcomeMessage(mockQuestion)

    expect(result.isOk()).toBe(true)
    if (result.isOk()) {
      expect(result.value.message).toBe('Welcome!')
    }
  })

  it('returns error when data is null', async () => {
    vi.mocked(apiClient.post).mockResolvedValue(makeApiResponse(null))

    const result = await chatService.getWelcomeMessage(mockQuestion)

    expect(result.isErr()).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// getSessionHeaders
// ---------------------------------------------------------------------------

describe('ChatService.getSessionHeaders', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns array of session headers on success', async () => {
    vi.mocked(apiClient.post).mockResolvedValue(makeApiResponse([mockRawSession]))

    const result = await chatService.getSessionHeaders({
      userCode: 'testuser',
      agents: [1],
      filterText: '',
    })

    expect(result.isOk()).toBe(true)
    if (result.isOk()) {
      expect(result.value).toHaveLength(1)
      expect(result.value[0]?.sessionId).toBe('session-1')
    }
  })

  it('returns empty array when no sessions', async () => {
    vi.mocked(apiClient.post).mockResolvedValue(makeApiResponse(null))

    const result = await chatService.getSessionHeaders({
      userCode: 'testuser',
      agents: [1],
      filterText: '',
    })

    expect(result.isOk()).toBe(true)
    if (result.isOk()) {
      expect(result.value).toHaveLength(0)
    }
  })

  it('returns VALIDATION_ERROR when session header shape is invalid', async () => {
    vi.mocked(apiClient.post).mockResolvedValue(makeApiResponse([{ badField: true }]))

    const result = await chatService.getSessionHeaders({
      userCode: 'testuser',
      agents: [1],
      filterText: '',
    })

    expect(result.isErr()).toBe(true)
  })

  it('returns error on network failure', async () => {
    vi.mocked(apiClient.post).mockRejectedValue(makeAxiosError(500))

    const result = await chatService.getSessionHeaders({
      userCode: 'testuser',
      agents: [1],
      filterText: '',
    })

    expect(result.isErr()).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// getSessionById
// ---------------------------------------------------------------------------

describe('ChatService.getSessionById', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns full session on success', async () => {
    const fullSession = { ...mockRawSession, messages: [mockRawMessage] }
    vi.mocked(apiClient.post).mockResolvedValue(makeApiResponse(fullSession))

    const result = await chatService.getSessionById('session-1')

    expect(result.isOk()).toBe(true)
    if (result.isOk()) {
      expect(result.value.sessionId).toBe('session-1')
    }
  })

  it('returns NOT_FOUND when data is null', async () => {
    vi.mocked(apiClient.post).mockResolvedValue(makeApiResponse(null))

    const result = await chatService.getSessionById('session-1')

    expect(result.isErr()).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// updateSessionName
// ---------------------------------------------------------------------------

describe('ChatService.updateSessionName', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns MutationSuccess on success', async () => {
    vi.mocked(apiClient.post).mockResolvedValue(
      makeApiResponse(JSON.stringify({ message: 'kész.' })),
    )

    const result = await chatService.updateSessionName({
      sessionId: 'session-1',
      sessionName: 'New Name',
      agentId: 1,
    })

    expect(result.isOk()).toBe(true)
    if (result.isOk()) {
      expect(result.value).toBe(true)
    }
  })

  it('returns error on network failure', async () => {
    vi.mocked(apiClient.post).mockRejectedValue(makeAxiosError(500))

    const result = await chatService.updateSessionName({
      sessionId: 'session-1',
      sessionName: 'New Name',
      agentId: 1,
    })

    expect(result.isErr()).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// deleteSession
// ---------------------------------------------------------------------------

describe('ChatService.deleteSession', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns MutationSuccess on success', async () => {
    vi.mocked(apiClient.post).mockResolvedValue(
      makeApiResponse(JSON.stringify({ message: 'kész.' })),
    )

    const result = await chatService.deleteSession({ sessionId: 'session-1', agentId: 1 })

    expect(result.isOk()).toBe(true)
    expect(result.isOk() && result.value).toBe(true)
  })

  it('returns error on network failure', async () => {
    vi.mocked(apiClient.post).mockRejectedValue(makeAxiosError(500))

    const result = await chatService.deleteSession({ sessionId: 'session-1', agentId: 1 })

    expect(result.isErr()).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// rateMessage
// ---------------------------------------------------------------------------

describe('ChatService.rateMessage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns void on success', async () => {
    vi.mocked(apiClient.post).mockResolvedValue({})

    const result = await chatService.rateMessage({
      sessionId: 'session-1',
      messageId: 'msg-1',
      agentId: 1,
      rating: 1,
    })

    expect(result.isOk()).toBe(true)
  })

  it('returns error on failure', async () => {
    vi.mocked(apiClient.post).mockRejectedValue(makeAxiosError(500))

    const result = await chatService.rateMessage({
      sessionId: 'session-1',
      messageId: 'msg-1',
      agentId: 1,
      rating: -1,
    })

    expect(result.isErr()).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// markMessagesRead
// ---------------------------------------------------------------------------

describe('ChatService.markMessagesRead', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns void on success', async () => {
    vi.mocked(apiClient.post).mockResolvedValue({})

    const result = await chatService.markMessagesRead('session-1', 1, 'testuser')

    expect(result.isOk()).toBe(true)
    expect(apiClient.post).toHaveBeenCalledWith('/api/AIWebAPI/Set_SessionMessagesRead', {
      sessionID: 'session-1',
      agent: 1,
      userCode: 'testuser',
    })
  })
})

// ---------------------------------------------------------------------------
// getUnreadMessages
// ---------------------------------------------------------------------------

describe('ChatService.getUnreadMessages', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns unread message counts on success', async () => {
    vi.mocked(apiClient.post).mockResolvedValue(
      makeApiResponse([{ sessionId: 'session-1', unreadMessageCount: 3 }]),
    )

    const result = await chatService.getUnreadMessages({ userCode: 'testuser' })

    expect(result.isOk()).toBe(true)
    if (result.isOk()) {
      expect(result.value[0]?.unreadMessageCount).toBe(3)
    }
  })

  it('returns empty array when no unread messages', async () => {
    vi.mocked(apiClient.post).mockResolvedValue(makeApiResponse(null))

    const result = await chatService.getUnreadMessages({ userCode: 'testuser' })

    expect(result.isOk()).toBe(true)
    if (result.isOk()) {
      expect(result.value).toHaveLength(0)
    }
  })
})

// ---------------------------------------------------------------------------
// getSessionUnreadMessages
// ---------------------------------------------------------------------------

describe('ChatService.getSessionUnreadMessages', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns count on success', async () => {
    vi.mocked(apiClient.post).mockResolvedValue(makeApiResponse(5))

    const result = await chatService.getSessionUnreadMessages({
      sessionId: 'session-1',
      agentId: 1,
    })

    expect(result.isOk()).toBe(true)
    if (result.isOk()) {
      expect(result.value).toBe(5)
    }
  })

  it('returns error when response is null', async () => {
    vi.mocked(apiClient.post).mockResolvedValue(makeApiResponse(null))

    const result = await chatService.getSessionUnreadMessages({
      sessionId: 'session-1',
      agentId: 1,
    })

    expect(result.isErr()).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// getMessage
// ---------------------------------------------------------------------------

describe('ChatService.getMessage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns parsed message on success', async () => {
    vi.mocked(apiClient.post).mockResolvedValue(makeApiResponse(mockRawMessage))

    const result = await chatService.getMessage({
      messageId: 'msg-1',
      sessionId: 'session-1',
      agentId: 1,
    })

    expect(result.isOk()).toBe(true)
    if (result.isOk()) {
      expect(result.value.messageID).toBe('msg-1')
    }
  })

  it('returns NOT_FOUND when data is null', async () => {
    vi.mocked(apiClient.post).mockResolvedValue(makeApiResponse(null))

    const result = await chatService.getMessage({
      messageId: 'msg-1',
      sessionId: 'session-1',
      agentId: 1,
    })

    expect(result.isErr()).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// addUserToSession / removeUserFromSession
// ---------------------------------------------------------------------------

describe('ChatService.addUserToSession', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns void on success', async () => {
    vi.mocked(apiClient.post).mockResolvedValue({})

    const result = await chatService.addUserToSession({
      sessionId: 'session-1',
      userCode: 'newuser',
      agentId: 1,
    })

    expect(result.isOk()).toBe(true)
  })
})

describe('ChatService.removeUserFromSession', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns void on success', async () => {
    vi.mocked(apiClient.post).mockResolvedValue({})

    const result = await chatService.removeUserFromSession({
      sessionId: 'session-1',
      userCode: 'removeduser',
      agentId: 1,
    })

    expect(result.isOk()).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// startPublicChat
// ---------------------------------------------------------------------------

describe('ChatService.startPublicChat', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns AIPublicChatStartDTO on success', async () => {
    vi.mocked(apiClient.post).mockResolvedValue(makeApiResponse({ user: null, agent: null }))

    const result = await chatService.startPublicChat({ agentId: 1 })

    expect(result.isOk()).toBe(true)
  })

  it('returns error when data is null', async () => {
    vi.mocked(apiClient.post).mockResolvedValue(makeApiResponse(null))

    const result = await chatService.startPublicChat({ agentId: 1 })

    expect(result.isErr()).toBe(true)
  })
})
