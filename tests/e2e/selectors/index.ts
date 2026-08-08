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
    // Logout lives on the /profile page (icon-labelled UButton), not an inline
    // nav button — target it by test id.
    logoutButton: '[data-testid="profile-logout-button"]',
    errorAlert: '[data-testid="login-error"]',
  },

  // App shell (authenticated). Desktop renders AppRail + a ChatListPanel on
  // /chats; mobile renders AppBottomTabBar (no rail/panel). There is no
  // collapsible "sidebar" — the old sidebar/sidebar-toggle/sidebar-collapse
  // testids never existed in the app.
  layout: {
    appRail: '[data-testid="app-rail"]',
    bottomTabBar: '[data-testid="bottom-tab-bar"]',
    chatListPanel: '[data-testid="chat-list-panel"]',
  },

  chats: {
    // Landing page
    agentTile: (id: number) => `[data-testid="agent-tile-${id}"]`,
    agentTiles: '[data-testid^="agent-tile-"]',
    unreadCard: (sessionId: string) => `[data-testid="unread-card-${sessionId}"]`,
    unreadCards: '[data-testid^="unread-card-"]',

    // Session list (ChatListPanel)
    sessionList: '[data-testid="chat-list-panel"]',
    sessionItem: (sessionId: string) => `[data-testid="session-item-${sessionId}"]`,
    sessionItems: '[data-testid^="session-item-"]',
    sessionSearch: '[data-testid="session-search-input"]',
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
    // Dedicated /users page (not a sidebar accordion).
    usersPage: '[data-testid="users-page"]',
    userItem: (id: number) => `[data-testid="user-item-${id}"]`,
    userItems: '[data-testid^="user-item-"]',
    userSearch: '[data-testid="user-search-input"]',
    usersGrid: '[data-testid="users-grid"]',
    filter: (filter: 'all' | 'ai' | 'human' | 'favorites') =>
      `[data-testid="user-filter-${filter}"]`,
    favoriteButton: (id: number) => `[data-testid="favorite-user-${id}"]`,
    openConversationButton: (id: number) => `[data-testid="open-conversation-${id}"]`,
  },
}

// Role-based selectors for accessibility-first testing
export const roles = {
  button: (name: RegExp | string) => ({ role: 'button' as const, name }),
  link: (name: RegExp | string) => ({ role: 'link' as const, name }),
  textbox: (name?: RegExp | string) =>
    name ? { role: 'textbox' as const, name } : { role: 'textbox' as const },
  heading: (name: RegExp | string, level?: 1 | 2 | 3 | 4 | 5 | 6) =>
    level ? { role: 'heading' as const, name, level } : { role: 'heading' as const, name },
}
