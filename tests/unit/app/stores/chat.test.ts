import { describe, it, expect, beforeEach } from 'vitest'
import { createApp } from 'vue'
import { setActivePinia, createPinia } from 'pinia'
import { useChatStore } from '~/stores/chat'
import { AIAnswerType, MessageStatus } from '@/types/enums'

function makeFailedMessage(id: string, sessionId = 'session-1') {
  return {
    messageID: id,
    messageText: `Message ${id}`,
    messageType: AIAnswerType.Text,
    isRated: false,
    rating: null,
    readByUsers: null,
    sendDate: '2024-01-01T00:00:00Z',
    senderName: 'User',
    senderUserCode: 'user',
    sessionId,
    dataTable: null,
    options: null,
    status: MessageStatus.FAILED,
  }
}

describe('Chat Store — failed messages', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('starts with no failed messages', () => {
    const store = useChatStore()

    expect(store.getFailedMessages('session-1')).toHaveLength(0)
  })

  it('adds a failed message to the correct session', () => {
    const store = useChatStore()
    const msg = makeFailedMessage('msg-1')

    store.addFailedMessage('session-1', msg)

    expect(store.getFailedMessages('session-1')).toHaveLength(1)
    expect(store.getFailedMessages('session-2')).toHaveLength(0)
  })

  it('accumulates multiple failed messages', () => {
    const store = useChatStore()

    store.addFailedMessage('session-1', makeFailedMessage('msg-1'))
    store.addFailedMessage('session-1', makeFailedMessage('msg-2'))

    expect(store.getFailedMessages('session-1')).toHaveLength(2)
  })

  it('removes a specific failed message by id', () => {
    const store = useChatStore()

    store.addFailedMessage('session-1', makeFailedMessage('msg-1'))
    store.addFailedMessage('session-1', makeFailedMessage('msg-2'))
    store.removeFailedMessage('session-1', 'msg-1')

    const remaining = store.getFailedMessages('session-1')
    expect(remaining).toHaveLength(1)
    expect(remaining[0]?.messageID).toBe('msg-2')
  })

  it('removes all failed messages for a session', () => {
    const store = useChatStore()

    store.addFailedMessage('session-1', makeFailedMessage('msg-1'))
    store.addFailedMessage('session-1', makeFailedMessage('msg-2'))
    store.removeAllFailedMessages('session-1')

    expect(store.getFailedMessages('session-1')).toHaveLength(0)
  })

  it('does not affect other sessions when removing', () => {
    const store = useChatStore()

    store.addFailedMessage('session-1', makeFailedMessage('msg-1', 'session-1'))
    store.addFailedMessage('session-2', makeFailedMessage('msg-2', 'session-2'))
    store.removeAllFailedMessages('session-1')

    expect(store.getFailedMessages('session-2')).toHaveLength(1)
  })
})

function makeMessage(id: string, messageText: string, senderUserCode = 'user') {
  return {
    messageID: id,
    messageText,
    messageType: AIAnswerType.Text,
    isRated: false,
    rating: null,
    readByUsers: null,
    sendDate: '2024-01-01T00:00:00Z',
    senderName: 'User',
    senderUserCode,
    sessionId: 'session-1',
    dataTable: null,
    options: null,
  }
}

