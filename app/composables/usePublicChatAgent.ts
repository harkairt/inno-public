import { useQuery } from '@tanstack/vue-query'
import { chatService } from '@/lib/api/services/ChatService'
import { useAuthStore } from '@/app/stores/auth'
import { toValue, type MaybeRefOrGetter } from 'vue'
import type { AIPublicChatStartDTO } from '@/types/api/schemas'
import type { AppError } from '@/lib/errors/types'

// Query keys for public chat agent
export const publicChatAgentQueryKeys = {
  all: ['publicChatAgent'] as const,
  agent: (agentId: number) => [...publicChatAgentQueryKeys.all, agentId] as const,
}

/**
 * Public chat agent query composable
 * Fetches agent information for public chat mode using the startPublicChat endpoint.
 * Returns the agent's UserDTO which includes email needed for the members array.
 */
export function usePublicChatAgent(
  agentId: MaybeRefOrGetter<number | null>,
  options?: {
    enabled?: MaybeRefOrGetter<boolean>
  },
) {
  const authStore = useAuthStore()

  return useQuery({
    queryKey: computed(() => {
      const id = toValue(agentId)
      return id ? publicChatAgentQueryKeys.agent(id) : publicChatAgentQueryKeys.all
    }),
    queryFn: async (): Promise<AIPublicChatStartDTO> => {
      const id = toValue(agentId)

      if (!authStore.user) {
        throw new Error('User not authenticated')
      }

      if (!id) {
        throw new Error('Agent ID is required')
      }

      const result = await chatService.startPublicChat({
        agentId: id,
        userEmail: authStore.user.email,
      })

      if (result.isErr()) {
        throw result.error
      }

      return result.value
    },
    enabled: computed(() => {
      const id = toValue(agentId)
      const enabledOption = toValue(options?.enabled)
      return (enabledOption ?? true) && authStore.isAuthenticated && !!id
    }),
    staleTime: 5 * 60 * 1000, // 5 minutes - agent info doesn't change often
    gcTime: 10 * 60 * 1000, // 10 minutes
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    retry: (failureCount, error) => {
      if (error && typeof error === 'object' && 'code' in error) {
        const appError = error as AppError
        if (
          appError.code === 'UNAUTHORIZED' ||
          appError.code === 'FORBIDDEN' ||
          appError.code === 'NOT_FOUND'
        ) {
          return false
        }
      }
      return failureCount < 2
    },
  })
}
