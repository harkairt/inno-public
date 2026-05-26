import { beforeAll, afterEach, vi } from 'vitest'
import { cleanup } from '@testing-library/vue'
import { createPinia, setActivePinia } from 'pinia'
import { VueQueryPlugin } from '@tanstack/vue-query'
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

// Clean up after each test
afterEach(() => {
  cleanup()
})

// Setup Pinia and VueQuery before all tests
beforeAll(() => {
  const pinia = createPinia()
  setActivePinia(pinia)

  // Setup VueQuery plugin globally for tests
  const app = createApp({})
  app.use(pinia)
  app.use(VueQueryPlugin)
})

// Global test utilities
global.console = {
  ...console,
  // Silence some console warnings during tests
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
