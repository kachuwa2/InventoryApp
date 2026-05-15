# Inventory Management System

## Purpose
This repository is a wholesale and retail kitchen utensils inventory system
built with Node.js, TypeScript, PostgreSQL, Prisma 7, Zod v4, and Express v5.

Use this file as the operating contract for Claude Code: optimize for
correctness, minimal token usage, and local changes that preserve the
existing architecture.

---

## How To Work In This Repo
1. Start with the smallest relevant file, symbol, or failing command.
2. Form one local hypothesis before editing.
3. Make the smallest change that fixes the issue.
4. Validate immediately after the first substantive edit.
5. Prefer existing patterns over inventing new abstractions.

---

## Token Efficiency Rules
- Read only the files needed to solve the current task.
- Prefer targeted search over broad repo exploration.
- Do not re-read large files unless the change depends on them.
- Batch related read-only lookups together.
- Avoid long explanations, repeated summaries, and speculative refactors.
- If the task is unclear, resolve the nearest concrete code path
  instead of mapping the whole codebase.

---

## Tech Stack Versions
- Node.js:       18+
- TypeScript:    6.x
- Express:       5.x
- Prisma:        7.x  (PrismaPg adapter — no direct engine)
- Zod:           4.x
- bcryptjs:      3.x
- jsonwebtoken:  9.x
- cookie-parser: 1.x

---

## Commands
```bash
npm run dev                                     # start dev server (nodemon, port 3000)
npm run build                                   # compile TypeScript to dist/
npm start                                       # run compiled production build
npm test                                        # run all integration tests
npm run seed                                    # seed realistic kitchen utensil data

npx prisma migrate dev --name description       # create and apply a migration
npx prisma generate --config prisma.config.mjs  # regenerate Prisma client
npx prisma studio --config prisma.config.mjs    # open database browser
npx prisma migrate reset                        # wipe and reapply all (dev only)

claude mcp list                                 # verify MCP servers are connected
```

---

## Project Structure
src/
├── config/
│   └── database.ts          — Prisma singleton with PrismaPg adapter
├── middleware/
│   ├── authenticate.ts      — JWT verification, attaches req.user
│   ├── authorize.ts         — role guard, takes UserRole[] of allowed roles
│   ├── errorHandler.ts      — 4-param global error handler, must be LAST
│   └── validate.ts          — Zod middleware, validates body/params/query
├── modules/
│   ├── auth/                — register, login, /me, refresh, logout
│   ├── products/            — catalog, barcode lookup, price history
│   ├── inventory/           — stock ledger, adjustments, valuation
│   ├── purchases/           — PO lifecycle: draft → approved → received
│   ├── sales/               — POS checkout, retail/wholesale pricing
│   ├── customers/           — customer CRUD + order history
│   ├── suppliers/           — supplier CRUD + PO history
│   ├── categories/          — self-referencing tree (parentId → id)
│   └── reports/             — dashboard, P&L, top products, slow-moving
├── types/
│   └── express.d.ts         — extends Request with user?: { userId, role }
└── utils/
├── errors.ts            — AppError, UnauthorizedError, NotFoundError etc.
└── request.ts           — getIp(req), getParam(req, key)
prisma/
├── schema.prisma            — all table definitions and enums
├── prisma.config.mjs        — Prisma 7 datasource config (defineConfig)
└── migrations/              — migration history (never edit manually)
src/generated/prisma/        — generated Prisma client (never edit manually)

---

## Environment Variables
```env
DATABASE_URL=postgresql://user:pass@localhost:5432/inventory_db
JWT_SECRET=long-random-string-never-commit-this
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d
PORT=3000
NODE_ENV=development
```

For integration tests:
```env
NODE_ENV=test
DATABASE_URL=postgresql://user:pass@localhost:5432/inventory_db_test
```

---

## Architecture Rules
- Framework:      Express v5 + TypeScript
- Database:       PostgreSQL via Prisma 7 PrismaPg adapter
- Validation:     Zod v4 with centralized middleware
- Auth:           JWT access token (15m) + httpOnly refresh cookie (7d)
- Security:       bcrypt cost factor 12
- Module pattern: schema.ts → service.ts → controller.ts → routes.ts

---

## API Base Path
All routes are prefixed with `/api`:

