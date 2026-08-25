import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ref } from 'vue'
import type { AISessionHeaderDTO, GetUnreadMessagesDTO } from '@/types/api/schemas'
import { makeSession } from '../../utils/factories'
import { resetChatListFilters } from '@/app/composables/useChatListFilters'

vi.mock('@vueuse/core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@vueuse/core')>()
  return { ...actual, refDebounced: <T>(source: import('vue').Ref<T>) => source }
})

const usersRef = ref([
  { id: 10, name: 'Alice Agent', email: 'alice@example.com', isVirtual: false },
  { id: 11, name: 'Bob Bot', email: 'bob@example.com', isVirtual: true },
])
const sessionsRef = ref<AISessionHeaderDTO[]>([])
const unreadRef = ref<GetUnreadMessagesDTO[]>([])
const draftMessagesRef = ref<Record<string, string>>({})

vi.mock('~/composables/useUsers', () => ({
  useSelectableUsers: () => ({ data: usersRef, isLoading: ref(false), error: ref(null) }),
}))

vi.mock('~/composables/useChatQueries', () => ({
  useChatSessions: () => ({ data: sessionsRef, isLoading: ref(false), error: ref(null) }),
  useUnreadMessageCounts: () => ({ data: unreadRef }),
}))

vi.mock('~/stores/auth', () => ({
  useAuthStore: () => ({ user: { email: 'me@example.com' } }),
}))

vi.mock('~/stores/chat', () => ({
  useChatStore: () => ({ draftMessages: draftMessagesRef.value }),
}))

vi.mock('~/composables/useRelativeDate', () => ({
  useRelativeDate: () => ({ formatRelativeDate: (value: string) => value }),
}))

vi.mock('~/composables/usePrimarySession', () => ({
  getSessionDisplayName: (session: { sessionName: string }) => session.sessionName,
  checkIsPrimarySession: () => false,
  getPrimarySessionForUser: () => null,
}))

const favoriteIdsRef = ref<number[]>([])

vi.mock('~/composables/useUserFavorites', () => ({
  useUserFavorites: () => ({
    favoriteIds: favoriteIdsRef,
    isFavorite: (id: number) => favoriteIdsRef.value.includes(id),
    toggleFavorite: vi.fn(),
  }),
}))

describe('useChatListData drafts', () => {
  beforeEach(() => {
    sessionsRef.value = []
    unreadRef.value = []
    draftMessagesRef.value = {}
    favoriteIdsRef.value = []
    resetChatListFilters()
  })

  it('returns draft-only items from new-* keys', async () => {
    draftMessagesRef.value = {
      'new-10': '  hello   from draft  ',
      'public-11': 'should not be included',
      'new-invalid': 'should not be included',
    }

    const { useChatListData } = await import('~/composables/useChatListData')
    const result = useChatListData()

    expect(result.filteredDraftSessions.value).toEqual([
      {
        draftId: 'draft-new-10',
        draftKey: 'new-10',
        userId: 10,
        userName: 'Alice Agent',
        userEmail: 'alice@example.com',
        preview: 'hello from draft',
        route: '/chats/new/10',
      },
    ])
  })

  it('filters draft-only items with session search query', async () => {
    draftMessagesRef.value = {
      'new-10': 'Project Apollo launch notes',
      'new-11': 'Bob status update',
    }

    const { useChatListData } = await import('~/composables/useChatListData')
    const result = useChatListData()

    result.sessionSearchQuery.value = 'apollo'
    expect(result.filteredDraftSessions.value).toHaveLength(1)
    expect(result.filteredDraftSessions.value[0].userId).toBe(10)

    result.sessionSearchQuery.value = 'bob@example.com'
    expect(result.filteredDraftSessions.value).toHaveLength(1)
    expect(result.filteredDraftSessions.value[0].userId).toBe(11)
  })
})

