/**
 * Integration flow #1 — login → chats.
 *
 * Drives the REAL post-login journey end to end: the login page's useLogin()
 * mutation → real auth store login() → real AuthService → real axios +
 * interceptor chain → MSW at the network boundary. On success the tokens land
 * in the store and localStorage and the page redirects to `/` (its real
 * target). index.vue's page-meta middleware then bounces `/` → `/chats`, which
 * we exercise to prove the user "lands on chats". Nothing here mocks the store,
 * service, or apiClient.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { screen, fireEvent, waitFor } from '@testing-library/vue'
import type { Component } from 'vue'
import { renderWithProviders } from '@/tests/utils/render'
import { useAuthStore } from '@/app/stores/auth'
import LoginPage from '@/app/pages/login.vue'
import IndexPage from '@/app/pages/index.vue'

// useAuthStore is a Nuxt auto-import in the SFC; expose the REAL store globally
// so the page drives real login → MSW (no mocking).
beforeEach(() => {
  vi.stubGlobal('useAuthStore', useAuthStore)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

const AUTH_STORAGE_KEY = 'innochat-auth'

// Minimal Nuxt UI stubs — enough DOM to fill the form and submit.
const stubs = {
  UInput: {
    props: ['modelValue'],
    emits: ['update:modelValue'],
    template:
      '<input v-bind="$attrs" :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" />',
  },
  UCheckbox: {
    props: ['modelValue'],
    emits: ['update:modelValue'],
    template:
      '<input type="checkbox" v-bind="$attrs" :checked="modelValue" @click="$emit(\'update:modelValue\', !modelValue)" />',
  },
  UButton: { template: '<button v-bind="$attrs"><slot /></button>' },
  UAlert: { props: ['title'], template: '<div role="alert">{{ title }}</div>' },
  UIcon: { props: ['name'], template: '<i :data-name="name" />' },
}

function setRoute(query: Record<string, string> = {}) {
  vi.mocked(useRoute).mockReturnValue({
    params: {},
    query,
    path: '/login',
    fullPath: '/login',
  } as never)
}

function setRouter() {
  const push = vi.fn()
  vi.mocked(useRouter).mockReturnValue({
    push,
    replace: vi.fn(),
    go: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
  } as never)
  return push
}

async function fillCredentials(email = 'agent@example.com', password = 'secret-pw') {
  await fireEvent.update(screen.getByLabelText('login.email'), email)
  await fireEvent.update(screen.getByLabelText('login.password'), password)
}

describe('login → chats (real stack, MSW at the boundary)', () => {
  it('submits valid credentials, persists tokens, redirects to /, and / bounces to /chats', async () => {
    setRoute({})
    const push = setRouter()

    const { container, authStore } = renderWithProviders(LoginPage as Component, {
      global: { stubs },
    })

    await fillCredentials()
    await fireEvent.submit(container.querySelector('form') as HTMLFormElement)

    // Real login succeeded via the default MSW auth handler → tokens in the store.
    await waitFor(() => expect(authStore.isAuthenticated).toBe(true))
    expect(authStore.accessToken).toBe('access-token-1')
    expect(authStore.refreshToken).toBe('refresh-token-1')

    // Tokens persisted to localStorage (authenticated mode).
    const stored = JSON.parse(localStorage.getItem(AUTH_STORAGE_KEY) ?? 'null') as {
      accessToken?: string
      refreshToken?: string
    } | null
    expect(stored?.accessToken).toBe('access-token-1')
    expect(stored?.refreshToken).toBe('refresh-token-1')

    // The page's real post-login target is `/`.
    await waitFor(() => expect(push).toHaveBeenCalledWith('/'))

    // index.vue then bounces `/` → `/chats` via its page-meta middleware.
    vi.mocked(definePageMeta).mockClear()
    vi.mocked(navigateTo).mockClear()

    renderWithProviders(IndexPage as Component)

    const meta = vi.mocked(definePageMeta).mock.calls.at(-1)?.[0] as
      | { middleware?: () => unknown }
      | undefined
    expect(typeof meta?.middleware).toBe('function')

    meta?.middleware?.()
    expect(navigateTo).toHaveBeenCalledWith('/chats')
  })
})