| Prefix           | Auth required | Roles                         |
|------------------|---------------|-------------------------------|
| /api/auth        | mixed         | public for login/register     |
| /api/categories  | yes           | all roles                     |
| /api/suppliers   | yes           | all roles (write: admin/mgr)  |
| /api/products    | yes           | all roles (write: admin/mgr)  |
| /api/inventory   | yes           | all roles (adjust: warehouse+)|
| /api/purchases   | yes           | all roles (write: admin/mgr)  |
| /api/customers   | yes           | all roles (write: cashier+)   |
| /api/sales       | yes           | all roles (create: cashier+)  |
| /api/reports     | yes           | admin and manager only        |

---

## Role Hierarchy
admin     — full access including user management and audit logs
manager   — approve POs, set prices, view all reports
cashier   — create sales, barcode lookup, manage customers
warehouse — receive stock (GRN), manual stock adjustments
viewer    — read-only access to catalog and reports

---

## Must Follow Rules

### Prisma
- Import PrismaClient ONLY from `../generated/prisma`
  never from `@prisma/client`
- In transactions use relation connects:
  `createdBy: { connect: { id } }`
  do NOT set foreign key scalars directly
- Always run `npx prisma generate --config prisma.config.mjs`
  after schema changes
- Config file is `prisma.config.mjs` — NOT `.ts` or `.js`
- datasource block in schema.prisma has NO `url` line
- generator output must be `"../src/generated/prisma"`
- PrismaClient constructor requires:
  `{ adapter: new PrismaPg({ connectionString }) }`
- Call `config()` from dotenv BEFORE PrismaPg reads DATABASE_URL

### Zod v4
- Use `z.email()`    — NOT `z.string().email()` (deprecated)
- Use `z.uuid()`     — NOT `z.string().uuid()`  (deprecated)
- Use `z.url()`      — NOT `z.string().url()`   (deprecated)
- Use `err.issues`   — NOT `err.errors` (renamed in v4)
- Use `z.ZodType`    — NOT `AnyZodObject` or `ZodSchema`
- Use `error:`       — NOT `required_error:` or `invalid_type_error:`

### Express v5
- Use `getParam(req, 'id')` from utils/request.ts
  NOT `req.params.id` directly
- Use `getIp(req)` from utils/request.ts
  NOT `req.ip` directly
- Error handler must have 4 params `(err, req, res, next)`
  and be LAST registered in app.ts
- Controller functions must return `Promise<void>`
  and call `next(error)` in catch blocks

### General
- Keep `validate()` middleware BEFORE controllers in every route
- Use `select` and `include` intentionally
  to avoid leaking sensitive fields
- Never return `passwordHash`, refresh tokens,
  or internal audit details in any response

---

## Database Rules
- Stock is NEVER stored directly
  always compute from `stock_movements`
- Prices are APPEND-ONLY
  create a new `product_price_history` row, never update existing
- ALL deletes are soft deletes
  set `deletedAt = new Date()`, never hard delete
- Money uses `Decimal(12,2)`
  never `Float` or `Int` for currency
- Every write runs inside `db.$transaction()`
- Every write transaction creates an audit log entry
  IN THE SAME transaction
- All queries exclude soft-deleted records with
  `where: { deletedAt: null }` unless explicitly required

### Integration Tests
- Use a separate test database: `inventory_db_test`
- Each test suite must clean up its own data after running
- Never run tests against the development `inventory_db`

---

## Stock And Price Behavior

Current stock is always computed — never stored:
currentStock = SUM(inbound quantities) - SUM(outbound quantities)

Inbound types:  `purchase`, `adjustment_in`, `return_in`
Outbound types: `sale`, `adjustment_out`, `return_out`

Price history is immutable append-only rows:
- List views:   latest price only
  `orderBy: { effectiveFrom: 'desc' }, take: 1`
- Detail views: full timeline with `changedBy` and `effectiveFrom`
- New price:    always INSERT — never UPDATE an existing row

---

## Security Rules
- Always run `bcrypt.compare` even if the user does not exist
  (timing attack prevention)
- Never return `passwordHash` or secret fields
  use explicit `select`
- Enforce roles through `authorize(['role1','role2'])` middleware
- Capture IP addresses through `getIp(req)` in every audit log entry
- Refresh token lives in `httpOnly` cookie — never in response body

---

## Preferred Implementation Pattern

### New route
1. Add validation schema in `schema.ts`
2. Add business logic in `service.ts`
3. Keep `controller.ts` thin — HTTP only, calls service, sends response
4. Wire middleware chain in `routes.ts`

### Write operation
1. Wrap in `db.$transaction(async (tx) => { ... })`
2. Write audit log inside the same transaction
3. Return only safe fields with `select`
4. Keep all side effects inside the service layer

