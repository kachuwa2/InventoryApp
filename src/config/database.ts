import { config } from 'dotenv';

// Load .env before anything else runs
// This must happen before PrismaPg reads DATABASE_URL
config();

import { PrismaClient } from '../generated/prisma';
import { PrismaPg } from '@prisma/adapter-pg';

function createPrismaClient() {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error(
      'DATABASE_URL is not defined in your .env file'
    );
  }

  // Parse connection pool options from environment variables with defaults
  const minPoolSize = parseInt(process.env.DATABASE_POOL_MIN || '1', 10);
  const maxPoolSize = parseInt(process.env.DATABASE_POOL_MAX || '20', 10);
  const idleTimeoutMillis = parseInt(process.env.DATABASE_IDLE_TIMEOUT || '30000', 10);
  // Connection timeout for new connections (5 seconds)
  const connectionTimeoutMillis = 5000;

  const adapter = new PrismaPg({
    connectionString,
    min: minPoolSize,
    max: maxPoolSize,
    idleTimeoutMillis,
    connectionTimeoutMillis,
  });

  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === 'development'
      ? ['query', 'error']
      : ['error'],
  });
}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const db =
  globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = db;
}