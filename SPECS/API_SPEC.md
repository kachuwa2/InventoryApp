# API Specification

## Overview

The Inventory Management System provides a comprehensive REST API with 35+ endpoints across 9 modules. All endpoints require authentication (JWT Bearer token) except for auth registration, login, and refresh endpoints. Response format is consistent JSON with success/error indicators.

## General Response Format

### Success Response
```json
{
  "success": true,
  "data": { /* endpoint-specific data */ }
}
```

### Error Response
```json
{
  "success": false,
  "code": "ERROR_CODE",
  "message": "Human-readable error message"
}
```

### Validation Error Response
```json
{
  "success": false,
  "code": "VALIDATION_ERROR",
  "errors": [
    {
      "field": "email",
      "message": "Invalid email format"
    }
  ]
}
```

## Authentication & Authorization

### Bearer Token
All protected endpoints require:
```
Authorization: Bearer <access_token>
```

### Token Management
- **Access Token**: 15 minute expiry, sent in Authorization header
- **Refresh Token**: 7 day expiry, sent as httpOnly cookie
- Get new access token by calling `/api/auth/refresh`

### Role-Based Access
| Role | Permissions |
|------|-------------|
| `admin` | Full system access, user management, purchase approval, price changes |
| `manager` | Business operations, inventory management, supplier management |
| `cashier` | Point-of-sale, customer management, sales processing |
| `warehouse` | Stock receiving, manual adjustments |
| `viewer` | Read-only access to products, inventory, reports |

---

## Module: Authentication

**Base URL**: `/api/auth`

### 1. Register User

**Endpoint**: `POST /api/auth/register`

**Auth**: Public (no token required)

**Request Body**:
```json
{
  "name": "John Smith",
  "email": "john@example.com",
  "password": "SecurePassword123!",
  "role": "cashier"
}
```

**Valid Roles**: admin, manager, cashier, warehouse, viewer

**Response**: `201 Created`
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "name": "John Smith",
    "email": "john@example.com",
    "role": "cashier",
    "isActive": true,
    "createdAt": "2026-05-15T10:30:00Z"
  }
}
```

**Error Codes**:
- `400 VALIDATION_ERROR` - Invalid input (email format, password strength)
- `409 CONFLICT` - Email already registered

---

### 2. Login

**Endpoint**: `POST /api/auth/login`

**Auth**: Public

**Request Body**:
```json
{
  "email": "john@example.com",
  "password": "SecurePassword123!"
}
```

**Response**: `200 OK`
```json
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIs...",
    "user": {
      "id": "uuid",
      "email": "john@example.com",
      "name": "John Smith",
      "role": "cashier"
    }
  }
}
```

**Headers**: Sets `refreshToken` as httpOnly cookie

**Error Codes**:
- `400 VALIDATION_ERROR` - Missing credentials
- `401 UNAUTHORIZED` - Invalid email or password

---

### 3. Refresh Token

**Endpoint**: `POST /api/auth/refresh`

**Auth**: Public (uses httpOnly cookie)

**Request Body**: Empty

**Response**: `200 OK`
```json
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIs...",
    "user": {
      "id": "uuid",
      "email": "john@example.com",
      "name": "John Smith",
      "role": "cashier"
    }
  }
}
```

**Error Codes**:
- `401 UNAUTHORIZED` - Refresh token missing or expired

---

### 4. Logout

**Endpoint**: `POST /api/auth/logout`

**Auth**: Public

**Request Body**: Empty

**Response**: `200 OK`
```json
{
  "success": true,
  "data": {
    "message": "Logged out successfully"
  }
}
```

**Effect**: Clears refreshToken cookie

---

### 5. Get Current User

**Endpoint**: `GET /api/auth/me`

**Auth**: Required

**Response**: `200 OK`
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "email": "john@example.com",
    "name": "John Smith",
    "role": "cashier",
    "isActive": true,
    "createdAt": "2026-05-15T10:30:00Z"
  }
}
```

---

## Module: Categories

**Base URL**: `/api/categories`

**Auth**: All endpoints require token

### 1. List Categories

**Endpoint**: `GET /api/categories`

