import { describe, expect, it } from 'vitest'
import { nextTick } from 'vue'
import { useAuthStore } from '@/app/stores/auth'
import { useUserFavorites } from '@/app/composables/useUserFavorites'
import { installBlockedStorage, installQuotaFullStorage } from '@/tests/utils/storage'
import { makeUser } from '@/tests/utils/factories'

const storageKey = (userId: number) => `innochat-user-favorites:${userId}`

function signInAs(userId: number) {
  const authStore = useAuthStore()
  authStore.user = makeUser({ id: userId, email: `user-${userId}@example.com` })
  return authStore
}

describe('useUserFavorites', () => {
  it('loads, validates, and deduplicates the current account favorites', () => {
    signInAs(10)
    localStorage.setItem(
      storageKey(10),
      JSON.stringify({ version: 1, userIds: [4, 4, -1, 8, 'invalid', 2.5] }),
    )

    const favorites = useUserFavorites()

    expect(favorites.favoriteIds.value).toEqual([4, 8])
    expect(favorites.isFavorite(4)).toBe(true)
  })

  it('persists toggles using the versioned account key', () => {
    signInAs(12)
    const favorites = useUserFavorites()

    favorites.toggleFavorite(21)
    favorites.toggleFavorite(34)
    favorites.toggleFavorite(21)

    expect(favorites.favoriteIds.value).toEqual([34])
    expect(JSON.parse(localStorage.getItem(storageKey(12)) ?? 'null')).toEqual({
      version: 1,
      userIds: [34],
    })
  })

  it('reloads an isolated list when the authenticated account changes', async () => {
    const authStore = signInAs(20)
    localStorage.setItem(storageKey(20), JSON.stringify({ version: 1, userIds: [1] }))
    localStorage.setItem(storageKey(30), JSON.stringify({ version: 1, userIds: [2] }))
    const favorites = useUserFavorites()

    expect(favorites.favoriteIds.value).toEqual([1])

    authStore.user = makeUser({ id: 30, email: 'second@example.com' })
    await nextTick()

    expect(favorites.favoriteIds.value).toEqual([2])
  })

  it.each([
    ['malformed JSON', '{'],
    ['an unsupported version', JSON.stringify({ version: 2, userIds: [1] })],
    ['an invalid payload', JSON.stringify({ version: 1, userIds: '1,2' })],
  ])('falls back to an empty list for %s', (_label, value) => {
    signInAs(40)
    localStorage.setItem(storageKey(40), value)

    expect(useUserFavorites().favoriteIds.value).toEqual([])
  })

  it('keeps favorites usable in memory when localStorage is blocked', () => {
    signInAs(50)
    const restore = installBlockedStorage('localStorage')

    try {
      const favorites = useUserFavorites()
      expect(() => favorites.toggleFavorite(9)).not.toThrow()
      expect(favorites.isFavorite(9)).toBe(true)
    } finally {
      restore()
    }
  })

  it('keeps favorites usable in memory when localStorage is quota-full', () => {
    signInAs(60)
    const favorites = useUserFavorites()
    const restore = installQuotaFullStorage('localStorage')

    try {
      expect(() => favorites.toggleFavorite(11)).not.toThrow()
      expect(favorites.isFavorite(11)).toBe(true)
    } finally {
      restore()
    }
  })
})
