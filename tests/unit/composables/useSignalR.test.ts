/**
 * Integration tests for useSignalR against the fake SignalR singleton.
 */
import { describe, it, expect, vi } from 'vitest'
import { nextTick } from 'vue'
import { installFakeSignalR } from '@/tests/utils/fakeSignalR'
import { seedAuthStorage } from '@/tests/utils/authSeed'
import { SignalRService } from '@/lib/signalr/SignalRService'
import { useSignalR } from '@/app/composables/useSignalR'

describe('useSignalR', () => {
  it('tracks the connection state reported by the service', async () => {
    const fake = installFakeSignalR()
    const signalr = useSignalR()

    expect(signalr.isConnected.value).toBe(false)
    expect(signalr.state.value).toBe('disconnected')

    fake.setState('connected')
    await nextTick()
    expect(signalr.isConnected.value).toBe(true)
    expect(signalr.state.value).toBe('connected')

    fake.setState('reconnecting')
    await nextTick()
    expect(signalr.isReconnecting.value).toBe(true)
    expect(signalr.isConnected.value).toBe(false)
  })

  it('connect() passes the auth store access token to the service', async () => {
    seedAuthStorage({ accessToken: 'seeded-access-token' })
    const fake = installFakeSignalR()
    const signalr = useSignalR()

    await signalr.connect()

    expect(fake.connect).toHaveBeenCalledWith('seeded-access-token')
  })

  it('connect() no-ops when there is no token', async () => {
    const fake = installFakeSignalR()
    const signalr = useSignalR()

    await signalr.connect()

    expect(fake.connect).not.toHaveBeenCalled()
  })

  it('builds the production hub URL from the runtime apiBaseUrl', () => {
    installFakeSignalR()
    const getInstanceSpy = vi.spyOn(SignalRService, 'getInstance')
    vi.mocked(useRuntimeConfig).mockReturnValueOnce({
      public: { apiBaseUrl: 'https://api.example.com' },
    } as unknown as ReturnType<typeof useRuntimeConfig>)

    useSignalR()

    expect(getInstanceSpy.mock.calls[0]![0]?.hubUrl).toBe('https://api.example.com/chatHub')
  })
})
