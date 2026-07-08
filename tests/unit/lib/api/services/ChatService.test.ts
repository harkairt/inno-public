import { describe, it, expect } from 'vitest'
import { server, http } from '@/tests/msw/server'
import { apiOk, apiError, mutationOk } from '@/tests/msw/http'
import { chatService } from '@/lib/api/services/ChatService'
import { makeSession, makeRawMessage } from '@/tests/utils/factories'
import { AIAnswerType } from '@/types/enums'

// MSW at the network boundary — no apiClient mock. Zod validation now really runs
// (a wrong response shape fails the test) and a wrong path trips onUnhandledRequest.

const P = {
  question: '/api/AIWebAPI/question/text',
  welcome: '/api/AIWebAPI/welcomeText',
  headers: '/api/AIWebAPI/GetSessionHeadersByUserId',
  byId: '/api/AIWebAPI/GetSessionById',
  setName: '/api/AIWebAPI/SetSessionName',
  del: '/api/AIWebAPI/DeleteSessionById',
  rate: '/api/AIWebAPI/SetSessionMessageRating',
  read: '/api/AIWebAPI/Set_SessionMessagesRead',
  unread: '/api/AIWebAPI/GetUnreadMessages',
  sessionUnread: '/api/AIWebAPI/GetSessionUnreadMessages',
  getMessage: '/api/AIWebAPI/getMessage',
  addUser: '/api/AIWebAPI/addUserToSession',
  removeUser: '/api/AIWebAPI/removeUserFromSession',
  startPublic: '/api/AIWebAPI/startPublicChat',
} as const

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

// ---------------------------------------------------------------------------
// sendQuestion
// ---------------------------------------------------------------------------

