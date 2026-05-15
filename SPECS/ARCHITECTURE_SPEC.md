# Architecture Specification

## System Architecture Overview

The Inventory Management System follows a **layered modular architecture** with clear separation of concerns. Each feature is organized as an independent module with schema validation, business logic, HTTP handling, and routing layers.

```
┌────────────────────────────────────────────────────────────────┐
│                        HTTP Client                             │
└────────────────────────────┬─────────────────────────────────┘
                             │
┌────────────────────────────────────────────────────────────────┐
│                      Express Router                            │
│  routes.ts: GET /api/resource, POST /api/resource, etc.       │
└────────────────────────────┬─────────────────────────────────┘
                             │
┌────────────────────────────────────────────────────────────────┐
│                     Middleware Stack                           │
│  1. Body Parser (express.json)                                 │
│  2. Cookie Parser                                              │
│  3. Authenticate (JWT validation)                              │
│  4. Authorize (role checking)                                  │
│  5. Validate (Zod schema validation)                           │
│  6. Error Handler (response formatting)                        │
└────────────────────────────┬─────────────────────────────────┘
                             │
┌────────────────────────────────────────────────────────────────┐
│                    Controller Layer                            │
│  controller.ts: HTTP handlers, call services                   │
│  - Extract request data                                        │
│  - Call service methods                                        │
│  - Format responses                                            │
│  - Pass errors to error handler                                │
└────────────────────────────┬─────────────────────────────────┘
                             │
┌────────────────────────────────────────────────────────────────┐
│                     Service Layer                              │
│  service.ts: Business logic, database calls                    │
│  - Complex validations                                         │
│  - Database transactions                                       │
│  - Audit logging                                               │
│  - Cross-module operations                                     │
└────────────────────────────┬─────────────────────────────────┘
                             │
┌────────────────────────────────────────────────────────────────┐
│                  Schema Validation Layer                       │
│  schema.ts: Zod schemas for all inputs/outputs                │
│  - Type-safe validation                                        │
│  - TypeScript type inference                                   │
│  - Consistent error messages                                   │
└────────────────────────────┬─────────────────────────────────┘
                             │
┌────────────────────────────────────────────────────────────────┐
│              Database Abstraction (Prisma)                     │
│  - PostgreSQL connection pooling                               │
│  - ORM query generation                                        │
│  - Relationship management                                     │
│  - Transaction support                                         │
└────────────────────────────┬─────────────────────────────────┘
                             │
┌────────────────────────────────────────────────────────────────┐
│                    PostgreSQL Database                         │
│  - Users, Audit Logs                                           │
│  - Categories, Suppliers, Products, Prices                     │
│  - Stock Movements (ledger)                                    │
│  - Purchase Orders, Sales Orders                               │
└────────────────────────────────────────────────────────────────┘
```

---

## Module Architecture

### Standard Module Structure

Every feature module follows the **schema → service → controller → routes** pattern:

```
modules/
└── feature-name/
    ├── feature-name.schema.ts      # Input validation & types
    ├── feature-name.service.ts     # Business logic
    ├── feature-name.controller.ts  # HTTP handlers
    └── feature-name.routes.ts      # Route definitions
```

### 1. Schema Layer (`.schema.ts`)

**Responsibility**: Define Zod validation schemas and export TypeScript types

```typescript
// Example: auth.schema.ts
export const registerSchema = z.object({
  name: z.string().min(2),
  email: z.email(),
  password: z.string().min(8),
  role: z.enum(['admin', 'manager', 'cashier', 'warehouse', 'viewer'])
});

export type RegisterInput = z.infer<typeof registerSchema>;
```

**Best Practices**:
- Use `z.email()` NOT `z.string().email()` (Zod v4)
- Use `z.uuid()` NOT `z.string().uuid()` (Zod v4)
- Define both input and output schemas
- Export inferred types for controllers/services
- Group related schemas together

---

### 2. Service Layer (`.service.ts`)

