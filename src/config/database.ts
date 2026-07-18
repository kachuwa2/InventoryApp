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

  const adapter = new PrismaPg({
  connectionString,
  // Connection pooling configuration
  // Note: These are passed to the underlying node-postgres pool
  // max: 20, // equivalent to DATABASE_POOL_MAX
  // idleTimeoutMillis: 30000, // equivalent to DATABASE_IDLE_TIMEOUT
  // connectionTimeoutMillis: 5000, // connection timeout
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