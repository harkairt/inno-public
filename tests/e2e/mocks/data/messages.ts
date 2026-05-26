/**
 * Mock message data for E2E tests
 * Data matches Zod AISessionMessageDTO schema
 */

// Type definition (matches schema from types/api/schemas.ts)
interface AISessionMessageDTO {
  isRated: boolean
  messageID: string
  messageText: string | null
  messageType: number
  rating: number | null
  readByUsers: string[] | null
  sendDate: string
  senderName: string
  senderUserCode: string
  sessionId: string
  dataTable?: { columns: string[]; rows: unknown[][] } | null
  options?: Array<{ column: string; orginalValue: string; selectedValue: string }> | null
}

// Message type enum values (matches AIAnswerType)
export const MessageType = {
  Text: 0,
  Command: 1,
  DataTable: 2,
  Options: 3,
  URL: 4,
  Question: 5,
  ErrorText: 6,
  ServerTask: 7,
  Empty: 8,
} as const

// Message status for optimistic updates (client-side only)
export const MessageStatus = {
  PENDING: 'PENDING',
  SENT: 'SENT',
  FAILED: 'FAILED',
} as const

export const mockMessages = {
  // Simple text message from user
  userText: {
    isRated: false,
    messageID: 'msg-user-001',
    messageText: 'Hello AI!',
    messageType: MessageType.Text,
    rating: null,
    readByUsers: [],
    sendDate: new Date().toISOString(),
    senderName: 'Test User',
    senderUserCode: 'test@example.com',
    sessionId: 'session-123',
    dataTable: null,
    options: null,
  } satisfies AISessionMessageDTO,

  // Simple text message from agent
  agentText: {
    isRated: false,
    messageID: 'msg-agent-001',
    messageText: 'Hello! How can I help you today?',
    messageType: MessageType.Text,
    rating: null,
    readByUsers: ['test@example.com'],
    sendDate: new Date().toISOString(),
    senderName: 'AI Assistant',
    senderUserCode: 'ai@virtual.agent',
    sessionId: 'session-123',
    dataTable: null,
    options: null,
  } satisfies AISessionMessageDTO,

  // Message with options
  withOptions: {
    isRated: false,
    messageID: 'msg-options-001',
    messageText: 'Please select an option:',
    messageType: MessageType.Options,
    rating: null,
    readByUsers: [],
    sendDate: new Date().toISOString(),
    senderName: 'AI Assistant',
    senderUserCode: 'ai@virtual.agent',
    sessionId: 'session-123',
    dataTable: null,
    options: [
      { column: 'choice', orginalValue: 'Option A', selectedValue: '' },
      { column: 'choice', orginalValue: 'Option B', selectedValue: '' },
      { column: 'choice', orginalValue: 'Option C', selectedValue: '' },
    ],
  } satisfies AISessionMessageDTO,

  // Message with data table
  withDataTable: {
    isRated: false,
    messageID: 'msg-table-001',
    messageText: 'Here is the data:',
    messageType: MessageType.DataTable,
    rating: null,
    readByUsers: [],
    sendDate: new Date().toISOString(),
    senderName: 'AI Assistant',
    senderUserCode: 'ai@virtual.agent',
    sessionId: 'session-123',
    dataTable: {
      columns: ['Name', 'Value', 'Status'],
      rows: [
        ['Item 1', '100', 'Active'],
        ['Item 2', '200', 'Pending'],
      ],
    },
    options: null,
  } satisfies AISessionMessageDTO,

  // Rated message
  rated: {
    isRated: true,
    messageID: 'msg-rated-001',
    messageText: 'This was a helpful response.',
    messageType: MessageType.Text,
    rating: 1, // positive rating
    readByUsers: ['test@example.com'],
    sendDate: new Date().toISOString(),
    senderName: 'AI Assistant',
    senderUserCode: 'ai@virtual.agent',
    sessionId: 'session-123',
    dataTable: null,
    options: null,
  } satisfies AISessionMessageDTO,
}

// Helper to create a user message
export function createUserMessage(text: string, sessionId = 'session-123'): AISessionMessageDTO {
  return {
    isRated: false,
    messageID: `msg-${Date.now()}`,
    messageText: text,
    messageType: MessageType.Text,
    rating: null,
    readByUsers: [],
    sendDate: new Date().toISOString(),
    senderName: 'Test User',
    senderUserCode: 'test@example.com',
    sessionId,
    dataTable: null,
    options: null,
  }
}

// Helper to create an agent message
export function createAgentMessage(text: string, sessionId = 'session-123'): AISessionMessageDTO {
  return {
    isRated: false,
    messageID: `msg-${Date.now()}`,
    messageText: text,
    messageType: MessageType.Text,
    rating: null,
    readByUsers: [],
    sendDate: new Date().toISOString(),
    senderName: 'AI Assistant',
    senderUserCode: 'ai@virtual.agent',
    sessionId,
    dataTable: null,
    options: null,
  }
}

// Helper to create a custom message
export function createMockMessage(overrides: Partial<AISessionMessageDTO>): AISessionMessageDTO {
  return {
    ...mockMessages.userText,
    messageID: `msg-${Date.now()}`,
    sendDate: new Date().toISOString(),
    ...overrides,
  }
}

// Conversation thread for tests
export const mockConversation: AISessionMessageDTO[] = [
  {
    ...mockMessages.userText,
    messageID: 'conv-001',
    messageText: 'Hello, can you help me?',
    sendDate: '2024-01-15T10:30:00Z',
  },
  {
    ...mockMessages.agentText,
    messageID: 'conv-002',
    messageText: 'Of course! What do you need help with?',
    sendDate: '2024-01-15T10:30:30Z',
  },
  {
    ...mockMessages.userText,
    messageID: 'conv-003',
    messageText: 'I need help with coding.',
    sendDate: '2024-01-15T10:31:00Z',
  },
  {
    ...mockMessages.agentText,
    messageID: 'conv-004',
    messageText:
      "I'd be happy to help with coding! What programming language are you working with?",
    sendDate: '2024-01-15T10:31:30Z',
  },
]