**Query Parameters**:
- None (returns all active categories with hierarchy)

**Response**: `200 OK`
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "name": "Food",
      "description": "Food items",
      "parentId": null,
      "children": [
        {
          "id": "uuid",
          "name": "Grains",
          "description": "Grain products",
          "parentId": "parent-uuid",
          "children": [
            {
              "id": "uuid",
              "name": "Rice",
              "parentId": "grains-uuid"
            }
          ]
        }
      ]
    }
  ]
}
```

---

### 2. Get Category by ID

**Endpoint**: `GET /api/categories/:id`

**Response**: `200 OK`
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "name": "Grains",
    "description": "Grain products",
    "parentId": "parent-uuid",
    "createdAt": "2026-05-15T10:30:00Z"
  }
}
```

**Error Codes**:
- `404 NOT_FOUND` - Category doesn't exist

---

### 3. Create Category

**Endpoint**: `POST /api/categories`

**Auth**: Requires admin or manager role

**Request Body**:
```json
{
  "name": "Grains",
  "description": "Grain products",
  "parentId": "parent-category-uuid"  // optional
}
```

**Response**: `201 Created`
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "name": "Grains",
    "description": "Grain products",
    "parentId": "parent-uuid",
    "createdAt": "2026-05-15T10:30:00Z"
  }
}
```

**Error Codes**:
- `409 CONFLICT` - Category name already exists

---

### 4. Update Category

**Endpoint**: `PUT /api/categories/:id`

**Auth**: Requires admin or manager role

**Request Body**:
```json
{
  "name": "Updated Name",
  "description": "Updated description",
  "parentId": "new-parent-uuid"  // optional
}
```

**Response**: `200 OK` (same as create response)

---

### 5. Delete Category (Soft Delete)

**Endpoint**: `DELETE /api/categories/:id`

**Auth**: Requires admin or manager role

**Response**: `200 OK`
```json
{
  "success": true,
  "data": {
    "message": "Category deleted successfully"
  }
}
```

**Note**: Soft delete only (sets deletedAt). Can be restored if needed.

---

## Module: Suppliers

**Base URL**: `/api/suppliers`

**Auth**: All endpoints require token

### 1. List Suppliers

**Endpoint**: `GET /api/suppliers`

**Response**: `200 OK`
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "name": "GrainCo Ltd",
      "contactPerson": "Alice Brown",
      "phone": "+1-555-0100",
      "email": "alice@graingo.com",
      "address": "123 Supply St, City",
      "creditLimit": "50000.00",
      "createdAt": "2026-05-15T10:30:00Z"
    }
  ]
}
```

---

### 2. Get Supplier by ID

**Endpoint**: `GET /api/suppliers/:id`

**Response**: `200 OK` (single supplier object)

---

### 3. Create Supplier

**Endpoint**: `POST /api/suppliers`

**Auth**: Requires admin or manager role

**Request Body**:
```json
{
  "name": "GrainCo Ltd",
  "contactPerson": "Alice Brown",
  "phone": "+1-555-0100",
  "email": "alice@graingo.com",
  "address": "123 Supply St, City",
  "creditLimit": "50000.00"
}
```

**Response**: `201 Created` (same as get response)

---

### 4. Update Supplier

**Endpoint**: `PUT /api/suppliers/:id`

**Auth**: Requires admin or manager role

**Request Body**: Same as create (all fields optional)

---

### 5. Delete Supplier

**Endpoint**: `DELETE /api/suppliers/:id`

**Auth**: Requires admin or manager role

**Response**: Success message

---

## Module: Products

**Base URL**: `/api/products`

**Auth**: All endpoints require token

### 1. List Products

**Endpoint**: `GET /api/products`

**Query Parameters**:
- `categoryId` - Filter by category UUID
- `supplierId` - Filter by supplier UUID
- `search` - Text search (name, SKU, barcode)

**Example**: `GET /api/products?categoryId=uuid&search=rice`

