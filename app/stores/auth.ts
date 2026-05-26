import { defineStore } from 'pinia'
import { ref, computed, type Ref, type ComputedRef } from 'vue'
import { err, ok, type Result } from 'neverthrow'
import { authService } from '@/lib/api/services/AuthService'
import { normalizeApiError } from '@/lib/errors/normalize'
import { AppError } from '@/lib/errors/types'
import { UserDTOSchema } from '@/types/api/schemas'
import type { LoginRequestDTO, UserDTO } from '@/types/api/schemas'
import { ErrorCode } from '@/types/enums'
import { sha512 } from 'js-sha512'
import { extractTokensFromResponse } from '@/lib/api/utils/tokens'
import { useSignalR } from '@/app/composables/useSignalR'
import { useChatStore } from '@/app/stores/chat'
import { getQueryClient } from '@/lib/queryClientSingleton'

// Manual localStorage persistence functions (fallback for Pinia persistence issues)
const AUTH_STORAGE_KEY = 'innochat-auth'
const REMEMBERED_EMAIL_KEY = 'innochat-remembered-email'

// Storage mode: 'localStorage' for normal mode, 'sessionStorage' for public mode
type StorageMode = 'localStorage' | 'sessionStorage'
let storageMode: StorageMode = 'localStorage'

function getStorage(): Storage {
  if (typeof window === 'undefined') {
    // SSR fallback - return a no-op storage
    return {
      length: 0,
      clear: () => {},
      getItem: () => null,
      key: () => null,
      removeItem: () => {},
      setItem: () => {},
    }
  }
  return storageMode === 'sessionStorage' ? sessionStorage : localStorage
}

export function setStorageMode(mode: StorageMode): void {
  // If switching modes, clear the old storage first
  if (storageMode !== mode) {
    clearAuthStateFromStorage()
  }
  storageMode = mode
}

export function getStorageMode(): StorageMode {
  return storageMode
}

// Remember Me helpers - stores only email (not sensitive data)
// SSR-safe: check for window/localStorage availability
// Note: Remember Me always uses localStorage (not affected by storage mode)
export function saveRememberedEmail(email: string): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(REMEMBERED_EMAIL_KEY, email)
}

export function getRememberedEmail(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem(REMEMBERED_EMAIL_KEY)
}

export function clearRememberedEmail(): void {
  if (typeof window === 'undefined') return
  localStorage.removeItem(REMEMBERED_EMAIL_KEY)
}

function saveAuthStateToStorage(
  user: UserDTO | null,
  accessToken: string | null,
  refreshToken: string | null,
): Promise<void> {
  return new Promise((resolve, reject) => {
    try {
      const authData = {
        user,
        accessToken,
        refreshToken,
        timestamp: new Date().toISOString(),
      }
      getStorage().setItem(AUTH_STORAGE_KEY, JSON.stringify(authData))
      resolve()
    } catch (error) {
      reject(error)
    }
  })
}

function loadAuthStateFromStorage(): {
  user: UserDTO | null
  accessToken: string | null
  refreshToken: string | null
} {
  try {
    const stored = getStorage().getItem(AUTH_STORAGE_KEY)
    if (!stored) return { user: null, accessToken: null, refreshToken: null }

    const authData: Record<string, unknown> = JSON.parse(stored) as Record<string, unknown>

    // Validate user data shape
    const userResult = authData.user
      ? UserDTOSchema.safeParse(authData.user)
      : { success: true as const, data: null }
    const user = userResult.success ? (userResult.data ?? null) : null

    return {
      user,
      accessToken: typeof authData.accessToken === 'string' ? authData.accessToken : null,
      refreshToken: typeof authData.refreshToken === 'string' ? authData.refreshToken : null,
    }
  } catch {
    return { user: null, accessToken: null, refreshToken: null }
  }
}

function clearAuthStateFromStorage() {
  try {
    getStorage().removeItem(AUTH_STORAGE_KEY)
  } catch {
    // Silently ignore storage clear errors
  }
}

// Reactive state refs used by extracted action helpers
interface AuthRefs {
  user: Ref<UserDTO | null>
  accessToken: Ref<string | null>
  refreshToken: Ref<string | null>
  isLoading: Ref<boolean>
  lastError: Ref<AppError | null>
  isAuthenticated: ComputedRef<boolean>
  setTokens: (access: string | null, refresh: string | null) => Promise<void>
}

function resetAuthRefs(refs: AuthRefs): void {
  refs.user.value = null
  refs.accessToken.value = null
  refs.refreshToken.value = null
  refs.lastError.value = null
}

function clearCachesAndStorage(): void {
  clearAuthStateFromStorage()
  try {
    const chatStore = useChatStore()
    chatStore.resetUserData()
  } catch {
    // Chat store may not be initialized yet
  }
  getQueryClient().clear()
}

