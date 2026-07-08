import { render, type RenderOptions } from '@testing-library/vue'
import { createPinia, setActivePinia } from 'pinia'
import { VueQueryPlugin, QueryClient } from '@tanstack/vue-query'
import { vi } from 'vitest'
import type { Component } from 'vue'
import { setQueryClient } from '@/lib/queryClientSingleton'
import { configureApiInterceptors } from '@/lib/api/interceptors/setup'
import { useAuthStore } from '@/app/stores/auth'

/** QueryClient tuned for deterministic tests: no retries, no GC eviction. */
export function createTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity, staleTime: 0 },
      mutations: { retry: false },
    },
  })
}

/**
 * Render a component with a fresh Pinia, a test QueryClient wired into the
 * singleton, and API interceptors configured against the store.
 */
export function renderWithProviders(component: Component, options: RenderOptions<Component> = {}) {
  const pinia = createPinia()
  setActivePinia(pinia)
  const queryClient = createTestQueryClient()
  setQueryClient(queryClient)

  const result = render(component, {
    ...options,
    global: {
      ...options.global,
      plugins: [pinia, [VueQueryPlugin, { queryClient }], ...(options.global?.plugins ?? [])],
    },
  })

  const authStore = useAuthStore()
  const redirectToLogin = vi.fn()
  configureApiInterceptors({ authStore, redirectToLogin })

  return { ...result, pinia, queryClient, authStore, redirectToLogin }
}