**Response**: `200 OK`
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "name": "Basmati Rice",
      "sku": "RICE-001",
      "barcode": "5012345678900",
      "description": "Long grain basmati",
      "unit": "kg",
      "reorderPoint": "50.00",
      "category": {
        "id": "uuid",
        "name": "Grains"
      },
      "supplier": {
        "id": "uuid",
        "name": "GrainCo Ltd"
      },
      "currentPrice": {
        "costPrice": "25.00",
        "retailPrice": "35.00",
        "wholesalePrice": "30.00",
        "effectiveFrom": "2026-05-01T00:00:00Z"
      },
      "createdAt": "2026-05-15T10:30:00Z"
    }
  ]
}
```

---

### 2. Get Product by Barcode

**Endpoint**: `GET /api/products/barcode/:code`

**URL Parameter**: 
- `code` - Barcode string (e.g., 5012345678900)

**Response**: `200 OK` (single product with full details)

**Use Case**: POS system needs quick barcode lookup (scanner passes barcode)

**Error Codes**:
- `404 NOT_FOUND` - Barcode not found

---

### 3. Get Product by ID

**Endpoint**: `GET /api/products/:id`

**Response**: `200 OK`
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "name": "Basmati Rice",
    "sku": "RICE-001",
    "barcode": "5012345678900",
    "unit": "kg",
    "reorderPoint": "50.00",
    "category": { /* full object */ },
    "supplier": { /* full object */ },
    "currentPrice": { /* current price */ },
    "priceHistory": [
      {
        "costPrice": "25.00",
        "retailPrice": "35.00",
        "wholesalePrice": "30.00",
        "effectiveFrom": "2026-05-01T00:00:00Z",
        "note": "Bulk discount adjustment"
      }
    ],
    "createdAt": "2026-05-15T10:30:00Z"
  }
}
```

---

### 4. Create Product

**Endpoint**: `POST /api/products`

**Auth**: Requires admin or manager role

**Request Body**:
```json
{
  "name": "Basmati Rice",
  "sku": "RICE-001",
  "barcode": "5012345678900",
  "description": "Long grain basmati",
  "unit": "kg",
  "reorderPoint": "50.00",
  "categoryId": "category-uuid",
  "supplierId": "supplier-uuid",
  "costPrice": "25.00",
  "retailPrice": "35.00",
  "wholesalePrice": "30.00"
}
```

**Response**: `201 Created` (same as get response)

**Note**: Initial prices stored in ProductPriceHistory

---

### 5. Update Product

**Endpoint**: `PUT /api/products/:id`

**Auth**: Requires admin or manager role

**Request Body**:
```json
{
  "name": "Updated Name",
  "description": "Updated description",
  "reorderPoint": "75.00"
  // Note: categoryId and supplierId can be updated
}
```

**Response**: `200 OK` (updated product)

