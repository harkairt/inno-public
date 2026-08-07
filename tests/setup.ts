import { beforeAll, beforeEach, afterAll, afterEach, vi } from 'vitest'
import { cleanup } from '@testing-library/vue'
import { createPinia, setActivePinia } from 'pinia'
import { VueQueryPlugin } from '@tanstack/vue-query'
import { server } from './msw/server'
import {
  createApp,
  ref,
  computed,
  watch,
  watchEffect,
  reactive,
  readonly,
  toRef,
  toRefs,
  nextTick,
  onMounted,
  onUnmounted,
  onBeforeUnmount,
} from 'vue'

// MSW network-boundary harness. onUnhandledRequest: 'error' surfaces any real
// HTTP a test leaks — add a handler, never downgrade the policy.
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

// Clean up after each test
afterEach(() => {
  cleanup()
})

// Setup VueQuery plugin globally for tests
beforeAll(() => {
  const app = createApp({})
  app.use(VueQueryPlugin)
})

// Fresh Pinia + full singleton reset before every test (test isolation).
// Tests that call their own setActivePinia in beforeEach still win — theirs
// runs after this one.
//
// resetAllState is imported dynamically (not at the top of this setup file) so
// its transitive app/service imports resolve AFTER each test file's vi.mock
// registrations. A static import here would instantiate service singletons
// (authService, chatService) bound to the real apiClient during setup-file
// execution, defeating tests that mock '@/lib/api/client'.
beforeEach(async () => {
  setActivePinia(createPinia())
  const { resetAllState } = await import('./utils/resetAllState')
  resetAllState()
})

// Global test utilities
global.console = {
  ...console,
  // Silence console noise during tests
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
}

// -----------------------------------------------------------------------
// Vue reactivity APIs as globals (Nuxt auto-imports these in components)
// -----------------------------------------------------------------------
global.ref = ref
global.computed = computed
global.watch = watch
global.watchEffect = watchEffect
global.reactive = reactive
global.readonly = readonly
global.toRef = toRef
global.toRefs = toRefs
global.nextTick = nextTick
global.onMounted = onMounted
global.onUnmounted = onUnmounted
global.onBeforeUnmount = onBeforeUnmount

// -----------------------------------------------------------------------
// Nuxt-specific auto-imports
// -----------------------------------------------------------------------
global.definePageMeta = vi.fn()
global.defineNuxtRouteMiddleware = vi.fn()
global.defineNuxtPlugin = (p: unknown) => p
global.navigateTo = vi.fn()
global.useRouter = vi.fn(() => ({
  push: vi.fn(),
  replace: vi.fn(),
  go: vi.fn(),
  back: vi.fn(),
  forward: vi.fn(),
}))
global.useRoute = vi.fn(() => ({ params: {}, query: {}, path: '/', fullPath: '/' }))
global.useRuntimeConfig = vi.fn(() => ({ public: {} }))

// -----------------------------------------------------------------------
// Common composable stubs (override per-test if needed)
// -----------------------------------------------------------------------
global.useI18n = vi.fn(() => ({
  t: (key: string) => key,
  locale: ref('en'),
  d: (val: unknown) => String(val),
  n: (val: unknown) => String(val),
}))

global.useToast = vi.fn(() => ({
  add: vi.fn(),
  remove: vi.fn(),
  clear: vi.fn(),
}))

global.useWindowSize = vi.fn(() => ({
  width: ref(1280),
  height: ref(800),
}))

global.watchDebounced = vi.fn()

global.useNavigationVisibility = vi.fn(() => ({
  isMobile: ref(false),
  isActiveChat: ref(false),
  showBottomTabBar: ref(false),
  showRail: ref(true),
}))

// -----------------------------------------------------------------------
// Vue mocks
// -----------------------------------------------------------------------
vi.mock('#app', () => ({
  definePageMeta: vi.fn(),
  defineNuxtRouteMiddleware: vi.fn(),
  navigateTo: vi.fn(),
}))

// Mock Icon component
vi.mock('#icon', () => ({
  default: {
    name: 'Icon',
    props: ['name'],
    template: '<i :class="`icon-${name}`"></i>',
  },
}))
