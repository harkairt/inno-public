/**
 * AgentTile component tests.
 * Renders an agent card (name + assistant label + avatar). AgentTile declares
 * no emits — click handling lives in the parent — so this covers the render
 * contract and colorMode-driven avatar source.
 */
import { describe, it, expect, afterEach, vi } from 'vitest'
import { screen } from '@testing-library/vue'
import { ref, type Component } from 'vue'
import { renderWithProviders } from '@/tests/utils/render'
import { makeUser } from '@/tests/utils/factories'
import AgentTile from '~/components/chat/AgentTile.vue'

const stubs = {
  UCard: { name: 'UCard', inheritAttrs: false, template: '<div v-bind="$attrs"><slot /></div>' },
  UAvatar: {
    name: 'UAvatar',
    props: ['src', 'alt'],
    template: '<div data-testid="u-avatar" :data-src="src" :data-alt="alt" />',
  },
}

function renderTile(agent = makeUser({ name: 'Helper Bot' }), mode: 'light' | 'dark' = 'light') {
  vi.stubGlobal('useColorMode', () => ref(mode))
  return renderWithProviders(AgentTile as Component, {
    props: { agent },
    global: { stubs },
  })
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('AgentTile — rendering', () => {
  it('renders the agent name', () => {
    renderTile(makeUser({ name: 'Helper Bot' }))
    expect(screen.getByText('Helper Bot')).toBeTruthy()
  })

  it('renders the AI assistant label', () => {
    renderTile()
    expect(screen.getByText('emptyPage.aiAssistant')).toBeTruthy()
  })

  it('exposes a data-testid keyed by agent id', () => {
    const agent = makeUser({ id: 42, name: 'Helper Bot' })
    renderTile(agent)
    expect(screen.getByTestId('agent-tile-42')).toBeTruthy()
  })
})

describe('AgentTile — avatar source', () => {
  it('uses image in light mode', () => {
    renderTile(makeUser({ image: '/light.png', darkImage: '/dark.png' }), 'light')
    expect(screen.getByTestId('u-avatar').getAttribute('data-src')).toBe('/light.png')
  })

  it('uses darkImage in dark mode', () => {
    renderTile(makeUser({ image: '/light.png', darkImage: '/dark.png' }), 'dark')
    expect(screen.getByTestId('u-avatar').getAttribute('data-src')).toBe('/dark.png')
  })
})
