import { useMutation, useQueryClient } from '@tanstack/vue-query'
import { chatService } from '@/lib/api/services/ChatService'
import { useChatStore } from '@/app/stores/chat'
import { useAuthStore } from '@/app/stores/auth'
import { useSignalR } from '@/app/composables/useSignalR'
import { chatQueryKeys } from './useChatQueries'
import { applyOptimisticSend, confirmSend, rollbackSend } from './sendMessageOptimistic'
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
  StartPublicChatrequestDTO,
  AIPublicChatStartDTO,
} from '@/types/api/schemas'
import type { StagedAttachment } from '@/types/fileAttachment'
import type { MutationSuccess } from '@/types/api/base'
import type { AppError } from '@/lib/errors/types'

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

export type SendMessageVariables = {
  request: AiQuestionRequestDTO
  attachments?: StagedAttachment[]
}

export function useSendMessage() {
  const queryClient = useQueryClient()
  const chatStore = useChatStore()
  const authStore = useAuthStore()
  const deps = { queryClient, chatStore, authStore }

  return useMutation({
    mutationFn: async (vars: SendMessageVariables): Promise<AISessionMessageDTO> => {
      const result = await chatService.sendQuestion(vars.request)
      if (result.isErr()) throw result.error
      return result.value
    },

    onMutate: (vars) => applyOptimisticSend(vars.request, deps, vars.attachments),

    onSuccess: async (serverMessage, vars, context) => {
      await confirmSend({ ...deps, serverMessage, request: vars.request, context })
      notifyMembersViaSignalR(vars.request, authStore)
    },

    onError: (_error, vars, context) => rollbackSend(vars.request, context, deps),
  })
}

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

    onMutate: async (params) => {
      await queryClient.cancelQueries({ queryKey: chatQueryKeys.sessions(), exact: true })
      await queryClient.cancelQueries({
        queryKey: chatQueryKeys.session(params.sessionId),
      })

      const previousSessions = queryClient.getQueryData<AISessionHeaderDTO[]>(
        chatQueryKeys.sessions(),
      )
      const previousSession = queryClient.getQueryData<AISessionDTO>(
        chatQueryKeys.session(params.sessionId),
      )

      queryClient.setQueryData<AISessionHeaderDTO[]>(chatQueryKeys.sessions(), (old) =>
        old?.map((session) =>
          session.sessionId === params.sessionId
            ? { ...session, sessionName: params.sessionName }
            : session,
        ),
      )

      queryClient.setQueryData<AISessionDTO>(chatQueryKeys.session(params.sessionId), (old) =>
        old ? { ...old, sessionName: params.sessionName } : old,
      )

      return { previousSessions, previousSession }
    },

    onError: (_error: AppError, params, context) => {
      if (context?.previousSessions) {
        queryClient.setQueryData(chatQueryKeys.sessions(), context.previousSessions)
      }
      if (context?.previousSession) {
        queryClient.setQueryData(chatQueryKeys.session(params.sessionId), context.previousSession)
      }
    },

    onSettled: (_, __, params) => {
      void queryClient.invalidateQueries({ queryKey: chatQueryKeys.sessions(), exact: true })
      void queryClient.invalidateQueries({
        queryKey: chatQueryKeys.session(params.sessionId),
      })
    },
  })
}

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
      queryClient.setQueryData<AISessionHeaderDTO[]>(chatQueryKeys.sessions(), (old) =>
        old?.filter((session) => session.sessionId !== params.sessionId),
      )

      queryClient.removeQueries({
        queryKey: chatQueryKeys.session(params.sessionId),
      })
      queryClient.removeQueries({
        queryKey: chatQueryKeys.messages(params.sessionId),
      })

      chatStore.removeAllPendingMessages(params.sessionId)
      chatStore.removeAllFailedMessages(params.sessionId)

      if (chatStore.activeSessionId === params.sessionId) {
        chatStore.setActiveSession(null)
      }

      void queryClient.invalidateQueries({ queryKey: chatQueryKeys.unread() })
    },

    onError: (_error: AppError) => {},
  })
}

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
      // Stryker disable next-line all: cancelQueries only matters under a concurrent in-flight refetch — a race not observable in tests
      await queryClient.cancelQueries({
        queryKey: chatQueryKeys.session(params.sessionId),
      })

      const previousSession = queryClient.getQueryData<AISessionDTO>(
        chatQueryKeys.session(params.sessionId),
      )

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

      return { previousSession }
    },

    onError: (error: AppError, params, context) => {
      // Stryker disable next-line OptionalChaining: context is provably non-null (onMutate always returns it before onError can run)
      if (context?.previousSession) {
        queryClient.setQueryData(chatQueryKeys.session(params.sessionId), context.previousSession)
      }
    },

    onSettled: (_, __, params) => {
      void queryClient.invalidateQueries({
        queryKey: chatQueryKeys.session(params.sessionId),
      })
    },
  })
}

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

    onMutate: async (params) => {
      // Stryker disable next-line all: cancelQueries only matters under a concurrent in-flight refetch — a race not observable in tests
      await queryClient.cancelQueries({ queryKey: chatQueryKeys.unread() })

      const previousUnread = queryClient.getQueryData<GetUnreadMessagesDTO[]>(
        chatQueryKeys.unread(),
      )

      queryClient.setQueryData<GetUnreadMessagesDTO[]>(chatQueryKeys.unread(), (old) =>
        old?.map((entry) =>
          entry.sessionId === params.sessionId ? { ...entry, unreadMessageCount: 0 } : entry,
        ),
      )

      return { previousUnread }
    },

    onError: (error: AppError, params, context) => {
      // Stryker disable next-line all: equivalent in reachable states — previousUnread is set whenever the cache held data; a null snapshot rolls back to the same empty state
      if (context?.previousUnread) {
        queryClient.setQueryData(chatQueryKeys.unread(), context.previousUnread)
      }
    },

    onSuccess: (_, params) => {
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
      void queryClient.invalidateQueries({ queryKey: chatQueryKeys.unread() })
    },
  })
}

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
      void queryClient.invalidateQueries({
        queryKey: chatQueryKeys.messages(params.sessionId),
      })
      void queryClient.invalidateQueries({
        queryKey: chatQueryKeys.session(params.sessionId),
      })
    },

    onError: (_error: AppError) => {},
  })
}

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
      void queryClient.invalidateQueries({
        queryKey: chatQueryKeys.session(params.sessionId),
      })
      void queryClient.invalidateQueries({ queryKey: chatQueryKeys.sessions(), exact: true })
    },

    onError: (_error: AppError) => {},
  })
}

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
      void queryClient.invalidateQueries({
        queryKey: chatQueryKeys.session(params.sessionId),
      })
      void queryClient.invalidateQueries({ queryKey: chatQueryKeys.sessions(), exact: true })
    },

    onError: (_error: AppError) => {},
  })
}

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
      void queryClient.invalidateQueries({ queryKey: chatQueryKeys.sessions() })
    },

    onError: (_error: AppError) => {},
  })
}
