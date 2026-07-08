/**
 * Unit tests for SignalRService — the only place we mock @microsoft/signalr.
 * The mock exposes a controllable HubConnectionBuilder chain and a fake
 * HubConnection whose lifecycle callbacks and `.on` handlers we can drive.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { SignalRService } from '@/lib/signalr/SignalRService'
import type { SignalRConfig } from '@/lib/signalr/types'
import { useFakeTimersSafe, advance, useRealTimers } from '@/tests/utils/timers'

// ---------------------------------------------------------------------------
// @microsoft/signalr mock (hoisted so the vi.mock factory can reference it)
// ---------------------------------------------------------------------------

interface FakeConnection {
  state: string
  connectionId: string
  serverTimeoutInMilliseconds: number
  keepAliveIntervalInMilliseconds: number
  lifecycle: Record<string, (...args: unknown[]) => void>
  start: ReturnType<typeof vi.fn>
  stop: ReturnType<typeof vi.fn>
  on: ReturnType<typeof vi.fn>
  off: ReturnType<typeof vi.fn>
  invoke: ReturnType<typeof vi.fn>
  send: ReturnType<typeof vi.fn>
  onreconnecting: ReturnType<typeof vi.fn>
  onreconnected: ReturnType<typeof vi.fn>
  onclose: ReturnType<typeof vi.fn>
  emit: (event: string, ...args: unknown[]) => void
}

const sr = vi.hoisted(() => {
  const HubConnectionState = {
    Disconnected: 'Disconnected',
    Connecting: 'Connecting',
    Connected: 'Connected',
    Disconnecting: 'Disconnecting',
    Reconnecting: 'Reconnecting',
  } as const
  const HttpTransportType = { WebSockets: 1, ServerSentEvents: 2, LongPolling: 4 } as const
  const LogLevel = { Warning: 3 } as const

  const state = {
    connections: [] as FakeConnection[],
    withUrlCalls: [] as Array<{ url: string; options: { accessTokenFactory: () => string } }>,
    reconnectDelays: undefined as unknown,
    startImpl: (() => Promise.resolve()) as () => Promise<void>,
  }

  function makeConnection(): FakeConnection {
    const handlers = new Map<string, Array<(...args: unknown[]) => void>>()
    const conn: FakeConnection = {
      state: HubConnectionState.Disconnected,
      connectionId: 'fake-conn-id',
      serverTimeoutInMilliseconds: 0,
      keepAliveIntervalInMilliseconds: 0,
      lifecycle: {},
      start: vi.fn(async () => {
        await state.startImpl()
        conn.state = HubConnectionState.Connected
      }),
      stop: vi.fn(async () => {
        conn.state = HubConnectionState.Disconnected
      }),
      on: vi.fn((event: string, cb: (...args: unknown[]) => void) => {
        if (!handlers.has(event)) handlers.set(event, [])
        handlers.get(event)!.push(cb)
      }),
      off: vi.fn((event: string, cb: (...args: unknown[]) => void) => {
        handlers.set(
          event,
          (handlers.get(event) ?? []).filter((h) => h !== cb),
        )
      }),
      invoke: vi.fn(async () => undefined),
      send: vi.fn(async () => undefined),
      onreconnecting: vi.fn((cb: (...args: unknown[]) => void) => {
        conn.lifecycle.reconnecting = cb
      }),
      onreconnected: vi.fn((cb: (...args: unknown[]) => void) => {
        conn.lifecycle.reconnected = cb
      }),
      onclose: vi.fn((cb: (...args: unknown[]) => void) => {
        conn.lifecycle.close = cb
      }),
      emit: (event: string, ...args: unknown[]) =>
        (handlers.get(event) ?? []).forEach((cb) => cb(...args)),
    }
    state.connections.push(conn)
    return conn
  }

  class HubConnectionBuilder {
    withUrl(url: string, options: { accessTokenFactory: () => string }) {
      state.withUrlCalls.push({ url, options })
      return this
    }
    withAutomaticReconnect(delays: unknown) {
      state.reconnectDelays = delays
      return this
    }
    configureLogging() {
      return this
    }
    build() {
      return makeConnection()
    }
  }

  return { HubConnectionState, HttpTransportType, LogLevel, HubConnectionBuilder, state }
})

vi.mock('@microsoft/signalr', () => ({
  HubConnectionBuilder: sr.HubConnectionBuilder,
  HubConnectionState: sr.HubConnectionState,
  HttpTransportType: sr.HttpTransportType,
  LogLevel: sr.LogLevel,
}))

// ---------------------------------------------------------------------------

const config: SignalRConfig = {
  hubUrl: '/chatHub',
  automaticReconnect: true,
  reconnectDelays: [0, 1000, 2000],
  connectionTimeoutMs: 15_000,
}

const lastConnection = () => sr.state.connections[sr.state.connections.length - 1]!

beforeEach(() => {
  // resetAllState() (global beforeEach) already calls SignalRService.resetInstance()
  sr.state.connections.length = 0
  sr.state.withUrlCalls.length = 0
  sr.state.reconnectDelays = undefined
  sr.state.startImpl = () => Promise.resolve()
})

describe('SignalRService singleton', () => {
  it('throws when getInstance is called without config on first init', () => {
    expect(() => SignalRService.getInstance()).toThrow(/config required/)
  })

  it('returns the same instance on subsequent calls, resetInstance clears it', () => {
    const a = SignalRService.getInstance(config)
    expect(SignalRService.getInstance()).toBe(a)

    SignalRService.resetInstance()
    expect(SignalRService.getInstance(config)).not.toBe(a)
  })
})

describe('SignalRService.connect', () => {
  it('builds the connection with the hub URL and an accessTokenFactory', async () => {
    const service = SignalRService.getInstance(config)
    await service.connect('my-token')

    expect(sr.state.withUrlCalls).toHaveLength(1)
    expect(sr.state.withUrlCalls[0]!.url).toBe('/chatHub')
    expect(sr.state.withUrlCalls[0]!.options.accessTokenFactory()).toBe('my-token')
    expect(sr.state.reconnectDelays).toEqual([0, 1000, 2000])
    expect(service.getState()).toBe('connected')
  })

  it('is idempotent when already connected', async () => {
    const service = SignalRService.getInstance(config)
    await service.connect('t')
    await service.connect('t')

    expect(sr.state.connections).toHaveLength(1)
  })

  it('rejects with a timeout error and lands disconnected when start never resolves', async () => {
    useFakeTimersSafe()
    const service = SignalRService.getInstance(config)
    sr.state.startImpl = () => new Promise<void>(() => {}) // never resolves

    const failure = service.connect('t').catch((e: unknown) => e)
    await advance(15_000)
    const error = await failure

    expect(error).toBeInstanceOf(Error)
    expect((error as Error).message).toMatch(/timed out/)
    expect(lastConnection().stop).toHaveBeenCalled()
    expect(service.getState()).toBe('disconnected')
    useRealTimers()
  })
})

describe('SignalRService lifecycle callbacks', () => {
  it('emits stateChange for onreconnecting/onreconnected/onclose and tracks the reconnect counter', async () => {
    const service = SignalRService.getInstance(config)
    const states: string[] = []
    const reconnectedIds: unknown[] = []
    service.on('stateChange', (s) => states.push(s as string))
    service.on('reconnected', (id) => reconnectedIds.push(id))
    await service.connect('t')

    const conn = lastConnection()
    conn.lifecycle.reconnecting!(new Error('drop'))
    expect(service.getConnectionInfo().reconnectAttempts).toBe(1)
    expect(service.getConnectionInfo().lastError).toBe('drop')

    conn.lifecycle.reconnected!('new-conn-id')
    expect(service.getConnectionInfo().reconnectAttempts).toBe(0)
    expect(reconnectedIds).toEqual(['new-conn-id'])

    conn.lifecycle.close!(new Error('bye'))
    expect(states).toEqual(['connecting', 'connected', 'reconnecting', 'connected', 'disconnected'])
  })
})

describe('SignalRService event handler map', () => {
  it('registers queued handlers on the connection and fires them on server push', async () => {
    const service = SignalRService.getInstance(config)
    const received: unknown[][] = []
    service.on('ReceiveMessage', (...args) => received.push(args))
    await service.connect('t')

    lastConnection().emit('ReceiveMessage', 'session-1', 5)
    expect(received).toEqual([['session-1', 5]])
  })

  it('registers a handler directly when already connected', async () => {
    const service = SignalRService.getInstance(config)
    await service.connect('t')

    const received: unknown[][] = []
    service.on('ReceiveMessage', (...args) => received.push(args))
    lastConnection().emit('ReceiveMessage', 'x', 1)
    expect(received).toEqual([['x', 1]])
  })

  it('clearAllEventHandlers empties the map', () => {
    const service = SignalRService.getInstance(config)
    service.on('ReceiveMessage', () => {})
    service.on('stateChange', () => {})
    expect(service.getEventHandlerCount()).toBe(2)

    service.clearAllEventHandlers()
    expect(service.getEventHandlerCount()).toBe(0)
  })
})

describe('SignalRService.disconnect', () => {
  it('stops the connection and reports disconnected', async () => {
    const service = SignalRService.getInstance(config)
    const states: string[] = []
    service.on('stateChange', (s) => states.push(s as string))
    await service.connect('t')
    const conn = lastConnection()

    await service.disconnect()

    expect(conn.stop).toHaveBeenCalled()
    expect(service.getState()).toBe('disconnected')
    expect(states).toContain('disconnected')
  })

  it('is safe when never connected', async () => {
    const service = SignalRService.getInstance(config)
    await expect(service.disconnect()).resolves.toBeUndefined()
    expect(service.getState()).toBe('disconnected')
  })
})

describe('SignalRService.invoke / send', () => {
  it('invoke throws when not connected', async () => {
    const service = SignalRService.getInstance(config)
    await expect(service.invoke('Foo')).rejects.toThrow(/not connected/)
  })

  it('invoke delegates to the connection and returns its result when connected', async () => {
    const service = SignalRService.getInstance(config)
    await service.connect('t')
    lastConnection().invoke.mockResolvedValue('result')

    const result = await service.invoke('Method', 'a', 'b')
    expect(lastConnection().invoke).toHaveBeenCalledWith('Method', 'a', 'b')
    expect(result).toBe('result')
  })

  it('invoke propagates errors and records lastError', async () => {
    const service = SignalRService.getInstance(config)
    await service.connect('t')
    lastConnection().invoke.mockRejectedValue(new Error('rpc failed'))

    await expect(service.invoke('M')).rejects.toThrow('rpc failed')
    expect(service.getConnectionInfo().lastError).toBe('rpc failed')
  })

  it('send silently no-ops when not connected', async () => {
    const service = SignalRService.getInstance(config)
    await expect(service.send('Foo', 1)).resolves.toBeUndefined()
  })

  it('send delegates to the connection when connected', async () => {
    const service = SignalRService.getInstance(config)
    await service.connect('t')

    await service.send('Method', 'x')
    expect(lastConnection().send).toHaveBeenCalledWith('Method', 'x')
  })
})

describe('SignalRService.getState mapping and forceReconnect', () => {
  it('maps HubConnectionState values to ConnectionState', async () => {
    const service = SignalRService.getInstance(config)
    await service.connect('t')
    const conn = lastConnection()

    conn.state = sr.HubConnectionState.Connecting
    expect(service.getState()).toBe('connecting')
    conn.state = sr.HubConnectionState.Reconnecting
    expect(service.getState()).toBe('reconnecting')
    conn.state = 'SomethingElse'
    expect(service.getState()).toBe('failed')
  })

  it('forceReconnect disconnects then reconnects', async () => {
    const service = SignalRService.getInstance(config)
    await service.connect('t')
    await service.forceReconnect('t2')

    expect(sr.state.connections).toHaveLength(2)
    expect(service.getState()).toBe('connected')
  })
})

describe('SignalRService accessTokenFactory captures the connect-time token', () => {
  // Characterization of current behavior: accessTokenFactory (SignalRService.ts
  // ~line 56) closes over the `accessToken` argument passed to connect(). It holds
  // no reference to the auth store, so a token rotation elsewhere (e.g. a 401
  // refresh) is NOT picked up — an automatic reconnect on the same connection
  // still presents the STALE connect-time token. The real remediation is
  // useSignalRChat's force-reconnect watcher (tested in useSignalRChat.test.ts),
  // which issues a fresh forceReconnect with the new token.
  it('an automatic reconnect keeps presenting the OLD token; only forceReconnect swaps it in', async () => {
    const service = SignalRService.getInstance(config)
    await service.connect('token-A')

    const factory = sr.state.withUrlCalls[0]!.options.accessTokenFactory
    expect(factory()).toBe('token-A')

    // Token rotates elsewhere (auth store updated) but no forceReconnect is
    // issued. Drive an automatic reconnect on the SAME connection.
    const conn = lastConnection()
    conn.lifecycle.reconnecting!(new Error('drop'))
    conn.lifecycle.reconnected!('conn-id-2')

    // Still hands SignalR the stale connect-time token — the documented gap.
    expect(factory()).toBe('token-A')

    // A fresh forceReconnect is what actually rebuilds the connection with the
    // new token (this is what the useSignalRChat watcher calls).
    await service.forceReconnect('token-B')
    expect(sr.state.withUrlCalls).toHaveLength(2)
    expect(sr.state.withUrlCalls[1]!.options.accessTokenFactory()).toBe('token-B')
  })
})
