import { defineStore } from "pinia";
import { ref, computed } from "vue";
import { err, ok, type Result } from "neverthrow";
import { authService } from "@/lib/api/services/AuthService";
import { normalizeApiError } from "@/lib/errors/normalize";
import { AppError } from "@/lib/errors/types";
import { UserDTOSchema } from "@/types/api/schemas";
import type { LoginRequestDTO, UserDTO } from "@/types/api/schemas";
import { ErrorCode } from "@/types/enums";
import { sha512 } from 'js-sha512'
import { extractTokensFromResponse } from "@/lib/api/utils/tokens";
import { useSignalR } from '@/app/composables/useSignalR'

// Manual localStorage persistence functions (fallback for Pinia persistence issues)
const AUTH_STORAGE_KEY = "innochat-auth";
const REMEMBERED_EMAIL_KEY = "innochat-remembered-email";

// Storage mode: 'localStorage' for normal mode, 'sessionStorage' for public mode
type StorageMode = 'localStorage' | 'sessionStorage';
let storageMode: StorageMode = 'localStorage';

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
    };
  }
  return storageMode === 'sessionStorage' ? sessionStorage : localStorage;
}

export function setStorageMode(mode: StorageMode): void {
  // If switching modes, clear the old storage first
  if (storageMode !== mode) {
    clearAuthStateFromStorage();
  }
  storageMode = mode;
}

export function getStorageMode(): StorageMode {
  return storageMode;
}

// Remember Me helpers - stores only email (not sensitive data)
// SSR-safe: check for window/localStorage availability
// Note: Remember Me always uses localStorage (not affected by storage mode)
export function saveRememberedEmail(email: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(REMEMBERED_EMAIL_KEY, email);
}

export function getRememberedEmail(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(REMEMBERED_EMAIL_KEY);
}

export function clearRememberedEmail(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(REMEMBERED_EMAIL_KEY);
}

function saveAuthStateToStorage(user: UserDTO | null, accessToken: string | null, refreshToken: string | null): Promise<void> {
  return new Promise((resolve, reject) => {
    try {
      const authData = {
        user,
        accessToken,
        refreshToken,
        timestamp: new Date().toISOString()
      };
      getStorage().setItem(AUTH_STORAGE_KEY, JSON.stringify(authData));
      resolve();
    } catch (error) {
      reject(error);
    }
  });
}

function loadAuthStateFromStorage(): { user: UserDTO | null; accessToken: string | null; refreshToken: string | null } {
  try {
    const stored = getStorage().getItem(AUTH_STORAGE_KEY);
    if (!stored) return { user: null, accessToken: null, refreshToken: null };

    const authData = JSON.parse(stored);

    // Validate user data shape
    const userResult = authData.user ? UserDTOSchema.safeParse(authData.user) : { success: true as const, data: null }
    const user = userResult.success ? (userResult.data ?? null) : null

    return {
      user,
      accessToken: typeof authData.accessToken === 'string' ? authData.accessToken : null,
      refreshToken: typeof authData.refreshToken === 'string' ? authData.refreshToken : null
    };
  } catch {
    return { user: null, accessToken: null, refreshToken: null };
  }
}

function clearAuthStateFromStorage() {
  try {
    getStorage().removeItem(AUTH_STORAGE_KEY);
  } catch {
    // Silently ignore storage clear errors
  }
}

