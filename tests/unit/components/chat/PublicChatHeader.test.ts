/**
 * PublicChatHeader — renders the public-mode agent header (avatar + name) and
 * routes to a fresh public chat for the configured agent.
 *
 * Real stores via renderWithProviders. The agent name/avatar come from props;
 * the "new chat" target comes from usePublicMode() → the REAL config store, so
 * we seed publicMode/publicAgent on that store after render and assert the
 * router push. useRouter is the global Nuxt stub — overridden with a stable push
 * spy so the call is observable.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen, fireEvent } from '@testing-library/vue'
import type { Component } from 'vue'
import { renderWithProviders } from '@/tests/utils/render'
import { useConfigStore } from '@/app/stores/config'
import { usePublicMode } from '@/app/composables/usePublicMode'

const pushSpy = vi.fn()

// usePublicMode is a Nuxt auto-import: PublicChatHeader references it as a bare
// global inside startNewChat (no import statement to intercept). Expose the REAL
// composable on globalThis so it reads the real config store seeded below.
;(global as unknown as { usePublicMode: typeof usePublicMode }).usePublicMode = usePublicMode

beforeEach(() => {
  pushSpy.mockReset()
  ;(global.useRouter as ReturnType<typeof vi.fn>).mockReturnValue({
    push: pushSpy,
    replace: vi.fn(),
    go: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
  })
})

const stubs = {
  UserAvatar: {
    name: 'UserAvatar',
    props: ['image', 'darkImage', 'alt', 'size'],
    template: '<div data-testid="user-avatar" :data-alt="alt" :data-image="image" />',
  },
  UButton: {
    name: 'UButton',
    props: ['icon'],
    template: '<button data-testid="new-chat-btn" @click="$emit(\'click\')"></button>',
  },
}

async function renderHeader(props: Record<string, unknown> = {}) {
  const { default: PublicChatHeader } =
    (await import('~/components/chat/PublicChatHeader.vue')) as { default: Component }

  return renderWithProviders(PublicChatHeader, {
    props: { agentId: 5, ...props },
    global: { stubs },
  })
}

describe('PublicChatHeader — rendering', () => {
  it('renders the agent name', async () => {
    await renderHeader({ agentName: 'InnoBot Agent' })
    expect(screen.getByText('InnoBot Agent')).toBeTruthy()
  })

  it('passes the agent image and name to the avatar', async () => {
    await renderHeader({ agentName: 'InnoBot Agent', agentImage: 'https://cdn/agent.png' })
    const avatar = screen.getByTestId('user-avatar')
    expect(avatar.getAttribute('data-alt')).toBe('InnoBot Agent')
    expect(avatar.getAttribute('data-image')).toBe('https://cdn/agent.png')
  })
})

describe('PublicChatHeader — new chat', () => {
  it('routes to a fresh public chat for the configured agent', async () => {
    await renderHeader({ agentName: 'InnoBot Agent' })
    // Seed the real config store for public mode (publicAgent drives the target).
    const configStore = useConfigStore()
    configStore.setConfig({ publicMode: 1, publicAgent: 5 })

    await fireEvent.click(screen.getByTestId('new-chat-btn'))
    expect(pushSpy).toHaveBeenCalledWith('/chats/public/new/5')
  })

  it('does not navigate when no public agent is configured', async () => {
    await renderHeader({ agentName: 'InnoBot Agent' })
    const configStore = useConfigStore()
    configStore.setConfig({ publicMode: 1, publicAgent: -1 })

    await fireEvent.click(screen.getByTestId('new-chat-btn'))
    expect(pushSpy).not.toHaveBeenCalled()
  })
})