describe('Chat Store — pending messages', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('shows a pending message while the server has no matching message', () => {
    const store = useChatStore()
    store.addPendingMessage('session-1', makeMessage('temp-1', 'hello'))

    const visible = store.getUnconfirmedPendingMessages('session-1', [])
    expect(visible).toHaveLength(1)
    expect(visible[0]?.messageID).toBe('temp-1')
  })

  it('hides a pending message once its server copy arrives (no double render)', () => {
    const store = useChatStore()
    store.addPendingMessage('session-1', makeMessage('temp-1', 'hello'))

    // GetSessionById echoes the message back with a real (different) id.
    const server = [makeMessage('server-1', 'hello')]
    expect(store.getUnconfirmedPendingMessages('session-1', server)).toHaveLength(0)
  })

  it('keeps a repeated message visible when an identical one predates it', () => {
    const store = useChatStore()
    // Session already contains one "ok"; user sends "ok" again (baseline = 1).
    store.addPendingMessage('session-1', makeMessage('temp-2', 'ok'), 1)

    // Server still only has the original "ok" — the new one is not persisted yet.
    const server = [makeMessage('server-1', 'ok')]
    const visible = store.getUnconfirmedPendingMessages('session-1', server)
    expect(visible).toHaveLength(1)
    expect(visible[0]?.messageID).toBe('temp-2')

    // Once the second "ok" is persisted, the pending copy is hidden.
    server.push(makeMessage('server-2', 'ok'))
    expect(store.getUnconfirmedPendingMessages('session-1', server)).toHaveLength(0)
  })

  it('reconciles two rapid identical sends one-to-one as copies arrive', () => {
    const store = useChatStore()
    store.addPendingMessage('session-1', makeMessage('temp-1', 'hi'), 0)
    store.addPendingMessage('session-1', makeMessage('temp-2', 'hi'), 0)

    // First copy persisted: oldest pending confirmed, second still shown.
    const oneArrived = store.getUnconfirmedPendingMessages('session-1', [
      makeMessage('server-1', 'hi'),
    ])
    expect(oneArrived).toHaveLength(1)
    expect(oneArrived[0]?.messageID).toBe('temp-2')

    // Both copies persisted: nothing pending remains.
    const bothArrived = store.getUnconfirmedPendingMessages('session-1', [
      makeMessage('server-1', 'hi'),
      makeMessage('server-2', 'hi'),
    ])
    expect(bothArrived).toHaveLength(0)
  })

  it('does not confirm a pending message when an identical-text copy is from another sender', () => {
    const store = useChatStore()
    // I send "ok"; the only server "ok" so far is someone else's message.
    store.addPendingMessage('session-1', makeMessage('temp-1', 'ok', 'me@example.com'), 0)

    const server = [makeMessage('server-1', 'ok', 'other@example.com')]
    const visible = store.getUnconfirmedPendingMessages('session-1', server)

    // Content identity is sender + text, so the other user's "ok" must not
    // swallow my still-unconfirmed one.
    expect(visible).toHaveLength(1)
    expect(visible[0]?.messageID).toBe('temp-1')
  })

  it('keeps a pending message visible when the server thread has fewer copies than the baseline', () => {
    const store = useChatStore()
    // Session had two "ok" from me at send time (baseline 2); a concurrent delete
    // then shrank the server thread to one. arrivedSinceSend = 1 - 2 = -1.
    store.addPendingMessage('session-1', makeMessage('temp-1', 'ok'), 2)

    const server = [makeMessage('server-1', 'ok')]
    const visible = store.getUnconfirmedPendingMessages('session-1', server)

    // Negative arrival must clamp to zero confirmed, not underflow into hiding it.
    expect(visible).toHaveLength(1)
    expect(visible[0]?.messageID).toBe('temp-1')
  })

  it('confirms at most the number of pending copies even when the server has more', () => {
    const store = useChatStore()
    // One pending "hi" (baseline 0), but the server already shows two "hi" from me
    // (e.g. another device echoed one). Confirmed count must cap at the 1 pending.
    store.addPendingMessage('session-1', makeMessage('temp-1', 'hi'), 0)

    const server = [makeMessage('server-1', 'hi'), makeMessage('server-2', 'hi')]
    const visible = store.getUnconfirmedPendingMessages('session-1', server)

    expect(visible).toHaveLength(0)
  })

  it('scopes pending reconciliation to the requested session only', () => {
    const store = useChatStore()
    store.addPendingMessage('session-1', makeMessage('temp-1', 'hi'), 0)
    store.addPendingMessage('session-2', makeMessage('temp-2', 'hi'), 0)

    // A server copy for session-2 must not confirm session-1's pending message.
    const visible = store.getUnconfirmedPendingMessages('session-1', [])
    expect(visible).toHaveLength(1)
    expect(visible[0]?.messageID).toBe('temp-1')
  })

  it('removes a specific pending message by id', () => {
    const store = useChatStore()
    store.addPendingMessage('session-1', makeMessage('temp-1', 'a'))
    store.addPendingMessage('session-1', makeMessage('temp-2', 'b'))
    store.removePendingMessage('session-1', 'temp-1')

    const remaining = store.getPendingMessages('session-1')
    expect(remaining).toHaveLength(1)
    expect(remaining[0]?.messageID).toBe('temp-2')
  })

  it('removes all pending messages for a session on demand', () => {
    const store = useChatStore()
    store.addPendingMessage('session-1', makeMessage('temp-1', 'a'))
    store.addPendingMessage('session-1', makeMessage('temp-2', 'b'))
    store.removeAllPendingMessages('session-1')

    expect(store.getPendingMessages('session-1')).toHaveLength(0)
  })
})

