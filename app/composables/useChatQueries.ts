import { useQuery, useQueryClient } from '@tanstack/vue-query'
import { chatService } from '@/lib/api/services/ChatService'
import { useAuthStore } from '@/app/stores/auth'
import { toValue, type MaybeRefOrGetter } from 'vue'
import type { AISessionHeaderDTO, AISessionDTO, AISessionMessageDTO, AIWelcomeMessageDTO, GetUnreadMessagesDTO } from '@/types/api/schemas'
import { isServerError, type AppError } from '@/lib/errors/types'

// Query keys
export const chatQueryKeys = {
  all: ['chat'] as const,
  sessions: () => [...chatQueryKeys.all, 'sessions'] as const,
  session: (id: string) => [...chatQueryKeys.sessions(), id] as const,
  messages: (sessionId: string) => [...chatQueryKeys.session(sessionId), 'messages'] as const,
  message: (messageId: string) => [...chatQueryKeys.all, 'message', messageId] as const,
  unread: () => [...chatQueryKeys.all, 'unread'] as const,
  sessionUnread: (sessionId: string) => [...chatQueryKeys.all, 'sessionUnread', sessionId] as const,
  welcome: (agentId: number) => [...chatQueryKeys.all, 'welcome', agentId] as const,
  search: (query: string) => [...chatQueryKeys.all, 'search', query] as const,
}

/**
 * Chat sessions query composable
 * Fetches chat sessions for the current user with filtering support
 * Returns session headers only (without messages)
 */
export function useChatSessions(options?: {
  enabled?: boolean
  staleTime?: number
  refetchInterval?: number
}) {
  const authStore = useAuthStore()

  return useQuery({
    queryKey: [...chatQueryKeys.sessions()],
    queryFn: async (): Promise<AISessionHeaderDTO[]> => {
      if (!authStore.user) {
        throw new Error('User not authenticated')
      }

      const result = await chatService.getSessionHeaders({
        userCode: authStore.user.email,
        agents: [],
        filterText: '',
      })

      if (result.isErr()) {
        throw result.error
      }

      return result.value
    },
    enabled: options?.enabled ?? authStore.isAuthenticated,
    staleTime: options?.staleTime ?? 30 * 1000, // 30 seconds - sessions update frequently
    gcTime: 5 * 60 * 1000, // 5 minutes
    refetchInterval: options?.refetchInterval ?? 60 * 1000, // Poll every minute by default
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    retry: (failureCount, error) => {
      // Don't retry on auth errors
      if (error && typeof error === 'object' && 'code' in error) {
        const appError = error as AppError
        if (appError.code === 'UNAUTHORIZED' || appError.code === 'FORBIDDEN') {
          return false
        }
      }
      return failureCount < 3
    },
  })
}

/**
 * Single chat session query composable
 * Fetches a specific chat session with all messages
 */
export function useChatSession(sessionId: string, options?: {
  enabled?: boolean
  staleTime?: number
  includeMessages?: boolean
}) {
  const authStore = useAuthStore()
  const queryClient = useQueryClient()

  const query = useQuery({
    queryKey: chatQueryKeys.session(sessionId),
    queryFn: async (): Promise<AISessionDTO> => {
      if (!authStore.user) {
        throw new Error('User not authenticated')
      }

      if (!sessionId) {
        throw new Error('Session ID is required')
      }

      const result = await chatService.getSessionById(sessionId)

      if (result.isErr()) {
        throw result.error
      }

      return result.value
    },
    enabled: options?.enabled ?? (authStore.isAuthenticated && !!sessionId),
    staleTime: options?.staleTime ?? 10 * 1000, // 10 seconds - messages update frequently
    gcTime: 2 * 60 * 1000, // 2 minutes
    placeholderData: (previousData) => {
      const headers = queryClient.getQueryData<AISessionHeaderDTO[]>(chatQueryKeys.sessions())
      const header = headers?.find(h => h.sessionId === sessionId)
      if (header) {
        return { ...header, messages: [] } as AISessionDTO
      }
      return previousData
    },
    refetchOnMount: true, // Always refetch to get real server data
    refetchOnWindowFocus: false, // Don't refetch on focus for sessions
    refetchOnReconnect: true,
    retry: (failureCount, error) => {
      // Don't retry on not found errors
      if (error && typeof error === 'object' && 'code' in error) {
        const appError = error as AppError
        if (appError.code === 'NOT_FOUND') {
          return false
        }
      }
      return failureCount < 2
    },
  })

  return query
}

/**
 * Unread message counts query composable
 * Fetches unread message counts across all sessions
 */
export function useUnreadMessageCounts(options?: {
  enabled?: boolean
  staleTime?: number
  refetchInterval?: number
}) {
  const authStore = useAuthStore()

  return useQuery({
    queryKey: chatQueryKeys.unread(),
    queryFn: async (): Promise<GetUnreadMessagesDTO[]> => {
      if (!authStore.user) {
        throw new Error('User not authenticated')
      }

      const result = await chatService.getUnreadMessages({
        userCode: authStore.user.email,
      })

      if (result.isErr()) {
        throw result.error
      }

      return result.value
    },
    enabled: options?.enabled ?? authStore.isAuthenticated,
    staleTime: options?.staleTime ?? 15 * 1000, // 15 seconds
    gcTime: 3 * 60 * 1000, // 3 minutes
    refetchInterval: options?.refetchInterval ?? 30 * 1000, // Poll every 30 seconds
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    retry: 2,
  })
}

