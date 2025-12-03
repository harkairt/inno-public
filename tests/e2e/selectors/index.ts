/**
 * Centralized selector registry for E2E tests
 * All selectors in one place for easy maintenance
 */

export const selectors = {
  auth: {
    emailInput: '#email',
    passwordInput: '#password',
    rememberCheckbox: '#remember',
    submitButton: { role: 'button' as const, name: /sign in/i },
    logoutButton: { role: 'button' as const, name: /logout/i },
    errorAlert: '[data-testid="login-error"]',
  },

  layout: {
    sidebar: '[data-testid="sidebar"]',
    sidebarToggle: '[data-testid="sidebar-toggle"]',
    sidebarCollapse: '[data-testid="sidebar-collapse"]',
  },

  chats: {
    // Landing page
    agentTile: (id: number) => `[data-testid="agent-tile-${id}"]`,
    agentTiles: '[data-testid^="agent-tile-"]',
    unreadCard: (sessionId: string) => `[data-testid="unread-card-${sessionId}"]`,
    unreadCards: '[data-testid^="unread-card-"]',

    // Session list in sidebar
    sessionList: '[data-testid="session-list"]',
    sessionItem: (sessionId: string) => `[data-testid="session-item-${sessionId}"]`,
    sessionSearch: '[data-testid="session-search"]',
  },

  chat: {
    // Message input area
    messageInput: '[data-testid="message-input"]',
    sendButton: '[data-testid="send-button"]',

    // Messages display
    messagesContainer: '[data-testid="messages-container"]',
    messageItem: (id: string) => `[data-testid="message-${id}"]`,
    messageItems: '[data-testid^="message-"]',

    // Typing indicator
    typingIndicator: '[data-testid="typing-indicator"]',

    // Session header
    sessionTitle: '[data-testid="session-title"]',
    sessionTitleInput: '[data-testid="session-title-input"]',
    editTitleButton: '[data-testid="edit-title-button"]',
  },

  users: {
    userList: '[data-testid="user-list"]',
    userCard: (id: number) => `[data-testid="user-card-${id}"]`,
    userCards: '[data-testid^="user-card-"]',
    userSearch: '[data-testid="user-search"]',
  },
}

// Role-based selectors for accessibility-first testing
export const roles = {
  button: (name: RegExp | string) => ({ role: 'button' as const, name }),
  link: (name: RegExp | string) => ({ role: 'link' as const, name }),
  textbox: (name?: RegExp | string) => name ? { role: 'textbox' as const, name } : { role: 'textbox' as const },
  heading: (name: RegExp | string, level?: 1 | 2 | 3 | 4 | 5 | 6) => level
    ? { role: 'heading' as const, name, level }
    : { role: 'heading' as const, name },
}
