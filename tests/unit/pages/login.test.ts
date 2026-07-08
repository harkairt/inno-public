/**
 * login.vue page tests.
 *
 * Drives the REAL login flow: the page's useLogin() mutation → real auth store
 * login() → real AuthService → real axios/interceptors → MSW at the network
 * boundary. Nothing here mocks the store, service, or apiClient.
 *
 * Note on the redirect assertion: login.vue redirects via `router.push(...)`
 * (NOT `navigateTo`), and its default target is `/` (index.vue then bounces
 * `/` → `/chats` via its own middleware). We assert the real behavior.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { screen, fireEvent, waitFor } from '@testing-library/vue'
import type { Component } from 'vue'
import { renderWithProviders } from '@/tests/utils/render'
import { server, http, HttpResponse } from '@/tests/msw/server'
import { useAuthStore } from '@/app/stores/auth'
import LoginPage from '@/app/pages/login.vue'

// useAuthStore is a Nuxt auto-import in the SFC; expose the REAL store globally
// so the page uses it (real login → MSW), no mocking.
beforeEach(() => {
  vi.stubGlobal('useAuthStore', useAuthStore)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

const LOGIN_PATH = '/api/authentication/login'
const REMEMBERED_EMAIL_KEY = 'innochat-remembered-email'

// Minimal Nuxt UI stubs — enough DOM to fill the form and read the error alert.
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

/** Point the page's useRoute() at a chosen query; must run before render. */
function setRoute(query: Record<string, string> = {}) {
  vi.mocked(useRoute).mockReturnValue({
    params: {},
    query,
    path: '/login',
    fullPath: '/login',
  } as never)
}

/** Give the page a stable router with a push spy; must run before render. */
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

function renderLogin() {
  return renderWithProviders(LoginPage as Component, { global: { stubs } })
}

async function fillCredentials(email = 'agent@example.com', password = 'secret-pw') {
  await fireEvent.update(screen.getByLabelText('login.email'), email)
  await fireEvent.update(screen.getByLabelText('login.password'), password)
}

function submitForm(container: HTMLElement) {
  return fireEvent.submit(container.querySelector('form') as HTMLFormElement)
}

describe('login page', () => {
  it('submits valid credentials and redirects home on success', async () => {
    setRoute({})
    const push = setRouter()
    const { container } = renderLogin()

    await fillCredentials()
    await submitForm(container)

    // Default handler (tests/msw/handlers/auth.ts) returns a successful login.
    await waitFor(() => expect(push).toHaveBeenCalledWith('/'))
  })

  it('shows a visible error message when credentials are invalid', async () => {
    // The backend signals invalid credentials via the `warning` field (HTTP 200),
    // which AuthService maps to InvalidCredentialsError.
    server.use(
      http.post(LOGIN_PATH, () =>
        HttpResponse.json({
          data: null,
          warning: 'Hibás felhasználónév / jelszó',
          success: null,
          error: null,
        }),
      ),
    )
    setRoute({})
    setRouter()
    const { container } = renderLogin()

    await fillCredentials('wrong@example.com', 'bad-pw')
    await submitForm(container)

    const alert = await screen.findByRole('alert')
    expect(alert.textContent).toContain('Invalid username or password')
  })

  it('writes the remembered email to localStorage when "remember me" is checked', async () => {
    setRoute({})
    setRouter()
    const { container } = renderLogin()

    await fireEvent.click(screen.getByRole('checkbox'))
    await fillCredentials('remember@example.com', 'secret-pw')
    await submitForm(container)

    await waitFor(() =>
      expect(localStorage.getItem(REMEMBERED_EMAIL_KEY)).toBe('remember@example.com'),
    )
  })

  it('honors the ?redirect= query param on success', async () => {
    setRoute({ redirect: '/somewhere' })
    const push = setRouter()
    const { container } = renderLogin()

    await fillCredentials()
    await submitForm(container)

    await waitFor(() => expect(push).toHaveBeenCalledWith('/somewhere'))
  })
})
