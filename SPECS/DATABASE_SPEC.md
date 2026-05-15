# Database Specification

## Overview

The Inventory Management System uses PostgreSQL as the primary data store with Prisma 7 ORM. The schema follows append-only ledger patterns for stock and prices to ensure complete audit trails and historical accuracy.

## Core Design Principles

### 1. Append-Only Ledgers
**Stock movements** and **price history** are never updated—only appended. This ensures:
- Complete audit trail of all transactions
- Historical accuracy for P&L reporting
- Easy rollback or reversal capability
- Compliance with accounting standards

### 2. Computed Stock
Stock quantities are **never stored directly**. Instead:
- Create an immutable `StockMovement` for every transaction
- Current stock = SUM(inbound movements) - SUM(outbound movements)
- Like a bank account: balance is computed from transaction history

### 3. Soft Deletes
Records are **never hard-deleted**. Instead:
- Add `deletedAt` timestamp field
- Exclude deleted records from queries with WHERE deletedAt IS NULL
- Recoverable if deletion was accidental

### 4. Decimal Precision
All money stored as `Decimal(12,2)`:
- 12 total digits, 2 after decimal point
- Range: -999,999,999.99 to 999,999,999.99
- Prevents floating-point precision errors (0.1 + 0.2 ≠ 0.3 in floats)

### 5. Transaction Safety
All write operations wrap multiple statements in `db.$transaction()`:
```typescript
await db.$transaction(async (tx) => {
  await tx.salesOrder.create(...);
  await tx.stockMovement.create(...);
  await tx.auditLog.create(...);
});
```
Ensures all-or-nothing atomicity: either all succeed or all rollback.

## Database Models

### Authentication & Audit

#### `users`
Central user account table. All users must have an account.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | UUID | PRIMARY KEY | Auto-generated |
| `name` | VARCHAR(255) | NOT NULL | Display name |
| `email` | VARCHAR(255) | NOT NULL, UNIQUE | Login identifier |
| `password_hash` | VARCHAR(255) | NOT NULL | bcryptjs hash (never stored plain) |
| `role` | ENUM | NOT NULL, DEFAULT 'cashier' | admin, manager, cashier, warehouse, viewer |
| `is_active` | BOOLEAN | NOT NULL, DEFAULT true | Soft active/inactive toggle |
| `created_at` | TIMESTAMP | NOT NULL, DEFAULT NOW() | Account creation |
| `updated_at` | TIMESTAMP | NOT NULL | Auto-updated on changes |
| `deleted_at` | TIMESTAMP | NULL | Soft delete marker |

**Relationships**:
- `auditLogs`: 1 user → many audit logs (user_id FK)
- `productPriceHistory`: 1 user → many price changes (created_by FK)
- `stockMovements`: 1 user → many movements (performed_by FK)
- `purchaseOrders`: 1 user → many POs (created_by, approved_by FK)
- `salesOrders`: 1 user → many sales (created_by FK)

**Indexes**: email (UNIQUE), role, is_active, deleted_at

---

#### `audit_logs`
Immutable audit trail. Every significant action creates one entry.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | UUID | PRIMARY KEY | Auto-generated |
| `user_id` | UUID | NOT NULL, FK → users | Who performed action |
| `action` | VARCHAR(255) | NOT NULL | e.g., 'USER_REGISTERED', 'PURCHASE_ORDER_CREATED' |
| `table_name` | VARCHAR(255) | NULL | Target table (e.g., 'products') |
| `record_id` | UUID | NULL | Target record ID |
| `before_state` | JSONB | NULL | Snapshot before change |
| `after_state` | JSONB | NULL | Snapshot after change |
| `ip_address` | VARCHAR(45) | NULL | IPv4 or IPv6 |
| `user_agent` | TEXT | NULL | Browser/client identifier |
| `created_at` | TIMESTAMP | NOT NULL, DEFAULT NOW() | Action timestamp |

**Constraints**: `user_id` references `users(id)`

**Indexes**: user_id, action, table_name, created_at

**Note**: NEVER updated, NEVER deleted. Append-only by design.

---

### Product Catalog

