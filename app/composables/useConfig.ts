import { useQuery, useQueryClient, useMutation, useInfiniteQuery } from '@tanstack/vue-query'
import { configService } from '@/lib/api/services/ConfigService'
import { useAuthStore } from '@/app/stores/auth'
import type { InnoChatConfig } from '@/types/api/schemas'
import type { AgentInfo, UIConfiguration, FeatureFlags, ConfigHistoryResponse } from '@/types/api/admin-types'
import type { AppError } from '@/lib/errors/types'

// Query keys
export const configQueryKeys = {
  all: ['config'] as const,
  main: () => [...configQueryKeys.all, 'main'] as const,
  value: (path: string) => [...configQueryKeys.all, 'value', path] as const,
  agent: (id: number) => [...configQueryKeys.all, 'agent', id] as const,
  agents: () => [...configQueryKeys.all, 'agents'] as const,
  ui: () => [...configQueryKeys.all, 'ui'] as const,
  features: () => [...configQueryKeys.all, 'features'] as const,
  feature: (name: string) => [...configQueryKeys.features(), name] as const,
  api: () => [...configQueryKeys.all, 'api'] as const,
  signalr: () => [...configQueryKeys.all, 'signalr'] as const,
  auth: () => [...configQueryKeys.all, 'auth'] as const,
  logging: () => [...configQueryKeys.all, 'logging'] as const,
  rateLimit: () => [...configQueryKeys.all, 'rateLimit'] as const,
  cache: () => [...configQueryKeys.all, 'cache'] as const,
  history: () => [...configQueryKeys.all, 'history'] as const,
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
  const _authStore = useAuthStore()

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
 * Configuration value query composable
 * Fetches a specific configuration value by path
 */
export function useConfigValue<T = unknown>(path: string, options?: {
  enabled?: boolean
  staleTime?: number
}) {
  return useQuery({
    queryKey: configQueryKeys.value(path),
    queryFn: async (): Promise<T> => {
      if (!path?.trim()) {
        throw new Error('Configuration path is required')
      }

      const result = await configService.getConfigValue<T>(path.trim())

      if (result.isErr()) {
        throw result.error
      }

      return result.value
    },
    enabled: options?.enabled ?? !!path?.trim(),
    staleTime: options?.staleTime ?? 30 * 60 * 1000, // 30 minutes
    gcTime: 60 * 60 * 1000, // 1 hour
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
    retry: 2,
  })
}

/**
 * Agent configuration query composable
 * Fetches configuration for a specific agent
 */
export function useAgentConfig(agentId: number, options?: {
  enabled?: boolean
  staleTime?: number
}) {
  return useQuery({
    queryKey: configQueryKeys.agent(agentId),
    queryFn: async (): Promise<AgentInfo> => {
      if (!agentId) {
        throw new Error('Agent ID is required')
      }

      const result = await configService.getAgentConfig(agentId)

      if (result.isErr()) {
        throw result.error
      }

      return result.value
    },
    enabled: options?.enabled ?? !!agentId,
    staleTime: options?.staleTime ?? 10 * 60 * 1000, // 10 minutes
    gcTime: 30 * 60 * 1000, // 30 minutes
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
    retry: 2,
  })
}

/**
 * UI configuration query composable
 * Fetches UI-specific configuration
 */
export function useUIConfig(options?: {
  enabled?: boolean
  staleTime?: number
}) {
  return useQuery({
    queryKey: configQueryKeys.ui(),
    queryFn: async (): Promise<UIConfiguration> => {
      const result = await configService.getUIConfig()

      if (result.isErr()) {
        throw result.error
      }

      return result.value
    },
    enabled: options?.enabled ?? true,
    staleTime: options?.staleTime ?? 30 * 60 * 1000, // 30 minutes
    gcTime: 60 * 60 * 1000, // 1 hour
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
    retry: 2,
  })
}

/**
 * Feature flags query composable
 * Fetches all feature flags
 */
export function useFeatureFlags(options?: {
  enabled?: boolean
  staleTime?: number
  refetchInterval?: number
}) {
  const authStore = useAuthStore()

  return useQuery({
    queryKey: configQueryKeys.features(),
    queryFn: async (): Promise<FeatureFlags> => {
      const result = await configService.getFeatureFlags()

      if (result.isErr()) {
        throw result.error
      }

      return result.value
    },
    enabled: options?.enabled ?? authStore.isAuthenticated,
    staleTime: options?.staleTime ?? 5 * 60 * 1000, // 5 minutes - feature flags might change
    gcTime: 15 * 60 * 1000, // 15 minutes
    refetchInterval: options?.refetchInterval ?? 5 * 60 * 1000, // Refresh every 5 minutes
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    retry: 3,
  })
}

/**
 * API configuration query composable
 * Fetches API-specific configuration
 */
export function useAPIConfig(options?: {
  enabled?: boolean
  staleTime?: number
}) {
  return useQuery({
    queryKey: configQueryKeys.api(),
    queryFn: async (): Promise<Record<string, unknown>> => {
      const result = await configService.getAPIConfig()

      if (result.isErr()) {
        throw result.error
      }

      return result.value
    },
    enabled: options?.enabled ?? true,
    staleTime: options?.staleTime ?? 30 * 60 * 1000, // 30 minutes
    gcTime: 60 * 60 * 1000, // 1 hour
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
    retry: 2,
  })
}

/**
 * SignalR configuration query composable
 * Fetches SignalR-specific configuration
 */
export function useSignalRConfig(options?: {
  enabled?: boolean
  staleTime?: number
}) {
  return useQuery({
    queryKey: configQueryKeys.signalr(),
    queryFn: async (): Promise<Record<string, unknown>> => {
      const result = await configService.getSignalRConfig()

      if (result.isErr()) {
        throw result.error
      }

      return result.value
    },
    enabled: options?.enabled ?? true,
    staleTime: options?.staleTime ?? 30 * 60 * 1000, // 30 minutes
    gcTime: 60 * 60 * 1000, // 1 hour
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
    retry: 2,
  })
}

/**
 * Authentication configuration query composable
 * Fetches authentication-specific configuration
 */
export function useAuthConfig(options?: {
  enabled?: boolean
  staleTime?: number
}) {
  return useQuery({
    queryKey: configQueryKeys.auth(),
    queryFn: async (): Promise<Record<string, unknown>> => {
      const result = await configService.getAuthConfig()

      if (result.isErr()) {
        throw result.error
      }

      return result.value
    },
    enabled: options?.enabled ?? true,
    staleTime: options?.staleTime ?? 30 * 60 * 1000, // 30 minutes
    gcTime: 60 * 60 * 1000, // 1 hour
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
    retry: 2,
  })
}

/**
 * Configuration history infinite query composable
 * Fetches configuration change history with pagination
 */
export function useConfigHistory(options?: {
  enabled?: boolean
  pageSize?: number
  staleTime?: number
}) {
  const authStore = useAuthStore()
  const pageSize = options?.pageSize || 20

  return useInfiniteQuery({
    queryKey: configQueryKeys.history(),
    queryFn: async ({ pageParam = 1 }): Promise<ConfigHistoryResponse> => {
      if (!authStore.isAuthenticated || !authStore.isAdmin) {
        throw new Error('Admin access required')
      }

      const result = await configService.getConfigHistory(pageParam, pageSize)

      if (result.isErr()) {
        throw result.error
      }

      return result.value
    },
    getNextPageParam: (lastPage) => {
      const totalPages = Math.ceil(lastPage.total / lastPage.pageSize)
      return lastPage.page < totalPages ? lastPage.page + 1 : null
    },
    initialPageParam: 1,
    enabled: options?.enabled ?? (authStore.isAuthenticated && authStore.isAdmin),
    staleTime: options?.staleTime ?? 60 * 1000, // 1 minute
    gcTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
    retry: 2,
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

/**
 * Update configuration mutation composable
 * Handles updating configuration (admin only)
 */
export function useUpdateConfig() {
  const queryClient = useQueryClient()
  const authStore = useAuthStore()

  return useMutation({
    mutationFn: async (updates: Partial<InnoChatConfig>): Promise<InnoChatConfig> => {
      if (!authStore.isAuthenticated || !authStore.isAdmin) {
        throw new Error('Admin access required')
      }

      const result = await configService.updateConfig(updates)

      if (result.isErr()) {
        throw result.error
      }

      return result.value
    },

    onSuccess: (updatedConfig) => {
      // Update config in cache
      queryClient.setQueryData(configQueryKeys.main(), updatedConfig)

      // Invalidate all config-related queries
      queryClient.invalidateQueries({ queryKey: configQueryKeys.all })
    },

    onError: (error: AppError) => {
      console.error('Update config failed:', error)
    },
  })
}

/**
 * Update agent configuration mutation composable
 * Handles updating agent-specific configuration (admin only)
 */
export function useUpdateAgentConfig() {
  const queryClient = useQueryClient()
  const authStore = useAuthStore()

  return useMutation({
    mutationFn: async (params: { agentId: number; config: Partial<AgentInfo> }): Promise<AgentInfo> => {
      if (!authStore.isAuthenticated || !authStore.isAdmin) {
        throw new Error('Admin access required')
      }

      const result = await configService.updateAgentConfig(params.agentId, params.config)

      if (result.isErr()) {
        throw result.error
      }

      return result.value
    },

    onSuccess: (updatedAgent, params) => {
      // Update agent in cache
      queryClient.setQueryData(configQueryKeys.agent(params.agentId), updatedAgent)

      // Invalidate related queries
      queryClient.invalidateQueries({ queryKey: configQueryKeys.agents() })
      queryClient.invalidateQueries({ queryKey: configQueryKeys.main() })
    },

    onError: (error: AppError) => {
      console.error('Update agent config failed:', error)
    },
  })
}

/**
 * Update feature flags mutation composable
 * Handles updating feature flags (admin only)
 */
export function useUpdateFeatureFlags() {
  const queryClient = useQueryClient()
  const authStore = useAuthStore()

  return useMutation({
    mutationFn: async (flags: Record<string, boolean>): Promise<Record<string, boolean>> => {
      if (!authStore.isAuthenticated || !authStore.isAdmin) {
        throw new Error('Admin access required')
      }

      const result = await configService.updateFeatureFlags(flags)

      if (result.isErr()) {
        throw result.error
      }

      return result.value
    },

    onSuccess: (updatedFlags) => {
      // Update feature flags in cache
      queryClient.setQueryData(configQueryKeys.features(), updatedFlags)

      // Invalidate individual feature flag queries
      Object.keys(updatedFlags).forEach(featureName => {
        queryClient.invalidateQueries({ queryKey: configQueryKeys.feature(featureName) })
      })

      // Invalidate main config
      queryClient.invalidateQueries({ queryKey: configQueryKeys.main() })
    },

    onError: (error: AppError) => {
      console.error('Update feature flags failed:', error)
    },
  })
}

/**
 * Export configuration mutation composable
 * Handles exporting configuration (admin only)
 */
export function useExportConfig() {
  const authStore = useAuthStore()

  return useMutation({
    mutationFn: async (format: 'json' | 'yaml' = 'json'): Promise<Blob> => {
      if (!authStore.isAuthenticated || !authStore.isAdmin) {
        throw new Error('Admin access required')
      }

      const result = await configService.exportConfig(format)

      if (result.isErr()) {
        throw result.error
      }

      return result.value
    },

    onSuccess: (blob, format) => {
      // Create download link
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `innochat-config.${format}`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
    },

    onError: (error: AppError) => {
      console.error('Export config failed:', error)
    },
  })
}

/**
 * Import configuration mutation composable
 * Handles importing configuration (admin only)
 */
export function useImportConfig() {
  const queryClient = useQueryClient()
  const authStore = useAuthStore()

  return useMutation({
    mutationFn: async (params: {
      configFile: File
      format?: 'json' | 'yaml'
    }): Promise<InnoChatConfig> => {
      if (!authStore.isAuthenticated || !authStore.isAdmin) {
        throw new Error('Admin access required')
      }

      const result = await configService.importConfig(
        params.configFile,
        params.format || 'json'
      )

      if (result.isErr()) {
        throw result.error
      }

      return result.value
    },

    onSuccess: (importedConfig) => {
      // Update config in cache
      queryClient.setQueryData(configQueryKeys.main(), importedConfig)

      // Invalidate all config-related queries
      queryClient.invalidateQueries({ queryKey: configQueryKeys.all })
    },

    onError: (error: AppError) => {
      console.error('Import config failed:', error)
    },
  })
}

/**
 * Reset configuration mutation composable
 * Handles resetting configuration to defaults (admin only)
 */
export function useResetConfig() {
  const queryClient = useQueryClient()
  const authStore = useAuthStore()

  return useMutation({
    mutationFn: async (): Promise<InnoChatConfig> => {
      if (!authStore.isAuthenticated || !authStore.isAdmin) {
        throw new Error('Admin access required')
      }

      const result = await configService.resetConfig()

      if (result.isErr()) {
        throw result.error
      }

      return result.value
    },

    onSuccess: (resetConfig) => {
      // Update config in cache
      queryClient.setQueryData(configQueryKeys.main(), resetConfig)

      // Invalidate all config-related queries
      queryClient.invalidateQueries({ queryKey: configQueryKeys.all })
    },

    onError: (error: AppError) => {
      console.error('Reset config failed:', error)
    },
  })
}

/**
 * Restore configuration version mutation composable
 * Handles restoring configuration to a previous version (admin only)
 */
export function useRestoreConfigVersion() {
  const queryClient = useQueryClient()
  const authStore = useAuthStore()

  return useMutation({
    mutationFn: async (versionId: string): Promise<InnoChatConfig> => {
      if (!authStore.isAuthenticated || !authStore.isAdmin) {
        throw new Error('Admin access required')
      }

      if (!versionId?.trim()) {
        throw new Error('Version ID is required')
      }

      const result = await configService.restoreConfigVersion(versionId.trim())

      if (result.isErr()) {
        throw result.error
      }

      return result.value
    },

    onSuccess: (restoredConfig) => {
      // Update config in cache
      queryClient.setQueryData(configQueryKeys.main(), restoredConfig)

      // Invalidate all config-related queries
      queryClient.invalidateQueries({ queryKey: configQueryKeys.all })
    },

    onError: (error: AppError) => {
      console.error('Restore config version failed:', error)
    },
  })
}