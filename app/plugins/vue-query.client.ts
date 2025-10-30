import { VueQueryPlugin, QueryClient, type VueQueryPluginOptions } from '@tanstack/vue-query'
import { AppError } from '@/lib/errors/types'
import { ErrorCode } from '@/types/enums'

// Create a client
export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // Default cache time: 5 minutes
        staleTime: 1000 * 60 * 5,
        // Default garbage collection time: 10 minutes
        gcTime: 1000 * 60 * 10,
        // Retry failed requests 3 times
        retry: 3,
        // Retry with exponential backoff
        retryDelay: (attemptIndex: number) => Math.min(1000 * 2 ** attemptIndex, 30000),
        // Don't refetch on window focus by default
        refetchOnWindowFocus: false,
        // Don't refetch on reconnect by default
        refetchOnReconnect: true,
      },
      mutations: {
        // Smart retry logic: retry on network/server errors, skip validation/client errors
        retry: (failureCount, error) => {
          // Max 2 retry attempts
          if (failureCount >= 2) return false

          // Don't retry validation errors
          if (error instanceof AppError && error.code === ErrorCode.VALIDATION_ERROR) {
            return false
          }

          // Don't retry 4xx client errors (except specific retriable ones)
          if (error instanceof AppError && error.statusCode &&
              error.statusCode >= 400 && error.statusCode < 500) {
            return false
          }

          // Retry 5xx server errors and network failures
          return true
        },
        // Retry delay for mutations
        retryDelay: 1000,
      },
    },
  })
}

export default defineNuxtPlugin({
  name: 'vue-query',
  enforce: 'pre', // Load this plugin before others
  setup(nuxtApp) {
    // Create query client
    const queryClient = createQueryClient()

    // Configure Vue Query plugin options
    const options: VueQueryPluginOptions = {
      queryClient,
      enableDevtoolsV6Plugin: true,
    }

    // Install Vue Query plugin
    nuxtApp.vueApp.use(VueQueryPlugin, options)

    // Make query client available via $queryClient
    return {
      provide: {
        queryClient,
      },
    }
  },
})