#### `categories`
Hierarchical product categories. Supports parent-child relationships.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | UUID | PRIMARY KEY | Auto-generated |
| `name` | VARCHAR(255) | NOT NULL, UNIQUE | Category name |
| `description` | TEXT | NULL | Optional description |
| `parent_id` | UUID | NULL, FK → categories | Parent category (self-referencing) |
| `created_at` | TIMESTAMP | NOT NULL, DEFAULT NOW() | Creation time |
| `updated_at` | TIMESTAMP | NOT NULL | Last modification |
| `deleted_at` | TIMESTAMP | NULL | Soft delete marker |

**Constraints**: `parent_id` references `categories(id)` (self-referencing)

**Indexes**: name (UNIQUE), parent_id, deleted_at

**Example Hierarchy**:
```
Food (id=cat1)
├── Grains (parent_id=cat1, id=cat2)
│   └── Rice (parent_id=cat2, id=cat3)
├── Spices (parent_id=cat1, id=cat4)
```

---

#### `suppliers`
Supplier master data. Tracks whom products are purchased from.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | UUID | PRIMARY KEY | Auto-generated |
| `name` | VARCHAR(255) | NOT NULL | Supplier company name |
| `contact_person` | VARCHAR(255) | NULL | Contact person name |
| `phone` | VARCHAR(20) | NULL | Contact phone |
| `email` | VARCHAR(255) | NULL | Contact email |
| `address` | TEXT | NULL | Supplier address |
| `credit_limit` | DECIMAL(12,2) | NOT NULL, DEFAULT 0 | Maximum credit allowed |
| `created_at` | TIMESTAMP | NOT NULL, DEFAULT NOW() | Creation time |
| `updated_at` | TIMESTAMP | NOT NULL | Last modification |
| `deleted_at` | TIMESTAMP | NULL | Soft delete marker |

**Indexes**: name, deleted_at

**Note**: Credit limit is advisory—not enforced in code (can be added as validation).

---

#### `products`
Core product catalog. Every inventory item is a product.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | UUID | PRIMARY KEY | Auto-generated |
| `name` | VARCHAR(255) | NOT NULL | Product name |
| `sku` | VARCHAR(50) | NOT NULL, UNIQUE | Stock Keeping Unit (internal code) |
| `barcode` | VARCHAR(255) | NULL, UNIQUE | Product barcode (scanner input) |
| `description` | TEXT | NULL | Product description |
| `unit` | VARCHAR(20) | NOT NULL, DEFAULT 'piece' | Measurement unit (piece, kg, litre, box, etc.) |
| `reorder_point` | DECIMAL(10,2) | NOT NULL, DEFAULT 0 | Alert threshold when stock falls below |
| `category_id` | UUID | NOT NULL, FK → categories | Category (required) |
| `supplier_id` | UUID | NOT NULL, FK → suppliers | Default supplier (required) |
| `created_at` | TIMESTAMP | NOT NULL, DEFAULT NOW() | Creation time |
| `updated_at` | TIMESTAMP | NOT NULL | Last modification |
| `deleted_at` | TIMESTAMP | NULL | Soft delete marker |

**Constraints**:
- `category_id` references `categories(id)`
- `supplier_id` references `suppliers(id)`
- sku is UNIQUE
- barcode is UNIQUE (if provided)

**Indexes**: sku (UNIQUE), barcode (UNIQUE), category_id, supplier_id, deleted_at

**Note**: Prices stored in separate `product_price_history` table (append-only).

---

#### `product_price_history`
Immutable price history. Append-only—prices never updated, only added.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | UUID | PRIMARY KEY | Auto-generated |
| `product_id` | UUID | NOT NULL, FK → products | Which product |
| `cost_price` | DECIMAL(12,2) | NOT NULL | Supplier cost (wholesale in) |
| `retail_price` | DECIMAL(12,2) | NOT NULL | Retail customer price |
| `wholesale_price` | DECIMAL(12,2) | NOT NULL | Wholesale customer price |
| `effective_from` | TIMESTAMP | NOT NULL | When this price becomes active |
| `created_by` | UUID | NOT NULL, FK → users | Who created this entry |
| `note` | TEXT | NULL | Reason for price change |
| `created_at` | TIMESTAMP | NOT NULL, DEFAULT NOW() | Record creation time |

**Constraints**:
- `product_id` references `products(id)`
- `created_by` references `users(id)`

**Indexes**: product_id, effective_from, created_at