**Note**: Does NOT include pricing changes (see endpoint #6)

---

### 6. Update Product Price

**Endpoint**: `PUT /api/products/:id/price`

**Auth**: Requires admin or manager role

**Request Body**:
```json
{
  "costPrice": "26.00",
  "retailPrice": "36.00",
  "wholesalePrice": "31.00",
  "note": "Supplier price increase",
  "effectiveFrom": "2026-06-01T00:00:00Z"
}
```

**Response**: `200 OK`
```json
{
  "success": true,
  "data": {
    "id": "product-uuid",
    "newPrice": {
      "costPrice": "26.00",
      "retailPrice": "36.00",
      "wholesalePrice": "31.00",
      "effectiveFrom": "2026-06-01T00:00:00Z"
    }
  }
}
```

**Important**: 
- Creates new ProductPriceHistory entry (append-only)
- Old prices never deleted
- Historical invoices remain accurate
- Effective dates allow scheduling future prices

---

### 7. Delete Product

**Endpoint**: `DELETE /api/products/:id`

**Auth**: Requires admin or manager role

**Response**: Success message

---

## Module: Inventory

**Base URL**: `/api/inventory`

**Auth**: All endpoints require token

### 1. Get Current Stock Levels

**Endpoint**: `GET /api/inventory`

**Response**: `200 OK`
```json
{
  "success": true,
  "data": [
    {
      "productId": "uuid",
      "name": "Basmati Rice",
      "sku": "RICE-001",
      "currentStock": "250.50",
      "unit": "kg",
      "reorderPoint": "50.00",
      "status": "safe",  // safe, low, critical
      "lastMovement": "2026-05-15T14:30:00Z",
      "valuation": {
        "quantity": "250.50",
        "unitCost": "25.00",
        "totalValue": "6262.50"
      }
    }
  ]
}
```

---

### 2. Get Low Stock Products

**Endpoint**: `GET /api/inventory/low-stock`

**Response**: `200 OK`
```json
{
  "success": true,
  "data": [
    {
      "productId": "uuid",
      "name": "Basmati Rice",
      "sku": "RICE-001",
      "currentStock": "35.00",
      "reorderPoint": "50.00",
      "unit": "kg",
      "urgency": "high"  // low, medium, high
    }
  ]
}
```

---

### 3. Get Total Inventory Valuation

**Endpoint**: `GET /api/inventory/valuation`

**Response**: `200 OK`
```json
{
  "success": true,
  "data": {
    "totalItems": 45,
    "totalQuantity": "5250.75",
    "totalValue": "125000.00",
    "byCategory": [
      {
        "categoryName": "Grains",
        "quantity": "2500.00",
        "value": "50000.00"
      }
    ]
  }
}
```

---

### 4. Get Stock Movement History

**Endpoint**: `GET /api/inventory/:productId/movements`

**Query Parameters**:
- `type` - Filter by movement type (purchase, sale, adjustment_in, adjustment_out)
- `limit` - Number of records (default 50, max 500)
- `offset` - Pagination offset

**Response**: `200 OK`
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "type": "purchase",
      "quantity": "100.00",
      "unitCost": "25.00",
      "performedBy": "username",
      "referenceType": "PurchaseOrder",
      "referenceId": "po-uuid",
      "notes": null,
      "createdAt": "2026-05-15T10:00:00Z"
    }
  ]
}
```

---

### 5. Manual Stock Adjustment

**Endpoint**: `POST /api/inventory/adjust`

**Auth**: Requires admin, manager, or warehouse role

**Request Body**:
```json
{
  "productId": "product-uuid",
  "type": "adjustment_in",  // or "adjustment_out"
  "quantity": "50.00",
  "notes": "Stock count variance correction",
  "unitCost": "25.00"  // at current market price
}
```

**Response**: `201 Created`
```json
{
  "success": true,
  "data": {
    "movement": {
      "id": "movement-uuid",
      "productId": "product-uuid",
      "type": "adjustment_in",
      "quantity": "50.00",
      "createdAt": "2026-05-15T10:00:00Z"
    },
    "newStock": "325.00"
  }
}
```

**Error Codes**:
- `400 VALIDATION_ERROR` - Invalid type or missing required fields
- `404 NOT_FOUND` - Product doesn't exist
- `422 UNPROCESSABLE_ENTITY` - Insufficient stock for adjustment_out

---

## Module: Purchases

**Base URL**: `/api/purchases`

**Auth**: All endpoints require token

### 1. List Purchase Orders

**Endpoint**: `GET /api/purchases`

**Query Parameters**:
- `status` - draft, approved, received, cancelled
- `supplierId` - Filter by supplier
- `startDate` - ISO 8601 date
- `endDate` - ISO 8601 date

**Response**: `200 OK`
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "supplierId": "uuid",
      "supplierName": "GrainCo Ltd",
      "status": "approved",
      "totalCost": "5000.00",
      "itemCount": 5,
      "expectedAt": "2026-05-20T00:00:00Z",
      "receivedAt": null,
      "createdAt": "2026-05-15T10:30:00Z"
    }
  ]
}
```

---

### 2. Get Purchase Order Details

**Endpoint**: `GET /api/purchases/:id`

