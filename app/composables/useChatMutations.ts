import { useMutation, useQueryClient } from "@tanstack/vue-query";
import { chatService } from "@/lib/api/services/ChatService";
import { useChatStore } from "@/app/stores/chat";
import { useAuthStore } from "@/app/stores/auth";
import { useSignalR } from "@/app/composables/useSignalR";
import { chatQueryKeys } from "./useChatQueries";
import { userQueryKeys } from "./useUsers";
import { publicChatAgentQueryKeys } from "./usePublicChatAgent";
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
} from "@/types/api/schemas";
import type { MutationSuccess } from "@/types/api/base";
import type { AppError } from "@/lib/errors/types";
import { AIAnswerType, MessageStatus } from "@/types/enums";

// Create a temporary message ID generator
function generateTempId(): string {
  return `temp-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

function isEmptyResponse(message: AISessionMessageDTO): boolean {
  return (
    message.messageType === AIAnswerType.Empty ||
    !message.messageText ||
    message.messageText.trim() === ''
  );
}

// Look up agent from cached selectable users or public chat agent
function getAgentFromCache(
  queryClient: ReturnType<typeof useQueryClient>,
  agentId: number
): UserDTO | undefined {
  // First check selectable users (regular chat)
  const selectableUsers = queryClient.getQueryData<UserDTO[]>(userQueryKeys.selectable());
  const fromSelectable = selectableUsers?.find((user) => user.id === agentId);
  if (fromSelectable) return fromSelectable;

  // Fallback: check public chat agent cache
  const publicChatData = queryClient.getQueryData<AIPublicChatStartDTO>(
    publicChatAgentQueryKeys.agent(agentId)
  );
  return publicChatData?.agent ?? undefined;
}

/**
 * Send message mutation composable
 * Handles sending text messages with optimistic updates
 */
export function useSendMessage() {
  const queryClient = useQueryClient();
  const chatStore = useChatStore();
  const authStore = useAuthStore();

  return useMutation({
    mutationFn: async (
      request: AiQuestionRequestDTO
    ): Promise<AISessionMessageDTO> => {
      const result = await chatService.sendQuestion(request);

      if (result.isErr()) {
        throw result.error;
      }

      return result.value;
    },

    // Optimistic update - add message immediately
    onMutate: async (request) => {
      // Cancel any outgoing refetches for this session
      await queryClient.cancelQueries({
        queryKey: chatQueryKeys.session(request.sessionId),
      });

      // Check if this is a new session (no existing cache data)
      const existingSession = queryClient.getQueryData<AISessionDTO>(
        chatQueryKeys.session(request.sessionId)
      );
      const isNewSession = !existingSession;

      // Snapshot previous session for rollback
      const previousSession = existingSession;

      // Create optimistic message
      const tempMessageId = generateTempId();
      const userMessageTimestamp = new Date();
      const tempMessage: AISessionMessageDTO = {
        messageID: tempMessageId,
        sessionId: request.sessionId,
        messageType: AIAnswerType.Text,
        messageText: request.question,
        senderUserCode: authStore.user?.email || "unknown",
        senderName: authStore.user?.name || "You",
        sendDate: userMessageTimestamp.toISOString(),
        isRated: false,
        rating: null,
        readByUsers: [authStore.user?.email || "unknown"],
      };

      // Add synthetic typing indicator for virtual agents
      const agent = getAgentFromCache(queryClient, request.agentId);
      const virtualAgentName = agent?.isVirtual ? agent.name : undefined;
      if (virtualAgentName) {
        chatStore.addTypingUser(request.sessionId, virtualAgentName);
      }

      // Create temp message in DTO format for cache
      const tempMessageDTO: AISessionMessageDTO = {
        messageID: tempMessageId,
        messageText: request.question,
        messageType: AIAnswerType.Text,
        senderUserCode: authStore.user?.email || "unknown",
        senderName: authStore.user?.name || "You",
        sendDate: userMessageTimestamp.toISOString(),
        isRated: false,
        rating: null,
        readByUsers: [authStore.user?.email || "unknown"],
        sessionId: request.sessionId,
      };

      // Add to session query cache (this is what the page reads from)
      queryClient.setQueryData<AISessionDTO>(
        chatQueryKeys.session(request.sessionId),
        (old) => {
          if (old) {
            // Existing session - append message
            return {
              ...old,
              messages: [...(old.messages || []), tempMessageDTO],
            };
          }

          // New session - create synthetic session with optimistic message
          return {
            sessionId: request.sessionId,
            agentId: request.agentId,
            agentImage: null,
            agentDarkImage: null,
            userCode: authStore.user?.email || 'unknown',
            members: request.members,
            sessionName: '',
            insertDate: userMessageTimestamp.toISOString(),
            messages: [tempMessageDTO],
          };
        }
      );

      return { previousSession, tempMessageId, tempMessageDTO, userMessageTimestamp, isNewSession, virtualAgentName };
    },

    // On success, add server response (keep temp user message - will be replaced by refetch)
    onSuccess: (serverMessage, request, context) => {
      // Remove virtual agent typing indicator before adding the response message
      if (context?.virtualAgentName) {
        chatStore.removeTypingUser(request.sessionId, context.virtualAgentName);
      }

      // Notify session members via SignalR
      const { isConnected, operations } = useSignalR()
      if (isConnected.value && request.members?.length) {
        operations.notifyMessageSent(request.members, request.sessionId, request.agentId)
      }

      // Update Vue Query cache with server response for existing sessions
      // Skip adding empty responses to the cache
      if (!context?.isNewSession && !isEmptyResponse(serverMessage)) {
        queryClient.setQueryData<AISessionDTO>(
          chatQueryKeys.session(request.sessionId),
          (old) => {
            if (!old) return old;
            return {
              ...old,
              messages: [...(old.messages || []), serverMessage],
            };
          }
        );
      }

      // PRE-POPULATE CACHE: Create synthetic session with both messages
      const userMessageTimestamp = context?.userMessageTimestamp?.toISOString() || new Date().toISOString();

      const syntheticUserMessage: AISessionMessageDTO = {
        messageID: `temp-user-${Date.now()}`,
        messageText: request.question,
        messageType: AIAnswerType.Text,
        senderUserCode: request.userCode,
        senderName: authStore.user?.name || '',
        sendDate: userMessageTimestamp,
        isRated: false,
        rating: null,
        readByUsers: [],
        sessionId: request.sessionId
      };

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
          ? [syntheticUserMessage]  // Only user message, no empty response
          : [syntheticUserMessage, serverMessage]  // Both messages
      };

      // Set session cache ONLY for new consultations (prevents loading state on navigation from /chats/new)
      if (context?.isNewSession) {
        queryClient.setQueryData(
          chatQueryKeys.session(request.sessionId),
          syntheticSession
        );
      }

      // Note: No invalidation here - onSettled handles sessions/unread, SignalR handles real-time sync
    },

    // On error, rollback
    onError: (error, request, context) => {
      // Remove virtual agent typing indicator on error
      if (context?.virtualAgentName) {
        chatStore.removeTypingUser(request.sessionId, context.virtualAgentName);
      }

      // Remove temp message from Vue Query cache (failed, shouldn't be in server data)
      if (context?.tempMessageId) {
        queryClient.setQueryData<AISessionDTO>(
          chatQueryKeys.session(request.sessionId),
          (old) => {
            if (!old) return old;
            return {
              ...old,
              messages: (old.messages || []).filter(m => m.messageID !== context.tempMessageId)
            };
          }
        );

        // Add to failed messages store (persisted across reloads)
        if (context?.tempMessageDTO) {
          chatStore.addFailedMessage(request.sessionId, {
            ...context.tempMessageDTO,
            status: MessageStatus.FAILED,
          });
        }
      }

      console.error("Send message failed:", error);
    },

    // NOTE: No onSettled invalidations needed - this was causing a cascade of 26+ requests
    // - Session cache is updated optimistically in onSuccess
    // - Sidebar sessions list will sync on next poll (60s) or navigation
    // - Unread counts don't change when YOU send a message (only when others do)
  });
}

/**
 * Update session name mutation composable
 * Uses pessimistic updates - cache is only updated after server confirms success
 */
export function useUpdateSessionName() {
  const queryClient = useQueryClient();
  const chatStore = useChatStore();

  return useMutation({
    mutationFn: async (params: SetSessionNameRequestDTO): Promise<MutationSuccess> => {
      const result = await chatService.updateSessionName(params);

      if (result.isErr()) {
        throw result.error;
      }

      return result.value;
    },

    // Update cache only after server confirms success
    onSuccess: (_, params) => {
      // Update sessions list cache
      queryClient.setQueryData<AISessionHeaderDTO[]>(
        chatQueryKeys.sessions(),
        (old) =>
          old?.map((session) =>
            session.sessionId === params.sessionId
              ? { ...session, sessionName: params.sessionName }
              : session
          )
      );

      // Update individual session cache
      queryClient.setQueryData<AISessionDTO>(
        chatQueryKeys.session(params.sessionId),
        (old) => (old ? { ...old, sessionName: params.sessionName } : old)
      );
    },

    onError: (error: AppError) => {
      console.error("Update session name failed:", error);
    },

    // Always refetch after mutation settles to ensure server sync
    onSettled: (_, __, params) => {
      queryClient.invalidateQueries({ queryKey: chatQueryKeys.sessions() });
      queryClient.invalidateQueries({
        queryKey: chatQueryKeys.session(params.sessionId),
      });
    },
  });
}

/**
 * Delete session mutation composable
 */
export function useDeleteSession() {
  const queryClient = useQueryClient();
  const chatStore = useChatStore();

  return useMutation({
    mutationFn: async (params: DeleteSessionByIdrequestDTO): Promise<MutationSuccess> => {
      const result = await chatService.deleteSession(params);

      if (result.isErr()) {
        throw result.error;
      }

      return result.value;
    },

    onSuccess: (_, params) => {
      // Pessimistically update sessions list cache
      queryClient.setQueryData<AISessionHeaderDTO[]>(
        chatQueryKeys.sessions(),
        (old) => old?.filter((session) => session.sessionId !== params.sessionId),
      );

      // Remove individual session and messages from cache
      queryClient.removeQueries({
        queryKey: chatQueryKeys.session(params.sessionId),
      });
      queryClient.removeQueries({
        queryKey: chatQueryKeys.messages(params.sessionId),
      });

      // Clean up failed messages for this session
      chatStore.removeAllFailedMessages(params.sessionId);

      // Invalidate unread counts
      queryClient.invalidateQueries({ queryKey: chatQueryKeys.unread() });
    },

    onError: (error: AppError) => {
      console.error("Delete session failed:", error);
    },
  });
}

/**
 * Rate message mutation composable
 * Uses optimistic updates for instant UI feedback
 */
export function useRateMessage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (
      params: SetSessionMessageRatingRequestDTO
    ): Promise<void> => {
      const result = await chatService.rateMessage(params);

      if (result.isErr()) {
        throw result.error;
      }

      return result.value;
    },

    onMutate: async (params) => {
      // Cancel any outgoing refetches to avoid overwriting optimistic update
      await queryClient.cancelQueries({
        queryKey: chatQueryKeys.session(params.sessionId),
      });

      // Snapshot the previous session data
      const previousSession = queryClient.getQueryData<AISessionDTO>(
        chatQueryKeys.session(params.sessionId)
      );

      // Optimistically update the message rating
      queryClient.setQueryData<AISessionDTO>(
        chatQueryKeys.session(params.sessionId),
        (old) => {
          if (!old) return old;
          return {
            ...old,
            messages: old.messages?.map((m) =>
              m.messageID === params.messageId
                ? { ...m, isRated: true, rating: params.rating ? 1 : 0 }
                : m
            ),
          };
        }
      );

      // Return context with previous value for rollback
      return { previousSession };
    },

    onError: (error: AppError, params, context) => {
      // Rollback to previous state on error
      if (context?.previousSession) {
        queryClient.setQueryData(
          chatQueryKeys.session(params.sessionId),
          context.previousSession
        );
      }
      console.error("Rate message failed:", error);
    },

    onSettled: (_, __, params) => {
      // Always refetch after mutation to ensure server sync
      queryClient.invalidateQueries({
        queryKey: chatQueryKeys.messages(params.sessionId),
      });
      queryClient.invalidateQueries({
        queryKey: chatQueryKeys.session(params.sessionId),
      });
    },
  });
}

/**
 * Mark messages as read mutation composable
 * Uses optimistic updates to immediately clear unread count in UI
 */
export function useMarkMessagesRead() {
  const queryClient = useQueryClient();
  const chatStore = useChatStore();
  const authStore = useAuthStore();

  return useMutation({
    mutationFn: async (params: {
      sessionId: string;
      agentId: number;
      userCode?: string;
    }): Promise<void> => {
      const result = await chatService.markMessagesRead(
        params.sessionId,
        params.agentId,
        params.userCode || authStore.user?.email || ""
      );

      if (result.isErr()) {
        throw result.error;
      }

      return result.value;
    },

    // Optimistic update - immediately set unread count to 0
    onMutate: async (params) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: chatQueryKeys.unread() });

      // Snapshot previous value
      const previousUnread = queryClient.getQueryData<GetUnreadMessagesDTO[]>(
        chatQueryKeys.unread()
      );

      // Optimistically update unread counts
      queryClient.setQueryData<GetUnreadMessagesDTO[]>(
        chatQueryKeys.unread(),
        (old) => old?.map((entry) =>
          entry.sessionId === params.sessionId
            ? { ...entry, unreadMessageCount: 0 }
            : entry
        )
      );

      return { previousUnread };
    },

    onError: (error: AppError, params, context) => {
      // Rollback on error
      if (context?.previousUnread) {
        queryClient.setQueryData(chatQueryKeys.unread(), context.previousUnread);
      }
      console.error("Mark messages read failed:", error);
    },

    onSuccess: (_, params) => {
      // Optimistically update the session's messages as read in cache
      // This avoids invalidating the session query which would cause a cascade loop
      const userCode = params.userCode || authStore.user?.email || "";
      queryClient.setQueryData<AISessionDTO>(
        chatQueryKeys.session(params.sessionId),
        (old) => {
          if (!old) return old;
          return {
            ...old,
            messages: old.messages?.map((msg) => ({
              ...msg,
              readByUsers: msg.readByUsers?.includes(userCode)
                ? msg.readByUsers
                : [...(msg.readByUsers || []), userCode],
            })),
          };
        }
      );
    },

    onSettled: () => {
      // Only invalidate unread counts - session is already updated optimistically
      // IMPORTANT: Do NOT invalidate session here - it causes a cascade loop
      queryClient.invalidateQueries({ queryKey: chatQueryKeys.unread() });
    },
  });
}

/**
 * React to message mutation composable
 */
export function useReactToMessage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      sessionId: string;
      messageId: string;
      agentId: number;
    }): Promise<void> => {
      const result = await chatService.reactToMessage(
        params.sessionId,
        params.messageId,
        params.agentId,
      );

      if (result.isErr()) {
        throw result.error;
      }

      return result.value;
    },

    onSuccess: (_, params) => {
      // Invalidate related queries
      queryClient.invalidateQueries({
        queryKey: chatQueryKeys.messages(params.sessionId),
      });
      queryClient.invalidateQueries({
        queryKey: chatQueryKeys.session(params.sessionId),
      });
    },

    onError: (error: AppError) => {
      console.error("React to message failed:", error);
    },
  });
}

/**
 * Add user to session mutation composable
 */
export function useAddUserToSession() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: AddUserToSessionRequestDTO): Promise<void> => {
      const result = await chatService.addUserToSession(params);

      if (result.isErr()) {
        throw result.error;
      }

      return result.value;
    },

    onSuccess: (_, params) => {
      // Invalidate session data to refresh member list
      queryClient.invalidateQueries({
        queryKey: chatQueryKeys.session(params.sessionId),
      });
      queryClient.invalidateQueries({ queryKey: chatQueryKeys.sessions() });
    },

    onError: (error: AppError) => {
      console.error("Add user to session failed:", error);
    },
  });
}

/**
 * Remove user from session mutation composable
 */
export function useRemoveUserFromSession() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (
      params: RemoveUserFromSessionRequestDTO
    ): Promise<void> => {
      const result = await chatService.removeUserFromSession(params);

      if (result.isErr()) {
        throw result.error;
      }

      return result.value;
    },

    onSuccess: (_, params) => {
      // Invalidate session data to refresh member list
      queryClient.invalidateQueries({
        queryKey: chatQueryKeys.session(params.sessionId),
      });
      queryClient.invalidateQueries({ queryKey: chatQueryKeys.sessions() });
    },

    onError: (error: AppError) => {
      console.error("Remove user from session failed:", error);
    },
  });
}

/**
 * Start public chat mutation composable
 * Initializes a public/anonymous chat session
 */
export function useStartPublicChat() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (
      params: StartPublicChatrequestDTO
    ): Promise<AIPublicChatStartDTO> => {
      const result = await chatService.startPublicChat(params);

      if (result.isErr()) {
        throw result.error;
      }

      return result.value;
    },

    onSuccess: () => {
      // Invalidate sessions to include new public chat session
      queryClient.invalidateQueries({ queryKey: chatQueryKeys.sessions() });
    },

    onError: (error: AppError) => {
      console.error("Start public chat failed:", error);
    },
  });
}