**Usage Pattern**:
```typescript
// Get current price
const current = await db.productPriceHistory.findFirst({
  where: { productId },
  orderBy: { effectiveFrom: 'desc' },
  take: 1
});

// Get price at specific date (for historical invoices)
const historical = await db.productPriceHistory.findFirst({
  where: {
    productId,
    effectiveFrom: { lte: historicalDate }
  },
  orderBy: { effectiveFrom: 'desc' },
  take: 1
});
```

---

### Inventory

#### `stock_movements`
Immutable ledger of all stock changes. Stock is NEVER stored—always computed from here.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | UUID | PRIMARY KEY | Auto-generated |
| `product_id` | UUID | NOT NULL, FK → products | Which product |
| `type` | ENUM | NOT NULL | purchase, sale, adjustment_in, adjustment_out, return_in, return_out |
| `quantity` | DECIMAL(10,2) | NOT NULL | Amount moved (always positive, type determines direction) |
| `unit_cost` | DECIMAL(12,2) | NOT NULL | Cost per unit AT TIME OF MOVEMENT (snapshot for valuation) |
| `performed_by` | UUID | NOT NULL, FK → users | Who performed action |
| `reference_type` | VARCHAR(50) | NOT NULL | PurchaseOrder, SalesOrder, Adjustment, Return |
| `reference_id` | UUID | NOT NULL | Link to PO, SO, or adjustment record |
| `notes` | TEXT | NULL | Optional notes |
| `created_at` | TIMESTAMP | NOT NULL, DEFAULT NOW() | Movement timestamp |

**Constraints**:
- `product_id` references `products(id)`
- `performed_by` references `users(id)`

**Indexes**: product_id, type, reference_type, reference_id, created_at

**Computation Example**:
```sql
-- Get current stock for product
SELECT SUM(
  CASE 
    WHEN type IN ('purchase', 'adjustment_in', 'return_in') THEN quantity
    WHEN type IN ('sale', 'adjustment_out', 'return_out') THEN -quantity
  END
) as current_stock
FROM stock_movements
WHERE product_id = $1 AND deleted_at IS NULL;
```

---

### Purchasing

#### `purchase_orders`
Purchase orders from suppliers. Workflow: draft → approved → received → cancelled.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | UUID | PRIMARY KEY | Auto-generated |
| `supplier_id` | UUID | NOT NULL, FK → suppliers | Which supplier |
| `status` | ENUM | NOT NULL, DEFAULT 'draft' | draft, approved, received, cancelled |
| `expected_at` | TIMESTAMP | NULL | Expected delivery date |
| `received_at` | TIMESTAMP | NULL | Actual receipt date |
| `created_by` | UUID | NOT NULL, FK → users | Who created PO |
| `approved_by` | UUID | NULL, FK → users | Who approved (when status=approved) |
| `total_cost` | DECIMAL(12,2) | NOT NULL | Sum of (qty × unit_cost) for all items |
| `created_at` | TIMESTAMP | NOT NULL, DEFAULT NOW() | Creation time |
| `updated_at` | TIMESTAMP | NOT NULL | Last modification |
| `notes` | TEXT | NULL | Optional notes |

**Constraints**:
- `supplier_id` references `suppliers(id)`
- `created_by` references `users(id)`
- `approved_by` references `users(id)` (null until approved)

**Indexes**: supplier_id, status, created_at, expected_at

**Status Transitions**:
- draft → approved: Locked, cannot edit items
- approved → received: Stock movements created
- Any status → cancelled: Reverses stock movements if already received

---

#### `purchase_order_items`
Individual line items in a purchase order.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | UUID | PRIMARY KEY | Auto-generated |
| `purchase_order_id` | UUID | NOT NULL, FK → purchase_orders | Parent PO |
| `product_id` | UUID | NOT NULL, FK → products | What product |
| `quantity_ordered` | DECIMAL(10,2) | NOT NULL | Original quantity ordered |
| `quantity_received` | DECIMAL(10,2) | NOT NULL, DEFAULT 0 | Actual quantity received (supports partial) |
| `unit_cost` | DECIMAL(12,2) | NOT NULL | Cost per unit (snapshot at PO creation) |
| `line_total` | DECIMAL(12,2) | NOT NULL | qty_ordered × unit_cost |
| `created_at` | TIMESTAMP | NOT NULL, DEFAULT NOW() | Creation time |