describe('useChatListData session ordering', () => {
  beforeEach(() => {
    sessionsRef.value = []
    unreadRef.value = []
    draftMessagesRef.value = {}
    favoriteIdsRef.value = []
    resetChatListFilters()
  })

  async function orderedSessionIds(): Promise<string[]> {
    const { useChatListData } = await import('~/composables/useChatListData')
    return useChatListData().filteredSessions.value.map((s) => s.sessionId)
  }

  it('sorts by modifiedAt descending, not by insertDate', async () => {
    sessionsRef.value = [
      makeSession({
        sessionId: 'stale',
        insertDate: '2024-06-01T00:00:00Z',
        modifiedAt: '2024-06-01T00:00:00Z',
      }),
      makeSession({
        sessionId: 'oldest-but-active',
        insertDate: '2024-01-01T00:00:00Z',
        modifiedAt: '2024-09-01T00:00:00Z',
      }),
    ]

    expect(await orderedSessionIds()).toEqual(['oldest-but-active', 'stale'])
  })

  it('falls back to insertDate when modifiedAt is null or absent', async () => {
    const withoutField = makeSession({ sessionId: 'absent', insertDate: '2024-08-01T00:00:00Z' })
    delete withoutField.modifiedAt

    sessionsRef.value = [
      makeSession({ sessionId: 'null-old', insertDate: '2024-02-01T00:00:00Z', modifiedAt: null }),
      withoutField,
      makeSession({
        sessionId: 'modified-middle',
        insertDate: '2024-01-01T00:00:00Z',
        modifiedAt: '2024-05-01T00:00:00Z',
      }),
    ]

    expect(await orderedSessionIds()).toEqual(['absent', 'modified-middle', 'null-old'])
  })

  it('does not reorder sessions by unread status', async () => {
    sessionsRef.value = [
      makeSession({
        sessionId: 'read-recent',
        insertDate: '2024-01-01T00:00:00Z',
        modifiedAt: '2024-09-01T00:00:00Z',
      }),
      makeSession({
        sessionId: 'unread-old',
        insertDate: '2024-01-01T00:00:00Z',
        modifiedAt: '2024-02-01T00:00:00Z',
      }),
    ]
    unreadRef.value = [{ sessionId: 'unread-old', unreadMessageCount: 3 }]

    expect(await orderedSessionIds()).toEqual(['read-recent', 'unread-old'])
  })
})

