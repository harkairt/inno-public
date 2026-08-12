import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { screen } from '@testing-library/vue'
import type { Component } from 'vue'
import { renderWithProviders } from '@/tests/utils/render'

import ChatsIndexPage from '@/app/pages/chats/index.vue'

beforeEach(() => {
  vi.stubGlobal('useSeoMeta', vi.fn())
})

afterEach(() => {
  vi.unstubAllGlobals()
})

const stubs = {
  ChatListPanel: { template: '<div data-testid="chat-list-panel-stub" />' },
  UIcon: {
    props: ['name'],
    template: '<i :data-icon="name" data-testid="centered-icon" />',
  },
}

function renderPage() {
  return renderWithProviders(ChatsIndexPage as Component, { global: { stubs } })
}

describe('chats/index page (desktop)', () => {
  it('renders the centered chats icon', () => {
    renderPage()

    const icon = screen.getByTestId('centered-icon')
    expect(icon.dataset.icon).toBe('i-ph-chats')
  })
})
