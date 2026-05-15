# Project Specification

## Project Overview

**Inventory Management System** is a comprehensive wholesale and retail kitchen utensils inventory management platform. It provides complete order management, stock tracking, customer management, and business analytics capabilities.

### Goals & Scope

#### Primary Goals
1. **Unified Inventory Management**: Single source of truth for all stock across wholesale and retail operations
2. **Purchase Order Management**: Complete workflow from ordering to receiving with supplier management
3. **Point-of-Sale Integration**: Seamless retail and wholesale sales processing with customer tracking
4. **Business Analytics**: Real-time KPIs, profit/loss reporting, and product performance analysis
5. **Audit Compliance**: Complete immutable audit trail for all transactions and financial records

#### Scope (Current Phase)
- User authentication and role-based access control
- Product catalog management (categories, suppliers, products)
- Stock level tracking with low-stock alerts
- Purchase order workflows (draft → approved → received)
- Sales order processing (retail and wholesale)
- Customer management (retail and wholesale)
- Financial reporting (P&L, daily summaries)
- Comprehensive audit logging

#### Out of Scope (Future Phases)
- Barcode generation and thermal printing
- Integration with external accounting software
- Mobile app
- Multi-warehouse support
- Advanced forecasting and demand planning

## Technology Stack

### Runtime & Language
- **Node.js**: Runtime environment
- **TypeScript 6.0.3**: Type-safe JavaScript
- **Express 5.2.1**: HTTP framework

### Database & ORM
- **PostgreSQL**: Primary data store
- **Prisma 7.8.0**: ORM with adapter pattern for PostgreSQL
- **PrismaClient**: Generated from schema, output to `src/generated/prisma/`

### Validation & Security
- **Zod 4.4.2**: Schema validation (TypeScript-first)
- **bcryptjs 3.0.3**: Password hashing
- **jsonwebtoken 9.0.3**: JWT token generation and verification

### Development Tools
- **TypeScript 6.0.3**: Type checking
- **ts-node 10.9.2**: TypeScript execution
- **nodemon 3.1.14**: Auto-reload on file changes
- **dotenv 17.4.2**: Environment variable loading
- **dotenv-cli 11.0.0**: CLI for .env management

## Project Structure

```
inventory_system/
├── src/
│   ├── app.ts                    # Express app setup and route mounting
│   ├── server.ts                 # Server entry point (port 3000)
│   ├── config/
│   │   └── database.ts           # Prisma client initialization
│   ├── middleware/
│   │   ├── authenticate.ts       # JWT verification
│   │   ├── authorize.ts          # Role-based access control
│   │   ├── validate.ts           # Zod schema validation
│   │   └── errorHandler.ts       # Error handling & response formatting
│   ├── modules/                  # Feature modules (9 total)
│   │   ├── auth/
│   │   ├── categories/
│   │   ├── suppliers/
│   │   ├── products/
│   │   ├── inventory/
│   │   ├── purchases/
│   │   ├── customers/
│   │   ├── sales/
│   │   └── reports/
│   ├── services/                 # Shared services (future)
│   ├── types/
│   │   └── express.d.ts          # Express type extensions
│   └── utils/
│       ├── errors.ts             # Custom error classes
│       └── request.ts            # Request helper utilities
├── prisma/
│   ├── schema.prisma             # Database schema
│   └── migrations/               # Migration history (6 migrations)
├── dist/                         # Compiled output (after npm run build)
├── SPECS/                        # Documentation (this folder)
├── package.json                  # Dependencies
├── prisma.config.mjs             # Prisma configuration
├── tsconfig.json                 # TypeScript configuration
└── .env                          # Environment variables (not in git)
```

### Module Structure

Each feature module (`auth`, `categories`, etc.) follows a consistent 4-file pattern:

```
module/
├── module.schema.ts       # Zod validation schemas
├── module.service.ts      # Business logic & database operations
├── module.controller.ts   # HTTP request handlers
└── module.routes.ts       # Express route definitions
```

This separation ensures:
- **Testability**: Services can be tested independently of HTTP layer
- **Reusability**: Services can be called from controllers or other services
- **Maintainability**: Clear separation between concerns
- **Type Safety**: Schemas define both validation and TypeScript types

## Environment Setup

### Prerequisites
- Node.js 18+ (LTS recommended)
- PostgreSQL 12+ with a database named `inventory_db`
- npm 8+

### Installation & Configuration

1. **Clone and install dependencies**
   ```bash
   npm install
   ```

2. **Create .env file**
   ```bash
   DATABASE_URL="postgresql://user:password@localhost:5432/inventory_db"
   NODE_ENV=development
   PORT=3000
   JWT_SECRET="your-super-secret-key-min-32-chars"
   JWT_EXPIRES_IN=15m
   JWT_REFRESH_EXPIRES_IN=7d
   ```

3. **Initialize database**
   ```bash
   npx prisma migrate dev --name init
   ```

4. **Start development server**
   ```bash
   npm run dev
   ```

Server runs on `http://localhost:3000`. Use `/health` endpoint to verify:
```bash
curl http://localhost:3000/health
```

### Database Browser
Interactive database explorer:
```bash
npx prisma studio --config prisma.config.mjs
```

Opens at http://localhost:5555

## Build & Deployment

### Development
```bash
npm run dev
# Server starts with nodemon, auto-reloads on file changes
# Port: 3000
# Watch: src/ directory (.ts files)
```

### Production Build
```bash
npm run build
# Compiles src/ → dist/
# Optimized TypeScript output
```

### Production Run
```bash
npm start
# Runs dist/server.js (requires prior build)
# No source files needed in production
```

### Database Migrations

**Create new migration**
```bash
npx prisma migrate dev --name description_of_changes
# Creates migration file + applies it
```

