// src/utils/logger.ts
const isDev = process.env.NODE_ENV !== 'production'

export const logger = {
  info: (message: string, data?: object) => {
    console.log(JSON.stringify({
      level: 'info',
      message,
      timestamp: new Date().toISOString(),
      ...(data || {}),
    }))
  },
  error: (message: string, error?: unknown, data?: object) => {
    console.error(JSON.stringify({
      level: 'error',
      message,
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? {
        name:    error.name,
        message: error.message,
        stack:   isDev ? error.stack : undefined,
      } : error,
      ...(data || {}),
    }))
  },
  warn: (message: string, data?: object) => {
    console.warn(JSON.stringify({
      level: 'warn',
      message,
      timestamp: new Date().toISOString(),
      ...(data || {}),
    }))
  },
}