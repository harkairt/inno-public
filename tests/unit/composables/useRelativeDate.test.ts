/**
 * Unit tests for useRelativeDate. The i18n `t` is the global stub (returns the
 * key), so we assert which translation KEY each time-delta maps to. System time
 * is pinned with vi.setSystemTime so deltas are deterministic.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { useRelativeDate } from '@/app/composables/useRelativeDate'
import { useFakeTimersSafe, freezeClock, useRealTimers } from '@/tests/utils/timers'

const NOW = new Date('2024-06-15T12:00:00.000Z')

function ago(ms: number): Date {
  return new Date(NOW.getTime() - ms)
}

const SECOND = 1000
const MINUTE = 60 * SECOND
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

describe('useRelativeDate.formatRelativeDate', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(NOW)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns justNow for deltas under one hour', () => {
    const { formatRelativeDate } = useRelativeDate()
    expect(formatRelativeDate(ago(30 * SECOND))).toBe('time.justNow')
    expect(formatRelativeDate(ago(59 * MINUTE))).toBe('time.justNow')
  })

  it('returns oneHourAgo at exactly one hour', () => {
    const { formatRelativeDate } = useRelativeDate()
    expect(formatRelativeDate(ago(HOUR))).toBe('time.oneHourAgo')
    expect(formatRelativeDate(ago(HOUR + 30 * MINUTE))).toBe('time.oneHourAgo')
  })

  it('returns hoursAgo for multiple hours under a day', () => {
    const { formatRelativeDate } = useRelativeDate()
    expect(formatRelativeDate(ago(5 * HOUR))).toBe('time.hoursAgo')
    expect(formatRelativeDate(ago(23 * HOUR))).toBe('time.hoursAgo')
  })

  it('returns oneDayAgo at exactly one day', () => {
    const { formatRelativeDate } = useRelativeDate()
    expect(formatRelativeDate(ago(DAY))).toBe('time.oneDayAgo')
    expect(formatRelativeDate(ago(DAY + 5 * HOUR))).toBe('time.oneDayAgo')
  })

  it('returns daysAgo for multiple days', () => {
    const { formatRelativeDate } = useRelativeDate()
    expect(formatRelativeDate(ago(2 * DAY))).toBe('time.daysAgo')
    expect(formatRelativeDate(ago(7 * DAY))).toBe('time.daysAgo')
  })

  it('accepts an ISO string as well as a Date', () => {
    const { formatRelativeDate } = useRelativeDate()
    expect(formatRelativeDate(ago(2 * DAY).toISOString())).toBe('time.daysAgo')
  })
})

// Exact bucket edges pinned with the freezeClock helper. Complements the
// delta-based cases above by fixing an absolute "now" and asserting the
// transition points (hours<=0, the 1h edge, and the sub-day→day rollover).
describe('useRelativeDate.formatRelativeDate — bucket edges (freezeClock)', () => {
  const FROZEN = '2024-06-15T12:00:00.000Z'

  beforeEach(() => {
    useFakeTimersSafe()
    freezeClock(FROZEN)
  })

  afterEach(() => useRealTimers())

  it('zero delta (message time === now) is justNow', () => {
    const { formatRelativeDate } = useRelativeDate()
    expect(formatRelativeDate(FROZEN)).toBe('time.justNow')
  })

  it('a future timestamp (negative delta / clock skew) is justNow', () => {
    const { formatRelativeDate } = useRelativeDate()
    expect(formatRelativeDate('2024-06-15T13:00:00.000Z')).toBe('time.justNow')
  })

  it('flips justNow → oneHourAgo at exactly the 1-hour edge', () => {
    const { formatRelativeDate } = useRelativeDate()
    expect(formatRelativeDate('2024-06-15T11:00:01.000Z')).toBe('time.justNow') // 59m59s
    expect(formatRelativeDate('2024-06-15T11:00:00.000Z')).toBe('time.oneHourAgo') // exactly 1h
  })

  it('flips hoursAgo → oneDayAgo at exactly the 24-hour edge', () => {
    const { formatRelativeDate } = useRelativeDate()
    expect(formatRelativeDate('2024-06-14T12:00:01.000Z')).toBe('time.hoursAgo') // 23h59m59s
    expect(formatRelativeDate('2024-06-14T12:00:00.000Z')).toBe('time.oneDayAgo') // exactly 24h
  })
})
