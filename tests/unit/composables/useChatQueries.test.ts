import { describe, it, expect } from 'vitest'
import { chatQueryKeys } from '~/composables/useChatQueries'

// ---------------------------------------------------------------------------
// Query key correctness
// ---------------------------------------------------------------------------

describe('chatQueryKeys — cache key structure', () => {
  it('all returns base key', () => {
    expect(chatQueryKeys.all).toEqual(['chat'])
  })

  it('sessions key contains all', () => {
    expect(chatQueryKeys.sessions()).toEqual(['chat', 'sessions'])
  })

  it('session key is scoped under sessions', () => {
    expect(chatQueryKeys.session('session-123')).toEqual(['chat', 'sessions', 'session-123'])
  })

  it('messages key is scoped under session', () => {
    expect(chatQueryKeys.messages('session-123')).toEqual([
      'chat', 'sessions', 'session-123', 'messages'
    ])
  })

  it('message key is scoped under all', () => {
    expect(chatQueryKeys.message('msg-456')).toEqual(['chat', 'message', 'msg-456'])
  })

  it('unread key is scoped under all', () => {
    expect(chatQueryKeys.unread()).toEqual(['chat', 'unread'])
  })

  it('sessionUnread key is scoped under all with session id', () => {
    expect(chatQueryKeys.sessionUnread('session-789')).toEqual([
      'chat', 'sessionUnread', 'session-789'
    ])
  })

  it('welcome key is scoped with agentId', () => {
    expect(chatQueryKeys.welcome(42)).toEqual(['chat', 'welcome', 42])
  })

  it('search key includes query string', () => {
    expect(chatQueryKeys.search('hello world')).toEqual(['chat', 'search', 'hello world'])
  })

  it('different session IDs produce different keys', () => {
    const key1 = chatQueryKeys.session('a')
    const key2 = chatQueryKeys.session('b')

    expect(key1).not.toEqual(key2)
  })

  it('invalidating "sessions" also invalidates "session/:id"', () => {
    // Prefix matching: sessions() is a prefix of session(id)
    const sessionsKey = chatQueryKeys.sessions()
    const sessionKey = chatQueryKeys.session('id-1')

    expect(sessionKey.slice(0, sessionsKey.length)).toEqual(sessionsKey)
  })
})
