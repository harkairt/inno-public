/**
 * Test stub for the @vite-pwa `virtual:pwa-register/vue` module, which only
 * exists during a Nuxt/Vite build. Aliased in vitest.config.ts so usePWAUpdate's
 * dynamic import resolves in tests. State lives on globalThis so it survives the
 * vi.resetModules() the usePWAUpdate test uses to reset the composable singleton.
 */
import { ref, type Ref } from 'vue'

interface PwaStubState {
  needRefresh: Ref<boolean>
  offlineReady: Ref<boolean>
  updateServiceWorker: (reloadPage?: boolean) => Promise<void>
  onRegisteredSW?: (swUrl: string, registration: { update: () => void } | undefined) => void
  onRegisterError?: (error: unknown) => void
  calls: number
}

const g = globalThis as unknown as { __pwaStub?: PwaStubState }

export function getPwaStub(): PwaStubState {
  g.__pwaStub ??= {
    needRefresh: ref(false),
    offlineReady: ref(false),
    updateServiceWorker: () => Promise.resolve(),
    calls: 0,
  }
  return g.__pwaStub
}

export function useRegisterSW(options: {
  onRegisteredSW?: PwaStubState['onRegisteredSW']
  onRegisterError?: PwaStubState['onRegisterError']
}) {
  const state = getPwaStub()
  state.onRegisteredSW = options.onRegisteredSW
  state.onRegisterError = options.onRegisterError
  state.calls++
  return {
    needRefresh: state.needRefresh,
    offlineReady: state.offlineReady,
    updateServiceWorker: state.updateServiceWorker,
  }
}