export const useAuthStore = defineStore(
  "auth",
  () => {
    // State
    const user = ref<UserDTO | null>(null);
    const accessToken = ref<string | null>(null);
    const refreshToken = ref<string | null>(null);
    const isLoading = ref(false);
    const lastError = ref<AppError | null>(null);

    // Initialize auth state from localStorage on store creation
    const initializeAuthState = () => {
      const storedAuth = loadAuthStateFromStorage();
      if (storedAuth.user && storedAuth.accessToken) {
        user.value = storedAuth.user;
        accessToken.value = storedAuth.accessToken;
        refreshToken.value = storedAuth.refreshToken;
      }
    };

    // Initialize on store creation
    initializeAuthState();

    // Computed
    const isAuthenticated = computed(() => user.value !== null);
    const isAdmin = computed(
      () => user.value?.roles.includes("admin") ?? false
    );
    const isAgent = computed(
      () => user.value?.roles.includes("agent") ?? false
    );
    const userDisplayName = computed(() => user.value?.name ?? "Unknown User");
    const userAvatar = computed(
      () => user.value?.image ?? "/images/default-avatar.png"
    );
    const userDarkAvatar = computed(
      () => user.value?.darkImage ?? "/images/default-avatar-dark.png"
    );
    const getAccessToken = computed(() => accessToken.value);

    // Actions
    async function login(
      credentials: LoginRequestDTO
    ): Promise<Result<UserDTO, AppError>> {
      isLoading.value = true;
      lastError.value = null;

      try {
        // Validate password before hashing - sha512 requires a string input
        if (typeof credentials.password !== 'string') {
          return err(new AppError(ErrorCode.VALIDATION_ERROR, 'Password is required'));
        }
        credentials.password = sha512(credentials.password);
        const result = await authService.login(credentials);

        if (result.isErr()) {
          lastError.value = result.error;
          return err(result.error);
        }
        // Extract and store tokens
        const tokens = extractTokensFromResponse(result.value.data);

        if (result.value.data.user) {
          // Use UserDTO directly
          user.value = result.value.data.user;

          // Use setTokens to ensure atomic storage
          await setTokens(tokens.accessToken, tokens.refreshToken);

          // Initialize SignalR connection after successful login
          try {
            const { connect } = useSignalR()
            await connect(tokens.accessToken ?? undefined)
          } catch  {
            // Don't block login flow if SignalR fails - it's not critical
            // User can still use the app, SignalR will retry on next action
          }

          return ok(user.value);
        }

        return err(
          new AppError(
            ErrorCode.UNAUTHORIZED,
            "Login response missing user data"
          )
        );
      } finally {
        isLoading.value = false;
      }
    }

    async function logout(): Promise<void> {
      isLoading.value = true;

      // Disconnect SignalR before clearing auth state (best-effort)
      try {
        const { disconnect } = useSignalR()
        await disconnect()
      } catch {
        // Continue with logout even if SignalR disconnect fails
      }

      // Clear auth state - no API call needed
      user.value = null;
      accessToken.value = null;
      refreshToken.value = null;
      lastError.value = null;
      isLoading.value = false;

      // Clear auth state from localStorage
      clearAuthStateFromStorage();
    }

    async function refreshAuthToken(): Promise<Result<void, AppError>> {
      if (!isAuthenticated.value) {
        return err(
          new AppError(ErrorCode.UNAUTHORIZED, "No user to refresh token for")
        );
      }

      if (!accessToken.value || !refreshToken.value) {
        return err(
          new AppError(ErrorCode.UNAUTHORIZED, "No tokens available for refresh")
        );
      }

      try {
        const result = await authService.refreshToken(accessToken.value, refreshToken.value);

        if (result.isErr()) {
          // Refresh failed - clear auth state
          user.value = null;
          accessToken.value = null;
          refreshToken.value = null;
          lastError.value = result.error;
          return err(result.error);
        }

        // Extract and store new tokens
        const tokens = extractTokensFromResponse(result.value);
        await setTokens(tokens.accessToken, tokens.refreshToken);

        // Token refreshed successfully, user remains the same
        return ok(undefined);
      } catch (error) {
        // Unexpected error - clear auth state
        user.value = null;
        accessToken.value = null;
        refreshToken.value = null;
        lastError.value = normalizeApiError(error);
        return err(normalizeApiError(error));
      }
    }

    async function fetchProfile(
      email: string
    ): Promise<Result<UserDTO, AppError>> {
      isLoading.value = true;

      try {
        const result = await authService.getProfile(email);

        if (result.isErr()) {
          lastError.value = result.error;
          return err(result.error);
        }

        user.value = result.value;
        return ok(user.value);
      } finally {
        isLoading.value = false;
      }
    }

    function clearAuth(): void {
      user.value = null;
      accessToken.value = null;
      refreshToken.value = null;
      lastError.value = null;
      isLoading.value = false;

      // Clear auth state from localStorage
      clearAuthStateFromStorage();
    }

    function setTokens(access: string | null, refresh: string | null): Promise<void> {
      // Validate tokens before storing
      const validatedAccessToken = access && access.trim() !== '' ? access : null;
      const validatedRefreshToken = refresh && refresh.trim() !== '' ? refresh : null;

      // Update reactive state immediately
      accessToken.value = validatedAccessToken;
      refreshToken.value = validatedRefreshToken;

      // Save auth state to localStorage when tokens are updated and return Promise
      return saveAuthStateToStorage(user.value, accessToken.value, refreshToken.value);
    }

    function clearError(): void {
      lastError.value = null;
    }

    return {
      // State
      user,
      accessToken,
      refreshToken,
      isLoading,
      lastError,

      // Computed
      isAuthenticated,
      isAdmin,
      isAgent,
      userDisplayName,
      userAvatar,
      userDarkAvatar,
      getAccessToken,

      // Actions
      login,
      logout,
      refreshAuthToken,
      fetchProfile,
      clearAuth,
      setTokens,
      clearError,
    };
  }
);