async function performLogin(
  refs: AuthRefs,
  credentials: LoginRequestDTO,
): Promise<Result<UserDTO, AppError>> {
  refs.isLoading.value = true
  refs.lastError.value = null

  try {
    if (typeof credentials.password !== 'string') {
      return err(new AppError(ErrorCode.VALIDATION_ERROR, 'Password is required'))
    }
    credentials.password = sha512(credentials.password)
    const result = await authService.login(credentials)

    if (result.isErr()) {
      refs.lastError.value = result.error
      return err(result.error)
    }

    const tokens = extractTokensFromResponse(result.value.data)

    if (result.value.data.user) {
      refs.user.value = result.value.data.user
      await refs.setTokens(tokens.accessToken, tokens.refreshToken)

      try {
        const { connect } = useSignalR()
        await connect(tokens.accessToken ?? undefined)
      } catch {
        // SignalR is not critical — will retry on next action
      }

      return ok(refs.user.value)
    }

    return err(new AppError(ErrorCode.UNAUTHORIZED, 'Login response missing user data'))
  } finally {
    refs.isLoading.value = false
  }
}

async function performLogout(refs: AuthRefs): Promise<void> {
  refs.isLoading.value = true

  try {
    const { disconnect } = useSignalR()
    await disconnect()
  } catch {
    // Continue with logout even if SignalR disconnect fails
  }

  resetAuthRefs(refs)
  refs.isLoading.value = false
  clearCachesAndStorage()
}

async function performRefreshToken(refs: AuthRefs): Promise<Result<void, AppError>> {
  if (!refs.isAuthenticated.value) {
    return err(new AppError(ErrorCode.UNAUTHORIZED, 'No user to refresh token for'))
  }

  if (!refs.accessToken.value || !refs.refreshToken.value) {
    return err(new AppError(ErrorCode.UNAUTHORIZED, 'No tokens available for refresh'))
  }

  try {
    const result = await authService.refreshToken(refs.accessToken.value, refs.refreshToken.value)

    if (result.isErr()) {
      resetAuthRefs(refs)
      refs.lastError.value = result.error
      return err(result.error)
    }

    const tokens = extractTokensFromResponse(result.value)
    await refs.setTokens(tokens.accessToken, tokens.refreshToken)
    return ok(undefined)
  } catch (error) {
    resetAuthRefs(refs)
    refs.lastError.value = normalizeApiError(error)
    return err(normalizeApiError(error))
  }
}

async function performFetchProfile(
  refs: AuthRefs,
  email: string,
): Promise<Result<UserDTO, AppError>> {
  refs.isLoading.value = true

  try {
    const result = await authService.getProfile(email)

    if (result.isErr()) {
      refs.lastError.value = result.error
      return err(result.error)
    }

    refs.user.value = result.value
    return ok(refs.user.value)
  } finally {
    refs.isLoading.value = false
  }
}

export const useAuthStore = defineStore('auth', () => {
  // State
  const user = ref<UserDTO | null>(null)
  const accessToken = ref<string | null>(null)
  const refreshToken = ref<string | null>(null)
  const isLoading = ref(false)
  const lastError = ref<AppError | null>(null)

  // Computed
  const isAuthenticated = computed(() => user.value !== null)
  const isAdmin = computed(() => user.value?.roles.includes('admin') ?? false)
  const isAgent = computed(() => user.value?.roles.includes('agent') ?? false)
  const userDisplayName = computed(() => user.value?.name ?? 'Unknown User')
  const userAvatar = computed(() => user.value?.image ?? '/images/default-avatar.png')
  const userDarkAvatar = computed(() => user.value?.darkImage ?? '/images/default-avatar-dark.png')
  const getAccessToken = computed(() => accessToken.value)

  function setTokens(access: string | null, refresh: string | null): Promise<void> {
    const validatedAccessToken = access && access.trim() !== '' ? access : null
    const validatedRefreshToken = refresh && refresh.trim() !== '' ? refresh : null
    accessToken.value = validatedAccessToken
    refreshToken.value = validatedRefreshToken
    return saveAuthStateToStorage(user.value, accessToken.value, refreshToken.value)
  }

  // Build shared refs object for extracted helpers
  const refs: AuthRefs = {
    user,
    accessToken,
    refreshToken,
    isLoading,
    lastError,
    isAuthenticated,
    setTokens,
  }

  // Initialize auth state from localStorage
  const storedAuth = loadAuthStateFromStorage()
  if (storedAuth.user && storedAuth.accessToken) {
    user.value = storedAuth.user
    accessToken.value = storedAuth.accessToken
    refreshToken.value = storedAuth.refreshToken
  }

  function clearAuth(): void {
    resetAuthRefs(refs)
    isLoading.value = false
    clearCachesAndStorage()
  }

  function clearError(): void {
    lastError.value = null
  }

  return {
    user,
    accessToken,
    refreshToken,
    isLoading,
    lastError,
    isAuthenticated,
    isAdmin,
    isAgent,
    userDisplayName,
    userAvatar,
    userDarkAvatar,
    getAccessToken,
    login: (credentials: LoginRequestDTO) => performLogin(refs, credentials),
    logout: () => performLogout(refs),
    refreshAuthToken: () => performRefreshToken(refs),
    fetchProfile: (email: string) => performFetchProfile(refs, email),
    clearAuth,
    setTokens,
    clearError,
  }
})
