# Inventory Management System - Specification Documentation

Welcome to the Inventory Management System specification documentation. This system is a comprehensive wholesale and retail kitchen utensils inventory management platform.

## Documentation Structure

### 📋 [PROJECT_SPEC.md](PROJECT_SPEC.md)
High-level project overview including:
- Project goals and scope
- Technology stack and dependencies
- Development environment setup
- Build and deployment commands
- Project structure overview

### 💾 [DATABASE_SPEC.md](DATABASE_SPEC.md)
Complete database schema documentation:
- All database models and their relationships
- Data types and constraints
- Soft delete and audit strategies
- Ledger-based computation patterns (stock, prices)
- Migration overview

### 🔌 [API_SPEC.md](API_SPEC.md)
Complete REST API reference:
- All 9 modules and 35+ endpoints
- Request/response formats
- Authentication and authorization requirements
- Error codes and handling
- Query parameters and filters
- Practical examples for critical workflows

### 🏗️ [ARCHITECTURE_SPEC.md](ARCHITECTURE_SPEC.md)
System architecture and design patterns:
- Modular architecture (schema → service → controller → routes)
- Authentication and JWT token management
- Authorization and role-based access control
- Error handling strategy
- Validation approach
- Key business logic patterns
- Performance considerations

## Quick Start

### Setup
```bash
npm install
npx prisma migrate dev --name init
npm run dev
```

### Key Commands
- `npm run dev` — Start development server with hot reload (port 3000)
- `npm run build` — Compile TypeScript to dist/
- `npm start` — Run production build
- `npm test` — Run 18 integration tests against `inventory_db_test`
- `npm run seed` — Seed realistic kitchen utensil data into `inventory_db`
- `npx prisma studio --config prisma.config.mjs` — Open database browser
- `npx prisma migrate dev --name description` — Create and apply migration

## System Overview

**Inventory Management System** is built for wholesale and retail kitchen utensil operations:

- **9 Modules**: auth, categories, suppliers, products, inventory, purchases, customers, sales, reports
- **35+ API Endpoints** with granular role-based access control
- **5 User Roles**: admin, manager, cashier, warehouse, viewer
- **Immutable Ledgers**: Stock movements and price history for complete audit trail
- **TypeScript + Express v5** with Prisma 7 ORM and PostgreSQL
- **Decimal-based Money** - All financial values stored as Decimal(12,2) for precision

## Technology Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| **Runtime** | Node.js | Latest |
| **Language** | TypeScript | 6.0.3 |
| **Framework** | Express | 5.2.1 |
| **Database** | PostgreSQL | Latest |
| **ORM** | Prisma | 7.8.0 |
| **Validation** | Zod | 4.4.2 |
| **Authentication** | JWT + bcrypt | 9.0.3, 3.0.3 |

## Key Design Principles

1. **Append-Only Ledgers**: Stock and price history are immutable—enables perfect audit trails
2. **Computed Stock**: Stock is NEVER stored—always derived from stock movements
3. **Price Snapshots**: Historical prices stored at sale time for accurate P&L reporting
4. **Soft Deletes**: Records marked with deletedAt instead of hard deletion—recoverable
5. **Transaction Safety**: All writes wrapped in `db.$transaction()` for ACID compliance
6. **Audit Everything**: Every significant action logged with before/after states
7. **Role Hierarchy**: 5-tier access control from viewer to admin with granular permissions
8. **Separation of Concerns**: Each module follows schema → service → controller → routes pattern

## Project Maturity

✅ **Phase 1**: Core infrastructure (auth, database, migrations)
✅ **Phase 2**: Product catalog (categories, suppliers, products, prices)
✅ **Phase 3**: Stock management (inventory, stock movements)
✅ **Phase 4**: Purchase workflows (purchase orders, receiving)
✅ **Phase 5**: Sales processing (customers, sales orders, POS)
✅ **Phase 6**: Reporting (KPIs, P&L, product analytics)
✅ **Phase 7**: Integration tests (18 tests, 5 suites — Jest 30 + ts-jest + Supertest)
✅ **Phase 8**: Seed data (prisma/seed.ts — 10 products, 6 POs, 20 sales, 5 customers)
✅ **Phase 9**: Security hardening (helmet + express-rate-limit)

## For More Information

- See [PROJECT_SPEC.md](PROJECT_SPEC.md) for goals and setup
- See [DATABASE_SPEC.md](DATABASE_SPEC.md) for schema details
- See [API_SPEC.md](API_SPEC.md) for endpoint documentation
- See [ARCHITECTURE_SPEC.md](ARCHITECTURE_SPEC.md) for design patterns and implementation details
