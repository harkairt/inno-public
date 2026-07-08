/**
 * TypingIndicator component tests.
 * Typing text is driven by the REAL chat store (useChatStore) — the store
 * produces the typingUsers[] the component renders. The animated-dots interval
 * is exercised with fake timers.
 */
import { describe, it, expect, afterEach } from 'vitest'
import { screen } from '@testing-library/vue'
import type { Component } from 'vue'
import { renderWithProviders } from '@/tests/utils/render'
import { useChatStore } from '@/app/stores/chat'
import { useFakeTimersSafe, advance, useRealTimers } from '@/tests/utils/timers'
import TypingIndicator from '~/components/chat/TypingIndicator.vue'

const SESSION = 'session-1'

/** Seed the real chat store with typing users and return the resulting array. */
function seedTyping(users: string[]): string[] {
  const chatStore = useChatStore()
  users.forEach((u) => chatStore.addTypingUser(SESSION, u))
  return chatStore.getTypingUsers(SESSION)
}

function render(typingUsers: string[]) {
  return renderWithProviders(TypingIndicator as Component, { props: { typingUsers } })
}

afterEach(() => {
  useRealTimers()
})

describe('TypingIndicator — visibility', () => {
  it('hides text when there are no typing users', () => {
    render(seedTyping([]))
    // Container always present, but no typing text span is rendered.
    expect(screen.getByTestId('typing-indicator')).toBeTruthy()
    expect(screen.queryByText(/chat\.typing/)).toBeNull()
  })

  it('shows single-user typing text', () => {
    render(seedTyping(['Alice']))
    expect(screen.getByText(/chat\.typing\.single/)).toBeTruthy()
  })

  it('shows double-user typing text', () => {
    render(seedTyping(['Alice', 'Bob']))
    expect(screen.getByText(/chat\.typing\.double/)).toBeTruthy()
  })

  it('shows multiple-user typing text for 3+ users', () => {
    render(seedTyping(['Alice', 'Bob', 'Carol']))
    expect(screen.getByText(/chat\.typing\.multiple/)).toBeTruthy()
  })
})

describe('TypingIndicator — animated dots timer', () => {
  const BASE = 'chat.typing.single'
  const dots = (el: Element) => (el.textContent ?? '').replace(BASE, '')

  it('cycles the trailing dots every 500ms', async () => {
    useFakeTimersSafe()
    render(seedTyping(['Alice']))

    const el = screen.getByTestId('typing-indicator')
    expect(dots(el).length).toBe(1)

    await advance(500)
    expect(dots(el).length).toBe(2)

    await advance(500)
    expect(dots(el).length).toBe(3)

    await advance(500)
    expect(dots(el).length).toBe(1)
  })
})
