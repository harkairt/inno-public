import { describe, it, expect, beforeEach } from 'vitest'
import type { Mock } from 'vitest'
import { render, screen, type RenderResult } from '@testing-library/vue'
import type { Component } from 'vue'
import { useAuthStore } from '@/app/stores/auth'

function setRoute(path: string) {
  ;(global.useRoute as Mock).mockReturnValue({
    path,
    fullPath: path,
    params: {},
    query: {},
  })
}

const stubs = {
  NuxtLink: {
    name: 'NuxtLink',
    props: ['to'],
    template: '<a :href="to"><slot /></a>',
  },
  UIcon: { name: 'UIcon', props: ['name'], template: '<i :data-icon="name" />' },
  UserAvatar: {
    name: 'UserAvatar',
    props: ['image', 'darkImage', 'alt'],
    template: '<span data-testid="tab-avatar" :data-image="image"><slot /></span>',
  },
}

async function renderBar(): Promise<RenderResult> {
  const { default: AppBottomTabBar } =
    (await import('~/components/navigation/AppBottomTabBar.vue')) as { default: Component }
  return render(AppBottomTabBar, { global: { stubs } })
}

beforeEach(() => {
  setRoute('/chats')
  useAuthStore().$patch({ user: { name: 'Unknown User' } as never })
})

describe('AppBottomTabBar', () => {
  it('renders the three responsive destinations', async () => {
    await renderBar()

    expect(screen.getByTestId('bottom-tab-bar')).toBeTruthy()
    expect(screen.getByTestId('tab-chats').getAttribute('href')).toBe('/chats')
    expect(screen.getByTestId('tab-users').getAttribute('href')).toBe('/users')
    expect(screen.getByTestId('tab-profile').getAttribute('href')).toBe('/profile')
  })

  it('uses the reference icons and avatar profile control without an unread badge', async () => {
    await renderBar()

    expect(
      screen.getByTestId('tab-chats').querySelector('[data-icon]')?.getAttribute('data-icon'),
    ).toBe('i-ph-chats-fill')
    expect(
      screen.getByTestId('tab-users').querySelector('[data-icon]')?.getAttribute('data-icon'),
    ).toBe('i-ph-users-three')
    expect(screen.getByTestId('tab-avatar').textContent).toContain('U')
    expect(screen.getByTestId('tab-chats').textContent).not.toContain('navigation.conversations')
    expect(screen.queryByTestId('tab-badge')).toBeNull()
  })

  it('marks the active route for conversations and profile', async () => {
    setRoute('/chats/abc-123')
    const chatsRender = await renderBar()
    expect(screen.getByTestId('tab-chats').getAttribute('aria-current')).toBe('page')
    expect(screen.getByTestId('tab-profile').getAttribute('aria-current')).toBeNull()
    expect(screen.getByTestId('tab-chats').className).toContain('text-[#16201f]')
    expect(screen.getByTestId('tab-chats').querySelector('[data-icon]')?.className).toContain(
      'text-[#0e5c5c]',
    )
    chatsRender.unmount()

    setRoute('/profile')
    await renderBar()
    expect(screen.getByTestId('tab-profile').getAttribute('aria-current')).toBe('page')
    expect(screen.getByTestId('tab-chats').getAttribute('aria-current')).toBeNull()
    expect(screen.getByTestId('tab-avatar').className).toContain('border-[#0e5c5c]')
  })
})