**Responsibility**: All business logic, database queries, and cross-module operations

```typescript
// Example: products.service.ts
export async function createProduct(
  input: CreateProductInput,
  userId: string
): Promise<Product> {
  // Validate business rules
  const category = await db.category.findUnique({ where: { id: input.categoryId } });
  if (!category) throw new NotFoundError('Category not found');

  // Wrap writes in transaction for atomicity
  return db.$transaction(async (tx) => {
    // Create product
    const product = await tx.product.create({
      data: {
        name: input.name,
        sku: input.sku,
        categoryId: input.categoryId,
        supplierId: input.supplierId,
      }
    });

    // Create initial price history entry
    await tx.productPriceHistory.create({
      data: {
        productId: product.id,
        costPrice: input.costPrice,
        retailPrice: input.retailPrice,
        wholesalePrice: input.wholesalePrice,
        createdBy: { connect: { id: userId } },
        effectiveFrom: new Date(),
      }
    });

    // Log audit event
    await tx.auditLog.create({
      data: {
        userId,
        action: 'PRODUCT_CREATED',
        tableName: 'products',
        recordId: product.id,
        afterState: JSON.stringify(product),
        ipAddress: '',
        userAgent: '',
      }
    });

    return product;
  });
}
```

**Key Principles**:
- **No HTTP details**: Services don't know about requests/responses
- **Transaction wrapped**: All writes inside `db.$transaction()`
- **Audit logged**: Record all significant changes
- **Error handling**: Throw custom AppError subclasses
- **Type safe**: Use TypeScript types from schemas
- **Single responsibility**: One service per module
- **Reusable**: Services callable from controllers OR other services

---

### 3. Controller Layer (`.controller.ts`)

**Responsibility**: HTTP request handling, parameter extraction, response formatting

```typescript
// Example: products.controller.ts
export async function create(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    // Request already validated by middleware
    const input = req.body as CreateProductInput;
    const userId = req.user!.id;

    // Call service
    const product = await productService.createProduct(input, userId);

    // Format response
    res.status(201).json({
      success: true,
      data: product
    });
  } catch (error) {
    // Pass to error handler middleware
    next(error);
  }
}
```

**Key Principles**:
- **Minimal logic**: Just HTTP concerns (status codes, response format)
- **Error passthrough**: All errors go to error handler middleware
- **Request extraction**: Get params, query, body from req
- **User context**: Extract userId/role from req.user (set by authenticate middleware)
- **Type safety**: Use inferred types from schemas

---

### 4. Routes Layer (`.routes.ts`)

**Responsibility**: URL routing, middleware chaining, and route composition

```typescript
// Example: products.routes.ts
const router = Router();

// GET all — public read
router.get('/', authenticate, productsController.list);

// GET by barcode — critical POS path, before /:id
router.get('/barcode/:code', authenticate, productsController.getByBarcode);

// GET by id — public read
router.get('/:id', authenticate, productsController.get);

// POST create — admin/manager only
router.post('/', 
  authenticate,
  authorize(['admin', 'manager']),
  validate(createProductSchema),
  productsController.create
);

// PUT update — admin/manager only
router.put('/:id',
  authenticate,
  authorize(['admin', 'manager']),
  validate(updateProductSchema),
  productsController.update
);

// PUT price — admin/manager only
router.put('/:id/price',
  authenticate,
  authorize(['admin', 'manager']),
  validate(updatePriceSchema),
  productsController.updatePrice
);

// DELETE — admin/manager only
router.delete('/:id',
  authenticate,
  authorize(['admin', 'manager']),
  productsController.delete
);

export default router;
```

**Key Principles**:
- **Middleware order matters**: Specific routes before catch-alls (barcode before :id)
- **Role-based middleware**: Use `authorize()` for granular control
- **Schema validation**: Use `validate()` middleware before passing to controller
- **Consistent pattern**: All similar operations follow same middleware chain
- **No duplicate logic**: Each route once, reuse controllers

