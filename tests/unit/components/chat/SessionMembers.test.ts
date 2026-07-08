/**
 * SessionMembers component tests.
 * Maps member emails → UserDTOs, shows up to 3 avatars (with initials fallback)
 * and a "+N" overflow. No emits — this covers the render/mapping contract.
 */
import { describe, it, expect } from 'vitest'
import { screen } from '@testing-library/vue'
import type { Component } from 'vue'
import { renderWithProviders } from '@/tests/utils/render'
import { makeUser } from '@/tests/utils/factories'
import SessionMembers from '~/components/chat/SessionMembers.vue'

const stubs = {
  UserAvatar: {
    name: 'UserAvatar',
    props: ['image', 'darkImage', 'alt', 'size'],
    template: '<div data-testid="member-avatar" :data-alt="alt"><slot /></div>',
  },
}

function renderMembers(props: Record<string, unknown>) {
  return renderWithProviders(SessionMembers as Component, {
    props,
    global: { stubs },
  })
}

const users = [
  makeUser({ email: 'alice@x.com', name: 'Alice Smith' }),
  makeUser({ email: 'bob@x.com', name: 'Bob Jones' }),
  makeUser({ email: 'carol@x.com', name: 'Carol King' }),
  makeUser({ email: 'dave@x.com', name: 'Dave Lee' }),
  makeUser({ email: 'erin@x.com', name: 'Erin May' }),
]

describe('SessionMembers — rendering', () => {
  it('renders one avatar per matched member (<= 3)', () => {
    renderMembers({ members: ['alice@x.com', 'bob@x.com'], selectableUsers: users })
    expect(screen.getAllByTestId('member-avatar')).toHaveLength(2)
    expect(screen.queryByText(/^\+/)).toBeNull()
  })

  it('shows initials in the avatar slot', () => {
    renderMembers({ members: ['alice@x.com'], selectableUsers: users })
    expect(screen.getByTestId('member-avatar').textContent).toContain('AS')
  })

  it('caps avatars at 3 and shows a +N overflow', () => {
    renderMembers({
      members: ['alice@x.com', 'bob@x.com', 'carol@x.com', 'dave@x.com', 'erin@x.com'],
      selectableUsers: users,
    })
    expect(screen.getAllByTestId('member-avatar')).toHaveLength(3)
    expect(screen.getByText('+2')).toBeTruthy()
  })

  it('drops members that are not in selectableUsers', () => {
    renderMembers({
      members: ['alice@x.com', 'unknown@x.com', 'bob@x.com'],
      selectableUsers: users,
    })
    // unknown@x.com is within the first 3 but has no matching UserDTO → filtered out.
    expect(screen.getAllByTestId('member-avatar')).toHaveLength(2)
  })
})
