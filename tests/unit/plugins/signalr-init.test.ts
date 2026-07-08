/**
 * Tests for the signalr-init client plugin. Drives the plugin's setup function
 * with a mocked nuxtApp carrying a real QueryClient, the fake SignalR singleton,
 * and a real auth store (seeded via storage).
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { nextTick } from 'vue'
import { installFakeSignalR } from '@/tests/utils/fakeSignalR'
import { seedAuthStorage } from '@/tests/utils/authSeed'
import { createTestQueryClient } from '@/tests/utils/render'
import { useFakeTimersSafe, advance, useRealTimers } from '@/tests/utils/timers'
import { chatQueryKeys } from '@/app/composables/useChatQueries'
import { useAuthStore } from '@/app/stores/auth'
import { useSignalR } from '@/app/composables/useSignalR'
import signalrInitPlugin from '@/app/plugins/signalr-init.client'

// The plugin relies on Nuxt auto-imports (useAuthStore, useSignalR). Expose them
// as globals so the un-imported references in the plugin resolve at runtime.
beforeEach(() => {
  vi.stubGlobal('useAuthStore', useAuthStore)
  vi.stubGlobal('useSignalR', useSignalR)
})

afterEach(() => {
  vi.unstubAllGlobals()
  useRealTimers()
})

function runPlugin(queryClient = createTestQueryClient()) {
  return signalrInitPlugin({ $queryClient: queryClient } as unknown as Parameters<
    typeof signalrInitPlugin
  >[0])
}

describe('signalr-init plugin', () => {
  it('auto-connects after the 500ms delay when authenticated', async () => {
    seedAuthStorage({ accessToken: 'seeded-access-token' })
    const fake = installFakeSignalR()
    useFakeTimersSafe()

    await runPlugin()
    await advance(500)

    expect(fake.connect).toHaveBeenCalledWith('seeded-access-token')
  })

  it('does not auto-connect when unauthenticated', async () => {
    const fake = installFakeSignalR()
    useFakeTimersSafe()

    await runPlugin()
    await advance(500)

    expect(fake.connect).not.toHaveBeenCalled()
  })

  it('invalidates the session and unread queries on ReceiveMessage', async () => {
    seedAuthStorage({ accessToken: 'seeded-access-token' })
    const fake = installFakeSignalR()
    useFakeTimersSafe()
    const queryClient = createTestQueryClient()
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')

    await runPlugin(queryClient)
    await advance(500)

    fake.emitFromServer('ReceiveMessage', 'sess-1', 5)

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: chatQueryKeys.session('sess-1') })
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: chatQueryKeys.unread(), exact: true })
  })

  it('ignores ReceiveMessage payloads with the wrong types', async () => {
    seedAuthStorage({ accessToken: 'seeded-access-token' })
    const fake = installFakeSignalR()
    useFakeTimersSafe()
    const queryClient = createTestQueryClient()
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')

    await runPlugin(queryClient)
    await advance(500)

    fake.emitFromServer('ReceiveMessage', 42, 'not-a-number')

    expect(invalidateSpy).not.toHaveBeenCalled()
  })

  // Regression guard for the commit's actual fix: a valid sessionId must still
  // trigger the refetch even when the backend drifts agentId off `number`. The
  // old guard (`typeof agentId !== 'number'`) silently dropped these events.
  it('still invalidates when sessionId is valid but agentId is not a number', async () => {
    seedAuthStorage({ accessToken: 'seeded-access-token' })
    const fake = installFakeSignalR()
    useFakeTimersSafe()
    const queryClient = createTestQueryClient()
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')

    await runPlugin(queryClient)
    await advance(500)

    // agentId arrives as a string (type drift) — sessionId is the only field the
    // refetch needs, so the event must NOT be dropped.
    fake.emitFromServer('ReceiveMessage', 'sess-1', 'agent-as-string')

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: chatQueryKeys.session('sess-1') })
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: chatQueryKeys.unread(), exact: true })
  })

  it('still invalidates when agentId is missing (undefined) but sessionId is valid', async () => {
    seedAuthStorage({ accessToken: 'seeded-access-token' })
    const fake = installFakeSignalR()
    useFakeTimersSafe()
    const queryClient = createTestQueryClient()
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')

    await runPlugin(queryClient)
    await advance(500)

    fake.emitFromServer('ReceiveMessage', 'sess-1')

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: chatQueryKeys.session('sess-1') })
  })

  // The new `!sessionId` guard rejects an empty string. The old type-only guard
  // (`typeof sessionId !== 'string'`) let '' through and invalidated a garbage key.
  it('drops a ReceiveMessage with an empty-string sessionId', async () => {
    seedAuthStorage({ accessToken: 'seeded-access-token' })
    const fake = installFakeSignalR()
    useFakeTimersSafe()
    const queryClient = createTestQueryClient()
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')

    await runPlugin(queryClient)
    await advance(500)

    fake.emitFromServer('ReceiveMessage', '', 5)

    expect(invalidateSpy).not.toHaveBeenCalled()
  })

  it('registers the ReceiveMessage listener only once (dedupe guard)', async () => {
    seedAuthStorage({ accessToken: 'seeded-access-token' })
    const fake = installFakeSignalR()
    useFakeTimersSafe()
    const queryClient = createTestQueryClient()
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')

    await runPlugin(queryClient)
    await advance(500) // connect + direct listener registration

    // Force the isConnected watcher to fire again — the guard must block re-registration.
    fake.setState('reconnecting')
    await nextTick()
    fake.setState('connected')
    await nextTick()

    fake.emitFromServer('ReceiveMessage', 'sess-1', 5)

    const sessionKey = JSON.stringify(chatQueryKeys.session('sess-1'))
    const sessionInvalidations = invalidateSpy.mock.calls.filter(
      (call) => JSON.stringify((call[0] as { queryKey: unknown }).queryKey) === sessionKey,
    )
    expect(sessionInvalidations).toHaveLength(1)
  })
})
