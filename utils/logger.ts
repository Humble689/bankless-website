export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

type LogMeta = Record<string, unknown>

const levelRank: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
}

const defaultLevel: LogLevel =
  process.env.NODE_ENV === 'production' ? 'info' : 'debug'

const configuredLevel =
  (process.env.NEXT_PUBLIC_LOG_LEVEL as LogLevel | undefined) ??
  (process.env.LOG_LEVEL as LogLevel | undefined) ??
  defaultLevel

const shouldLog = (level: LogLevel) =>
  levelRank[level] >= levelRank[configuredLevel]

export const normalizeError = (error: unknown) => {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
    }
  }

  if (typeof error === 'string') {
    return { message: error }
  }

  return {
    message: 'Non-Error thrown',
    value: error,
  }
}

const emit = (level: LogLevel, message: string, meta?: LogMeta) => {
  if (!shouldLog(level)) return

  const payload = {
    level,
    message,
    ...(meta ?? {}),
  }

  const fn =
    level === 'debug'
      ? console.debug
      : level === 'info'
        ? console.info
        : level === 'warn'
          ? console.warn
          : console.error

  fn(message, payload)
}

export const logger = {
  debug: (message: string, meta?: LogMeta) => emit('debug', message, meta),
  info: (message: string, meta?: LogMeta) => emit('info', message, meta),
  warn: (message: string, meta?: LogMeta) => emit('warn', message, meta),
  error: (message: string, meta?: LogMeta) => emit('error', message, meta),
}