---

## Authentication & Authorization

### JWT Token Strategy

#### Access Token
- **Type**: Short-lived JWT
- **Expiry**: 15 minutes (configurable via JWT_EXPIRES_IN)
- **Storage**: Authorization header (`Bearer <token>`)
- **Payload**: `{ userId, role, iat, exp }`
- **Usage**: Attached to every API request

#### Refresh Token
- **Type**: Long-lived JWT
- **Expiry**: 7 days (configurable via JWT_REFRESH_EXPIRES_IN)
- **Storage**: httpOnly cookie (secure, not JS-accessible)
- **Payload**: `{ userId, iat, exp }`
- **Usage**: Only sent to `/api/auth/refresh` endpoint

### Authentication Flow

```
1. User calls POST /api/auth/login
   ├─ Validates email + password
   ├─ Generates access token (15m)
   ├─ Generates refresh token (7d)
   └─ Returns access token, sets refresh token cookie

2. Client stores access token in memory
   └─ Includes in all subsequent requests: Authorization: Bearer <token>

3. When access token expires (15m)
   ├─ Client calls POST /api/auth/refresh
   ├─ Server validates refresh token cookie
   ├─ Generates new access token
   └─ Client continues with new token

4. When refresh token expires (7d)
   └─ User must login again
```

### Middleware: authenticate

Located in `src/middleware/authentication.ts`

```typescript
export async function authenticate(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const token = extractBearerToken(req.headers.authorization);
  
  if (!token) {
    return next(new UnauthorizedError('No token provided'));
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET!);
    req.user = {
      id: decoded.userId,
      role: decoded.role
    };
    next();
  } catch (error) {
    next(new UnauthorizedError('Invalid or expired token'));
  }
}

// Attached to req object by middleware
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        role: UserRole;
      };
    }
  }
}
```

**Usage in Routes**:
```typescript
// Require authentication
router.get('/', authenticate, controller.list);

// Optional authentication (for future features)
// router.get('/', (req, res, next) => {
//   authenticate(req, res, () => next()); // Ignore auth errors
// }, controller.list);
```

---

### Middleware: authorize

Located in `src/middleware/authorize.ts`

```typescript
export function authorize(allowedRoles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      // Should never happen if authenticate middleware ran
      return next(new UnauthorizedError('Not authenticated'));
    }

    if (!allowedRoles.includes(req.user.role)) {
      return next(new ForbiddenError(
        `This action requires one of: ${allowedRoles.join(', ')}`
      ));
    }

    next();
  };
}
```

**Usage in Routes**:
```typescript
// Admin or manager only
router.post('/', 
  authenticate,
  authorize(['admin', 'manager']),
  validate(schema),
  controller.create
);

// Any authenticated user
// (no authorize middleware)
router.get('/', 
  authenticate,
  controller.list
);

// Read-only: viewer and above
router.get('/',
  authenticate,
  authorize(['admin', 'manager', 'viewer']),
  controller.list
);
```

---

### Role Hierarchy (Conceptual)

```
admin        (full access)
  ├─ manager (approve, adjust, manage suppliers)
  │   ├─ cashier (POS, sales, customers)
  │   │   └─ warehouse (receive, adjust stock)
  │   │       └─ viewer (read-only)
```

**Not enforced** (no hierarchy in code), but recommended authorization pattern:
```typescript
// Pattern: admin > manager > cashier > warehouse > viewer
const CAN_MANAGE_PRICES = ['admin', 'manager'];
const CAN_ADJUST_STOCK = ['admin', 'manager', 'warehouse'];
const CAN_CREATE_SALES = ['admin', 'manager', 'cashier'];
const CAN_VIEW_ALL = ['admin', 'manager', 'cashier', 'warehouse', 'viewer'];
```

---

## Validation Strategy

### Zod Schema Validation

Located in `src/middleware/validate.ts`

