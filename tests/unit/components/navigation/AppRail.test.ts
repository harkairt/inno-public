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
  UTooltip: { name: 'UTooltip', template: '<div><slot /></div>' },
  NuxtLink: {
    name: 'NuxtLink',
    props: ['to'],
    template: '<a :href="to"><slot /></a>',
  },
  UIcon: { name: 'UIcon', props: ['name'], template: '<i :data-icon="name" />' },
  UserAvatar: {
    name: 'UserAvatar',
    props: ['image', 'darkImage', 'alt'],
    template: '<span data-testid="rail-avatar" :data-image="image"><slot /></span>',
  },
}

async function renderRail(): Promise<RenderResult> {
  const { default: AppRail } = (await import('~/components/navigation/AppRail.vue')) as {
    default: Component
  }
  return render(AppRail, { global: { stubs } })
}

beforeEach(() => {
  setRoute('/chats')
  useAuthStore().$patch({ user: { name: 'Unknown User' } as never })
})

describe('AppRail', () => {
  it('renders a static logo, the two primary destinations, and a profile avatar link', async () => {
    await renderRail()

    expect(screen.getByTestId('app-rail')).toBeTruthy()
    expect(screen.getByTestId('app-rail').className).toContain('w-[74px]')
    expect(screen.getByTestId('rail-logo').tagName).toBe('DIV')
    expect(screen.queryByRole('button', { name: 'InnoChat' })).toBeNull()
    expect(screen.getByTestId('rail-chats').getAttribute('href')).toBe('/chats')
    expect(screen.getByTestId('rail-users').getAttribute('href')).toBe('/users')
    expect(screen.getByTestId('rail-profile').getAttribute('href')).toBe('/profile')
  })

  it('uses the reference icon set and does not render an unread badge', async () => {
    await renderRail()

    expect(
      screen.getByTestId('rail-chats').querySelector('[data-icon]')?.getAttribute('data-icon'),
    ).toBe('i-ph-chats-fill')
    expect(
      screen.getByTestId('rail-users').querySelector('[data-icon]')?.getAttribute('data-icon'),
    ).toBe('i-ph-users-three')
    expect(screen.queryByTestId('rail-badge')).toBeNull()
  })

  it('marks the matching route active', async () => {
    setRoute('/chats/abc-123')
    const chatsRender = await renderRail()
    expect(screen.getByTestId('rail-chats').getAttribute('aria-current')).toBe('page')
    expect(screen.getByTestId('rail-users').getAttribute('aria-current')).toBeNull()
    expect(screen.getByTestId('rail-chats').className).toContain('bg-[#f0efea]')
    expect(screen.getByTestId('rail-chats').querySelector('[data-icon]')?.className).toContain(
      'text-[#0e5c5c]',
    )
    expect(screen.getByTestId('rail-users').className).toContain('hover:bg-[#f0efea]')
    chatsRender.unmount()

    setRoute('/profile')
    await renderRail()
    expect(screen.getByTestId('rail-profile').getAttribute('aria-current')).toBe('page')
    expect(screen.getByTestId('rail-avatar').className).toContain('border-[#0e5c5c]')
  })

  it('provides an initials fallback when no avatar image is available', async () => {
    await renderRail()

    const avatar = screen.getByTestId('rail-avatar')
    expect(avatar.getAttribute('data-image')).toBeNull()
    expect(avatar.textContent).toContain('U')
  })
})
