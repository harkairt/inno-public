import type { UserDTO } from '@/types/api/schemas'
import { makeUser } from './factories'
import { setStorageMode } from '@/app/stores/auth'

// Keys mirror the constants in app/stores/auth.ts (AUTH_STORAGE_KEY,
// REMEMBERED_EMAIL_KEY). loadAuthStateFromStorage() reads user/accessToken/
// refreshToken; timestamp is written by the app (ISO string) but ignored on load.
const AUTH_STORAGE_KEY = 'innochat-auth'
const REMEMBERED_EMAIL_KEY = 'innochat-remembered-email'

/**
 * Seed persisted auth state so a freshly-created auth store hydrates as
 * logged-in. Set mode to 'sessionStorage' to emulate public/iframe mode.
 */
export function seedAuthStorage(
  opts: {
    user?: UserDTO
    accessToken?: string
    refreshToken?: string
    mode?: 'localStorage' | 'sessionStorage'
  } = {},
): void {
  if (opts.mode === 'sessionStorage') setStorageMode('sessionStorage')
  const storage = opts.mode === 'sessionStorage' ? sessionStorage : localStorage
  storage.setItem(
    AUTH_STORAGE_KEY,
    JSON.stringify({
      user: opts.user ?? makeUser(),
      accessToken: opts.accessToken ?? 'seeded-access-token',
      refreshToken: opts.refreshToken ?? 'seeded-refresh-token',
      timestamp: new Date('2023-11-14T22:13:20.000Z').toISOString(),
    }),
  )
}

/** Seed the "remember me" email (always localStorage, per the store). */
export function seedRememberedEmail(email: string): void {
  localStorage.setItem(REMEMBERED_EMAIL_KEY, email)
}

/** Switch the auth store into public/iframe mode (sessionStorage-backed). */
export function enablePublicMode(): void {
  setStorageMode('sessionStorage')
}