**Constraints**:
- `purchase_order_id` references `purchase_orders(id)`
- `product_id` references `products(id)`
- quantity_received ≤ quantity_ordered (enforced in service)

**Indexes**: purchase_order_id, product_id

---

### Sales

#### `customers`
Retail and wholesale customers. Optional for walk-in sales.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | UUID | PRIMARY KEY | Auto-generated |
| `name` | VARCHAR(255) | NOT NULL | Customer name |
| `type` | ENUM | NOT NULL | retail (single units), wholesale (bulk) |
| `email` | VARCHAR(255) | NULL, UNIQUE | Contact email |
| `phone` | VARCHAR(20) | NULL | Contact phone |
| `address` | TEXT | NULL | Delivery address |
| `credit_limit` | DECIMAL(12,2) | NOT NULL, DEFAULT 0 | Credit allowed |
| `created_at` | TIMESTAMP | NOT NULL, DEFAULT NOW() | Creation time |
| `updated_at` | TIMESTAMP | NOT NULL | Last modification |
| `deleted_at` | TIMESTAMP | NULL | Soft delete marker |

**Constraints**: email is UNIQUE (if provided)

**Indexes**: type, deleted_at

**Note**: `created_by` user tracked via audit log, not stored directly.

---

#### `sales_orders`
Sales orders (retail and wholesale). Links to customers and contains line items.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | UUID | PRIMARY KEY | Auto-generated |
| `customer_id` | UUID | NULL, FK → customers | Null = walk-in customer |
| `type` | ENUM | NOT NULL | retail, wholesale |
| `status` | ENUM | NOT NULL, DEFAULT 'completed' | completed, returned, partial_return |
| `subtotal` | DECIMAL(12,2) | NOT NULL | Sum of line totals |
| `discount_amount` | DECIMAL(12,2) | NOT NULL, DEFAULT 0 | Order-level discount |
| `discount_percent` | DECIMAL(5,2) | NOT NULL, DEFAULT 0 | Order-level discount % |
| `total_amount` | DECIMAL(12,2) | NOT NULL | (subtotal - discount) |
| `created_by` | UUID | NOT NULL, FK → users | Cashier who processed sale |
| `created_at` | TIMESTAMP | NOT NULL, DEFAULT NOW() | Sale timestamp |
| `updated_at` | TIMESTAMP | NOT NULL | Last modification |

**Constraints**:
- `customer_id` references `customers(id)` (nullable for walk-in)
- `created_by` references `users(id)`

**Indexes**: customer_id, type, created_at

---

#### `sales_order_items`
Individual line items in a sales order. Prices are snapshots at sale time.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | UUID | PRIMARY KEY | Auto-generated |
| `sales_order_id` | UUID | NOT NULL, FK → sales_orders | Parent order |
| `product_id` | UUID | NOT NULL, FK → products | What product |
| `quantity` | DECIMAL(10,2) | NOT NULL | Amount sold |
| `unit_price` | DECIMAL(12,2) | NOT NULL | Price per unit (snapshot at sale time) |
| `discount_percent` | DECIMAL(5,2) | NOT NULL, DEFAULT 0 | Line-item discount % |
| `line_total` | DECIMAL(12,2) | NOT NULL | (qty × unit_price × (1 - discount%)) |
| `created_at` | TIMESTAMP | NOT NULL, DEFAULT NOW() | Creation time |

**Constraints**:
- `sales_order_id` references `sales_orders(id)`
- `product_id` references `products(id)`

**Indexes**: sales_order_id, product_id

**Important**: `unit_price` is a snapshot—never changes. This ensures historical invoices are accurate even if product prices change.

---

## Relationships Diagram

