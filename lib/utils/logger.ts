type LogMethod = 'debug' | 'info' | 'warn' | 'error'

export interface Logger {
  debug: (...args: unknown[]) => void
  info: (...args: unknown[]) => void
  warn: (...args: unknown[]) => void
  error: (...args: unknown[]) => void
}

function writeLog(scope: string, method: LogMethod, args: unknown[]): void {
  const logMethod = globalThis.console[method]

  logMethod(`[${scope}]`, ...args)
}

export function createLogger(scope: string): Logger {
  return {
    debug: (...args) => writeLog(scope, 'debug', args),
    info: (...args) => writeLog(scope, 'info', args),
    warn: (...args) => writeLog(scope, 'warn', args),
    error: (...args) => writeLog(scope, 'error', args),
  }
}