```typescript
export function validate<T>(schema: z.ZodType<T>) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Validate body, query, params together
      const data = {
        ...req.body,
        ...req.query,
        ...req.params
      };

      const validated = await schema.parseAsync(data);
      req.body = validated;
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        return next(error); // Error handler formats this
      }
      next(error);
    }
  };
}
```

**Usage in Routes**:
```typescript
import { loginSchema } from './auth.schema';

router.post('/login',
  validate(loginSchema),  // Validates body
  authController.login
);
```

### Validation Response Format

When validation fails, error handler returns:
```json
{
  "success": false,
  "code": "VALIDATION_ERROR",
  "errors": [
    {
      "field": "email",
      "message": "Invalid email"
    },
    {
      "field": "password",
      "message": "String must contain at least 8 character(s)"
    }
  ]
}
```

### Custom Refinements

```typescript
const productSchema = z.object({
  name: z.string().min(1),
  costPrice: z.number().positive(),
  retailPrice: z.number().positive(),
  wholesalePrice: z.number().positive(),
}).refine(
  (data) => data.costPrice <= data.retailPrice,
  {
    message: "Cost price cannot exceed retail price",
    path: ["costPrice"]
  }
);
```

---

## Error Handling

### Custom Error Hierarchy

Located in `src/utils/errors.ts`

```typescript
export class AppError extends Error {
  constructor(
    public message: string,
    public statusCode: number,
    public code: string
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export class UnauthorizedError extends AppError {
  constructor(message: string = 'Unauthorized') {
    super(message, 401, 'UNAUTHORIZED');
  }
}

export class ForbiddenError extends AppError {
  constructor(message: string = 'Forbidden') {
    super(message, 403, 'FORBIDDEN');
  }
}

export class NotFoundError extends AppError {
  constructor(message: string = 'Not found') {
    super(message, 404, 'NOT_FOUND');
  }
}

export class ConflictError extends AppError {
  constructor(message: string = 'Conflict') {
    super(message, 409, 'CONFLICT');
  }
}

export class ValidationError extends AppError {
  constructor(message: string = 'Validation failed') {
    super(message, 400, 'VALIDATION_ERROR');
  }
}
```

**Usage in Services**:
```typescript
export async function getProduct(id: string): Promise<Product> {
  const product = await db.product.findUnique({ where: { id } });
  
  if (!product) {
    throw new NotFoundError(`Product ${id} not found`);
  }
  
  if (product.deletedAt) {
    throw new NotFoundError('Product has been deleted');
  }
  
  return product;
}
```

### Error Handler Middleware

Located in `src/middleware/errorHandler.ts`

Catches errors in priority order:

1. **ZodError** → 400 Validation Error
2. **AppError** → Configured status code + message
3. **Prisma Constraint** (P2002) → 409 Conflict
4. **Unknown Error** → 500 Internal Error (logs server-side)

```typescript
export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
) {
  if (err instanceof ZodError) {
    return res.status(400).json({
      success: false,
      code: 'VALIDATION_ERROR',
      errors: err.issues.map(e => ({
        field: e.path.join('.'),
        message: e.message,
      })),
    });
  }

  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      success: false,
      code: err.code,
      message: err.message,
    });
  }

  if ((err as any).code === 'P2002') {
    return res.status(409).json({
      success: false,
      code: 'CONFLICT',
      message: 'A record with this value already exists',
    });
  }

  // Unknown error — don't leak details
  console.error('[Unhandled error]', err);
  return res.status(500).json({
    success: false,
    code: 'INTERNAL_ERROR',
    message: 'Something went wrong. Please try again.',
  });
}
```

---

## Database Patterns

### Transaction Pattern

All write operations must be wrapped in transactions for atomicity:

```typescript
// BAD: Not atomic — could fail midway
await db.product.create({ data: {...} });
await db.productPriceHistory.create({ data: {...} });
await db.auditLog.create({ data: {...} });

// GOOD: All or nothing
await db.$transaction(async (tx) => {
  await tx.product.create({ data: {...} });
  await tx.productPriceHistory.create({ data: {...} });
  await tx.auditLog.create({ data: {...} });
});
```