**Reset database** (dev only)
```bash
npx prisma migrate reset
# ⚠️ Drops all data, reapplies all migrations
```

**Generate Prisma Client** (if schema changed)
```bash
npx prisma generate --config prisma.config.mjs
# Regenerates TypeScript types in src/generated/prisma/
```

## Module Overview

### 1. Auth Module
Handles user authentication and JWT token management.
- User registration (with role assignment)
- Login with access + refresh tokens
- Token refresh mechanism
- Logout with cookie clearing
- User profile retrieval

### 2. Categories Module
Manages product categories with hierarchical structure.
- Hierarchical categories (e.g., Food → Grains → Rice)
- Self-referencing parent-child relationships
- CRUD operations with soft deletes

### 3. Suppliers Module
Manages supplier relationships and credit limits.
- Supplier contact and credit information
- Credit limit tracking
- Product-supplier associations
- CRUD with soft deletes

### 4. Products Module
Core product catalog management.
- SKU (Stock Keeping Unit) unique identifier
- Barcode integration
- Multi-tiered pricing (cost, retail, wholesale)
- Reorder point alerts
- Price history tracking
- CRUD with soft deletes

### 5. Inventory Module
Real-time stock level tracking.
- Current stock computed from movements (not stored)
- Low-stock alerts
- Inventory valuation
- Stock movement history/ledger
- Manual adjustments with notes

### 6. Purchases Module
Purchase order lifecycle management.
- Status workflow: draft → approved → received → cancelled
- Partial receiving support
- Supplier and cost tracking
- Stock movement integration

### 7. Customers Module
Customer relationship management.
- Retail vs wholesale customer types
- Credit limit tracking
- CRUD with soft deletes

### 8. Sales Module
Point-of-sale sales order processing.
- Retail and wholesale sales
- Customer-optional walk-in support
- Line item discounts
- Order-level discounts
- Stock movement integration

### 9. Reports Module
Business analytics and KPIs.
- Dashboard (revenue, stock metrics)
- Profit/loss reporting
- Top products analysis
- Slow-moving inventory identification

## Development Workflow

### Adding a New Feature

1. **Define schema** (Zod validation + TypeScript types)
2. **Implement service** (business logic + database calls)
3. **Create controller** (HTTP handlers calling service)
4. **Add routes** (Express route definitions)
5. **Test manually** via HTTP requests
6. **Update spec** documentation

### Code Standards

- **Naming**: camelCase for variables/functions, PascalCase for classes/types
- **Files**: `module.purpose.ts` (e.g., `auth.controller.ts`)
- **Imports**: Relative paths from src root (e.g., `'../middleware/validate'`)
- **Error Handling**: Always use custom AppError class
- **Database**: Always wrap writes in `db.$transaction()`
- **Validation**: Always validate request data with Zod schema

## Security Considerations

### Authentication
- JWT access tokens (15 min expiry) in Authorization header
- Refresh tokens (7 day expiry) in httpOnly cookies (secure, not JS-accessible)
- Passwords hashed with bcryptjs (12-round salt)

### Authorization
- 5-tier role system (admin > manager > cashier > warehouse > viewer)
- Route-level role checks via `authorize()` middleware
- Resource-level checks in service layer

### Audit Logging
- Every user action logged with before/after states
- User IP address and User-Agent captured
- Immutable audit trail (never updated/deleted)

### Data Integrity
- Soft deletes (deletedAt field) prevent accidental data loss
- Decimal(12,2) for all money (prevents floating-point errors)
- Stock computed from movements (no stored quantities to fall out of sync)
- Prices appended-only (historical accuracy guaranteed)

## Performance Considerations

### Indexing Strategy
- Primary keys (id) auto-indexed
- Foreign keys (userId, productId, etc.) auto-indexed
- Unique fields (email, SKU, barcode) auto-indexed
- Consider additional indexes on frequently-queried fields (status, createdAt)

### Query Optimization
- Use `include()`/`select()` in Prisma to avoid N+1 queries
- Pagination for list endpoints (consider implementing)
- Computed values (stock, inventory valuation) calculated on-demand

### Caching Opportunities (Future)
- Product prices (relatively stable)
- Stock levels (refresh on movement creation)
- Current user profile (Redis session store)

## Deployment Checklist

Before production deployment:
- [ ] Environment variables configured correctly
- [ ] DATABASE_URL pointing to production database
- [ ] JWT_SECRET is cryptographically strong (min 32 chars)
- [ ] NODE_ENV=production
- [ ] All migrations applied (`npx prisma migrate deploy`)
- [ ] Build succeeds (`npm run build`)
- [ ] No console.log() statements in production code
- [ ] Error logging configured for production monitoring
- [ ] Database backups configured
- [ ] Rate limiting implemented (future)
- [ ] HTTPS enforced
- [ ] CORS properly configured for frontend origin

## Support & Maintenance

### Common Issues

**"DATABASE_URL is not defined"**
- Ensure .env file exists in project root
- Verify DATABASE_URL is set correctly

**Prisma client errors**
- Run `npx prisma generate --config prisma.config.mjs` after schema changes
- Check src/generated/prisma/ folder exists

**Port already in use**
- Change PORT in .env (default 3000)
- Or kill process on port: `lsof -i :3000` (macOS/Linux) or `netstat -ano` (Windows)

### Monitoring & Logs

- Development: Errors logged to console
- Production: Implement centralized logging (Sentry, LogRocket, etc.)
- Database: Enable PostgreSQL query logging for slow query analysis

### Regular Maintenance

- Review audit logs monthly
- Archive old sales/purchase orders (consider data retention policy)
- Monitor database size and performance
- Update dependencies quarterly
