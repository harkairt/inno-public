import type { QueryClient } from '@tanstack/vue-query'
import { chatQueryKeys } from './useChatQueries'
import { userQueryKeys } from './useUsers'
import { publicChatAgentQueryKeys } from './usePublicChatAgent'
import type {
  AISessionMessageDTO,
  AiQuestionRequestDTO,
  AISessionDTO,
  AISessionHeaderDTO,
  UserDTO,
  AIPublicChatStartDTO,
} from '@/types/api/schemas'
import type { useChatStore } from '@/app/stores/chat'
import type { useAuthStore } from '@/app/stores/auth'
import { AIAnswerType, MessageStatus } from '@/types/enums'

export interface SendMessageMutateContext {
  previousSession: AISessionDTO | undefined
  tempMessageId: string
  tempMessageDTO: AISessionMessageDTO
  userMessageTimestamp: Date
  isNewSession: boolean
  thinkingAgentName: string | undefined
}

interface SendMessageDeps {
  queryClient: QueryClient
  chatStore: ReturnType<typeof useChatStore>
  authStore: ReturnType<typeof useAuthStore>
}

interface ConfirmSendParams extends SendMessageDeps {
  serverMessage: AISessionMessageDTO
  request: AiQuestionRequestDTO
  context: SendMessageMutateContext | undefined
}

function generateTempId(): string {
  // Stryker disable next-line all: temp-id suffix is cosmetic uniqueness; no observable behavior depends on the exact substring bounds
  return `temp-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
}

function isEmptyResponse(message: AISessionMessageDTO): boolean {
  return (
    message.messageType === AIAnswerType.Empty ||
    !message.messageText ||
    message.messageText.trim() === ''
  )
}

function getAgentFromCache(queryClient: QueryClient, agentId: number): UserDTO | undefined {
  const selectableUsers = queryClient.getQueryData<UserDTO[]>(userQueryKeys.selectable())
  const fromSelectable = selectableUsers?.find((user) => user.id === agentId)
  if (fromSelectable) return fromSelectable

  const publicChatData = queryClient.getQueryData<AIPublicChatStartDTO>(
    publicChatAgentQueryKeys.agent(agentId),
  )
  return publicChatData?.agent ?? undefined
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
    modifiedAt: timestamp,
    messages: [],
  }
}

function truncateSessionTitle(text: string, maxLength: number): string {
  return text.length > maxLength ? text.slice(0, maxLength) : text
}

function createSyntheticSessionHeader(
  request: AiQuestionRequestDTO,
  timestamp: string,
): AISessionHeaderDTO {
  return {
    sessionId: request.sessionId,
    agentId: request.agentId,
    agentImage: null,
    agentDarkImage: null,
    userCode: request.userCode,
    members: request.members,
    sessionName: truncateSessionTitle(request.question, 60),
    insertDate: timestamp,
    modifiedAt: timestamp,
  }
}

export async function applyOptimisticSend(
  request: AiQuestionRequestDTO,
  deps: SendMessageDeps,
): Promise<SendMessageMutateContext> {
  const { queryClient, chatStore, authStore } = deps

  const existingSession = queryClient.getQueryData<AISessionDTO>(
    chatQueryKeys.session(request.sessionId),
  )
  const isNewSession = !existingSession
  const previousSession = existingSession

  const tempMessageId = generateTempId()
  const userMessageTimestamp = new Date()

  const agent = getAgentFromCache(queryClient, request.agentId)
  const thinkingAgentName = agent?.isVirtual ? agent.name : undefined
  if (thinkingAgentName) {
    chatStore.startAgentThinking(request.sessionId, thinkingAgentName)
  }

  const tempMessageDTO = createTempMessageDTO(
    request,
    tempMessageId,
    userMessageTimestamp,
    authStore,
  )

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

    queryClient.setQueryData<AISessionHeaderDTO[]>(chatQueryKeys.sessions(), (old) => {
      const header = createSyntheticSessionHeader(request, userMessageTimestamp.toISOString())
      if (!old) return [header]
      if (old.some((s) => s.sessionId === request.sessionId)) return old
      return [header, ...old]
    })
  } else {
    queryClient.setQueryData<AISessionHeaderDTO[]>(chatQueryKeys.sessions(), (old) =>
      old?.map((s) =>
        s.sessionId === request.sessionId
          ? { ...s, modifiedAt: userMessageTimestamp.toISOString() }
          : s,
      ),
    )
  }

  return {
    previousSession,
    tempMessageId,
    tempMessageDTO,
    userMessageTimestamp,
    isNewSession,
    thinkingAgentName,
  }
}

export async function confirmSend(params: ConfirmSendParams): Promise<void> {
  const { queryClient, chatStore, authStore, serverMessage, request, context } = params

  if (context?.thinkingAgentName) {
    chatStore.stopAgentThinking(request.sessionId, context.thinkingAgentName)
  }

  if (!context?.isNewSession) {
    await queryClient.invalidateQueries({ queryKey: chatQueryKeys.session(request.sessionId) })

    queryClient.setQueryData<AISessionHeaderDTO[]>(chatQueryKeys.sessions(), (old) =>
      old?.map((s) =>
        s.sessionId === request.sessionId ? { ...s, modifiedAt: serverMessage.sendDate } : s,
      ),
    )
  }

  if (context?.tempMessageId) {
    chatStore.removePendingMessage(request.sessionId, context.tempMessageId)
  }

  if (context?.isNewSession) {
    const userMessageTimestamp =
      context.userMessageTimestamp?.toISOString() ?? new Date().toISOString()

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
      sessionName: '',
      insertDate: userMessageTimestamp,
      modifiedAt: userMessageTimestamp,
      messages: isEmptyResponse(serverMessage)
        ? [syntheticUserMessage]
        : [syntheticUserMessage, serverMessage],
    }

    queryClient.setQueryData<AISessionDTO>(chatQueryKeys.session(request.sessionId), (old) => {
      if (old?.messages?.length) {
        if (isEmptyResponse(serverMessage)) return old
        if (old.messages.some((m) => m.messageID === serverMessage.messageID)) return old
        return { ...old, messages: [...old.messages, serverMessage] }
      }
      return syntheticSession
    })

    await queryClient.invalidateQueries({ queryKey: chatQueryKeys.sessions(), exact: true })
    await queryClient.invalidateQueries({ queryKey: chatQueryKeys.session(request.sessionId) })

    chatStore.executeNewSessionCallback(request.sessionId)
  }
}

export function rollbackSend(
  request: AiQuestionRequestDTO,
  context: SendMessageMutateContext | undefined,
  deps: SendMessageDeps,
): void {
  const { chatStore } = deps

  // Stryker disable next-line OptionalChaining: context is provably non-null in every reachable onError path
  if (context?.thinkingAgentName) {
    chatStore.stopAgentThinking(request.sessionId, context.thinkingAgentName)
  }

  if (context?.tempMessageId) {
    chatStore.removePendingMessage(request.sessionId, context.tempMessageId)

    // Stryker disable next-line OptionalChaining: context is provably non-null here (tempMessageId branch already entered)
    if (context?.tempMessageDTO) {
      chatStore.addFailedMessage(request.sessionId, {
        ...context.tempMessageDTO,
        status: MessageStatus.FAILED,
      })
    }
  }
}