describe('useChatListData participant type filtering', () => {
  beforeEach(() => {
    sessionsRef.value = []
    unreadRef.value = []
    draftMessagesRef.value = {}
    favoriteIdsRef.value = []
    resetChatListFilters()
  })

  function makeSessionWithMember(
    id: string,
    memberEmail: string,
    isVirtual: boolean,
  ): AISessionHeaderDTO {
    return makeSession({
      sessionId: id,
      members: ['me@example.com', memberEmail],
      memberDetails: [
        { email: 'me@example.com', name: 'Me', isVirtual: false },
        { email: memberEmail, name: memberEmail, isVirtual },
      ],
    })
  }

  it('filters sessions by AI participant type', async () => {
    sessionsRef.value = [
      makeSessionWithMember('human-chat', 'alice@example.com', false),
      makeSessionWithMember('ai-chat', 'bob@example.com', true),
    ]

    const { useChatListData } = await import('~/composables/useChatListData')
    const { useChatListFilters } = await import('~/composables/useChatListFilters')
    const result = useChatListData()
    const filters = useChatListFilters()

    filters.participantType.value = 'ai'
    expect(result.filteredSessions.value.map((s) => s.sessionId)).toEqual(['ai-chat'])
  })

  it('filters sessions by People participant type', async () => {
    sessionsRef.value = [
      makeSessionWithMember('human-chat', 'alice@example.com', false),
      makeSessionWithMember('ai-chat', 'bob@example.com', true),
    ]

    const { useChatListData } = await import('~/composables/useChatListData')
    const { useChatListFilters } = await import('~/composables/useChatListFilters')
    const result = useChatListData()
    const filters = useChatListFilters()

    filters.participantType.value = 'people'
    expect(result.filteredSessions.value.map((s) => s.sessionId)).toEqual(['human-chat'])
  })

  it('shows all sessions when participant type is all', async () => {
    sessionsRef.value = [
      makeSessionWithMember('human-chat', 'alice@example.com', false),
      makeSessionWithMember('ai-chat', 'bob@example.com', true),
    ]

    const { useChatListData } = await import('~/composables/useChatListData')
    const { useChatListFilters } = await import('~/composables/useChatListFilters')
    const result = useChatListData()
    const filters = useChatListFilters()

    filters.participantType.value = 'all'
    expect(result.filteredSessions.value).toHaveLength(2)
  })

  it('falls back to UserDTO.isVirtual when memberDetails is null', async () => {
    sessionsRef.value = [
      makeSession({
        sessionId: 'ai-no-details',
        members: ['me@example.com', 'bob@example.com'],
        memberDetails: null,
      }),
    ]

    const { useChatListData } = await import('~/composables/useChatListData')
    const { useChatListFilters } = await import('~/composables/useChatListFilters')
    const result = useChatListData()
    const filters = useChatListFilters()

    filters.participantType.value = 'ai'
    expect(result.filteredSessions.value.map((s) => s.sessionId)).toEqual(['ai-no-details'])
  })

  it('filters drafts by participant type', async () => {
    draftMessagesRef.value = {
      'new-10': 'Hello Alice',
      'new-11': 'Hello Bot',
    }

    const { useChatListData } = await import('~/composables/useChatListData')
    const { useChatListFilters } = await import('~/composables/useChatListFilters')
    const result = useChatListData()
    const filters = useChatListFilters()

    filters.participantType.value = 'ai'
    expect(result.filteredDraftSessions.value.map((d) => d.userId)).toEqual([11])

    filters.participantType.value = 'people'
    expect(result.filteredDraftSessions.value.map((d) => d.userId)).toEqual([10])
  })

  it('combines text search with participant type filter', async () => {
    sessionsRef.value = [
      makeSessionWithMember('human-chat', 'alice@example.com', false),
      makeSessionWithMember('ai-chat', 'bob@example.com', true),
    ]
    sessionsRef.value[0].sessionName = 'Project Alpha'
    sessionsRef.value[1].sessionName = 'Project Beta'

    const { useChatListData } = await import('~/composables/useChatListData')
    const { useChatListFilters } = await import('~/composables/useChatListFilters')
    const result = useChatListData()
    const filters = useChatListFilters()

    filters.searchQuery.value = 'Project'
    filters.participantType.value = 'ai'
    expect(result.filteredSessions.value.map((s) => s.sessionId)).toEqual(['ai-chat'])
  })
})

describe('useChatListData unread filtering', () => {
  beforeEach(() => {
    sessionsRef.value = []
    unreadRef.value = []
    draftMessagesRef.value = {}
    favoriteIdsRef.value = []
    resetChatListFilters()
  })

  it('shows only sessions with unread messages when unreadOnly is on', async () => {
    sessionsRef.value = [
      makeSession({ sessionId: 'read', members: ['me@example.com', 'alice@example.com'] }),
      makeSession({ sessionId: 'unread', members: ['me@example.com', 'bob@example.com'] }),
    ]
    unreadRef.value = [{ sessionId: 'unread', unreadMessageCount: 5 }]

    const { useChatListData } = await import('~/composables/useChatListData')
    const { useChatListFilters } = await import('~/composables/useChatListFilters')
    const result = useChatListData()
    const filters = useChatListFilters()

    filters.unreadOnly.value = true
    expect(result.filteredSessions.value.map((s) => s.sessionId)).toEqual(['unread'])
  })

  it('hides all drafts when unreadOnly is on', async () => {
    draftMessagesRef.value = { 'new-10': 'Hello Alice' }

    const { useChatListData } = await import('~/composables/useChatListData')
    const { useChatListFilters } = await import('~/composables/useChatListFilters')
    const result = useChatListData()
    const filters = useChatListFilters()

    expect(result.filteredDraftSessions.value).toHaveLength(1)

    filters.unreadOnly.value = true
    expect(result.filteredDraftSessions.value).toHaveLength(0)
  })

  it('treats zero unread count as not unread', async () => {
    sessionsRef.value = [
      makeSession({ sessionId: 'zero', members: ['me@example.com', 'alice@example.com'] }),
    ]
    unreadRef.value = [{ sessionId: 'zero', unreadMessageCount: 0 }]

    const { useChatListData } = await import('~/composables/useChatListData')
    const { useChatListFilters } = await import('~/composables/useChatListFilters')
    const result = useChatListData()
    const filters = useChatListFilters()

    filters.unreadOnly.value = true
    expect(result.filteredSessions.value).toHaveLength(0)
  })
})

