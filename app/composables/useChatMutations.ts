import { useMutation, useQueryClient } from '@tanstack/vue-query'
import { chatService } from '@/lib/api/services/ChatService'
import { useChatStore } from '@/app/stores/chat'
import { useAuthStore } from '@/app/stores/auth'
import { useSignalR } from '@/app/composables/useSignalR'
import { chatQueryKeys } from './useChatQueries'
import { userQueryKeys } from './useUsers'
import { publicChatAgentQueryKeys } from './usePublicChatAgent'
import type {
  AISessionMessageDTO,
  AiQuestionRequestDTO,
  SetSessionNameRequestDTO,
  DeleteSessionByIdrequestDTO,
  SetSessionMessageRatingRequestDTO,
  AddUserToSessionRequestDTO,
  RemoveUserFromSessionRequestDTO,
  AISessionDTO,
  AISessionHeaderDTO,
  GetUnreadMessagesDTO,
  UserDTO,
  StartPublicChatrequestDTO,
  AIPublicChatStartDTO,
} from '@/types/api/schemas'
import type { MutationSuccess } from '@/types/api/base'
import type { AppError } from '@/lib/errors/types'
import { AIAnswerType, MessageStatus } from '@/types/enums'

// Create a temporary message ID generator
function generateTempId(): string {
  return `temp-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
}

function isEmptyResponse(message: AISessionMessageDTO): boolean {
  return (
    message.messageType === AIAnswerType.Empty ||
    !message.messageText ||
    message.messageText.trim() === ''
  )
}

// Look up agent from cached selectable users or public chat agent
function getAgentFromCache(
  queryClient: ReturnType<typeof useQueryClient>,
  agentId: number,
): UserDTO | undefined {
  // First check selectable users (regular chat)
  const selectableUsers = queryClient.getQueryData<UserDTO[]>(userQueryKeys.selectable())
  const fromSelectable = selectableUsers?.find((user) => user.id === agentId)
  if (fromSelectable) return fromSelectable

  // Fallback: check public chat agent cache
  const publicChatData = queryClient.getQueryData<AIPublicChatStartDTO>(
    publicChatAgentQueryKeys.agent(agentId),
  )
  return publicChatData?.agent ?? undefined
}

// --- useSendMessage helpers ---

interface SendMessageMutateContext {
  previousSession: AISessionDTO | undefined
  tempMessageId: string
  tempMessageDTO: AISessionMessageDTO
  userMessageTimestamp: Date
  isNewSession: boolean
  virtualAgentName: string | undefined
}

function createTempMessageDTO(
  request: AiQuestionRequestDTO,
  tempMessageId: string,
  timestamp: Date,
  authStore: ReturnType<typeof useAuthStore>,
): AISessionMessageDTO {
  return {
    messageID: tempMessageId,
    messageText: request.question,
    messageType: AIAnswerType.Text,
    senderUserCode: authStore.user?.email ?? 'unknown',
    senderName: authStore.user?.name ?? 'You',
    sendDate: timestamp.toISOString(),
    isRated: false,
    rating: null,
    readByUsers: [authStore.user?.email ?? 'unknown'],
    sessionId: request.sessionId,
  }
}

function createSyntheticSession(
  request: AiQuestionRequestDTO,
  authStore: ReturnType<typeof useAuthStore>,
  timestamp: string,
): AISessionDTO {
  return {
    sessionId: request.sessionId,
    agentId: request.agentId,
    agentImage: null,
    agentDarkImage: null,
    userCode: authStore.user?.email ?? 'unknown',
    members: request.members,
    sessionName: '',
    insertDate: timestamp,
    messages: [],
  }
}

function notifyMembersViaSignalR(
  request: AiQuestionRequestDTO,
  authStore: ReturnType<typeof useAuthStore>,
): void {
  const { isConnected, operations } = useSignalR()
  if (isConnected.value && request.members?.length) {
    const otherMembers = request.members.filter((m) => m !== authStore.user?.email)
    if (otherMembers.length) {
      operations.notifyMessageSent(otherMembers, request.sessionId, request.agentId)
    }
  }
}

interface SendMessageSuccessParams {
  queryClient: ReturnType<typeof useQueryClient>
  chatStore: ReturnType<typeof useChatStore>
  authStore: ReturnType<typeof useAuthStore>
  serverMessage: AISessionMessageDTO
  request: AiQuestionRequestDTO
  context: SendMessageMutateContext | undefined
}

async function handleSendMessageSuccess(params: SendMessageSuccessParams): Promise<void> {
  const { chatStore, authStore, request, context, queryClient } = params
  if (context?.virtualAgentName) {
    chatStore.removeTypingUser(request.sessionId, context.virtualAgentName)
  }

  notifyMembersViaSignalR(request, authStore)

  if (!context?.isNewSession) {
    await queryClient.invalidateQueries({ queryKey: chatQueryKeys.session(request.sessionId) })
  }

  if (context?.tempMessageId) {
    chatStore.removePendingMessage(request.sessionId, context.tempMessageId)
  }
}

async function handleNewSessionCacheUpdate(params: SendMessageSuccessParams): Promise<void> {
  const { queryClient, chatStore, authStore, serverMessage, request, context } = params
  const userMessageTimestamp =
    context?.userMessageTimestamp?.toISOString() ?? new Date().toISOString()

  const syntheticUserMessage: AISessionMessageDTO = {
    messageID: `temp-user-${Date.now()}`,
    messageText: request.question,
    messageType: AIAnswerType.Text,
    senderUserCode: request.userCode,
    senderName: authStore.user?.name ?? '',
    sendDate: userMessageTimestamp,
    isRated: false,
    rating: null,
    readByUsers: [],
    sessionId: request.sessionId,
  }

  const syntheticSession: AISessionDTO = {
    sessionId: request.sessionId,
    agentId: request.agentId,
    agentImage: null,
    agentDarkImage: null,
    userCode: request.userCode,
    members: request.members,
    sessionName: '', // Will be filled by background refetch
    insertDate: userMessageTimestamp,
    messages: isEmptyResponse(serverMessage)
      ? [syntheticUserMessage] // Only user message, no empty response
      : [syntheticUserMessage, serverMessage], // Both messages
  }

  if (context?.isNewSession) {
    // Synthetic data gives an instant render; the server now has the session, so pull
    // authoritative data (real message ids, sessionName) via GetSessionById. This no
    // longer depends on a SignalR ReceiveMessage echo firing for the sender.
    queryClient.setQueryData<AISessionDTO>(chatQueryKeys.session(request.sessionId), (old) => {
      // A SignalR-triggered refetch may have already populated the cache (e.g. the
      // backend's "working on it" message) — merge, don't clobber.
      if (old?.messages?.length) {
        if (isEmptyResponse(serverMessage)) return old
        if (old.messages.some((m) => m.messageID === serverMessage.messageID)) return old
        return { ...old, messages: [...old.messages, serverMessage] }
      }
      return syntheticSession
    })

    await queryClient.invalidateQueries({ queryKey: chatQueryKeys.sessions() })
    await queryClient.refetchQueries({ queryKey: chatQueryKeys.sessions(), type: 'active' })
    await queryClient.invalidateQueries({ queryKey: chatQueryKeys.session(request.sessionId) })

    chatStore.executeNewSessionCallback(request.sessionId)
  }
}

interface SendMessageOnMutateParams {
  queryClient: ReturnType<typeof useQueryClient>
  chatStore: ReturnType<typeof useChatStore>
  authStore: ReturnType<typeof useAuthStore>
}

async function handleSendMessageOnMutate(
  request: AiQuestionRequestDTO,
  params: SendMessageOnMutateParams,
): Promise<SendMessageMutateContext> {
  const { queryClient, chatStore, authStore } = params

  const existingSession = queryClient.getQueryData<AISessionDTO>(
    chatQueryKeys.session(request.sessionId),
  )
  const isNewSession = !existingSession
  const previousSession = existingSession

  const tempMessageId = generateTempId()
  const userMessageTimestamp = new Date()

  const agent = getAgentFromCache(queryClient, request.agentId)
  const virtualAgentName = agent?.isVirtual ? agent.name : undefined
  if (virtualAgentName) {
    chatStore.addTypingUser(request.sessionId, virtualAgentName)
  }

  const tempMessageDTO = createTempMessageDTO(
    request,
    tempMessageId,
    userMessageTimestamp,
    authStore,
  )

  // Count same-content messages already in the session so a repeated message (e.g. "ok"
  // sent twice) isn't reconciled against an older identical one. See
  // chatStore.getUnconfirmedPendingMessages.
  const baselineCount = (existingSession?.messages ?? []).filter(
    (m) =>
      m.senderUserCode === tempMessageDTO.senderUserCode &&
      m.messageText === tempMessageDTO.messageText,
  ).length

  chatStore.addPendingMessage(request.sessionId, tempMessageDTO, baselineCount)

  if (isNewSession) {
    await queryClient.cancelQueries({ queryKey: chatQueryKeys.session(request.sessionId) })
    queryClient.setQueryData<AISessionDTO>(chatQueryKeys.session(request.sessionId), {
      ...createSyntheticSession(request, authStore, userMessageTimestamp.toISOString()),
      messages: [],
    })
  }

  return {
    previousSession,
    tempMessageId,
    tempMessageDTO,
    userMessageTimestamp,
    isNewSession,
    virtualAgentName,
  }
}

function handleSendMessageOnError(
  request: AiQuestionRequestDTO,
  context: SendMessageMutateContext | undefined,
  params: SendMessageOnMutateParams,
): void {
  const { chatStore } = params

  if (context?.virtualAgentName) {
    chatStore.removeTypingUser(request.sessionId, context.virtualAgentName)
  }

  if (context?.tempMessageId) {
    chatStore.removePendingMessage(request.sessionId, context.tempMessageId)

    if (context?.tempMessageDTO) {
      chatStore.addFailedMessage(request.sessionId, {
        ...context.tempMessageDTO,
        status: MessageStatus.FAILED,
      })
    }
  }
}

export function useSendMessage() {
  const queryClient = useQueryClient()
  const chatStore = useChatStore()
  const authStore = useAuthStore()
  const mutateParams = { queryClient, chatStore, authStore }

  return useMutation({
    mutationFn: async (request: AiQuestionRequestDTO): Promise<AISessionMessageDTO> => {
      const result = await chatService.sendQuestion(request)
      if (result.isErr()) throw result.error
      return result.value
    },

    onMutate: (request) => handleSendMessageOnMutate(request, mutateParams),

    onSuccess: async (serverMessage, request, context) => {
      await handleSendMessageSuccess({ ...mutateParams, serverMessage, request, context })
      await handleNewSessionCacheUpdate({ ...mutateParams, serverMessage, request, context })
    },

    onError: (_error, request, context) => handleSendMessageOnError(request, context, mutateParams),

    // NOTE: No onSettled — was causing 26+ request cascade.
    // Session cache updated in onSuccess; sidebar syncs on poll/navigation.
  })
}

/**
 * Update session name mutation composable
 * Uses pessimistic updates - cache is only updated after server confirms success
 */
export function useUpdateSessionName() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (params: SetSessionNameRequestDTO): Promise<MutationSuccess> => {
      const result = await chatService.updateSessionName(params)

      if (result.isErr()) {
        throw result.error
      }

      return result.value
    },

    // Update cache only after server confirms success
    onSuccess: (_, params) => {
      // Update sessions list cache
      queryClient.setQueryData<AISessionHeaderDTO[]>(chatQueryKeys.sessions(), (old) =>
        old?.map((session) =>
          session.sessionId === params.sessionId
            ? { ...session, sessionName: params.sessionName }
            : session,
        ),
      )

      // Update individual session cache
      queryClient.setQueryData<AISessionDTO>(chatQueryKeys.session(params.sessionId), (old) =>
        old ? { ...old, sessionName: params.sessionName } : old,
      )
    },

    onError: (_error: AppError) => {
      // Error handled by mutation error state
    },

    // Always refetch after mutation settles to ensure server sync
    onSettled: (_, __, params) => {
      void queryClient.invalidateQueries({ queryKey: chatQueryKeys.sessions(), exact: true })
      void queryClient.invalidateQueries({
        queryKey: chatQueryKeys.session(params.sessionId),
      })
    },
  })
}

/**
 * Delete session mutation composable
 */
export function useDeleteSession() {
  const queryClient = useQueryClient()
  const chatStore = useChatStore()

  return useMutation({
    mutationFn: async (params: DeleteSessionByIdrequestDTO): Promise<MutationSuccess> => {
      const result = await chatService.deleteSession(params)

      if (result.isErr()) {
        throw result.error
      }

      return result.value
    },

    onSuccess: (_, params) => {
      // Pessimistically update sessions list cache
      queryClient.setQueryData<AISessionHeaderDTO[]>(chatQueryKeys.sessions(), (old) =>
        old?.filter((session) => session.sessionId !== params.sessionId),
      )

      // Remove individual session and messages from cache
      queryClient.removeQueries({
        queryKey: chatQueryKeys.session(params.sessionId),
      })
      queryClient.removeQueries({
        queryKey: chatQueryKeys.messages(params.sessionId),
      })

      // Clean up pending and failed messages for this session
      chatStore.removeAllPendingMessages(params.sessionId)
      chatStore.removeAllFailedMessages(params.sessionId)

      // Invalidate unread counts
      void queryClient.invalidateQueries({ queryKey: chatQueryKeys.unread() })
    },

    onError: (_error: AppError) => {
      // Error handled by mutation error state
    },
  })
}

/**
 * Rate message mutation composable
 * Uses optimistic updates for instant UI feedback
 */
export function useRateMessage() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (params: SetSessionMessageRatingRequestDTO): Promise<void> => {
      const result = await chatService.rateMessage(params)

      if (result.isErr()) {
        throw result.error
      }

      return result.value
    },

    onMutate: async (params) => {
      // Cancel any outgoing refetches to avoid overwriting optimistic update
      await queryClient.cancelQueries({
        queryKey: chatQueryKeys.session(params.sessionId),
      })

      // Snapshot the previous session data
      const previousSession = queryClient.getQueryData<AISessionDTO>(
        chatQueryKeys.session(params.sessionId),
      )

      // Optimistically update the message rating
      queryClient.setQueryData<AISessionDTO>(chatQueryKeys.session(params.sessionId), (old) => {
        if (!old) return old
        return {
          ...old,
          messages: old.messages?.map((m) =>
            m.messageID === params.messageId
              ? { ...m, isRated: true, rating: params.rating ? 1 : 0 }
              : m,
          ),
        }
      })

      // Return context with previous value for rollback
      return { previousSession }
    },

    onError: (error: AppError, params, context) => {
      // Rollback to previous state on error
      if (context?.previousSession) {
        queryClient.setQueryData(chatQueryKeys.session(params.sessionId), context.previousSession)
      }
      // Error handled by mutation error state
    },

    onSettled: (_, __, params) => {
      // Always refetch after mutation to ensure server sync
      void queryClient.invalidateQueries({
        queryKey: chatQueryKeys.messages(params.sessionId),
      })
      void queryClient.invalidateQueries({
        queryKey: chatQueryKeys.session(params.sessionId),
      })
    },
  })
}

/**
 * Mark messages as read mutation composable
 * Uses optimistic updates to immediately clear unread count in UI
 */
export function useMarkMessagesRead() {
  const queryClient = useQueryClient()
  const authStore = useAuthStore()

  return useMutation({
    mutationFn: async (params: {
      sessionId: string
      agentId: number
      userCode?: string
    }): Promise<void> => {
      const result = await chatService.markMessagesRead(
        params.sessionId,
        params.agentId,
        params.userCode ?? authStore.user?.email ?? '',
      )

      if (result.isErr()) {
        throw result.error
      }

      return result.value
    },

    // Optimistic update - immediately set unread count to 0
    onMutate: async (params) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: chatQueryKeys.unread() })

      // Snapshot previous value
      const previousUnread = queryClient.getQueryData<GetUnreadMessagesDTO[]>(
        chatQueryKeys.unread(),
      )

      // Optimistically update unread counts
      queryClient.setQueryData<GetUnreadMessagesDTO[]>(chatQueryKeys.unread(), (old) =>
        old?.map((entry) =>
          entry.sessionId === params.sessionId ? { ...entry, unreadMessageCount: 0 } : entry,
        ),
      )

      return { previousUnread }
    },

    onError: (error: AppError, params, context) => {
      // Rollback on error
      if (context?.previousUnread) {
        queryClient.setQueryData(chatQueryKeys.unread(), context.previousUnread)
      }
      // Error handled by mutation error state
    },

    onSuccess: (_, params) => {
      // Optimistically update the session's messages as read in cache
      // This avoids invalidating the session query which would cause a cascade loop
      const userCode = params.userCode ?? authStore.user?.email ?? ''
      queryClient.setQueryData<AISessionDTO>(chatQueryKeys.session(params.sessionId), (old) => {
        if (!old) return old
        return {
          ...old,
          messages: old.messages?.map((msg) => ({
            ...msg,
            readByUsers: msg.readByUsers?.includes(userCode)
              ? msg.readByUsers
              : [...(msg.readByUsers ?? []), userCode],
          })),
        }
      })
    },

    onSettled: () => {
      // Only invalidate unread counts - session is already updated optimistically
      // IMPORTANT: Do NOT invalidate session here - it causes a cascade loop
      void queryClient.invalidateQueries({ queryKey: chatQueryKeys.unread() })
    },
  })
}

/**
 * React to message mutation composable
 */
export function useReactToMessage() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (params: {
      sessionId: string
      messageId: string
      agentId: number
    }): Promise<void> => {
      const result = await chatService.reactToMessage(
        params.sessionId,
        params.messageId,
        params.agentId,
      )

      if (result.isErr()) {
        throw result.error
      }

      return result.value
    },

    onSuccess: (_, params) => {
      // Invalidate related queries
      void queryClient.invalidateQueries({
        queryKey: chatQueryKeys.messages(params.sessionId),
      })
      void queryClient.invalidateQueries({
        queryKey: chatQueryKeys.session(params.sessionId),
      })
    },

    onError: (_error: AppError) => {
      // Error handled by mutation error state
    },
  })
}

/**
 * Add user to session mutation composable
 */
export function useAddUserToSession() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (params: AddUserToSessionRequestDTO): Promise<void> => {
      const result = await chatService.addUserToSession(params)

      if (result.isErr()) {
        throw result.error
      }

      return result.value
    },

    onSuccess: (_, params) => {
      // Invalidate session data to refresh member list
      void queryClient.invalidateQueries({
        queryKey: chatQueryKeys.session(params.sessionId),
      })
      void queryClient.invalidateQueries({ queryKey: chatQueryKeys.sessions() })
    },

    onError: (_error: AppError) => {
      // Error handled by mutation error state
    },
  })
}

/**
 * Remove user from session mutation composable
 */
export function useRemoveUserFromSession() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (params: RemoveUserFromSessionRequestDTO): Promise<void> => {
      const result = await chatService.removeUserFromSession(params)

      if (result.isErr()) {
        throw result.error
      }

      return result.value
    },

    onSuccess: (_, params) => {
      // Invalidate session data to refresh member list
      void queryClient.invalidateQueries({
        queryKey: chatQueryKeys.session(params.sessionId),
      })
      void queryClient.invalidateQueries({ queryKey: chatQueryKeys.sessions() })
    },

    onError: (_error: AppError) => {
      // Error handled by mutation error state
    },
  })
}

/**
 * Start public chat mutation composable
 * Initializes a public/anonymous chat session
 */
export function useStartPublicChat() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (params: StartPublicChatrequestDTO): Promise<AIPublicChatStartDTO> => {
      const result = await chatService.startPublicChat(params)

      if (result.isErr()) {
        throw result.error
      }

      return result.value
    },

    onSuccess: () => {
      // Invalidate sessions to include new public chat session
      void queryClient.invalidateQueries({ queryKey: chatQueryKeys.sessions() })
    },

    onError: (_error: AppError) => {
      // Error handled by mutation error state
    },
  })
}
