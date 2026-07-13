/**
 * Unit tests for usePrimarySession — pure selection logic over session/user
 * permutations. No I/O, so this is a straight reactive-computed unit test with
 * plain refs; no mounting needed.
 */
import { describe, it, expect } from 'vitest'
import { ref } from 'vue'
import {
  usePrimarySession,
  getPrimarySessionForUser,
  getSessionDisplayName,
  checkIsPrimarySession,
} from '@/app/composables/usePrimarySession'
import type { AISessionHeaderDTO, UserDTO } from '@/types/api/schemas'
import { makeSession, makeUser } from '@/tests/utils/factories'

const ME = 'me@example.com'
const OTHER = 'other@example.com'

function twoMemberSession(overrides: Partial<AISessionHeaderDTO> = {}): AISessionHeaderDTO {
  return makeSession({ members: [ME, OTHER], memberDetails: null, ...overrides })
}

const realOther: UserDTO = makeUser({ email: OTHER, name: 'Other Person', isVirtual: false })

describe('usePrimarySession (reactive)', () => {
  it('flags the oldest 2-member session between two real users as primary', () => {
    const older = twoMemberSession({ sessionId: 's-old', insertDate: '2024-01-01T00:00:00Z' })
    const newer = twoMemberSession({ sessionId: 's-new', insertDate: '2024-02-01T00:00:00Z' })

    const { isPrimarySession } = usePrimarySession(
      ref(older),
      ref([older, newer]),
      ref([realOther]),
      ref(ME),
    )

    expect(isPrimarySession.value).toBe(true)
  })

  it('does not flag the newer session as primary', () => {
    const older = twoMemberSession({ sessionId: 's-old', insertDate: '2024-01-01T00:00:00Z' })
    const newer = twoMemberSession({ sessionId: 's-new', insertDate: '2024-02-01T00:00:00Z' })

    const { isPrimarySession } = usePrimarySession(
      ref(newer),
      ref([older, newer]),
      ref([realOther]),
      ref(ME),
    )

    expect(isPrimarySession.value).toBe(false)
  })

  it('is false when the other member is virtual', () => {
    const session = twoMemberSession()
    const virtualOther = makeUser({ email: OTHER, isVirtual: true })

    const { isPrimarySession } = usePrimarySession(
      ref(session),
      ref([session]),
      ref([virtualOther]),
      ref(ME),
    )

    expect(isPrimarySession.value).toBe(false)
  })

  it('uses memberDetails.isVirtual over the users array when present', () => {
    const session = twoMemberSession({
      memberDetails: [
        { email: ME, name: 'Me', isVirtual: false },
        { email: OTHER, name: 'Other', isVirtual: true },
      ],
    })

    const { isPrimarySession } = usePrimarySession(
      ref(session),
      ref([session]),
      ref([realOther]), // users says real, but memberDetails says virtual → virtual wins
      ref(ME),
    )

    expect(isPrimarySession.value).toBe(false)
  })

  it('is primary when memberDetails marks the other member as real', () => {
    const session = twoMemberSession({
      memberDetails: [
        { email: ME, name: 'Me', isVirtual: false },
        { email: OTHER, name: 'Other', isVirtual: false },
      ],
    })

    const { isPrimarySession } = usePrimarySession(
      ref(session),
      ref([session]),
      ref([]), // no users array entry — memberDetails carries the real-user signal
      ref(ME),
    )

    expect(isPrimarySession.value).toBe(true)
  })

  it('prefers the memberDetails name over the users-array name', () => {
    const session = twoMemberSession({
      memberDetails: [
        { email: ME, name: 'Me', isVirtual: false },
        { email: OTHER, name: 'Detail Name', isVirtual: false },
      ],
    })
    const other = makeUser({ id: 7, email: OTHER, name: 'Array Name' })

    const { otherMemberName, otherMemberId } = usePrimarySession(
      ref(session),
      ref([session]),
      ref([other]),
      ref(ME),
    )

    expect(otherMemberName.value).toBe('Detail Name')
    expect(otherMemberId.value).toBe(7)
  })

  it('is false when the current user is not a member of the session', () => {
    const session = makeSession({ members: ['a@example.com', OTHER], memberDetails: null })

    const { isPrimarySession } = usePrimarySession(
      ref(session),
      ref([session]),
      ref([realOther]),
      ref(ME),
    )

    expect(isPrimarySession.value).toBe(false)
  })

  it('is false for sessions that do not have exactly two members', () => {
    const session = makeSession({ members: [ME, OTHER, 'third@example.com'] })

    const { isPrimarySession } = usePrimarySession(
      ref(session),
      ref([session]),
      ref([realOther]),
      ref(ME),
    )

    expect(isPrimarySession.value).toBe(false)
  })

  it('is false when no session exists between the two users', () => {
    const session = twoMemberSession({ sessionId: 's-target' })
    const unrelated = makeSession({
      members: ['x@example.com', 'y@example.com'],
      memberDetails: null,
    })

    const { isPrimarySession } = usePrimarySession(
      ref(session),
      ref([unrelated]), // allSessions has nothing between ME and OTHER
      ref([realOther]),
      ref(ME),
    )

    expect(isPrimarySession.value).toBe(false)
  })

  it('is false when required inputs are missing', () => {
    const session = twoMemberSession()
    const { isPrimarySession } = usePrimarySession(
      ref(session),
      ref(undefined),
      ref([realOther]),
      ref(ME),
    )
    expect(isPrimarySession.value).toBe(false)
  })

  it('exposes the other member name and id', () => {
    const session = twoMemberSession()
    const other = makeUser({ id: 99, email: OTHER, name: 'Other Person' })

    const { otherMemberName, otherMemberId } = usePrimarySession(
      ref(session),
      ref([session]),
      ref([other]),
      ref(ME),
    )

    expect(otherMemberName.value).toBe('Other Person')
    expect(otherMemberId.value).toBe(99)
  })

  it('falls back to the email when no name is known', () => {
    const session = twoMemberSession()
    const { otherMemberName } = usePrimarySession(ref(session), ref([session]), ref([]), ref(ME))
    expect(otherMemberName.value).toBe(OTHER)
  })

  it('treats an unknown other member (absent from users) as non-real → not primary', () => {
    // 2-member ME↔OTHER, memberDetails null, and OTHER missing from selectableUsers:
    // the users.find lookup returns undefined, so the other member is not a real user.
    const session = twoMemberSession()
    const { isPrimarySession } = usePrimarySession(ref(session), ref([session]), ref([]), ref(ME))
    expect(isPrimarySession.value).toBe(false)
  })

  it('picks the oldest 2-member pair out of a mixed session list', () => {
    const target = twoMemberSession({ sessionId: 's-target', insertDate: '2024-03-01T00:00:00Z' })
    const olderThreeMember = makeSession({
      sessionId: 's-3',
      members: [ME, OTHER, 'x@example.com'],
      memberDetails: null,
      insertDate: '2024-01-01T00:00:00Z',
    })
    const olderMeThird = makeSession({
      sessionId: 's-me-third',
      members: [ME, 'third@example.com'],
      memberDetails: null,
      insertDate: '2024-01-01T00:00:00Z',
    })
    const olderThirdOther = makeSession({
      sessionId: 's-third-other',
      members: ['third@example.com', OTHER],
      memberDetails: null,
      insertDate: '2024-01-01T00:00:00Z',
    })
    const olderUnrelated = makeSession({
      sessionId: 's-unrelated',
      members: ['a@example.com', 'b@example.com'],
      memberDetails: null,
      insertDate: '2024-01-01T00:00:00Z',
    })

    const { isPrimarySession } = usePrimarySession(
      ref(target),
      ref([olderThreeMember, olderMeThird, olderThirdOther, olderUnrelated, target]),
      ref([realOther]),
      ref(ME),
    )

    // Only `target` is a 2-member ME↔OTHER session; the older 3-member and
    // half-matching ones are filtered out, so target is the oldest qualifying pair.
    expect(isPrimarySession.value).toBe(true)
  })

  it('selects the oldest pair even when allSessions is ordered newest-first', () => {
    const older = twoMemberSession({ sessionId: 's-old', insertDate: '2024-01-01T00:00:00Z' })
    const newer = twoMemberSession({ sessionId: 's-new', insertDate: '2024-02-01T00:00:00Z' })
    const allNewestFirst = ref([newer, older])

    expect(
      usePrimarySession(ref(older), allNewestFirst, ref([realOther]), ref(ME)).isPrimarySession
        .value,
    ).toBe(true)
    expect(
      usePrimarySession(ref(newer), allNewestFirst, ref([realOther]), ref(ME)).isPrimarySession
        .value,
    ).toBe(false)
  })

  it('exposes no other-member info for a 3-member session', () => {
    const session = makeSession({ members: [ME, OTHER, 'third@example.com'], memberDetails: null })
    const { otherMemberName, otherMemberId } = usePrimarySession(
      ref(session),
      ref([session]),
      ref([realOther]),
      ref(ME),
    )
    expect(otherMemberName.value).toBe('')
    expect(otherMemberId.value).toBeUndefined()
  })

  it('resolves the other member by email match, not array position', () => {
    const session = twoMemberSession()
    const unrelated = makeUser({ id: 1, email: 'nobody@example.com', name: 'Nobody' })
    const matching = makeUser({ id: 42, email: OTHER, name: 'Matched Name' })
    const { otherMemberName, otherMemberId } = usePrimarySession(
      ref(session),
      ref([session]),
      ref([unrelated, matching]),
      ref(ME),
    )
    expect(otherMemberName.value).toBe('Matched Name')
    expect(otherMemberId.value).toBe(42)
  })

  it('returns empty other-member info when the session is null', () => {
    const { otherMemberName, otherMemberId } = usePrimarySession(
      ref(null),
      ref([]),
      ref([realOther]),
      ref(ME),
    )
    expect(otherMemberName.value).toBe('')
    expect(otherMemberId.value).toBeUndefined()
  })

  it('returns empty other-member name when selectableUsers is undefined', () => {
    const session = twoMemberSession()
    const { otherMemberName } = usePrimarySession(
      ref(session),
      ref([session]),
      ref(undefined),
      ref(ME),
    )
    expect(otherMemberName.value).toBe('')
  })

  it('returns empty other-member name when the current user email is empty', () => {
    const session = twoMemberSession()
    const meUser = makeUser({ email: ME, name: 'Me Myself' })
    const { otherMemberName } = usePrimarySession(
      ref(session),
      ref([session]),
      ref([meUser, realOther]),
      ref(''),
    )
    // Without a current-user email the guard returns null; dropping it would pick
    // ME as the "other" member and surface 'Me Myself'.
    expect(otherMemberName.value).toBe('')
  })
})

