import { vi } from 'vitest'
import { SignalRService } from '@/lib/signalr/SignalRService'
import type { ConnectionState, SignalRConnectionInfo } from '@/lib/signalr/types'

/**
 * Duck-typed fake of SignalRService for tests. Mirrors the surface the app
 * consumes (useSignalR / useSignalRChat / SignalROperations): connect,
 * disconnect, forceReconnect, on (returns unsubscribe), invoke, send, getState,
 * getConnectionInfo, clearAllEventHandlers — plus test-only helpers to drive
 * server-pushed events and connection state.
 */
export function createFakeSignalR() {
  const handlers = new Map<string, Set<(...args: unknown[]) => void>>()
  let state: ConnectionState = 'disconnected'
  let lastError: string | undefined
  let reconnectAttempts = 0
  const invocations: Array<{ method: string; args: unknown[] }> = []

  const emit = (event: string, ...args: unknown[]) =>
    handlers.get(event)?.forEach((cb) => cb(...args))

  const on = (event: string, cb: (...args: unknown[]) => void): (() => void) => {
    if (!handlers.has(event)) handlers.set(event, new Set())
    handlers.get(event)!.add(cb)
    return () => {
      handlers.get(event)?.delete(cb)
    }
  }

  const fake = {
    connect: vi.fn(async () => {
      state = 'connected'
      emit('stateChange', state)
    }),
    disconnect: vi.fn(async () => {
      state = 'disconnected'
      emit('stateChange', state)
    }),
    forceReconnect: vi.fn(async () => {
      state = 'connected'
      emit('stateChange', state)
    }),
    on,
    invoke: vi.fn(async (method: string, ...args: unknown[]) => {
      invocations.push({ method, args })
    }),
    send: vi.fn(async (method: string, ...args: unknown[]) => {
      invocations.push({ method, args })
    }),
    getState: (): ConnectionState => state,
    getConnectionInfo: (): SignalRConnectionInfo => ({
      state,
      connectionId: state === 'connected' ? 'fake-connection-id' : undefined,
      reconnectAttempts,
      lastError,
    }),
    clearAllEventHandlers: () => handlers.clear(),
    getEventHandlerCount: () => {
      let count = 0
      for (const set of handlers.values()) count += set.size
      return count
    },
    // -------- test-only surface --------
    emitFromServer: (event: string, ...args: unknown[]) => emit(event, ...args),
    setState: (s: ConnectionState, error?: string) => {
      state = s
      lastError = error
      if (s === 'reconnecting') reconnectAttempts++
      emit('stateChange', s)
    },
    invocations,
  }
  return fake
}

/** Install a fake SignalR instance as the singleton and return it. */
export function installFakeSignalR() {
  const fake = createFakeSignalR()
  SignalRService.setInstanceForTests(fake as unknown as SignalRService)
  return fake
}
