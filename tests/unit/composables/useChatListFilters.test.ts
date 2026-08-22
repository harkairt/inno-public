import { describe, it, expect, beforeEach } from 'vitest'
import { useChatListFilters, resetChatListFilters } from '@/app/composables/useChatListFilters'

describe('useChatListFilters', () => {
  beforeEach(() => {
    resetChatListFilters()
  })

  it('returns default values', () => {
    const filters = useChatListFilters()

    expect(filters.searchQuery.value).toBe('')
    expect(filters.participantType.value).toBe('all')
    expect(filters.unreadOnly.value).toBe(false)
    expect(filters.favoritesOnly.value).toBe(false)
    expect(filters.hasActiveFilters.value).toBe(false)
  })

  it('hasActiveFilters is true when searchQuery is non-empty', () => {
    const filters = useChatListFilters()
    filters.searchQuery.value = 'test'
    expect(filters.hasActiveFilters.value).toBe(true)
  })

  it('hasActiveFilters ignores whitespace-only search', () => {
    const filters = useChatListFilters()
    filters.searchQuery.value = '   '
    expect(filters.hasActiveFilters.value).toBe(false)
  })

  it('hasActiveFilters is true when participantType is not all', () => {
    const filters = useChatListFilters()
    filters.participantType.value = 'ai'
    expect(filters.hasActiveFilters.value).toBe(true)

    filters.participantType.value = 'people'
    expect(filters.hasActiveFilters.value).toBe(true)
  })

  it('hasActiveFilters is true when unreadOnly is on', () => {
    const filters = useChatListFilters()
    filters.unreadOnly.value = true
    expect(filters.hasActiveFilters.value).toBe(true)
  })

  it('hasActiveFilters is true when favoritesOnly is on', () => {
    const filters = useChatListFilters()
    filters.favoritesOnly.value = true
    expect(filters.hasActiveFilters.value).toBe(true)
  })

  it('clearAll resets all filters to defaults', () => {
    const filters = useChatListFilters()
    filters.searchQuery.value = 'query'
    filters.participantType.value = 'ai'
    filters.unreadOnly.value = true
    filters.favoritesOnly.value = true

    filters.clearAll()

    expect(filters.searchQuery.value).toBe('')
    expect(filters.participantType.value).toBe('all')
    expect(filters.unreadOnly.value).toBe(false)
    expect(filters.favoritesOnly.value).toBe(false)
    expect(filters.hasActiveFilters.value).toBe(false)
  })

  it('shares state across multiple calls', () => {
    const a = useChatListFilters()
    const b = useChatListFilters()

    a.participantType.value = 'people'
    expect(b.participantType.value).toBe('people')

    b.searchQuery.value = 'shared'
    expect(a.searchQuery.value).toBe('shared')
  })
})