**Response**: `200 OK`
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "supplierId": "uuid",
    "supplierName": "GrainCo Ltd",
    "status": "approved",
    "totalCost": "5000.00",
    "expectedAt": "2026-05-20T00:00:00Z",
    "receivedAt": null,
    "createdBy": {
      "id": "uuid",
      "name": "John Smith"
    },
    "approvedBy": {
      "id": "uuid",
      "name": "Jane Doe"
    },
    "items": [
      {
        "id": "uuid",
        "productId": "uuid",
        "productName": "Basmati Rice",
        "quantityOrdered": "100.00",
        "quantityReceived": "100.00",
        "unitCost": "25.00",
        "lineTotal": "2500.00"
      }
    ],
    "notes": "Standard monthly order",
    "createdAt": "2026-05-15T10:30:00Z"
  }
}
```

---

### 3. Create Purchase Order

**Endpoint**: `POST /api/purchases`

**Auth**: Requires admin or manager role

**Request Body**:
```json
{
  "supplierId": "supplier-uuid",
  "expectedAt": "2026-05-20T00:00:00Z",
  "items": [
    {
      "productId": "product-uuid",
      "quantityOrdered": "100.00",
      "unitCost": "25.00"
    }
  ],
  "notes": "Standard monthly order"
}
```

**Response**: `201 Created`
```json
{
  "success": true,
  "data": {
    "id": "po-uuid",
    "status": "draft",
    "totalCost": "2500.00",
    "itemCount": 1,
    "createdAt": "2026-05-15T10:30:00Z"
  }
}
```

---

### 4. Update Purchase Order

**Endpoint**: `PUT /api/purchases/:id`

**Auth**: Requires admin or manager role

**Constraint**: Only editable in `draft` status

**Request Body**:
```json
{
  "expectedAt": "2026-05-22T00:00:00Z",
  "items": [
    {
      "productId": "product-uuid",
      "quantityOrdered": "150.00",
      "unitCost": "25.00"
    }
  ],
  "notes": "Updated order"
}
```

**Response**: `200 OK` (updated PO)

---

### 5. Approve Purchase Order

**Endpoint**: `POST /api/purchases/:id/approve`

**Auth**: Requires admin or manager role

**Request Body**: Empty

**Response**: `200 OK`
```json
{
  "success": true,
  "data": {
    "id": "po-uuid",
    "status": "approved",
    "approvedBy": { "id": "uuid", "name": "Jane Doe" },
    "approvedAt": "2026-05-15T11:00:00Z"
  }
}
```

**Effect**: Transitions draft → approved, PO is now locked

---

### 6. Receive Purchase Order

**Endpoint**: `POST /api/purchases/:id/receive`

**Auth**: Requires admin, manager, or warehouse role

**Request Body**:
```json
{
  "items": [
    {
      "itemId": "po-item-uuid",
      "quantityReceived": "100.00"  // can be less than ordered
    }
  ],
  "notes": "Received full shipment"
}
```

**Response**: `200 OK`
```json
{
  "success": true,
  "data": {
    "id": "po-uuid",
    "status": "received",
    "receivedAt": "2026-05-15T11:00:00Z",
    "stockMovementsCreated": 1,
    "totalStockReceived": "100.00"
  }
}
```

**Effect**: 
- Transitions approved → received
- Creates StockMovement entries for each item
- Updates current stock levels

---

### 7. Cancel Purchase Order

**Endpoint**: `POST /api/purchases/:id/cancel`

**Auth**: Requires admin or manager role

**Response**: `200 OK`
```json
{
  "success": true,
  "data": {
    "id": "po-uuid",
    "status": "cancelled",
    "cancelledAt": "2026-05-15T11:00:00Z"
  }
}
```

---

## Module: Customers

**Base URL**: `/api/customers`

**Auth**: All endpoints require token

### 1. List Customers

**Endpoint**: `GET /api/customers`

**Query Parameters**:
- `type` - retail or wholesale
- `search` - Customer name search

**Response**: `200 OK`
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "name": "Acme Restaurant",
      "type": "wholesale",
      "email": "orders@acme.com",
      "phone": "+1-555-0200",
      "address": "456 Business Ave",
      "creditLimit": "100000.00",
      "createdAt": "2026-05-15T10:30:00Z"
    }
  ]
}
```

---

### 2. Get Customer by ID

**Endpoint**: `GET /api/customers/:id`

**Response**: `200 OK` (single customer)

---

### 3. Create Customer

**Endpoint**: `POST /api/customers`

**Auth**: Requires admin, manager, or cashier role

