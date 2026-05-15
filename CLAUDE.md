# Inventory Management System — Claude Code Context

## Project Overview
A wholesale and retail kitchen utensils inventory system built with Node.js,
TypeScript, PostgreSQL, Prisma 7, Zod v4, and Express v5.

## Commands
- `npm run dev`    — start development server with nodemon on port 3000
- `npm run build`  — compile TypeScript to dist/
- `npm start`      — run compiled production build

## Database
- `npx prisma migrate dev --name description`    — create and apply migration
- `npx prisma generate --config prisma.config.mjs` — regenerate Prisma client
- `npx prisma studio --config prisma.config.mjs`   — open database browser

## Architecture
- **Framework:** Express v5 with TypeScript
- **Database:** PostgreSQL via Prisma 7 (adapter pattern)
- **Validation:** Zod v4 (z.email() not z.string().email())
- **Auth:** JWT access token (15min) + httpOnly refresh cookie (7d)
- **Pattern:** schema → service → controller → routes per module

## Critical Prisma 7 Rules
- Import PrismaClient from '../generated/prisma' NOT from '@prisma/client'
- Always use connect syntax for relations in transactions:
  `createdBy: { connect: { id: userId } }` NOT `createdById: userId`
- Run generate with: `npx prisma generate --config prisma.config.mjs`
- Config file is prisma.config.mjs (NOT .ts or .js)

## Critical Zod v4 Rules
- Use z.email() NOT z.string().email() (deprecated)
- Use z.uuid() NOT z.string().uuid() (deprecated)
- Use err.issues NOT err.errors
- Use z.ZodType for schema parameter types

## Critical Express v5 Rules
- Use getParam(req, 'id') NOT req.params.id (can be string | string[])
- Use getIp(req) NOT req.ip (can be string | string[])
- Both helpers live in src/utils/request.ts

## Module Structure
Each module has exactly 4 files:
- schema.ts    — Zod validation schemas
- service.ts   — all business logic, database calls
- controller.ts — HTTP layer only, calls service
- routes.ts    — URL mapping, middleware chain

## Database Rules (NEVER break these)
- Stock is NEVER stored directly — always computed from stock_movements
- Prices NEVER updated — always INSERT new product_price_history record
- Business records NEVER hard-deleted — use deletedAt (soft delete)
- All money stored as Decimal(12,2) — never Float
- Every write operation runs inside db.$transaction()
- Audit log always written inside the same transaction

## Modules Built
- auth, categories, suppliers, products, inventory
- purchases, customers, sales, reports

## Environment
- DATABASE_URL in .env pointing to local PostgreSQL inventory_db
- JWT_SECRET, JWT_EXPIRES_IN=15m, JWT_REFRESH_EXPIRES_IN=7d
- PORT=3000, NODE_ENV=development