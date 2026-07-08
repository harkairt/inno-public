import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { groupMessagesByDate, formatTime } from '@/lib/utils/chat/groupMessages'
import type { ChatMessage } from '@/lib/utils/chat/groupMessages'
import { MessageType } from '@/lib/types/chat'
import { useFakeTimersSafe, freezeClock, useRealTimers } from '@/tests/utils/timers'

function makeMessage(overrides: Partial<ChatMessage> & { sendDate: string }): ChatMessage {
  return {
    messageID: crypto.randomUUID(),
    sessionID: 'session-1',
    messageText: 'hello',
    messageType: MessageType.USER_QUESTION,
    senderUserCode: 'user-1',
    senderName: 'Test User',
    isRated: false,
    rating: null,
    readByUsers: [],
    ...overrides,
  }
}

describe('groupMessagesByDate', () => {
  const FAKE_NOW = new Date('2025-06-15T12:00:00.000Z')

  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(FAKE_NOW)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns empty array for empty input', () => {
    expect(groupMessagesByDate([])).toEqual([])
  })

  it('returns empty array for null-ish input', () => {
    // The implementation guards with !messages
    expect(groupMessagesByDate(null as unknown as ChatMessage[])).toEqual([])
  })

  it('groups a single message sent today under "Today"', () => {
    const msg = makeMessage({ sendDate: '2025-06-15T09:30:00.000Z' })
    const groups = groupMessagesByDate([msg])

    expect(groups).toHaveLength(1)
    expect(groups[0].date).toBe('Today')
    expect(groups[0].messages).toHaveLength(1)
    expect(groups[0].messages[0].messageID).toBe(msg.messageID)
  })

  it('labels messages from yesterday as "Yesterday"', () => {
    const msg = makeMessage({ sendDate: '2025-06-14T18:00:00.000Z' })
    const groups = groupMessagesByDate([msg])

    expect(groups).toHaveLength(1)
    expect(groups[0].date).toBe('Yesterday')
  })

  it('puts multiple messages on the same day into one group', () => {
    const messages = [
      makeMessage({ sendDate: '2025-06-15T08:00:00.000Z', messageID: 'a' }),
      makeMessage({ sendDate: '2025-06-15T10:00:00.000Z', messageID: 'b' }),
      makeMessage({ sendDate: '2025-06-15T14:00:00.000Z', messageID: 'c' }),
    ]
    const groups = groupMessagesByDate(messages)

    expect(groups).toHaveLength(1)
    expect(groups[0].date).toBe('Today')
    expect(groups[0].messages).toHaveLength(3)
  })

  it('sorts messages within a group by time ascending', () => {
    const messages = [
      makeMessage({ sendDate: '2025-06-15T14:00:00.000Z', messageID: 'late' }),
      makeMessage({ sendDate: '2025-06-15T08:00:00.000Z', messageID: 'early' }),
      makeMessage({ sendDate: '2025-06-15T11:00:00.000Z', messageID: 'mid' }),
    ]
    const groups = groupMessagesByDate(messages)
    const ids = groups[0].messages.map((m) => m.messageID)

    expect(ids).toEqual(['early', 'mid', 'late'])
  })

  it('creates multiple groups for messages across different days, sorted most recent first', () => {
    const messages = [
      makeMessage({ sendDate: '2025-06-13T10:00:00.000Z', messageID: 'old' }),
      makeMessage({ sendDate: '2025-06-15T10:00:00.000Z', messageID: 'today' }),
      makeMessage({ sendDate: '2025-06-14T10:00:00.000Z', messageID: 'yesterday' }),
    ]
    const groups = groupMessagesByDate(messages)

    expect(groups).toHaveLength(3)
    expect(groups[0].date).toBe('Today')
    expect(groups[1].date).toBe('Yesterday')
    // Third group is a formatted date for June 13
    expect(groups[2].messages[0].messageID).toBe('old')
  })

  it('formats older same-year dates with weekday, month, and day', () => {
    const msg = makeMessage({ sendDate: '2025-01-10T10:00:00.000Z' })
    const groups = groupMessagesByDate([msg])

    // en-US short format: e.g. "Fri, Jan 10"
    expect(groups[0].date).toContain('Jan')
    expect(groups[0].date).toContain('10')
  })

  it('includes year for dates in a different year', () => {
    const msg = makeMessage({ sendDate: '2024-03-05T10:00:00.000Z' })
    const groups = groupMessagesByDate([msg])

    expect(groups[0].date).toContain('2024')
    expect(groups[0].date).toContain('Mar')
  })
})

// The date-boundary labels (formatDate / parseGroupDate, ~lines 68/100) are
// already covered thoroughly by the suite above (Today / Yesterday / same-year /
// different-year). This block adds one clock-relative characterization: the SAME
// absolute message date is "Today" under one frozen clock and a plain formatted
// date once the clock advances past it — proving the label tracks "now".
describe('groupMessagesByDate — labels are relative to the frozen clock', () => {
  afterEach(() => useRealTimers())

  const SEND_DATE = '2025-06-15T09:30:00.000Z'

  it('labels a fixed message date "Today" when the clock sits on that day', () => {
    useFakeTimersSafe()
    freezeClock('2025-06-15T12:00:00.000Z')
    const groups = groupMessagesByDate([makeMessage({ sendDate: SEND_DATE })])
    expect(groups[0].date).toBe('Today')
  })

  it('re-labels the SAME message date once the clock advances two days past it', () => {
    useFakeTimersSafe()
    freezeClock('2025-06-17T12:00:00.000Z')
    const groups = groupMessagesByDate([makeMessage({ sendDate: SEND_DATE })])
    expect(groups[0].date).not.toBe('Today')
    expect(groups[0].date).not.toBe('Yesterday')
    expect(groups[0].date).toContain('Jun')
    expect(groups[0].date).toContain('15')
  })
})

describe('formatTime', () => {
  it('formats a valid ISO string to HH:MM', () => {
    const result = formatTime('2025-06-15T14:35:00.000Z')
    // The exact output depends on locale/timezone but should match HH:MM pattern
    expect(result).toMatch(/^\d{2}:\d{2}$/)
  })

  it('returns empty string for an invalid date string', () => {
    expect(formatTime('not-a-date')).toBe('')
  })

  it('returns empty string for an empty string', () => {
    expect(formatTime('')).toBe('')
  })
})
