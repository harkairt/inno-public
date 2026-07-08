/**
 * chats/public/new/[agentId].vue page tests + public layout coverage.
 *
 * The PAGE owns public-agent validation: an agent id that doesn't match the
 * configured public agent redirects to the canonical public-chat URL; the -1
 * sentinel (no agent configured) yields no redirect target and is handled
 * gracefully. Public mode is driven through the REAL config store (seeded after
 * render, per the PublicChatHeader test pattern — renderWithProviders owns the
 * active Pinia, so seeding earlier would be lost).
 *
 * The public HEADER, the "no nav rail" property, and the publicAuthError error
 * state are NOT the page's concern — they live in app/layouts/public.vue, which
 * renderWithProviders does not wrap around a page component. They are therefore
 * covered here by rendering that layout directly.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { screen, waitFor } from '@testing-library/vue'
import type { Component } from 'vue'
import { ref } from 'vue'
import { renderWithProviders } from '@/tests/utils/render'
import { makeUser } from '@/tests/utils/factories'
import { seedAuthStorage } from '@/tests/utils/authSeed'
import { useConfigStore } from '@/app/stores/config'
import PublicNewChatPage from '@/app/pages/chats/public/new/[agentId].vue'
import PublicLayout from '@/app/layouts/public.vue'
import ChatMessages from '@/app/components/chat/ChatMessages.vue'

const ME = 'me@example.com'
const AGENT_ID = 5

const stubs = {
  MessageInput: { template: '<div data-testid="message-input-stub" />' },
  TypingIndicator: { template: '<div data-testid="typing-indicator-stub" />' },
  MarkdownContent: { props: ['content'], template: '<div class="markdown">{{ content }}</div>' },
  MessageRating: { template: '<div />' },
  OptionsMessage: { template: '<div />' },
  UIcon: { template: '<i />' },
}

function seedPublicConfig(agent: number) {
  const configStore = useConfigStore()
  configStore.setConfig({ publicMode: 1, publicAgent: agent })
  return configStore
}

function renderPage() {
  return renderWithProviders(PublicNewChatPage as Component, {
    global: { stubs, components: { ChatMessages } },
  })
}

beforeEach(() => {
  vi.stubGlobal('useSeoMeta', vi.fn())
  vi.mocked(global.navigateTo).mockClear()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('chats/public/new/[agentId] page — agent validation', () => {
  function stubRoute(agentId: number) {
    vi.mocked(global.useRoute).mockReturnValue({
      params: { agentId: String(agentId) },
      query: {},
      path: `/chats/public/new/${agentId}`,
      fullPath: `/chats/public/new/${agentId}`,
      name: 'chats-public-new-agentId',
    } as never)
  }

  it('renders the chat surface for the valid configured agent (no redirect)', async () => {
    seedAuthStorage({ mode: 'sessionStorage', user: makeUser({ email: ME }) })
    stubRoute(AGENT_ID)

    renderPage()
    seedPublicConfig(AGENT_ID)

    expect(await screen.findByTestId('messages-container')).toBeTruthy()
    // The valid agent matches config → no redirect to the canonical URL.
    expect(vi.mocked(global.navigateTo)).not.toHaveBeenCalledWith(
      `/chats/public/new/${AGENT_ID}`,
      expect.anything(),
    )
  })

  it('redirects an agent id that does not match the configured public agent', async () => {
    seedAuthStorage({ mode: 'sessionStorage', user: makeUser({ email: ME }) })
    stubRoute(99)

    renderPage()
    // Configured agent is 5; the route asked for 99 → redirect to the canonical URL.
    seedPublicConfig(AGENT_ID)

    await waitFor(() =>
      expect(vi.mocked(global.navigateTo)).toHaveBeenCalledWith(`/chats/public/new/${AGENT_ID}`, {
        replace: true,
      }),
    )
  })

  it('handles the -1 sentinel (no agent configured) without redirecting', async () => {
    seedAuthStorage({ mode: 'sessionStorage', user: makeUser({ email: ME }) })
    stubRoute(-1)

    renderPage()
    // publicAgent === -1 → isValidPublicAgent is always false AND getPublicChatUrl
    // returns null, so there is no target to redirect to: handled, no navigation.
    seedPublicConfig(-1)

    await waitFor(() => expect(screen.getByTestId('messages-container')).toBeTruthy())
    expect(vi.mocked(global.navigateTo)).not.toHaveBeenCalled()
  })
})

describe('public layout — header / error / no nav rail', () => {
  const layoutStubs = {
    PublicChatHeader: {
      props: ['agentName', 'agentId', 'agentImage', 'agentDarkImage'],
      template: '<header data-testid="public-chat-header">{{ agentName }}</header>',
    },
  }

  beforeEach(() => {
    // The layout calls useI18n().setLocale — the global stub omits it.
    vi.stubGlobal(
      'useI18n',
      vi.fn(() => ({ t: (k: string) => k, locale: ref('hu'), setLocale: vi.fn() })),
    )
  })

  function renderLayout() {
    return renderWithProviders(PublicLayout as Component, {
      slots: { default: '<main data-testid="layout-slot">page</main>' },
      global: { stubs: layoutStubs },
    })
  }

  it('renders the public chat header and content (no nav rail) once loaded', async () => {
    seedAuthStorage({ mode: 'sessionStorage', user: makeUser({ email: ME }) })

    renderLayout()
    const configStore = seedPublicConfig(AGENT_ID)
    configStore.isLoaded = true

    // startPublicChat (MSW) resolves an agent → header renders.
    expect(await screen.findByTestId('public-chat-header')).toBeTruthy()
    expect(screen.getByTestId('layout-slot')).toBeTruthy()
    // The public layout never mounts the authenticated nav rail / bottom tab bar.
    expect(screen.queryByTestId('app-rail')).toBeNull()
    expect(screen.queryByTestId('app-bottom-tab-bar')).toBeNull()
  })

  it('renders the public-mode error state when publicAuthError is set', async () => {
    seedAuthStorage({ mode: 'sessionStorage', user: makeUser({ email: ME }) })

    renderLayout()
    const configStore = seedPublicConfig(AGENT_ID)
    configStore.isLoaded = true
    configStore.setPublicAuthError(true)

    await waitFor(() => expect(screen.getByText('public.authError.title')).toBeTruthy())
    // Error state replaces the normal content: no header, no slot.
    expect(screen.queryByTestId('public-chat-header')).toBeNull()
    expect(screen.queryByTestId('layout-slot')).toBeNull()
  })
})
