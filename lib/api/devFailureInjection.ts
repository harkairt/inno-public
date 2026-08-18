import { err, type Result } from 'neverthrow'
import { NetworkError } from '@/lib/errors/types'

const DEVELOPMENT_FAILURE_RATE = 0.8
const SIMULATED_LOADING_DURATION_MS = 750

type SimulatedOperation = 'upload' | 'message send'

export async function simulateDevelopmentApiFailure<T>(
  operation: SimulatedOperation,
): Promise<Result<T, NetworkError> | undefined> {
  if (
    !import.meta.dev ||
    import.meta.env.MODE !== 'development' ||
    Math.random() >= DEVELOPMENT_FAILURE_RATE
  ) {
    return undefined
  }

  await new Promise<void>((resolve) => {
    setTimeout(resolve, SIMULATED_LOADING_DURATION_MS)
  })

  return err(new NetworkError(`Simulated development ${operation} failure`))
}