/**
 * Tracks agent IDs that returned a server error (500) for welcome text.
 * These agents don't have a welcome message configured, so we skip
 * subsequent fetches for the lifetime of the browser session.
 */
const agentsWithoutWelcomeMessage = new Set<number>()

/**
 * Welcome message query composable
 * Fetches welcome message for a specific agent
 */
export function useWelcomeMessage(agentId: MaybeRefOrGetter<number>, options?: {
  enabled?: MaybeRefOrGetter<boolean>
  sessionId?: string
  staleTime?: number
}) {
  const authStore = useAuthStore()

  return useQuery({
    queryKey: computed(() => chatQueryKeys.welcome(toValue(agentId))),
    queryFn: async (): Promise<AIWelcomeMessageDTO> => {
      if (!authStore.user) {
        throw new Error('User not authenticated')
      }

      const unwrappedAgentId = toValue(agentId)
      if (!unwrappedAgentId) {
        throw new Error('Agent ID is required')
      }

      if (agentsWithoutWelcomeMessage.has(unwrappedAgentId)) {
        return { message: '' }
      }

      const result = await chatService.getWelcomeMessage({
        userCode: authStore.user.email,
        sessionId: options?.sessionId ?? '',
        agentId: unwrappedAgentId,
        members: [],
        question: '',
        group: 'default',
        pquestionType: 0, // Text question
        options: [],
      })

      if (result.isErr()) {
        if (isServerError(result.error)) {
          agentsWithoutWelcomeMessage.add(unwrappedAgentId)
          return { message: '' }
        }
        throw result.error
      }

      return result.value
    },
    enabled: computed(() => toValue(options?.enabled) ?? (authStore.isAuthenticated && !!toValue(agentId))),
    staleTime: options?.staleTime ?? 10 * 60 * 1000, // 10 minutes - welcome messages don't change often
    gcTime: 30 * 60 * 1000, // 30 minutes
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    retry: 1,
  })
}

/**
 * Single message query composable
 * Fetches a specific message by ID
 */
export function useMessage(
  messageId: MaybeRefOrGetter<string>,
  agentId: MaybeRefOrGetter<number>,
  options?: {
    enabled?: MaybeRefOrGetter<boolean>
    staleTime?: number
  }
) {
  const authStore = useAuthStore()

  return useQuery({
    queryKey: computed(() => chatQueryKeys.message(toValue(messageId))),
    queryFn: async (): Promise<AISessionMessageDTO> => {
      if (!authStore.user) {
        throw new Error('User not authenticated')
      }

      const unwrappedMessageId = toValue(messageId)
      if (!unwrappedMessageId) {
        throw new Error('Message ID is required')
      }

      const result = await chatService.getMessage({
        messageID: unwrappedMessageId,
        agentId: toValue(agentId),
      })

      if (result.isErr()) {
        throw result.error
      }

      return result.value
    },
    enabled: computed(() => toValue(options?.enabled) ?? (authStore.isAuthenticated && !!toValue(messageId))),
    staleTime: options?.staleTime ?? 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    retry: (failureCount, error) => {
      // Don't retry on not found errors
      if (error && typeof error === 'object' && 'code' in error) {
        const appError = error as AppError
        if (appError.code === 'NOT_FOUND') {
          return false
        }
      }
      return failureCount < 2
    },
  })
}

/**
 * Session unread count query composable
 * Fetches unread message count for a specific session
 */
export function useSessionUnreadCount(
  sessionId: MaybeRefOrGetter<string>,
  agentId: MaybeRefOrGetter<number>,
  options?: {
    enabled?: MaybeRefOrGetter<boolean>
    staleTime?: number
    refetchInterval?: number
  }
) {
  const authStore = useAuthStore()

  return useQuery({
    queryKey: computed(() => chatQueryKeys.sessionUnread(toValue(sessionId))),
    queryFn: async (): Promise<number> => {
      if (!authStore.user) {
        throw new Error('User not authenticated')
      }

      const unwrappedSessionId = toValue(sessionId)
      if (!unwrappedSessionId) {
        throw new Error('Session ID is required')
      }

      const result = await chatService.getSessionUnreadMessages({
        userEmail: authStore.user.email,
        sessionId: unwrappedSessionId,
        agentId: toValue(agentId),
      })

      if (result.isErr()) {
        throw result.error
      }

      return result.value
    },
    enabled: computed(() => toValue(options?.enabled) ?? (authStore.isAuthenticated && !!toValue(sessionId))),
    staleTime: options?.staleTime ?? 15 * 1000, // 15 seconds
    gcTime: 3 * 60 * 1000, // 3 minutes
    refetchInterval: options?.refetchInterval ?? 30 * 1000, // Poll every 30 seconds
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    retry: 2,
  })
}