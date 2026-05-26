import { defineConfig } from 'prisma/config'

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    // Use process.env instead of env() so prisma generate
    // does not throw when DATABASE_URL is missing at build time.
    // prisma generate only needs the schema — never the database.
    // prisma migrate deploy uses the real URL at runtime.
    url: process.env.DATABASE_URL ?? 'postgresql://postgres:Knowledge7670@localhost:5432/inventory_db',
  },
})