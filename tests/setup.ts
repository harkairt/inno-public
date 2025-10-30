import { beforeAll, afterEach, vi } from 'vitest'
import { cleanup } from '@testing-library/vue'
import { createPinia, setActivePinia } from 'pinia'
import { VueQueryPlugin } from '@tanstack/vue-query'
import { createApp } from 'vue'

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
  error: vi.fn()
}

// Mock Nuxt auto-imports
global.definePageMeta = vi.fn()
global.defineNuxtRouteMiddleware = vi.fn()
global.navigateTo = vi.fn()

// Mock Vue composables
vi.mock('#app', () => ({
  definePageMeta: vi.fn(),
  defineNuxtRouteMiddleware: vi.fn(),
  navigateTo: vi.fn()
}))

// Mock Icon component
vi.mock('#icon', () => ({
  default: {
    name: 'Icon',
    props: ['name'],
    template: '<i :class="`icon-${name}`"></i>'
  }
}))