describe('ChatService.sendQuestion', () => {
  it('returns parsed AISessionMessageDTO on success', async () => {
    let capturedBody: unknown
    server.use(
      http.post(P.question, async ({ request }) => {
        capturedBody = await request.json()
        return apiOk(makeRawMessage({ messageID: 'msg-1', messageType: 'text' }))
      }),
    )

    const result = await chatService.sendQuestion(mockQuestion)

    expect(result.isOk()).toBe(true)
    if (result.isOk()) {
      expect(result.value.messageID).toBe('msg-1')
      expect(result.value.messageType).toBe(AIAnswerType.Text)
    }
    expect(capturedBody).toMatchObject({ sessionId: 'session-1', question: 'What is the answer?' })
  })

  it('returns EMPTY_RESPONSE error when data is null', async () => {
    server.use(http.post(P.question, () => apiOk(null)))

    const result = await chatService.sendQuestion(mockQuestion)

    expect(result.isErr()).toBe(true)
  })

  it('returns an error on network failure', async () => {
    server.use(http.post(P.question, () => apiError(500)))

    const result = await chatService.sendQuestion(mockQuestion)

    expect(result.isErr()).toBe(true)
  })

  it('returns VALIDATION_ERROR when response shape is invalid', async () => {
    server.use(http.post(P.question, () => apiOk({ invalid: true })))

    const result = await chatService.sendQuestion(mockQuestion)

    expect(result.isErr()).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// getWelcomeMessage
// ---------------------------------------------------------------------------

describe('ChatService.getWelcomeMessage', () => {
  it('returns welcome message on success', async () => {
    server.use(http.post(P.welcome, () => apiOk({ message: 'Welcome!' })))

    const result = await chatService.getWelcomeMessage(mockQuestion)

    expect(result.isOk()).toBe(true)
    if (result.isOk()) expect(result.value.message).toBe('Welcome!')
  })

  it('returns error when data is null', async () => {
    server.use(http.post(P.welcome, () => apiOk(null)))

    const result = await chatService.getWelcomeMessage(mockQuestion)

    expect(result.isErr()).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// getSessionHeaders
// ---------------------------------------------------------------------------

describe('ChatService.getSessionHeaders', () => {
  const request = { userCode: 'testuser', agents: [1], filterText: '' }

  it('returns array of session headers on success', async () => {
    server.use(http.post(P.headers, () => apiOk([makeSession({ sessionId: 'session-1' })])))

    const result = await chatService.getSessionHeaders(request)

    expect(result.isOk()).toBe(true)
    if (result.isOk()) {
      expect(result.value).toHaveLength(1)
      expect(result.value[0]?.sessionId).toBe('session-1')
    }
  })

  it('returns empty array when no sessions', async () => {
    server.use(http.post(P.headers, () => apiOk(null)))

    const result = await chatService.getSessionHeaders(request)

    expect(result.isOk()).toBe(true)
    if (result.isOk()) expect(result.value).toHaveLength(0)
  })

  it('returns VALIDATION_ERROR when a session header shape is invalid', async () => {
    server.use(http.post(P.headers, () => apiOk([{ badField: true }])))

    const result = await chatService.getSessionHeaders(request)

    expect(result.isErr()).toBe(true)
  })

  it('returns an error on network failure', async () => {
    server.use(http.post(P.headers, () => apiError(500)))

    const result = await chatService.getSessionHeaders(request)

    expect(result.isErr()).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// getSessionById
// ---------------------------------------------------------------------------

describe('ChatService.getSessionById', () => {
  it('returns full session on success', async () => {
    server.use(
      http.post(P.byId, () =>
        apiOk({ ...makeSession({ sessionId: 'session-1' }), messages: [makeRawMessage()] }),
      ),
    )

    const result = await chatService.getSessionById('session-1')

    expect(result.isOk()).toBe(true)
    if (result.isOk()) expect(result.value.sessionId).toBe('session-1')
  })

  it('returns NOT_FOUND when data is null', async () => {
    server.use(http.post(P.byId, () => apiOk(null)))

    const result = await chatService.getSessionById('session-1')

    expect(result.isErr()).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// updateSessionName / deleteSession (mutation-success contract)
// ---------------------------------------------------------------------------

describe('ChatService.updateSessionName', () => {
  it('returns MutationSuccess on success', async () => {
    server.use(http.post(P.setName, () => mutationOk()))

    const result = await chatService.updateSessionName({
      sessionId: 'session-1',
      sessionName: 'New Name',
      agentId: 1,
    })

    expect(result.isOk()).toBe(true)
    if (result.isOk()) expect(result.value).toBe(true)
  })

  it('returns an error on network failure', async () => {
    server.use(http.post(P.setName, () => apiError(500)))

    const result = await chatService.updateSessionName({
      sessionId: 'session-1',
      sessionName: 'New Name',
      agentId: 1,
    })

    expect(result.isErr()).toBe(true)
  })
})

describe('ChatService.deleteSession', () => {
  it('returns MutationSuccess on success', async () => {
    server.use(http.post(P.del, () => mutationOk()))

    const result = await chatService.deleteSession({ sessionId: 'session-1', agentId: 1 })

    expect(result.isOk()).toBe(true)
    expect(result.isOk() && result.value).toBe(true)
  })

  it('returns an error on network failure', async () => {
    server.use(http.post(P.del, () => apiError(500)))

    const result = await chatService.deleteSession({ sessionId: 'session-1', agentId: 1 })

    expect(result.isErr()).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// rateMessage
// ---------------------------------------------------------------------------

describe('ChatService.rateMessage', () => {
  it('returns void on success', async () => {
    server.use(http.post(P.rate, () => apiOk(null)))

    const result = await chatService.rateMessage({
      sessionId: 'session-1',
      messageId: 'msg-1',
      agentId: 1,
      rating: 1,
    })

    expect(result.isOk()).toBe(true)
  })

  it('returns an error on failure', async () => {
    server.use(http.post(P.rate, () => apiError(500)))

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
// markMessagesRead (request-shape via handler spy)
// ---------------------------------------------------------------------------

describe('ChatService.markMessagesRead', () => {
  it('posts the mapped body shape and returns void on success', async () => {
    let capturedBody: unknown
    server.use(
      http.post(P.read, async ({ request }) => {
        capturedBody = await request.json()
        return apiOk(null)
      }),
    )

    const result = await chatService.markMessagesRead('session-1', 1, 'testuser')

    expect(result.isOk()).toBe(true)
    expect(capturedBody).toEqual({ sessionID: 'session-1', agent: 1, userCode: 'testuser' })
  })
})

// ---------------------------------------------------------------------------
// getUnreadMessages
// ---------------------------------------------------------------------------

describe('ChatService.getUnreadMessages', () => {
  it('returns unread message counts on success', async () => {
    server.use(
      http.post(P.unread, () => apiOk([{ sessionId: 'session-1', unreadMessageCount: 3 }])),
    )

    const result = await chatService.getUnreadMessages({ userCode: 'testuser' })

    expect(result.isOk()).toBe(true)
    if (result.isOk()) expect(result.value[0]?.unreadMessageCount).toBe(3)
  })

  it('returns empty array when no unread messages', async () => {
    server.use(http.post(P.unread, () => apiOk(null)))

    const result = await chatService.getUnreadMessages({ userCode: 'testuser' })

    expect(result.isOk()).toBe(true)
    if (result.isOk()) expect(result.value).toHaveLength(0)
  })
})

// ---------------------------------------------------------------------------
// getSessionUnreadMessages
// ---------------------------------------------------------------------------

describe('ChatService.getSessionUnreadMessages', () => {
  it('returns count on success', async () => {
    server.use(http.post(P.sessionUnread, () => apiOk(5)))

    const result = await chatService.getSessionUnreadMessages({
      sessionId: 'session-1',
      agentId: 1,
    })

    expect(result.isOk()).toBe(true)
    if (result.isOk()) expect(result.value).toBe(5)
  })

  it('returns error when response is null', async () => {
    server.use(http.post(P.sessionUnread, () => apiOk(null)))

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
  it('returns parsed message on success', async () => {
    server.use(http.post(P.getMessage, () => apiOk(makeRawMessage({ messageID: 'msg-1' }))))

    const result = await chatService.getMessage({
      messageId: 'msg-1',
      sessionId: 'session-1',
      agentId: 1,
    })

    expect(result.isOk()).toBe(true)
    if (result.isOk()) expect(result.value.messageID).toBe('msg-1')
  })

  it('returns NOT_FOUND when data is null', async () => {
    server.use(http.post(P.getMessage, () => apiOk(null)))

    const result = await chatService.getMessage({
      messageId: 'msg-1',
      sessionId: 'session-1',
      agentId: 1,
    })

    expect(result.isErr()).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// addUserToSession / removeUserFromSession / reactToMessage
// ---------------------------------------------------------------------------

describe('ChatService.addUserToSession', () => {
  it('returns void on success', async () => {
    server.use(http.post(P.addUser, () => apiOk(null)))

    const result = await chatService.addUserToSession({
      sessionId: 'session-1',
      userCode: 'newuser',
      agentId: 1,
    })

    expect(result.isOk()).toBe(true)
  })
})

describe('ChatService.removeUserFromSession', () => {
  it('returns void on success', async () => {
    server.use(http.post(P.removeUser, () => apiOk(null)))

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
  it('returns AIPublicChatStartDTO on success', async () => {
    server.use(http.post(P.startPublic, () => apiOk({ user: null, agent: null })))

    const result = await chatService.startPublicChat({ agentId: 1 })

    expect(result.isOk()).toBe(true)
  })

  it('returns error when data is null', async () => {
    server.use(http.post(P.startPublic, () => apiOk(null)))

    const result = await chatService.startPublicChat({ agentId: 1 })

    expect(result.isErr()).toBe(true)
  })
})
