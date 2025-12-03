import { useQuery, useQueryClient, useMutation } from '@tanstack/vue-query'
import { configService } from '@/lib/api/services/ConfigService'
import type { InnoChatConfig } from '@/types/api/schemas'
import type { AppError } from '@/lib/errors/types'

// Query keys
export const configQueryKeys = {
  all: ['config'] as const,
  main: () => [...configQueryKeys.all, 'main'] as const,
}

/**
 * Main configuration query composable
 * Fetches the complete application configuration
 */
export function useConfig(options?: {
  enabled?: boolean
  staleTime?: number
  refetchInterval?: number
}) {
  return useQuery({
    queryKey: configQueryKeys.main(),
    queryFn: async (): Promise<InnoChatConfig> => {
      const result = await configService.getConfig()

      if (result.isErr()) {
        throw result.error
      }

      return result.value
    },
    enabled: options?.enabled ?? true, // Config can be loaded without auth
    staleTime: options?.staleTime ?? 30 * 60 * 1000, // 30 minutes - config doesn't change often
    gcTime: 60 * 60 * 1000, // 1 hour
    refetchInterval: options?.refetchInterval ?? 15 * 60 * 1000, // Refresh every 15 minutes
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
    retry: 3,
  })
}

/**
 * Refresh configuration mutation composable
 * Forces a refresh of the cached configuration
 */
export function useRefreshConfig() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (): Promise<InnoChatConfig> => {
      const result = await configService.refreshConfig()

      if (result.isErr()) {
        throw result.error
      }

      return result.value
    },

    onSuccess: (config) => {
      // Update all config-related queries
      queryClient.invalidateQueries({ queryKey: configQueryKeys.all })
      queryClient.setQueryData(configQueryKeys.main(), config)
    },

    onError: (error: AppError) => {
      console.error('Refresh config failed:', error)
    },
  })
}