describe('Chat Store — draft messages', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('returns empty string for unknown draft key', () => {
    const store = useChatStore()

    expect(store.getDraft('session-1')).toBe('')
  })

  it('saves and retrieves a draft', () => {
    const store = useChatStore()

    store.saveDraft('session-1', 'Hello world')

    expect(store.getDraft('session-1')).toBe('Hello world')
  })

  it('removes draft when saving empty string', () => {
    const store = useChatStore()

    store.saveDraft('session-1', 'Hello')
    store.saveDraft('session-1', '   ')

    expect(store.getDraft('session-1')).toBe('')
  })

  it('clears a draft explicitly', () => {
    const store = useChatStore()

    store.saveDraft('session-1', 'Draft text')
    store.clearDraft('session-1')

    expect(store.getDraft('session-1')).toBe('')
  })

  it('isolates drafts per key', () => {
    const store = useChatStore()

    store.saveDraft('session-1', 'Draft 1')
    store.saveDraft('session-2', 'Draft 2')
    store.clearDraft('session-1')

    expect(store.getDraft('session-2')).toBe('Draft 2')
  })
})

describe('Chat Store — typing indicators', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('returns empty array when no one is typing', () => {
    const store = useChatStore()

    expect(store.getTypingUsers('session-1')).toHaveLength(0)
  })

  it('adds a typing user', () => {
    const store = useChatStore()

    store.addTypingUser('session-1', 'Alice')

    expect(store.getTypingUsers('session-1')).toContain('Alice')
  })

  it('deduplicates typing users', () => {
    const store = useChatStore()

    store.addTypingUser('session-1', 'Alice')
    store.addTypingUser('session-1', 'Alice')

    expect(store.getTypingUsers('session-1')).toHaveLength(1)
  })

  it('removes a typing user', () => {
    const store = useChatStore()

    store.addTypingUser('session-1', 'Alice')
    store.addTypingUser('session-1', 'Bob')
    store.removeTypingUser('session-1', 'Alice')

    const typing = store.getTypingUsers('session-1')
    expect(typing).not.toContain('Alice')
    expect(typing).toContain('Bob')
  })
})

describe('Chat Store — resetUserData', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('clears all state on reset', () => {
    const store = useChatStore()

    store.setActiveSession('session-1')
    store.saveDraft('session-1', 'draft')
    store.addFailedMessage('session-1', makeFailedMessage('msg-1'))
    store.addPendingMessage('session-1', makeMessage('temp-1', 'pending'))
    store.addTypingUser('session-1', 'Alice')
    store.setError('some error')

    store.resetUserData()

    expect(store.activeSessionId).toBeNull()
    expect(store.getDraft('session-1')).toBe('')
    expect(store.getFailedMessages('session-1')).toHaveLength(0)
    expect(store.getPendingMessages('session-1')).toHaveLength(0)
    expect(store.getTypingUsers('session-1')).toHaveLength(0)
    expect(store.error).toBeNull()
  })
})

describe('S37–S40 Chat Store — composer requests', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('S37 collapses newlines and whitespace runs to single spaces', () => {
    const store = useChatStore()
    store.requestComposerText('a  b\n\nc')

    expect(store.composerRequest?.text).toBe('a b c')
  })

  it('S37 ignores whitespace-only input', () => {
    const store = useChatStore()
    store.requestComposerText('   \n  ')

    expect(store.composerRequest).toBeNull()
  })

  it('S38 gives two identical texts two distinct seq values', () => {
    const store = useChatStore()

    store.requestComposerText('Why did North drop?')
    const first = store.composerRequest?.seq

    store.requestComposerText('Why did North drop?')
    const second = store.composerRequest?.seq

    expect(first).toBeDefined()
    expect(second).toBeDefined()
    expect(second).not.toBe(first)
  })

  it('S39 clears the request', () => {
    const store = useChatStore()
    store.requestComposerText('Why?')
    store.clearComposerRequest()

    expect(store.composerRequest).toBeNull()
  })

  it('S39 clears the request on resetUserData', () => {
    const store = useChatStore()
    store.requestComposerText('Why?')
    store.resetUserData()

    expect(store.composerRequest).toBeNull()
  })

  it('S40 keeps composerRequest out of the persisted payload', () => {
    let persist: { key?: string; pick?: string[] } | undefined

    const pinia = createPinia()
    pinia.use((context) => {
      if (context.store.$id === 'chat') {
        persist = (context.options as { persist?: { key?: string; pick?: string[] } }).persist
      }
    })
    createApp({}).use(pinia)
    setActivePinia(pinia)
    useChatStore()

    expect(persist?.key).toBe('innochat-chat')
    expect(persist?.pick).toEqual(['failedMessages', 'activeSessionId', 'draftMessages'])
    expect(persist?.pick).not.toContain('composerRequest')
  })
})
