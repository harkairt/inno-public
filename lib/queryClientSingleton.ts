import { QueryClient } from '@tanstack/vue-query'
import { AppError } from '@/lib/errors/types'
import { ErrorCode } from '@/types/enums'

let _queryClient: QueryClient | null = null

export function getQueryClient(): QueryClient {
  _queryClient ??= createQueryClient()
  return _queryClient
}

export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 1000 * 60 * 5,
        gcTime: 1000 * 60 * 10,
        retry: 3,
        retryDelay: (attemptIndex: number) => Math.min(1000 * 2 ** attemptIndex, 30000),
        refetchOnWindowFocus: false,
        refetchOnReconnect: true,
      },
      mutations: {
        retry: (failureCount, error) => {
          if (failureCount >= 2) return false
          if (error instanceof AppError && error.code === ErrorCode.VALIDATION_ERROR) return false
          if (error instanceof AppError && error.statusCode && error.statusCode >= 400 && error.statusCode < 500) return false
          return true
        },
        retryDelay: 1000,
      },
    },
  })
}
