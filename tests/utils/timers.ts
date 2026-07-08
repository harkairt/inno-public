/**
 * Fake-timer pattern for tests that must control time (retry backoff, polling
 * refetchInterval, cache TTL, SignalR timeouts).
 *
 * Rules:
 * 1. Real timers by default. Only fake in dedicated timing tests.
 * 2. Alongside MSW/waitFor: vi.useFakeTimers({ shouldAdvanceTime: true }).
 * 3. Never sync-advance — always: await vi.advanceTimersByTimeAsync(ms).
 * 4. vi.useRealTimers() in the test's afterEach; resetAllState() backstops.
 */
import { vi } from 'vitest'

export function useFakeTimersSafe(): void {
  vi.useFakeTimers({ shouldAdvanceTime: true })
}

export async function advance(ms: number): Promise<void> {
  await vi.advanceTimersByTimeAsync(ms)
}

export function useRealTimers(): void {
  vi.useRealTimers()
}

/**
 * Pin the system clock to a fixed instant so date/time-relative logic
 * (relative-time formatting, date-boundary grouping) is deterministic.
 *
 * Contract: fake timers must already be active — call useFakeTimersSafe() (or
 * vi.useFakeTimers()) first. Like the other helpers here this is a thin wrapper
 * (over vi.setSystemTime) and does NOT enable fake timers itself; vi.setSystemTime
 * throws when they are not. Restore with useRealTimers() in afterEach
 * (resetAllState() backstops it).
 */
export function freezeClock(iso: string): void {
  vi.setSystemTime(new Date(iso))
}