### Search and filtering
- Use `OR` for multi-field search (name, SKU, barcode)
- Use `{ contains: value, mode: 'insensitive' }` for
  case-insensitive matching
- Use conditional spreads for optional filters:
  `...(value && { field: value })`

---

## Error Handling
1. Zod validation fails → field-level details from `err.issues` with 400
2. Known `AppError` subclasses → their `statusCode` and `code`
3. Prisma unique constraint `P2002` → `409 CONFLICT`
4. Unknown errors → generic `500` without leaking internals

---

## What Has Been Built
All 9 backend modules are complete and covered by integration tests:
✅ Auth            — register, login, JWT, RBAC, audit logs
✅ Categories      — hierarchical tree with parent/child structure
✅ Suppliers       — CRUD with product count and soft delete protection
✅ Products        — catalog, barcode lookup, price history (append-only)
✅ Inventory       — stock ledger, adjustments, valuation by category
✅ Purchases       — PO workflow: draft → approved → received (GRN)
✅ Sales           — POS checkout with retail/wholesale pricing
✅ Reports         — dashboard KPIs, P&L, top products, slow-moving
✅ Customers       — customer CRUD (retail + wholesale) with order history
✅ Integration tests — 18 tests across 5 suites (Jest 30 + ts-jest + Supertest)
✅ Seed data        — prisma/seed.ts with realistic kitchen utensil data
✅ Security hardening — helmet (12 headers) + express-rate-limit (login: 5/15min, general: 100/min)

---

## Testing Infrastructure
- `jest.config.ts`        — preset ts-jest, globalSetup, setupFiles, forceExit
- `jest.global-setup.js`  — plain CommonJS; creates `inventory_db_test`, deploys migrations
- `jest.env.js`           — loaded by setupFiles; calls dotenv with `.env.test`, override:true
- `tsconfig.test.json`    — extends tsconfig, adds `rootDir:"."`, `isolatedModules:true`,
                            `ignoreDeprecations:"6.0"` (TypeScript 6 moduleResolution fix)
- `__tests__/helpers/setup.ts` — exports `app`, `db`, `cleanDb()`, `registerAdmin()`
- `.env.test`             — points DATABASE_URL to `inventory_db_test`

Run: `npm test` (plain jest --runInBand; .env.test loaded automatically)

Test suites: auth(7), products(4), inventory(3), purchases(1 lifecycle), sales(3)

Key rule: NEVER run tests against `inventory_db` — always `inventory_db_test`.

---

## What Still Needs Building
⬜ README.md           — portfolio-quality documentation
⬜ React frontend      — Vite + TanStack Query + React Router
⬜ Deployment          — Railway (API) + Vercel (frontend)

---

## Common Mistakes Claude Must Never Make
1.  Forgetting `dotenv config()` before `database.ts` imports PrismaPg
2.  Using scalar FKs instead of connect syntax in transactions
3.  Reading `req.params.id` directly — use `getParam(req, 'id')`
4.  Reading `req.ip` directly — use `getIp(req)`
5.  Importing from `@prisma/client` — use `../generated/prisma`
6.  Using `z.string().email()` — use `z.email()` in Zod v4
7.  Using `err.errors` — use `err.issues` in Zod v4
8.  Registering error handler BEFORE routes in `app.ts`
9.  Registering `/:id` BEFORE `/barcode/:code` in products router
10. Declaring empty arrays without explicit TypeScript types
11. Running `prisma generate` without `--config prisma.config.mjs`
12. Using `Float` or `Int` for money — always `Decimal(12,2)`
13. Hard deleting any record — always soft delete with `deletedAt`
14. Updating a price in place — always insert new `product_price_history`
15. Writing stock directly — always insert a `stock_movements` row

---

## MCP Servers Connected
- `postgres`  — queries `inventory_db` for schema inspection and data work
- `context7`  — pulls live docs for Prisma 7, Zod v4, Express v5

When using postgres MCP: prefer read operations unless asked to mutate.
When using context7: prefix prompts with `use context7` to fetch docs.

---

## Do Nots
- Do not hard delete records
- Do not update prices in place
- Do not store stock as a persisted number
- Do not use `req.params.id` or `req.ip` directly
- Do not import Prisma from `@prisma/client`
- Do not use `z.string().email()` or `z.string().uuid()`
- Do not leak `passwordHash`, refresh tokens, or audit internals
- Do not skip transactions for any related writes
- Do not ignore `deletedAt` in queries unless explicitly required
- Do not introduce new dependencies unless they solve the current task
- Do not rewrite unrelated files while making a focused change
- Do not optimize for novelty over readability
- Do not run tests against the development database