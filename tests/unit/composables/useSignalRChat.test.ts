/**
 * Integration tests for useSignalRChat against the fake SignalR singleton
 * and a real chat/auth Pinia store.
 */
import { describe, it, expect, vi } from 'vitest'
import { nextTick } from 'vue'
import { installFakeSignalR } from '@/tests/utils/fakeSignalR'
import { seedAuthStorage } from '@/tests/utils/authSeed'
import { makeUser } from '@/tests/utils/factories'
import { useSignalRChat } from '@/app/composables/useSignalRChat'
import { useChatStore } from '@/app/stores/chat'
import { useAuthStore } from '@/app/stores/auth'

describe('useSignalRChat typing events', () => {
  it('adds a typing user on SendStartTypingInfo from another user', () => {
    seedAuthStorage({ user: makeUser({ email: 'me@example.com', name: 'Me' }) })
    const fake = installFakeSignalR()
    fake.setState('connected')
    useSignalRChat()
    const chatStore = useChatStore()

    fake.emitFromServer('SendStartTypingInfo', 'Alice', 'alice@example.com', 'sess-1')

    expect(chatStore.getTypingUsers('sess-1')).toContain('Alice')
  })

  it('removes a typing user on SendStopTypingInfo', () => {
    seedAuthStorage({ user: makeUser({ email: 'me@example.com', name: 'Me' }) })
    const fake = installFakeSignalR()
    fake.setState('connected')
    useSignalRChat()
    const chatStore = useChatStore()

    fake.emitFromServer('SendStartTypingInfo', 'Alice', 'alice@example.com', 'sess-1')
    fake.emitFromServer('SendStopTypingInfo', 'Alice', 'alice@example.com', 'sess-1')

    expect(chatStore.getTypingUsers('sess-1')).toEqual([])
  })

  it('ignores typing events originating from the current user', () => {
    seedAuthStorage({ user: makeUser({ email: 'me@example.com', name: 'Me' }) })
    const fake = installFakeSignalR()
    fake.setState('connected')
    useSignalRChat()
    const chatStore = useChatStore()

    fake.emitFromServer('SendStartTypingInfo', 'Me', 'me@example.com', 'sess-1')

    expect(chatStore.getTypingUsers('sess-1')).toEqual([])
  })
})

describe('useSignalRChat watchers', () => {
  it('force-reconnects when the access token changes while connected', async () => {
    seedAuthStorage({ accessToken: 'old-token' })
    const fake = installFakeSignalR()
    fake.setState('connected')
    useSignalRChat()
    const authStore = useAuthStore()

    authStore.accessToken = 'new-token'
    await nextTick()

    expect(fake.forceReconnect).toHaveBeenCalledWith('new-token')
  })

  it('disconnects when the user becomes unauthenticated', async () => {
    seedAuthStorage()
    const fake = installFakeSignalR()
    fake.setState('connected')
    useSignalRChat()
    const authStore = useAuthStore()

    authStore.user = null
    await nextTick()

    expect(fake.disconnect).toHaveBeenCalled()
  })

  it('registers typing listeners exactly once across a reconnect cycle', async () => {
    seedAuthStorage({ user: makeUser({ email: 'me@example.com', name: 'Me' }) })
    const fake = installFakeSignalR()
    useSignalRChat()
    const chatStore = useChatStore()
    const addTypingSpy = vi.spyOn(chatStore, 'addTypingUser')

    fake.setState('connected')
    await nextTick()
    fake.setState('disconnected')
    await nextTick()
    fake.setState('connected')
    await nextTick()

    fake.emitFromServer('SendStartTypingInfo', 'Alice', 'alice@example.com', 'sess-1')

    expect(addTypingSpy).toHaveBeenCalledTimes(1)
  })
})