describe('useChatListData favorites filtering', () => {
  beforeEach(() => {
    sessionsRef.value = []
    unreadRef.value = []
    draftMessagesRef.value = {}
    favoriteIdsRef.value = []
    resetChatListFilters()
  })

  it('shows only sessions whose primary member is favorited', async () => {
    sessionsRef.value = [
      makeSession({ sessionId: 'fav', members: ['me@example.com', 'alice@example.com'] }),
      makeSession({ sessionId: 'not-fav', members: ['me@example.com', 'bob@example.com'] }),
    ]
    favoriteIdsRef.value = [10]

    const { useChatListData } = await import('~/composables/useChatListData')
    const { useChatListFilters } = await import('~/composables/useChatListFilters')
    const result = useChatListData()
    const filters = useChatListFilters()

    filters.favoritesOnly.value = true
    expect(result.filteredSessions.value.map((s) => s.sessionId)).toEqual(['fav'])
  })

  it('filters drafts by favorited target user', async () => {
    draftMessagesRef.value = {
      'new-10': 'Hello Alice',
      'new-11': 'Hello Bot',
    }
    favoriteIdsRef.value = [11]

    const { useChatListData } = await import('~/composables/useChatListData')
    const { useChatListFilters } = await import('~/composables/useChatListFilters')
    const result = useChatListData()
    const filters = useChatListFilters()

    filters.favoritesOnly.value = true
    expect(result.filteredDraftSessions.value.map((d) => d.userId)).toEqual([11])
  })

  it('combines all filters with AND logic', async () => {
    sessionsRef.value = [
      makeSession({
        sessionId: 'ai-fav-unread',
        members: ['me@example.com', 'bob@example.com'],
        memberDetails: [
          { email: 'me@example.com', name: 'Me', isVirtual: false },
          { email: 'bob@example.com', name: 'Bob', isVirtual: true },
        ],
      }),
      makeSession({
        sessionId: 'ai-not-fav',
        members: ['me@example.com', 'bob@example.com'],
        memberDetails: [
          { email: 'me@example.com', name: 'Me', isVirtual: false },
          { email: 'bob@example.com', name: 'Bob', isVirtual: true },
        ],
      }),
      makeSession({
        sessionId: 'human-fav-unread',
        members: ['me@example.com', 'alice@example.com'],
        memberDetails: [
          { email: 'me@example.com', name: 'Me', isVirtual: false },
          { email: 'alice@example.com', name: 'Alice', isVirtual: false },
        ],
      }),
    ]
    unreadRef.value = [
      { sessionId: 'ai-fav-unread', unreadMessageCount: 2 },
      { sessionId: 'human-fav-unread', unreadMessageCount: 1 },
    ]
    favoriteIdsRef.value = [10, 11]

    const { useChatListData } = await import('~/composables/useChatListData')
    const { useChatListFilters } = await import('~/composables/useChatListFilters')
    const result = useChatListData()
    const filters = useChatListFilters()

    filters.participantType.value = 'ai'
    filters.unreadOnly.value = true
    filters.favoritesOnly.value = true

    expect(result.filteredSessions.value.map((s) => s.sessionId)).toEqual(['ai-fav-unread'])
  })
})
