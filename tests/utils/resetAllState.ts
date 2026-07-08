import { vi } from 'vitest'
import { focusManager, onlineManager } from '@tanstack/vue-query'
import { clearApiInterceptors } from '@/lib/api/interceptors/setup'
import { resetResponseInterceptorState } from '@/lib/api/interceptors/response'
import { resetRateLimiter } from '@/lib/api/interceptors/request'
import { configService } from '@/lib/api/services/ConfigService'
import { globalErrorTracker } from '@/lib/errors/utils'
import { SignalRService } from '@/lib/signalr/SignalRService'
import { setStorageMode } from '@/app/stores/auth'
import { resetWelcomeMessageTracking } from '@/app/composables/useChatQueries'
import { setQueryClient } from '@/lib/queryClientSingleton'

/**
 * Run a reset step, tolerating the case where the underlying module has been
 * mocked away by the current test file (vi.mock factories often omit the
 * reset/singleton helpers, leaving them undefined). Such tests don't need the
 * real reset — they've replaced the module — so skipping is correct.
 */
function safe(fn: () => void): void {
  try {
    fn()
  } catch {
    // Symbol mocked out in this test file — nothing to reset.
  }
}

/**
 * Reset every module-level singleton / global that leaks between tests.
 * Called from tests/setup.ts beforeEach so each test starts from a clean slate.
 */
export function resetAllState(): void {
  safe(() => clearApiInterceptors())
  safe(() => resetResponseInterceptorState())
  safe(() => resetRateLimiter())
  safe(() => configService.clearCache())
  safe(() => globalErrorTracker.reset())
  safe(() => SignalRService.resetInstance())
  safe(() => setQueryClient(null))
  safe(() => setStorageMode('localStorage'))
  safe(() => localStorage.clear())
  safe(() => sessionStorage.clear())
  safe(() => resetWelcomeMessageTracking())
  safe(() => focusManager.setFocused(undefined))
  // Reset to online (true), NOT undefined: isOnline() returns the raw value, and
  // a falsy value pauses all TanStack mutations, deadlocking mutateAsync in tests.
  safe(() => onlineManager.setOnline(true))
  vi.useRealTimers()
}