**Request Body**:
```json
{
  "name": "Acme Restaurant",
  "type": "wholesale",  // retail or wholesale
  "email": "orders@acme.com",
  "phone": "+1-555-0200",
  "address": "456 Business Ave",
  "creditLimit": "100000.00"
}
```

**Response**: `201 Created` (customer object)

---

### 4. Update Customer

**Endpoint**: `PUT /api/customers/:id`

**Auth**: Requires admin, manager, or cashier role

**Request Body**: Same as create (all fields optional)

---

### 5. Delete Customer

**Endpoint**: `DELETE /api/customers/:id`

**Auth**: Requires admin or manager role

**Response**: Success message

---

## Module: Sales

**Base URL**: `/api/sales`

**Auth**: All endpoints require token

### 1. Get Daily Sales Summary

**Endpoint**: `GET /api/sales/daily-summary`

**Query Parameters**:
- `date` - ISO 8601 date (defaults to today)

**Response**: `200 OK`
```json
{
  "success": true,
  "data": {
    "date": "2026-05-15",
    "salesCount": 42,
    "retailSales": 28,
    "wholesaleSales": 14,
    "totalRevenue": "15000.00",
    "totalDiscount": "750.00",
    "netRevenue": "14250.00",
    "averageOrder": "339.29",
    "topProducts": [
      {
        "productId": "uuid",
        "name": "Basmati Rice",
        "quantity": "500.00",
        "revenue": "17500.00"
      }
    ]
  }
}
```

---

### 2. List Sales Orders

**Endpoint**: `GET /api/sales`

**Query Parameters**:
- `customerId` - Filter by customer
- `type` - retail or wholesale
- `startDate` - ISO 8601 date
- `endDate` - ISO 8601 date

**Response**: `200 OK`
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "customerId": null,  // walk-in if null
      "type": "retail",
      "totalAmount": "350.00",
      "discount": "0.00",
      "itemCount": 3,
      "createdBy": "Cashier Name",
      "createdAt": "2026-05-15T14:30:00Z"
    }
  ]
}
```

---

### 3. Get Sales Order Details

**Endpoint**: `GET /api/sales/:id`

**Response**: `200 OK`
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "customerId": "customer-uuid",
    "customerName": "Acme Restaurant",
    "type": "wholesale",
    "status": "completed",
    "items": [
      {
        "id": "uuid",
        "productId": "uuid",
        "productName": "Basmati Rice",
        "quantity": "100.00",
        "unitPrice": "30.00",  // wholesale price snapshot
        "discountPercent": "0.00",
        "lineTotal": "3000.00"
      }
    ],
    "subtotal": "3000.00",
    "discountAmount": "150.00",
    "discountPercent": "5.00",
    "totalAmount": "2850.00",
    "createdBy": {
      "id": "uuid",
      "name": "Jane Cashier"
    },
    "createdAt": "2026-05-15T14:30:00Z"
  }
}
```

---

### 4. Create Sales Order (POS Checkout)

**Endpoint**: `POST /api/sales`

**Auth**: Requires admin, manager, or cashier role

**Request Body**:
```json
{
  "customerId": "customer-uuid",  // null for walk-in
  "type": "retail",  // retail or wholesale
  "items": [
    {
      "productId": "product-uuid",
      "quantity": "50.00",
      "discountPercent": "0.00"  // line-item discount
    }
  ],
  "discountAmount": "0.00",  // order-level discount
  "discountPercent": "0.00"
}
```

**Response**: `201 Created`
```json
{
  "success": true,
  "data": {
    "id": "sale-uuid",
    "type": "retail",
    "itemCount": 1,
    "subtotal": "1250.00",
    "discount": "0.00",
    "totalAmount": "1250.00",
    "createdAt": "2026-05-15T14:30:00Z"
  }
}
```

**Validations**:
- Product must exist and not be deleted
- Stock must be sufficient for all items
- Customer (if provided) must exist
- Prices taken from current ProductPriceHistory

**Effect**:
- Creates SalesOrder record
- Creates SalesOrderItem for each line
- Creates StockMovement for each product (type: sale)
- Unit prices are snapshots at sale time (immutable for historical accuracy)

---

## Module: Reports

**Base URL**: `/api/reports`

**Auth**: All endpoints require token; most require admin or manager role