### Relation Management

Always use `connect` syntax for existing relations (not raw IDs):

```typescript
// BAD: Raw ID assignment
await db.product.create({
  data: {
    name: 'Rice',
    categoryId: 'category-uuid',  // Don't do this
  }
});

// GOOD: Connect syntax
await db.product.create({
  data: {
    name: 'Rice',
    category: { connect: { id: 'category-uuid' } },
  }
});
```

### Prisma Client Import

**Critical**: Always import from generated location, NOT from '@prisma/client':

```typescript
// GOOD
import { PrismaClient } from '../generated/prisma';

// BAD — will fail
import { PrismaClient } from '@prisma/client';
```

### Soft Delete Pattern

Always include `WHERE deletedAt IS NULL` when querying:

```typescript
// Get active products only
const products = await db.product.findMany({
  where: {
    deletedAt: null
  }
});

// Soft delete
await db.product.update({
  where: { id },
  data: { deletedAt: new Date() }
});
```

---

## Request & Response Utilities

### Request Helpers

Located in `src/utils/request.ts`

**Express v5 Safety**: Some properties can be string OR string[]

```typescript
// Get URL parameters safely
export function getParam(req: Request, key: string): string {
  const value = req.params[key];
  if (Array.isArray(value)) return value[0];
  return value || '';
}

// Get client IP safely  
export function getIp(req: Request): string {
  const value = req.ip;
  if (Array.isArray(value)) return value[0];
  return value || 'unknown';
}

// Usage in controllers
const id = getParam(req, 'id');
const ip = getIp(req);
```

---

## Key Business Logic Patterns

### 1. Stock Computation (Ledger Model)

**Problem**: Stock quantity changes frequently. Storing quantity as a column creates sync issues.

**Solution**: Append-only ledger of movements.

```typescript
// Never do this:
await db.product.update({
  where: { id },
  data: { stock: { decrement: 50 } }  // ❌ Can get out of sync
});

// Always create ledger entry:
await db.$transaction(async (tx) => {
  // Create immutable movement record
  await tx.stockMovement.create({
    data: {
      productId: id,
      type: 'sale',
      quantity: 50,
      unitCost: product.currentPrice.costPrice,
      performedBy: { connect: { id: userId } },
      referenceType: 'SalesOrder',
      referenceId: saleId,
    }
  });
  
  // Audit log
  await tx.auditLog.create({...});
});

// Compute stock from movements
export async function getCurrentStock(productId: string): Promise<number> {
  const movements = await db.stockMovement.findMany({
    where: { productId }
  });

  return movements.reduce((sum, m) => {
    if (['purchase', 'adjustment_in', 'return_in'].includes(m.type)) {
      return sum + m.quantity;
    } else {
      return sum - m.quantity;
    }
  }, 0);
}
```

### 2. Price History (Append-Only)

**Problem**: Prices change, but historical invoices need original prices.

**Solution**: Never update prices—append new history entries.

```typescript
// BAD: Modifies history
await db.productPriceHistory.update({
  where: { id },
  data: { retailPrice: 40 }
});

// GOOD: Append new entry
await db.productPriceHistory.create({
  data: {
    productId,
    costPrice: 26,
    retailPrice: 40,
    wholesalePrice: 32,
    effectiveFrom: new Date(),
    createdBy: { connect: { id: userId } },
    note: 'Supplier increase'
  }
});

// Get current price
export async function getCurrentPrice(productId: string) {
  return db.productPriceHistory.findFirst({
    where: { productId },
    orderBy: { effectiveFrom: 'desc' }
  });
}

// Get historical price (for past invoices)
export async function getPriceAt(productId: string, date: Date) {
  return db.productPriceHistory.findFirst({
    where: {
      productId,
      effectiveFrom: { lte: date }
    },
    orderBy: { effectiveFrom: 'desc' }
  });
}
```

