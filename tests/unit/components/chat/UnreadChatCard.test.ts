/**
 * UnreadChatCard component tests.
 * Renders session name, unread-count badge, member avatars (SessionMembers) and
 * a relative timestamp. No emits — this covers the render contract.
 */
import { describe, it, expect, afterEach, vi } from 'vitest'
import { screen } from '@testing-library/vue'
import { ref, type Component } from 'vue'
import { renderWithProviders } from '@/tests/utils/render'
import { makeSession, makeUser } from '@/tests/utils/factories'
import type { AISessionHeaderDTO } from '@/types/api/schemas'
import UnreadChatCard from '~/components/chat/UnreadChatCard.vue'

const stubs = {
  UCard: { name: 'UCard', inheritAttrs: false, template: '<div v-bind="$attrs"><slot /></div>' },
  UBadge: { name: 'UBadge', template: '<span data-testid="badge"><slot /></span>' },
  SessionMembers: {
    name: 'SessionMembers',
    props: ['members', 'selectableUsers'],
    template: '<div data-testid="session-members" />',
  },
}

function makeUnreadSession(overrides: Partial<AISessionHeaderDTO> = {}, unreadCount = 3) {
  return { ...makeSession(overrides), unreadCount }
}

function renderCard(session = makeUnreadSession(), selectableUsers = [makeUser()]) {
  // UnreadChatCard → useRelativeDate → useI18n (global stub). colorMode stubbed
  // defensively in case the SessionMembers stub does not intercept.
  vi.stubGlobal('useColorMode', () => ref('light'))
  return renderWithProviders(UnreadChatCard as Component, {
    props: { session, selectableUsers },
    global: { stubs },
  })
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('UnreadChatCard — rendering', () => {
  it('renders the session name', () => {
    renderCard(makeUnreadSession({ sessionName: 'Support thread' }))
    expect(screen.getByText('Support thread')).toBeTruthy()
  })

  it('renders the unread count badge', () => {
    renderCard(makeUnreadSession({}, 5))
    expect(screen.getByTestId('badge').textContent).toContain('5')
  })

  it('renders the member avatars via SessionMembers', () => {
    renderCard()
    expect(screen.getByTestId('session-members')).toBeTruthy()
  })

  it('renders a relative timestamp', () => {
    renderCard(makeUnreadSession({ insertDate: new Date().toISOString() }))
    expect(screen.getByText('time.justNow')).toBeTruthy()
  })

  it('exposes a data-testid keyed by session id', () => {
    renderCard(makeUnreadSession({ sessionId: 'sess-xyz' }))
    expect(screen.getByTestId('unread-card-sess-xyz')).toBeTruthy()
  })
})