describe('getPrimarySessionForUser', () => {
  it('returns the oldest session between the current user and the target', () => {
    const target = makeUser({ id: 5, email: OTHER, isVirtual: false })
    const older = twoMemberSession({ sessionId: 's-old', insertDate: '2024-01-01T00:00:00Z' })
    const newer = twoMemberSession({ sessionId: 's-new', insertDate: '2024-03-01T00:00:00Z' })

    const result = getPrimarySessionForUser(5, ME, [newer, older], [target])
    expect(result?.sessionId).toBe('s-old')
  })

  it('returns null for a virtual target user', () => {
    const target = makeUser({ id: 5, email: OTHER, isVirtual: true })
    const session = twoMemberSession()
    expect(getPrimarySessionForUser(5, ME, [session], [target])).toBeNull()
  })

  it('returns null when no session exists between the two users', () => {
    const target = makeUser({ id: 5, email: OTHER })
    expect(getPrimarySessionForUser(5, ME, [], [target])).toBeNull()
  })

  it('returns null without a current user email', () => {
    const target = makeUser({ id: 5, email: OTHER })
    const session = twoMemberSession()
    expect(getPrimarySessionForUser(5, '', [session], [target])).toBeNull()
  })

  it('returns null for an unknown target user id', () => {
    const target = makeUser({ id: 5, email: OTHER })
    const session = twoMemberSession()
    expect(getPrimarySessionForUser(999, ME, [session], [target])).toBeNull()
  })

  it('honours memberDetails marking the target as virtual (no real session)', () => {
    const target = makeUser({ id: 5, email: OTHER, isVirtual: false })
    const session = twoMemberSession({
      memberDetails: [
        { email: ME, name: 'Me', isVirtual: false },
        { email: OTHER, name: 'Other', isVirtual: true },
      ],
    })
    expect(getPrimarySessionForUser(5, ME, [session], [target])).toBeNull()
  })

  it('returns the session when memberDetails marks the target as real', () => {
    const target = makeUser({ id: 5, email: OTHER, isVirtual: false })
    const session = twoMemberSession({
      sessionId: 's-real',
      memberDetails: [
        { email: ME, name: 'Me', isVirtual: false },
        { email: OTHER, name: 'Other', isVirtual: false },
      ],
    })
    expect(getPrimarySessionForUser(5, ME, [session], [target])?.sessionId).toBe('s-real')
  })

  it('returns the true pair from a mixed list, ignoring unrelated and 3-member sessions', () => {
    const target = makeUser({ id: 5, email: OTHER, isVirtual: false })
    const pair = twoMemberSession({ sessionId: 's-pair', insertDate: '2024-02-01T00:00:00Z' })
    const olderThreeMember = makeSession({
      sessionId: 's-3',
      members: [ME, OTHER, 'x@example.com'],
      memberDetails: null,
      insertDate: '2024-01-01T00:00:00Z',
    })
    const olderUnrelated = makeSession({
      sessionId: 's-unrelated',
      members: ['a@example.com', 'b@example.com'],
      memberDetails: null,
      insertDate: '2024-01-01T00:00:00Z',
    })

    const result = getPrimarySessionForUser(
      5,
      ME,
      [olderThreeMember, olderUnrelated, pair],
      [target],
    )
    // Only `pair` survives the 2-member ME↔target filter, so it is returned even
    // though older non-matching sessions precede it in the list.
    expect(result?.sessionId).toBe('s-pair')
  })
})

describe('getSessionDisplayName & checkIsPrimarySession', () => {
  it('shows the other member name for a primary session', () => {
    const other = makeUser({ email: OTHER, name: 'Other Person' })
    const session = twoMemberSession()
    expect(getSessionDisplayName(session, ME, [session], [other])).toBe('Other Person')
  })

  it('falls back to the session name for a non-primary session', () => {
    const other = makeUser({ email: OTHER, isVirtual: true })
    const session = twoMemberSession({ sessionName: 'Group Chat' })
    expect(getSessionDisplayName(session, ME, [session], [other])).toBe('Group Chat')
  })

  it('checkIsPrimarySession mirrors the reactive check', () => {
    const other = makeUser({ email: OTHER })
    const session = twoMemberSession()
    expect(checkIsPrimarySession(session, [session], [other], ME)).toBe(true)
  })

  it('checkIsPrimarySession is false with an empty current user email', () => {
    const other = makeUser({ email: OTHER })
    const session = twoMemberSession()
    expect(checkIsPrimarySession(session, [session], [other], '')).toBe(false)
  })
})