### 3. Sales Order Processing

**Workflow**:
1. Validate customer (optional)
2. Validate products & stock
3. Get current prices
4. Create sales order + items + movements in one transaction

```typescript
export async function createSaleOrder(
  input: CreateSaleInput,
  userId: string
): Promise<SaleOrder> {
  // Validate stock for all items
  for (const item of input.items) {
    const stock = await getCurrentStock(item.productId);
    if (stock < item.quantity) {
      throw new ValidationError(
        `Insufficient stock for product ${item.productId}`
      );
    }
  }

  return db.$transaction(async (tx) => {
    // Calculate totals
    let subtotal = Decimal(0);
    const lineItems = [];

    for (const item of input.items) {
      const price = await tx.productPriceHistory.findFirst({
        where: { productId: item.productId },
        orderBy: { effectiveFrom: 'desc' }
      });

      const priceToUse = 
        input.type === 'retail' 
          ? price.retailPrice 
          : price.wholesalePrice;

      const lineTotal = priceToUse * item.quantity * (1 - item.discountPercent / 100);
      subtotal += lineTotal;

      lineItems.push({
        productId: item.productId,
        quantity: item.quantity,
        unitPrice: priceToUse,  // Snapshot at time of sale
        discountPercent: item.discountPercent,
        lineTotal
      });
    }

    // Apply order-level discount
    const totalAmount = subtotal * (1 - input.discountPercent / 100);

    // Create sale order
    const saleOrder = await tx.salesOrder.create({
      data: {
        customerId: input.customerId || null,  // null = walk-in
        type: input.type,
        subtotal,
        discountPercent: input.discountPercent,
        discountAmount: subtotal - totalAmount,
        totalAmount,
        createdBy: { connect: { id: userId } },
        items: {
          createMany: {
            data: lineItems
          }
        }
      }
    });

    // Create stock movements
    for (const item of input.items) {
      const price = await tx.productPriceHistory.findFirst({
        where: { productId: item.productId },
        orderBy: { effectiveFrom: 'desc' }
      });

      await tx.stockMovement.create({
        data: {
          productId: item.productId,
          type: 'sale',
          quantity: item.quantity,
          unitCost: price.costPrice,
          performedBy: { connect: { id: userId } },
          referenceType: 'SalesOrder',
          referenceId: saleOrder.id
        }
      });
    }

    // Audit log
    await tx.auditLog.create({
      data: {
        userId,
        action: 'SALE_ORDER_CREATED',
        tableName: 'sales_orders',
        recordId: saleOrder.id,
        afterState: JSON.stringify(saleOrder),
        ipAddress: '',
        userAgent: ''
      }
    });

    return saleOrder;
  });
}
```

---

## Performance Considerations

### Query Optimization

**Problem**: N+1 queries (one per item)
```typescript
// BAD: N+1 query problem
const sales = await db.salesOrder.findMany();
for (const sale of sales) {
  const customer = await db.customer.findUnique({
    where: { id: sale.customerId }  // Extra query per sale
  });
}

// GOOD: Include in single query
const sales = await db.salesOrder.findMany({
  include: {
    customer: true,
    items: {
      include: {
        product: true
      }
    }
  }
});
```

### Indexing Strategy

**Created by Prisma** (auto-indexed):
- Primary keys (id)
- Foreign keys (userId, productId, etc.)
- Unique fields (email, sku, barcode)

**Consider adding**:
- `idx_stock_movements_product_id` on stockMovement.productId
- `idx_sales_orders_created_at` for daily summaries
- `idx_product_price_history_product_id` for price lookups

```typescript
// In schema.prisma
model StockMovement {
  // ... fields ...
  @@index([productId])  // Faster product history queries
  @@index([createdAt])  // Faster time-range queries
}
```

### Caching Opportunities

