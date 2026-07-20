// src/utils/validateEnv.ts
import { logger } from './logger';
import { config } from 'dotenv';
config();
const required = [
  'DATABASE_URL',
  'JWT_SECRET',
  'JWT_EXPIRES_IN',
  'JWT_REFRESH_EXPIRES_IN',
  'NODE_ENV',
];

export function validateEnv(): void {
  const missing: string[] = []

  for (const key of required) {
    if (!process.env[key]) {
      missing.push(key)
    }
  }

  if (missing.length > 0) {
    logger.error(
      `Missing required environment variables: ${missing.join(', ')}`
    )
    logger.error('Check your .env file')
    process.exit(1)
  }

  logger.info('Environment variables validated')
}