```
┌─────────────┐
│    Users    │ (admin, manager, cashier, warehouse, viewer)
└──────┬──────┘
       │
       ├─────> AuditLog (immutable action log)
       ├─────> ProductPriceHistory (appended prices)
       ├─────> StockMovements (appended movements)
       ├─────> PurchaseOrder (created_by, approved_by)
       └─────> SalesOrder (created_by)

┌──────────────┐
│  Categories  │ (self-referencing tree: parent_id)
└──────┬───────┘
       │
       ├─────> Product

┌──────────────┐
│  Suppliers   │
└──────┬───────┘
       │
       ├─────> Product
       └─────> PurchaseOrder

┌──────────────┐
│   Products   │ (SKU, barcode, unit, reorder_point)
└──────┬───────┘
       │
       ├─────> ProductPriceHistory (current prices)
       ├─────> StockMovement (current stock = SUM)
       ├─────> PurchaseOrderItem
       └─────> SalesOrderItem

┌──────────────┐       ┌──────────────────────┐
│PurchaseOrder │──────>│PurchaseOrderItem     │──────> Product
│ (draft→rcv)  │       │ (qty_ord, qty_rcv)   │
└──────┬───────┘       └──────────────────────┘
       │
       └─────────> StockMovement (type='purchase')

┌──────────────┐       ┌──────────────────────┐
│  SalesOrder  │──────>│SalesOrderItem        │──────> Product
│  (completed) │       │ (unit_price snapshot)│
└──────┬───────┘       └──────────────────────┘
       │
       └─────────> Customer (optional)
       │
       └─────────> StockMovement (type='sale')

┌──────────────┐
│  Customers   │ (retail/wholesale)
└──────┬───────┘
       │
       └─────> SalesOrder
```

---

## Migration History

### Migration 1: `20260509121059_init_users_and_audit`
Initial schema with core authentication and audit infrastructure.
- `users` table with roles and soft deletes
- `audit_logs` immutable table

### Migration 2: `20260511094258_phase2_categories_suppliers_products`
Product catalog foundation.
- `categories` (hierarchical with self-referencing)
- `suppliers` (with credit limits)
- `products` (SKU, barcode, units)

### Migration 3: `20260512080211_add_product_price_history`
Append-only price tracking.
- `product_price_history` (cost, retail, wholesale)
- Prices never updated, only appended

### Migration 4: `20260513023015_phase3_stock_movements`
Inventory ledger system.
- `stock_movements` (append-only stock ledger)
- Stock computed from movements, never stored

### Migration 5: `20260513081931_phase4_purchase_orders`
Purchase order workflows.
- `purchase_orders` (draft → approved → received)
- `purchase_order_items` (with partial receiving support)

### Migration 6: `20260513100438_phase5_sales_and_customers`
Sales processing and customer management.
- `customers` (retail/wholesale)
- `sales_orders` (with line items)
- `sales_order_items` (price snapshots at sale time)

---

## Data Integrity Rules

### Foreign Key Constraints
All ForeignKey relationships are configured with:
- `onDelete: 'Restrict'` (prevent deletion if child records exist)
- Soft deletes ensure records remain for audit compliance

### Unique Constraints
- `users.email` - UNIQUE
- `categories.name` - UNIQUE
- `products.sku` - UNIQUE
- `products.barcode` - UNIQUE (if provided)
- `customers.email` - UNIQUE (if provided)

### Check Constraints (Recommended, not yet enforced)
- Prices must be ≥ 0
- Quantities must be ≥ 0
- Credit limits must be ≥ 0
- cost_price ≤ retail_price ≤ wholesale_price (optional)

---

## Performance Considerations

### Indexing Strategy

**Recommended Indexes** (beyond primary/foreign keys):

1. `audit_logs(created_at DESC)` — For time-range queries
2. `stock_movements(product_id, created_at DESC)` — Product history lookups
3. `product_price_history(product_id, effective_from DESC)` — Current/historical prices
4. `sales_orders(created_at DESC)` — Daily summaries
5. `purchase_orders(status, created_at)` — Filtering by status

### Query Optimization

**Stock Computation**: Precompute current stock in cache if performance becomes issue:
- Cache invalidates on every StockMovement creation
- Redis or in-memory for small datasets

**Price Lookups**: Index on `(product_id, effective_from DESC)` to speed current/historical price fetches.

**Soft Deletes**: Always include `WHERE deleted_at IS NULL` in queries. Prisma can automate via `@prisma/extension-soft-deletes`.

---

## Backup & Recovery

### Daily Backups
```bash
pg_dump -U user inventory_db > backup_$(date +%Y%m%d).sql
```

### Point-in-Time Recovery
- Audit logs enable reconstruction of state at any point
- Stock movements can be reversed if error detected
- Never hard-delete—always soft delete and audit

### Disaster Recovery
- Restore from latest backup
- Replay audit logs if needed
- All transactions logged for compliance

