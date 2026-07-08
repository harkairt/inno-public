import { focusManager, onlineManager } from '@tanstack/vue-query'

/** Simulate a window regaining focus (triggers refetchOnWindowFocus). */
export function simulateWindowFocus(): void {
  focusManager.setFocused(false)
  focusManager.setFocused(true)
}

/** Simulate the browser going offline. */
export function simulateOffline(): void {
  onlineManager.setOnline(false)
}

/** Simulate the browser reconnecting (triggers refetchOnReconnect). */
export function simulateReconnect(): void {
  onlineManager.setOnline(true)
}
