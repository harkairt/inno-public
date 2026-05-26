import { describe, it, expect, beforeEach } from 'vitest'
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
    store.addTypingUser('session-1', 'Alice')
    store.setError('some error')

    store.resetUserData()

    expect(store.activeSessionId).toBeNull()
    expect(store.getDraft('session-1')).toBe('')
    expect(store.getFailedMessages('session-1')).toHaveLength(0)
    expect(store.getTypingUsers('session-1')).toHaveLength(0)
    expect(store.error).toBeNull()
  })
})
