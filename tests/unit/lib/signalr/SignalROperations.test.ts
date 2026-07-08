/**
 * Unit tests for SignalROperations against a stubbed SignalRService.
 * Each operation is fire-and-forget over service.send().
 */
import { describe, it, expect, vi } from 'vitest'
import { SignalROperations } from '@/lib/signalr/SignalROperations'
import type { SignalRService } from '@/lib/signalr/SignalRService'

function makeStubService(send = vi.fn(async () => {})) {
  const service = { send } as unknown as SignalRService
  return { service, send }
}

describe('SignalROperations', () => {
  it('notifyMessageSent invokes SendMessageToUser with user ids, session and agent', () => {
    const { service, send } = makeStubService()
    new SignalROperations(service).notifyMessageSent(['a@x.com', 'b@x.com'], 'sess-1', 7)

    expect(send).toHaveBeenCalledWith('SendMessageToUser', ['a@x.com', 'b@x.com'], 'sess-1', 7)
  })

  it('notifyMessageSent early-returns on empty user ids', () => {
    const { service, send } = makeStubService()
    new SignalROperations(service).notifyMessageSent([], 'sess-1', 7)

    expect(send).not.toHaveBeenCalled()
  })

  it('sendStartTypingInfo invokes SendStartTypingInfo with the member/name/email/session', () => {
    const { service, send } = makeStubService()
    new SignalROperations(service).sendStartTypingInfo(['b@x.com'], 'Alice', 'a@x.com', 'sess-1')

    expect(send).toHaveBeenCalledWith(
      'SendStartTypingInfo',
      ['b@x.com'],
      'Alice',
      'a@x.com',
      'sess-1',
    )
  })

  it('sendStartTypingInfo early-returns on empty member emails', () => {
    const { service, send } = makeStubService()
    new SignalROperations(service).sendStartTypingInfo([], 'Alice', 'a@x.com', 'sess-1')

    expect(send).not.toHaveBeenCalled()
  })

  it('sendStopTypingInfo invokes SendStopTypingInfo with the member/name/email/session', () => {
    const { service, send } = makeStubService()
    new SignalROperations(service).sendStopTypingInfo(['b@x.com'], 'Alice', 'a@x.com', 'sess-1')

    expect(send).toHaveBeenCalledWith(
      'SendStopTypingInfo',
      ['b@x.com'],
      'Alice',
      'a@x.com',
      'sess-1',
    )
  })

  it('sendStopTypingInfo early-returns on empty member emails', () => {
    const { service, send } = makeStubService()
    new SignalROperations(service).sendStopTypingInfo([], 'Alice', 'a@x.com', 'sess-1')

    expect(send).not.toHaveBeenCalled()
  })

  it('propagates a synchronous error thrown by service.send', () => {
    const send = vi.fn(() => {
      throw new Error('boom')
    })
    const { service } = makeStubService(send)

    expect(() =>
      new SignalROperations(service).notifyMessageSent(['a@x.com'], 'sess-1', 1),
    ).toThrow('boom')
  })
})
