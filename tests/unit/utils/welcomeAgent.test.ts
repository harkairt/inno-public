import { describe, it, expect } from 'vitest'
import { resolveWelcomeAgent } from '@/app/utils/welcomeAgent'
import { makeUser, makeMessage } from '@/tests/utils/factories'

describe('resolveWelcomeAgent', () => {
  const human = makeUser({ email: 'human@example.com', isVirtual: false })
  const agent = makeUser({ id: 42, name: 'Aida', email: 'agent@example.com', isVirtual: true })
  const members = [human.email, agent.email]
  const selectableUsers = [human, agent]

  it('resolves the agent for a 2-member session with exactly one virtual agent', () => {
    const result = resolveWelcomeAgent(members, selectableUsers, [], '2024-01-01T00:00:00Z')
    expect(result).toEqual({
      agentId: 42,
      agentName: 'Aida',
      firstMessageDate: '2024-01-01T00:00:00Z',
    })
  })

  it('yields the same agent whether messages are empty (placeholder) or a full server thread', () => {
    // Regression guard: the authoritative GetSessionById payload used to blank the welcome
    // because it swapped agentId/sender codes. Member-based resolution must be stable.
    const insertDate = '2024-01-01T00:00:00Z'
    const placeholder = resolveWelcomeAgent(members, selectableUsers, [], insertDate)

    const serverThread = [
      makeMessage({ senderUserCode: human.email, sendDate: '2024-01-02T10:00:00Z' }),
      makeMessage({ senderUserCode: agent.email, sendDate: '2024-01-02T10:00:01Z' }),
    ]
    const authoritative = resolveWelcomeAgent(members, selectableUsers, serverThread, insertDate)

    // Agent identity is identical across the cache replacement...
    expect(authoritative?.agentId).toBe(placeholder?.agentId)
    expect(authoritative?.agentName).toBe(placeholder?.agentName)
    // ...both non-null, so the welcome stays prepended in both cache states.
    expect(placeholder).not.toBeNull()
    expect(authoritative).not.toBeNull()
  })

  it('uses the first message sendDate when messages exist, else falls back to insertDate', () => {
    const withMessages = resolveWelcomeAgent(
      members,
      selectableUsers,
      [makeMessage({ sendDate: '2024-05-05T12:00:00Z' })],
      '2024-01-01T00:00:00Z',
    )
    expect(withMessages?.firstMessageDate).toBe('2024-05-05T12:00:00Z')

    const noMessages = resolveWelcomeAgent(members, selectableUsers, [], '2024-01-01T00:00:00Z')
    expect(noMessages?.firstMessageDate).toBe('2024-01-01T00:00:00Z')
  })

  it('returns null for a 1:1 chat of two humans (no virtual agent)', () => {
    const otherHuman = makeUser({ email: 'other@example.com', isVirtual: false })
    const result = resolveWelcomeAgent(
      [human.email, otherHuman.email],
      [human, otherHuman],
      [],
      '2024-01-01T00:00:00Z',
    )
    expect(result).toBeNull()
  })

  it('returns null for a 3-member group even with a virtual agent', () => {
    const otherHuman = makeUser({ email: 'other@example.com', isVirtual: false })
    const result = resolveWelcomeAgent(
      [human.email, otherHuman.email, agent.email],
      [human, otherHuman, agent],
      [],
      '2024-01-01T00:00:00Z',
    )
    expect(result).toBeNull()
  })

  it('returns null when the virtual member is absent from selectableUsers', () => {
    const result = resolveWelcomeAgent(members, [human], [], '2024-01-01T00:00:00Z')
    expect(result).toBeNull()
  })

  it('returns null when members or selectableUsers are undefined', () => {
    expect(resolveWelcomeAgent(undefined, selectableUsers, [], undefined)).toBeNull()
    expect(resolveWelcomeAgent(members, undefined, [], undefined)).toBeNull()
  })
})
