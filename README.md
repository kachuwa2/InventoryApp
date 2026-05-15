# Inventory Management System

A production-grade REST API for wholesale and retail kitchen utensil inventory management. Built with a focus on financial accuracy, auditability, and correctness over convenience.

Stock is never stored as a number — it is always computed from an immutable ledger. Prices are never overwritten — every change is appended to a history table. Nothing is ever hard-deleted. Every write runs inside a database transaction alongside its own audit log entry.

---

## Table of Contents

- [Features](#features)
- [Tech Stack](#tech-stack)
- [Architecture Decisions](#architecture-decisions)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [API Reference](#api-reference)
- [Database Schema](#database-schema)
- [Testing](#testing)
- [Project Structure](#project-structure)

---

## Features

| Module | Description |
|--------|-------------|
| **Auth** | JWT authentication with 15-minute access tokens and 7-day httpOnly refresh cookies. Five roles: admin, manager, cashier, warehouse, viewer. Every login and registration is audit-logged. |
| **Categories** | Self-referencing tree structure. A category can have a parent, enabling hierarchies like Cookware → Pans → Non-stick. |
| **Suppliers** | Supplier relationship management with credit limits, contact details, and purchase order history. Soft-delete protected. |
| **Products** | Full product catalog with SKU, EAN-13 barcode, unit type, and reorder point alerting. Three prices tracked per product: cost, retail, wholesale. |
| **Inventory** | Ledger-based stock tracking. Current stock computed from movement history. Manual adjustments, low-stock alerts, and inventory valuation by category. |
| **Purchases** | Purchase order lifecycle: draft → approved → received. Receiving creates stock movements automatically. Supports partial shipments. |
| **Sales** | Point-of-sale checkout for retail and wholesale. Prices snapshotted at sale time. Stock deducted atomically. Walk-in support (no customer account required). |
| **Customers** | Retail and wholesale customer management with credit limits and full order history. |
| **Reports** | Business intelligence endpoints: dashboard KPIs, profit/loss by period, top products by revenue, slow-moving inventory identification. |

---

## Tech Stack

| Technology | Version | Why |
|------------|---------|-----|
| Node.js | 18+ | LTS with native ESM support and stable performance |
| TypeScript | 6.x | Strict typing catches entire classes of bugs at compile time; strict mode enforced |
| Express | 5.x | Async error propagation built-in — no more wrapping every controller in try/catch for unhandled promise rejections |
| PostgreSQL | 15+ | ACID transactions, `Decimal` type for financial data, mature JSON support for audit log states |
| Prisma | 7.x | Type-safe query builder with generated types; PrismaPg adapter uses the native `pg` driver directly — no Rust engine binary required |
| Zod | 4.x | Runtime validation that generates TypeScript types from the same schema; used at every API boundary |
| bcryptjs | 3.x | Pure-JS bcrypt implementation; cost factor 12 makes brute-force attacks computationally expensive |
| jsonwebtoken | 9.x | Signed JWT with configurable expiry; refresh token rotation via httpOnly cookie |
| helmet | 8.x | Sets 12 HTTP security headers (CSP, HSTS, X-Frame-Options, etc.) on every response |
| express-rate-limit | 8.x | Brute-force protection on login (5/15 min) and general DoS protection (100 req/min) |
| Jest + ts-jest | 30 + 29 | Integration test runner; ts-jest compiles TypeScript directly without a separate build step |
| Supertest | 7.x | HTTP assertion library that drives the Express app in-process — no network required |

---

## Architecture Decisions

### Stock is a ledger, not a number

Stock is never stored as a column anywhere in the database. The current quantity of any product is always computed on demand:

```
currentStock = SUM(purchase + adjustment_in + return_in)
             - SUM(sale + adjustment_out + return_out)
```

Every stock movement is an **immutable append-only row** in `stock_movements`. Rows are never updated or deleted.

This matters for three reasons. First, you get a complete audit trail of every movement — who did it, when, why, and what it cost per unit. Second, there is no synchronisation problem: the ledger and the "balance" can never drift apart because there is no stored balance. Third, historical reports are trivially correct — you can compute stock as of any point in time by filtering movements by date.

The tradeoff is that computing current stock requires a `SUM` aggregation. For a catalog of thousands of products this is fast with the right indexes; for a catalog of millions, a materialised view or periodic snapshot would be considered.

---

### Prices are append-only history

`product_price_history` is an append-only table. When a price changes, a new row is inserted — the previous row is never touched. The current price is always the row with the highest `effectiveFrom` timestamp.

```sql
-- Current price
SELECT * FROM product_price_history
WHERE product_id = $1
ORDER BY effective_from DESC
LIMIT 1;
```

This means every invoice and every profit/loss calculation can reproduce the exact price that applied at any historical point in time. If a product's retail price was $30 in March and $35 in April, a March sale report will always show $30 — even if the product is re-priced a hundred times after that.

---

### Soft deletes instead of hard deletes

Every table that represents a business entity has a `deleted_at` column. Deleting a record sets this timestamp; all queries filter `WHERE deleted_at IS NULL` by default.

Hard deletes destroy data permanently and can silently corrupt foreign key relationships. A supplier that was deleted is still referenced in two years of purchase orders. A product that was deleted is still on last month's invoice. Soft deletes preserve referential integrity and allow recovery of mistakenly deleted records.

---

### Prisma 7 with the PrismaPg adapter

Prisma 7 introduces an adapter pattern that replaces the legacy Rust query engine binary. The `PrismaPg` adapter uses the native Node.js `pg` package as the database driver directly.

```typescript
import { PrismaClient } from '../generated/prisma';
import { PrismaPg } from '@prisma/adapter-pg';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
export const db = new PrismaClient({ adapter });
```

The benefits are: no platform-specific Rust binary to include in the deployment, smaller container images, and compatibility with edge runtimes that cannot execute native binaries.

---

### Every write is a transaction with an audit log

Every route that mutates state follows this pattern:

```typescript
await db.$transaction(async (tx) => {
  const record = await tx.someModel.create({ ... });

  await tx.auditLog.create({
    data: {
      userId,
      action: 'SOME_ACTION',
      tableName: 'some_table',
      recordId: record.id,
      beforeState: null,
      afterState: { ...safeFields },
      ipAddress: getIp(req),
    },
  });

  return record;
});
```

The audit log entry and the business record are written atomically. If the audit log insert fails, the entire transaction rolls back. You can never have a record without an audit trail, and you can never have an orphaned audit trail entry.

---

## Getting Started

### Prerequisites

- Node.js 18 or later
- PostgreSQL 15 running locally (or a connection string to a remote instance)
- npm 9 or later

### Installation

```bash
git clone https://github.com/Pensive25/inventory_system.git
cd inventory_system
npm install
```

### Configure environment

```bash
cp .env.example .env
```

Open `.env` and set your database credentials and JWT secret. See [Environment Variables](#environment-variables) for the full reference.

### Initialise the database

```bash
# Create all tables
npx prisma migrate dev --name init

# Regenerate the type-safe Prisma client
npx prisma generate --config prisma.config.mjs
```

### Seed with sample data

Loads 9 categories, 2 suppliers, 10 kitchen utensil products with EAN-13 barcodes, 5 customers, 6 received purchase orders, and 20 sales orders spanning February–May 2026.

```bash
npm run seed
```

### Start the development server

```bash
npm run dev
```

Server starts at `http://localhost:3000` with hot reload. Verify with:

```bash
curl http://localhost:3000/health
# {"status":"ok","timestamp":"...","environment":"development"}
```

### Production

```bash
npm run build   # compiles src/ → dist/
npm start       # runs dist/server.js
```

---

## Environment Variables

| Variable | Required | Example | Description |
|----------|----------|---------|-------------|
| `DATABASE_URL` | Yes | `postgresql://user:pass@localhost:5432/inventory_db` | PostgreSQL connection string |
| `JWT_SECRET` | Yes | `a-long-random-string-min-32-chars` | Signs access and refresh tokens. Must be kept secret. |
| `JWT_EXPIRES_IN` | No | `15m` | Access token lifetime. Default: `15m` |
| `JWT_REFRESH_EXPIRES_IN` | No | `7d` | Refresh token lifetime. Default: `7d` |
| `PORT` | No | `3000` | HTTP server port. Default: `3000` |
| `NODE_ENV` | No | `development` | Set to `production` to suppress debug output |

For integration tests, create `.env.test` pointing to a separate database:

```env
DATABASE_URL=postgresql://user:pass@localhost:5432/inventory_db_test
JWT_SECRET=test-secret-not-for-production
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d
PORT=3001
NODE_ENV=test
```

---

## API Reference

All routes are prefixed with `/api`. Authenticated routes require `Authorization: Bearer <token>` in the request header. Role abbreviations: **A** = admin, **M** = manager, **C** = cashier, **W** = warehouse, **V** = viewer.

### Authentication

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/api/auth/register` | — | Create a new user account |
| `POST` | `/api/auth/login` | — | Returns access token; sets httpOnly refresh cookie |
| `POST` | `/api/auth/refresh` | Cookie | Issues a new access token using the refresh cookie |
| `POST` | `/api/auth/logout` | Bearer | Clears the refresh cookie |
| `GET` | `/api/auth/me` | Bearer | Returns the authenticated user's profile |

### Categories

| Method | Path | Roles | Description |
|--------|------|-------|-------------|
| `GET` | `/api/categories` | All | List all categories with child counts |
| `GET` | `/api/categories/:id` | All | Single category with parent and children |
| `POST` | `/api/categories` | A, M | Create a category (set `parentId` for a subcategory) |
| `PUT` | `/api/categories/:id` | A, M | Update name, description, or parent |
| `DELETE` | `/api/categories/:id` | A, M | Soft-delete (blocked if category has active products) |

### Suppliers

| Method | Path | Roles | Description |
|--------|------|-------|-------------|
| `GET` | `/api/suppliers` | All | List all suppliers with product count |
| `GET` | `/api/suppliers/:id` | All | Supplier detail with purchase order history |
| `POST` | `/api/suppliers` | A, M | Create a supplier |
| `PUT` | `/api/suppliers/:id` | A, M | Update supplier details or credit limit |
| `DELETE` | `/api/suppliers/:id` | A, M | Soft-delete (blocked if supplier has active products) |

### Products

| Method | Path | Roles | Description |
|--------|------|-------|-------------|
| `GET` | `/api/products` | All | Paginated list; supports search by name/SKU/barcode |
| `GET` | `/api/products/barcode/:code` | All | Look up a product by EAN-13 barcode (POS scanner) |
| `GET` | `/api/products/:id` | All | Product detail with current price and full price history |
| `POST` | `/api/products` | A, M | Create a product with initial cost, retail, and wholesale prices |
| `PUT` | `/api/products/:id` | A, M | Update product fields (non-price) |
| `PUT` | `/api/products/:id/price` | A, M | Set new prices — inserts a `product_price_history` row |
| `DELETE` | `/api/products/:id` | A, M | Soft-delete |

### Inventory

| Method | Path | Roles | Description |
|--------|------|-------|-------------|
| `GET` | `/api/inventory` | All | Current stock level for every product |
| `GET` | `/api/inventory/low-stock` | All | Products at or below their reorder point |
| `GET` | `/api/inventory/valuation` | All | Total stock value grouped by category |
| `GET` | `/api/inventory/:productId/movements` | All | Full movement history with running total |
| `POST` | `/api/inventory/adjust` | A, M, W | Manual adjustment (requires type and reason notes) |

### Purchase Orders

| Method | Path | Roles | Description |
|--------|------|-------|-------------|
| `GET` | `/api/purchases` | All | List POs; filter by status (`draft`, `approved`, `received`, `cancelled`) |
| `GET` | `/api/purchases/:id` | All | PO detail with line items and receiving history |
| `POST` | `/api/purchases` | A, M | Create a draft PO with one or more line items |
| `PUT` | `/api/purchases/:id` | A, M | Edit a draft PO before it is approved |
| `POST` | `/api/purchases/:id/approve` | A, M | Advance status from `draft` → `approved` |
| `POST` | `/api/purchases/:id/receive` | A, M, W | Record goods received; creates stock movements |
| `POST` | `/api/purchases/:id/cancel` | A, M | Cancel a draft or approved PO |

### Customers

| Method | Path | Roles | Description |
|--------|------|-------|-------------|
| `GET` | `/api/customers` | All | List customers; filter by type (`retail` / `wholesale`) |
| `GET` | `/api/customers/:id` | All | Customer detail with order history |
| `POST` | `/api/customers` | A, M, C | Create a retail or wholesale customer |
| `PUT` | `/api/customers/:id` | A, M, C | Update customer details or credit limit |
| `DELETE` | `/api/customers/:id` | A, M | Soft-delete |

### Sales

| Method | Path | Roles | Description |
|--------|------|-------|-------------|
| `GET` | `/api/sales` | All | List sales orders with optional date and type filters |
| `GET` | `/api/sales/daily-summary` | All | Today's order count, units sold, and revenue |
| `GET` | `/api/sales/:id` | All | Sale detail with line items and price snapshots |
| `POST` | `/api/sales` | A, M, C | Create a sale; prices are snapshotted and stock deducted atomically |

### Reports

| Method | Path | Roles | Description |
|--------|------|-------|-------------|
| `GET` | `/api/reports/dashboard` | A, M | KPIs: revenue, stock value, low-stock count, pending POs |
| `GET` | `/api/reports/profit-loss` | A, M | P&L for a given date range with cost and margin breakdown |
| `GET` | `/api/reports/top-products` | A, M | Best sellers ranked by revenue |
| `GET` | `/api/reports/slow-moving` | A, M | Products with the lowest sales velocity |

---

## Database Schema

Eleven tables across three functional areas.

```
Users & Access Control
  users                — accounts, roles, soft delete
  audit_logs           — immutable log of every write; linked to users

Catalog
  categories           — self-referencing tree (parentId → id)
  suppliers            — supplier details and credit limits
  products             — SKU, barcode, reorder point
  product_price_history — append-only; cost/retail/wholesale per change

Transactions
  stock_movements      — append-only ledger; source of truth for stock
  purchase_orders      — draft → approved → received → cancelled
  purchase_order_items — line items with ordered vs received quantities
  customers            — retail and wholesale accounts
  sales_orders         — POS transactions with price snapshots
  sales_order_items    — line items with price locked at sale time
```

### Key relationships

```
Category (tree)
  └── Product (many)
        ├── ProductPriceHistory (append-only, many)
        ├── StockMovement (append-only, many)
        ├── PurchaseOrderItem (many)
        └── SalesOrderItem (many)

Supplier
  ├── Product (many)
  └── PurchaseOrder (many)
        └── PurchaseOrderItem (many)

Customer
  └── SalesOrder (many)
        └── SalesOrderItem (many)

User
  ├── AuditLog (many)
  ├── ProductPriceHistory.changedBy (many)
  ├── StockMovement.performedBy (many)
  ├── PurchaseOrder.createdBy / approvedBy
  └── SalesOrder.createdBy
```

### Money storage

All monetary values are stored as `Decimal(12,2)` in PostgreSQL — never `Float` or `Integer`. This avoids the floating-point precision errors that occur with `Float` (`0.1 + 0.2 = 0.30000000000000004`) and the cent-conversion complexity that comes with storing money as integers.

---

## Testing

Integration tests run against a dedicated `inventory_db_test` database. The development database is never touched by the test suite.

```bash
npm test
```

On first run the global setup script creates `inventory_db_test` and deploys all Prisma migrations automatically. Subsequent runs skip this step if the database already exists and migrations are current.

Each test suite is fully isolated — `cleanDb()` is called in `beforeAll` and `afterAll` to reset state. Suites run sequentially (`--runInBand`) so there are no race conditions between tests sharing the same database.

| Suite | Tests | Coverage |
|-------|-------|----------|
| `auth.test.ts` | 7 | Register 201/409/400, login 200/401, protected route 200/401 |
| `products.test.ts` | 4 | Create product, retail price < cost rejected, barcode lookup, 404 |
| `inventory.test.ts` | 3 | Manual adjust_in, stock guard rejects oversell, notes validation |
| `purchases.test.ts` | 1 | Full PO lifecycle: draft → approved → received → stock verified |
| `sales.test.ts` | 3 | Retail price snapshot, wholesale price snapshot, stock guard 400 |
| **Total** | **18** | |

### Test infrastructure

```
jest.config.ts          — ts-jest preset, globalSetup, setupFiles, 30s timeout
jest.global-setup.js    — creates inventory_db_test, deploys migrations (plain CJS)
jest.env.js             — loads .env.test before any test module imports
tsconfig.test.json      — extends tsconfig; adds rootDir:".", ignoreDeprecations:"6.0"
__tests__/helpers/setup.ts — exports app, db, cleanDb(), registerAdmin()
.env.test               — DATABASE_URL pointing to inventory_db_test
```

The `ignoreDeprecations: "6.0"` flag in `tsconfig.test.json` suppresses TypeScript 6's deprecation warning for `moduleResolution: node10`, which is implied by `module: commonjs`. This is a known issue with ts-jest 29 and TypeScript 6 and does not affect runtime behaviour.

---

## Project Structure

```
inventory_system/
├── src/
│   ├── app.ts                    # Express setup: helmet, rate limiting, routes
│   ├── server.ts                 # HTTP server entry point
│   ├── config/
│   │   └── database.ts           # Prisma singleton with PrismaPg adapter
│   ├── middleware/
│   │   ├── authenticate.ts       # Verifies JWT; attaches req.user
│   │   ├── authorize.ts          # Role guard; accepts allowed UserRole[]
│   │   ├── errorHandler.ts       # 4-param global handler; must be last
│   │   └── validate.ts           # Zod middleware; validates body/params/query
│   ├── modules/
│   │   ├── auth/
│   │   ├── categories/
│   │   ├── customers/
│   │   ├── inventory/
│   │   ├── products/
│   │   ├── purchases/
│   │   ├── reports/
│   │   ├── sales/
│   │   └── suppliers/
│   │       Each module follows:
│   │         schema.ts     — Zod validation schemas
│   │         service.ts    — business logic and database calls
│   │         controller.ts — thin HTTP handlers, calls service
│   │         routes.ts     — Express router with middleware chain
│   ├── types/
│   │   └── express.d.ts          # Extends Request with user?: { userId, role }
│   └── utils/
│       ├── errors.ts             # AppError hierarchy
│       └── request.ts            # getIp(req), getParam(req, key)
├── prisma/
│   ├── schema.prisma             # All table and enum definitions
│   ├── prisma.config.mjs         # Prisma 7 datasource config
│   ├── seed.ts                   # Seed data for development
│   └── migrations/               # Applied migration history
├── src/generated/prisma/         # Generated Prisma client (do not edit)
├── __tests__/
│   ├── helpers/setup.ts
│   ├── auth.test.ts
│   ├── products.test.ts
│   ├── inventory.test.ts
│   ├── purchases.test.ts
│   └── sales.test.ts
├── SPECS/                        # Extended documentation
│   ├── PROJECT_SPEC.md
│   ├── DATABASE_SPEC.md
│   ├── API_SPEC.md
│   └── ARCHITECTURE_SPEC.md
├── jest.config.ts
├── jest.global-setup.js
├── jest.env.js
├── tsconfig.json
├── tsconfig.test.json
└── .env.test
```

---

## Roadmap

- [ ] React frontend — Vite + TanStack Query + React Router
- [ ] Deployment — Railway (API) + Vercel (frontend)
- [ ] Barcode label generation and thermal printer support
- [ ] Multi-warehouse stock tracking
- [ ] WebSocket real-time stock alerts

---

## License

ISC