### 1. Dashboard

**Endpoint**: `GET /api/reports/dashboard`

**Auth**: Requires admin or manager role

**Query Parameters**:
- `period` - today, month, quarter, year (default: month)

**Response**: `200 OK`
```json
{
  "success": true,
  "data": {
    "period": "month",
    "revenue": {
      "today": "5000.00",
      "period": "125000.00",
      "previousPeriod": "120000.00",
      "growth": "4.17"
    },
    "orders": {
      "today": 42,
      "period": 850,
      "averageValue": "147.06"
    },
    "inventory": {
      "totalValue": "500000.00",
      "lowStockItems": 12,
      "criticalItems": 3
    },
    "purchases": {
      "pending": 5,
      "received": 23,
      "totalSpent": "75000.00"
    }
  }
}
```

---

### 2. Profit & Loss Report

**Endpoint**: `GET /api/reports/profit-loss`

**Auth**: Requires admin or manager role

**Query Parameters**:
- `startDate` - ISO 8601 date (required)
- `endDate` - ISO 8601 date (required)

**Response**: `200 OK`
```json
{
  "success": true,
  "data": {
    "period": {
      "startDate": "2026-05-01",
      "endDate": "2026-05-31"
    },
    "revenue": "125000.00",
    "discounts": "5000.00",
    "netRevenue": "120000.00",
    "costOfGoodsSold": "75000.00",
    "grossProfit": "45000.00",
    "grossMargin": "37.5",
    "operatingExpenses": "15000.00",
    "netProfit": "30000.00",
    "netMargin": "25.0"
  }
}
```

**Calculation**:
- Revenue = SUM(SalesOrder.totalAmount)
- COGS = SUM(StockMovement.quantity × unitCost) for type='sale'
- Gross Profit = Net Revenue - COGS
- Net Profit = Gross Profit - Operating Expenses (if tracked)

---

### 3. Top Products

**Endpoint**: `GET /api/reports/top-products`

**Auth**: Requires admin or manager role

**Query Parameters**:
- `limit` - Number of products (default: 10)
- `period` - today, week, month, quarter, year
- `sortBy` - quantity or revenue (default: revenue)

**Response**: `200 OK`
```json
{
  "success": true,
  "data": [
    {
      "productId": "uuid",
      "name": "Basmati Rice",
      "sku": "RICE-001",
      "quantity": "1500.00",
      "revenue": "45000.00",
      "unitPrice": "30.00",
      "orders": 45
    }
  ]
}
```

---

### 4. Slow-Moving Inventory

**Endpoint**: `GET /api/reports/slow-moving`

**Auth**: Requires admin or manager role

**Query Parameters**:
- `days` - Products not sold in X days (default: 30)
- `limit` - Number of products (default: 20)

**Response**: `200 OK`
```json
{
  "success": true,
  "data": [
    {
      "productId": "uuid",
      "name": "Specialty Knife",
      "sku": "KNIFE-001",
      "currentStock": "45.00",
      "stockValue": "1125.00",
      "lastSaleDate": "2026-04-15T10:30:00Z",
      "daysSinceSale": 30,
      "reorderPoint": "10.00"
    }
  ]
}
```

---

## Common Error Codes

| Code | Status | Description |
|------|--------|-------------|
| VALIDATION_ERROR | 400 | Request validation failed |
| UNAUTHORIZED | 401 | No token or token invalid |
| FORBIDDEN | 403 | Authenticated but no permission |
| NOT_FOUND | 404 | Resource doesn't exist |
| CONFLICT | 409 | Unique constraint violation |
| UNPROCESSABLE_ENTITY | 422 | Business logic error (e.g., insufficient stock) |
| INTERNAL_ERROR | 500 | Server error (shouldn't normally occur) |

---

## Rate Limiting (Future)

Currently not implemented. Recommended:
- 100 requests per minute for public endpoints
- 1000 requests per minute for authenticated endpoints
- 10 requests per second for sensitive endpoints (payment processing)

---

## Webhook Support (Future)

Planned events for webhook triggers:
- order.created
- order.shipped
- inventory.low_stock
- price.updated
- supplier.alert

