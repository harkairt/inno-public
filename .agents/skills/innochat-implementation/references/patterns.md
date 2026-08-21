# InnoChat Implementation Patterns — Extended Examples

## Optimistic Update Pattern (useChatMutations.ts)

Mutations often add optimistic messages to Vue Query cache before the API resolves:

```typescript
export function useSendMessage() {
  const queryClient = useQueryClient()
  const authStore = useAuthStore()
  const chatStore = useChatStore()

  return useMutation({
    mutationFn: async (request: AiQuestionRequestDTO) => {
      const result = await chatService.sendQuestion(request)
      if (result.isErr()) throw result.error
      return result.value
    },

    onMutate: async (request) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: chatQueryKeys.session(request.sessionId) })

      // Snapshot previous value (for rollback)
      const previous = queryClient.getQueryData<AISessionDTO>(
        chatQueryKeys.session(request.sessionId)
      )

      // Add optimistic user message with PENDING status
      const tempMessage: ExtendedMessage = {
        messageID: generateTempId(),
        messageText: request.question,
        messageType: AIAnswerType.Text,
        senderUserCode: authStore.user?.email ?? '',
        senderName: authStore.user?.name ?? '',
        sendDate: new Date().toISOString(),
        status: MessageStatus.PENDING,  // optimistic status
        // ... other fields
      }

      queryClient.setQueryData(
        chatQueryKeys.session(request.sessionId),
        (old: AISessionDTO | undefined) => old
          ? { ...old, messages: [...old.messages, tempMessage] }
          : old
      )

      return { previous }  // returned context for onError
    },

    onError: (_err, request, context) => {
      // Rollback on error
      if (context?.previous) {
        queryClient.setQueryData(chatQueryKeys.session(request.sessionId), context.previous)
      }
    },

    onSuccess: (response, request) => {
      // Replace temp message with real response and update cache
      queryClient.invalidateQueries({ queryKey: chatQueryKeys.session(request.sessionId) })
    },
  })
}
```

## SignalR → Vue Query Cache Integration

`useSignalRChat.ts` listens to SignalR hub events and updates the Vue Query cache directly:

```typescript
export function useSignalRChat() {
  const queryClient = useQueryClient()
  const { connection, isConnected } = useSignalR()

  function handleNewMessage(message: AISessionMessageDTO) {
    // Update the session cache with the new message
    queryClient.setQueryData(
      chatQueryKeys.session(message.sessionId),
      (old: AISessionDTO | undefined) => {
        if (!old) return old
        // Avoid duplicates
        const exists = old.messages.some(m => m.messageID === message.messageID)
        if (exists) return old
        return { ...old, messages: [...old.messages, message] }
      }
    )
    // Also invalidate the sessions list (unread counts may have changed)
    queryClient.invalidateQueries({ queryKey: chatQueryKeys.sessions() })
  }

  watch(connection, (conn) => {
    if (!conn) return
    conn.on('ReceiveMessage', handleNewMessage)
  }, { immediate: true })
}
```

## Public Mode Pattern

Public mode composable (`usePublicMode.ts`) detects and validates public configuration:

```typescript
// In any component or composable
const { isPublicMode, isValidPublicAgent, getPublicChatUrl } = usePublicMode()

if (isPublicMode.value) {
  // App is in iframe/public mode — no sidebar, restricted navigation
  // Storage mode is sessionStorage (set by config-init.client.ts plugin)
}
```

Public mode is activated when `InnoChatConfig.publicAgentId` is set. The `config-init.client.ts` plugin:
1. Fetches `/api/settings/config.json`
2. If `publicAgentId` is set, calls `setStorageMode('sessionStorage')` on auth store
3. Stores config in `useConfigStore()`

## Config Access Pattern

```typescript
const { config, isLoaded } = useConfig()

// config.value?.primaryColor
// config.value?.publicAgentId
// config.value?.chatBubbleStyle
```

## Response Envelope Pattern

All backend responses follow this `ApiResponse<T>` wrapper (from `types/api/base.ts`):

```typescript
interface ApiResponse<T> {
  data: T | null
  error: { code: string; message: string; statusCode: number } | null
  success: string | null
  warning: string | null
}
```

When writing MSW handlers, always wrap responses in this envelope. The `warning` field is used for soft errors (e.g., invalid credentials return `{ warning: "Hibás felhasználónév / jelszó" }` with HTTP 200).

## Mutation Success Pattern

Some ChatService methods return `MutationSuccess` (a `true` literal type):

```typescript
// validateMutationSuccess in schemas.ts checks the response string
// Backend returns: { data: '{"message":"kész."}' }
// validateMutationSuccess parses this and returns ok(true) or err(...)
const result = await chatService.deleteSession({ sessionId })
if (result.isOk()) {
  // result.value === true
  queryClient.invalidateQueries({ queryKey: chatQueryKeys.sessions() })
}
```

## Adding a New API Endpoint

1. Add method to `ChatService` (or new `XxxService.ts`):
   ```typescript
   async getMyNewData(request: MyRequestDTO): Promise<Result<MyResponseDTO, AppError>> {
     try {
       const response = await apiClient.post<ApiResponse<MyResponseDTO>>(
         '/api/AIWebAPI/MyNewEndpoint', request
       )
       if (!response.data.data) return err(new AppError(ErrorCode.EMPTY_RESPONSE, '...'))
       const parseResult = MyResponseDTOSchema.safeParse(response.data.data)
       if (!parseResult.success) return err(new AppError(ErrorCode.VALIDATION_ERROR, '...'))
       return ok(parseResult.data)
     } catch (error) {
       return err(normalizeApiError(error))
     }
   }
   ```

2. Add Zod schema to `types/api/schemas.ts`:
   ```typescript
   export const MyResponseDTOSchema = z.object({
     id: z.string(),
     name: z.string(),
   })
   export type MyResponseDTO = z.infer<typeof MyResponseDTOSchema>
   ```

3. Add query key to `chatQueryKeys` in `useChatQueries.ts`

4. Add query composable in `useChatQueries.ts` (or mutation in `useChatMutations.ts`)

5. Add MSW handler in `tests/msw/handlers/chat.ts` using the real endpoint path
