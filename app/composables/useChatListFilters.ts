import { computed, ref, type ComputedRef, type Ref } from 'vue'

export type ParticipantType = 'all' | 'ai' | 'people'

export interface ChatListFilters {
  searchQuery: Ref<string>
  participantType: Ref<ParticipantType>
  unreadOnly: Ref<boolean>
  favoritesOnly: Ref<boolean>
  hasActiveFilters: ComputedRef<boolean>
  clearAll: () => void
}

const searchQuery = ref('')
const participantType = ref<ParticipantType>('all')
const unreadOnly = ref(false)
const favoritesOnly = ref(false)

function resetFilterValues(): void {
  searchQuery.value = ''
  participantType.value = 'all'
  unreadOnly.value = false
  favoritesOnly.value = false
}

export function useChatListFilters(): ChatListFilters {
  const hasActiveFilters = computed(
    () =>
      searchQuery.value.trim() !== '' ||
      participantType.value !== 'all' ||
      unreadOnly.value ||
      favoritesOnly.value,
  )

  return {
    searchQuery,
    participantType,
    unreadOnly,
    favoritesOnly,
    hasActiveFilters,
    clearAll: resetFilterValues,
  }
}

export function resetChatListFilters(): void {
  resetFilterValues()
}
