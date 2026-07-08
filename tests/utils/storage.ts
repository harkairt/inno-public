import { vi } from 'vitest'

// Simulate hostile browser Storage: blocked (Safari private mode / third-party
// iframe → SecurityError) or quota-full (QuotaExceededError). happy-dom exposes
// real window.localStorage/sessionStorage as Proxies, so rather than patch their
// methods in place (which doesn't cleanly restore), we swap the whole object on
// window with a Proxy that delegates to the real Storage but throws from the
// chosen methods. restore() puts the original back — call it in afterEach.

type StorageName = 'localStorage' | 'sessionStorage'
type StorageTarget = StorageName | 'both'
type Method = 'getItem' | 'setItem' | 'removeItem'
type Overrides = Partial<Record<Method, Storage[Method]>>

function securityError(): DOMException {
  return new DOMException('The operation is insecure.', 'SecurityError')
}

function quotaExceededError(): DOMException {
  return new DOMException('The quota has been exceeded.', 'QuotaExceededError')
}

function resolveNames(target: StorageTarget): StorageName[] {
  return target === 'both' ? ['localStorage', 'sessionStorage'] : [target]
}

function patchStorage(target: StorageTarget, overrides: Overrides): () => void {
  const restores: Array<() => void> = []

  for (const name of resolveNames(target)) {
    const original = window[name]
    const originalDescriptor = Object.getOwnPropertyDescriptor(window, name)

    const patched = new Proxy(original, {
      get(store, prop, receiver) {
        if (typeof prop === 'string' && prop in overrides) {
          return overrides[prop as Method]
        }
        const value: unknown = Reflect.get(store, prop, receiver)
        return typeof value === 'function'
          ? (value as (...args: unknown[]) => unknown).bind(store)
          : value
      },
    })

    Object.defineProperty(window, name, { configurable: true, value: patched })
    restores.push(() => {
      if (originalDescriptor) Object.defineProperty(window, name, originalDescriptor)
      else Reflect.deleteProperty(window, name)
    })
  }

  return () => restores.forEach((restore) => restore())
}

/**
 * Make the target Storage throw a SecurityError-like DOMException on every
 * getItem/setItem/removeItem (mimics Safari private mode / a third-party
 * iframe). Returns restore().
 */
export function installBlockedStorage(target: StorageTarget = 'localStorage'): () => void {
  return patchStorage(target, {
    getItem: vi.fn(() => {
      throw securityError()
    }),
    setItem: vi.fn(() => {
      throw securityError()
    }),
    removeItem: vi.fn(() => {
      throw securityError()
    }),
  })
}

/**
 * Make the target Storage throw QuotaExceededError on setItem while getItem and
 * removeItem keep working (mimics a full quota). Returns restore().
 */
export function installQuotaFullStorage(target: StorageTarget = 'localStorage'): () => void {
  return patchStorage(target, {
    setItem: vi.fn(() => {
      throw quotaExceededError()
    }),
  })
}
