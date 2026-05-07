import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ref } from 'vue'

const usersRef = ref([
  { id: 10, name: 'Alice Agent', email: 'alice@example.com', isVirtual: false },
  { id: 11, name: 'Bob Bot', email: 'bob@example.com', isVirtual: true },
])
const sessionsRef = ref([])
const unreadRef = ref([])
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

describe('useChatListData drafts', () => {
  beforeEach(() => {
    sessionsRef.value = []
    unreadRef.value = []
    draftMessagesRef.value = {}
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