**Not currently implemented**, but recommended:

```typescript
// Cache current prices (refresh on price history creation)
const PRICE_CACHE_TTL = 3600; // 1 hour
export async function getCurrentPrice(productId: string) {
  const cached = await redis.get(`price:${productId}`);
  if (cached) return JSON.parse(cached);

  const price = await db.productPriceHistory.findFirst({...});
  await redis.setex(`price:${productId}`, PRICE_CACHE_TTL, JSON.stringify(price));
  return price;
}
```

---

## Security Best Practices

### Password Hashing

```typescript
import bcryptjs from 'bcryptjs';

// Hash on registration
const salt = await bcryptjs.genSalt(12);
const passwordHash = await bcryptjs.hash(password, salt);

// Always compare, even if user doesn't exist
// (prevents timing attacks)
const isMatch = await bcryptjs.compare(password, storedHash);
```

### Audit Logging

Every significant action logged:

```typescript
await db.auditLog.create({
  data: {
    userId,
    action: 'PRICE_CHANGED',
    tableName: 'product_price_history',
    recordId: priceEntry.id,
    beforeState: JSON.stringify(oldPrice),
    afterState: JSON.stringify(newPrice),
    ipAddress: getIp(req),
    userAgent: req.get('user-agent'),
  }
});
```

### Soft Deletes

Records never hard-deleted:
```typescript
// "Delete" = set deletedAt
await db.user.update({
  where: { id },
  data: { deletedAt: new Date() }
});

// Queries automatically exclude deleted
const users = await db.user.findMany({
  where: { deletedAt: null }
});
```

---

## Testing Strategy (Recommended)

### Unit Tests (Services)

```typescript
describe('ProductService', () => {
  it('should create product with price history', async () => {
    const product = await productService.createProduct(
      {
        name: 'Rice',
        sku: 'RICE-001',
        categoryId: 'cat-1',
        supplierId: 'sup-1',
        costPrice: 25,
        retailPrice: 35,
        wholesalePrice: 30
      },
      'user-1'
    );

    expect(product.sku).toBe('RICE-001');
    expect(product.priceHistory).toHaveLength(1);
  });
});
```

### Integration Tests (API)

```typescript
describe('POST /api/sales', () => {
  it('should create sale and update stock', async () => {
    const res = await request(app)
      .post('/api/sales')
      .set('Authorization', `Bearer ${token}`)
      .send({
        customerId: 'cust-1',
        type: 'retail',
        items: [{ productId: 'prod-1', quantity: 50 }]
      });

    expect(res.status).toBe(201);
    const stock = await db.stockMovement.count({
      where: { type: 'sale' }
    });
    expect(stock).toBe(1);
  });
});
```

---

## Deployment Architecture

```
┌─────────────────────────────────────────┐
│       Load Balancer (Optional)          │
└──────────────┬──────────────────────────┘
               │
┌──────────────┴──────────────────────────┐
│   Node.js Application Servers (x2+)     │
│   - Express app on :3000                │
│   - Auto-scaling based on CPU/memory    │
└──────────────┬──────────────────────────┘
               │
┌──────────────┴──────────────────────────┐
│    PostgreSQL Database (Replicated)     │
│    - Primary (read/write)               │
│    - Replicas (read-only)               │
│    - Automated backups                  │
└─────────────────────────────────────────┘
```

### Environment Configuration

**Development** (.env):
```
NODE_ENV=development
PORT=3000
DATABASE_URL=postgresql://localhost/inventory_db
JWT_SECRET=dev-secret-123456789
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d
```

**Production** (.env):
```
NODE_ENV=production
PORT=3000
DATABASE_URL=postgresql://produser:password@prod.db.host/inventory_db
JWT_SECRET=<cryptographically-strong-32-chars-min>
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d
DATABASE_POOL_MIN=5
DATABASE_POOL_MAX=20
LOG_LEVEL=info
SENTRY_DSN=<error-tracking>
```

