import { computed, readonly, ref, watch } from 'vue'
import { useAuthStore } from '~/stores/auth'

const STORAGE_PREFIX = 'innochat-user-favorites'
const STORAGE_VERSION = 1

interface StoredUserFavorites {
  version: typeof STORAGE_VERSION
  userIds: number[]
}

function parseStoredFavorites(raw: string | null): number[] {
  if (!raw) return []

  try {
    const parsed = JSON.parse(raw) as Partial<StoredUserFavorites> | null
    if (parsed?.version !== STORAGE_VERSION || !Array.isArray(parsed.userIds)) return []

    return [
      ...new Set(
        parsed.userIds.filter(
          (userId): userId is number =>
            typeof userId === 'number' && Number.isInteger(userId) && userId >= 0,
        ),
      ),
    ]
  } catch {
    return []
  }
}

export function useUserFavorites() {
  const authStore = useAuthStore()
  const favoriteIds = ref<number[]>([])

  const storageKey = computed(() => {
    const currentUserId = authStore.user?.id
    return currentUserId === undefined ? null : `${STORAGE_PREFIX}:${currentUserId}`
  })

  function loadFavorites(): void {
    if (typeof window === 'undefined' || !storageKey.value) {
      favoriteIds.value = []
      return
    }

    try {
      favoriteIds.value = parseStoredFavorites(localStorage.getItem(storageKey.value))
    } catch {
      favoriteIds.value = []
    }
  }

  function persistFavorites(): void {
    if (typeof window === 'undefined' || !storageKey.value) return

    try {
      const value: StoredUserFavorites = {
        version: STORAGE_VERSION,
        userIds: favoriteIds.value,
      }
      localStorage.setItem(storageKey.value, JSON.stringify(value))
    } catch {
      // Browser storage can be blocked or quota-full. Favorites remain usable in memory.
    }
  }

  function isFavorite(userId: number): boolean {
    return favoriteIds.value.includes(userId)
  }

  function toggleFavorite(userId: number): void {
    favoriteIds.value = isFavorite(userId)
      ? favoriteIds.value.filter((id) => id !== userId)
      : [...favoriteIds.value, userId]
    persistFavorites()
  }

  watch(storageKey, loadFavorites, { immediate: true })

  return {
    favoriteIds: readonly(favoriteIds),
    isFavorite,
    toggleFavorite,
  }
}
