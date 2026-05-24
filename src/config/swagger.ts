import swaggerJsdoc from "swagger-jsdoc";

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "StockFlow — Kitchen Utensils Inventory API",
      version: "1.0.0",
      description: `
## StockFlow Inventory Management System

A production-grade wholesale and retail inventory management
system for a kitchen utensils shop.

### Key Features
- JWT authentication with role-based access control
- Append-only stock ledger (never stored directly)
- Dual pricing: retail and wholesale
- Complete audit trail on every action
- Purchase order workflow: draft → approved → received

### Authentication
Most endpoints require a Bearer token.
Login via **POST /api/auth/login** to get your token.
Click **Authorize** and enter: **Bearer {your_token}**

### Test Credentials
| Role | Email | Password |
|------|-------|----------|
| Admin | sara@shop.com | Admin1234 |
| Cashier | james@shop.com | Cashier1234 |
| Warehouse | david@shop.com | Warehouse1234 |
      `.trim(),
      contact: {
        name: "StockFlow API Support",
        email: "support@stockflow.app",
      },
      license: {
        name: "MIT",
      },
    },
    servers: [
      {
        url:
          process.env.NODE_ENV === "production"
            ? process.env.RAILWAY_PUBLIC_DOMAIN
              ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`
              : "https://your-railway-url.up.railway.app"
            : "http://localhost:8080",
        description:
          process.env.NODE_ENV === "production"
            ? "Production server"
            : "Development server",
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
          description: "Enter your JWT access token from POST /api/auth/login",
        },
      },
      schemas: {
        // ── Success response wrapper ──────────────────────────
        SuccessResponse: {
          type: "object",
          properties: {
            success: { type: "boolean", example: true },
            data: { type: "object" },
          },
        },
        // ── Error response ────────────────────────────────────
        ErrorResponse: {
          type: "object",
          properties: {
            success: { type: "boolean", example: false },
            code: { type: "string", example: "VALIDATION_ERROR" },
            message: { type: "string", example: "Invalid input" },
            errors: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  field: { type: "string", example: "body.email" },
                  message: { type: "string", example: "Must be a valid email" },
                },
              },
            },
          },
        },
        // ── User ─────────────────────────────────────────────
        User: {
          type: "object",
          properties: {
            id: { type: "string", format: "uuid" },
            name: { type: "string", example: "Sara Admin" },
            email: { type: "string", example: "sara@shop.com" },
            role: {
              type: "string",
              enum: ["admin", "manager", "cashier", "warehouse", "viewer"],
            },
            isActive: { type: "boolean", example: true },
            createdAt: { type: "string", format: "date-time" },
          },
        },
        // ── Category ─────────────────────────────────────────
        Category: {
          type: "object",
          properties: {
            id: { type: "string", format: "uuid" },
            name: { type: "string", example: "Cookware" },
            description: { type: "string", nullable: true },
            parentId: { type: "string", format: "uuid", nullable: true },
            parent: { $ref: "#/components/schemas/Category", nullable: true },
            children: {
              type: "array",
              items: { $ref: "#/components/schemas/Category" },
            },
            _count: {
              type: "object",
              properties: {
                products: { type: "integer", example: 5 },
              },
            },
          },
        },
        // ── Supplier ─────────────────────────────────────────
        Supplier: {
          type: "object",
          properties: {
            id: { type: "string", format: "uuid" },
            name: { type: "string", example: "Global Cookware Co." },
            contactPerson: { type: "string", example: "David Mwangi" },
            phone: { type: "string", example: "+254 712 345 678" },
            email: { type: "string", example: "david@globalcookware.com" },
            address: { type: "string", example: "Industrial Area, Nairobi" },
            creditLimit: { type: "string", example: "50000.00" },
            _count: {
              type: "object",
              properties: {
                products: { type: "integer", example: 6 },
              },
            },
          },
        },
        // ── PriceHistory ─────────────────────────────────────
        PriceHistory: {
          type: "object",
          properties: {
            id: { type: "string", format: "uuid" },
            productId: { type: "string", format: "uuid" },
            costPrice: { type: "string", example: "8.50" },
            retailPrice: { type: "string", example: "14.99" },
            wholesalePrice: { type: "string", example: "11.50" },
            effectiveFrom: { type: "string", format: "date-time" },
            note: { type: "string", nullable: true },
            changedBy: {
              type: "object",
              properties: {
                id: { type: "string", format: "uuid" },
                name: { type: "string", example: "Sara Admin" },
              },
            },
          },
        },
        // ── Product ──────────────────────────────────────────
        Product: {
          type: "object",
          properties: {
            id: { type: "string", format: "uuid" },
            name: { type: "string", example: "26cm Non-Stick Frying Pan" },
            sku: { type: "string", example: "PAN-001" },
            barcode: {
              type: "string",
              example: "5012345001234",
              nullable: true,
            },
            description: { type: "string", nullable: true },
            unit: { type: "string", example: "piece" },
            reorderPoint: { type: "string", example: "10" },
            category: {
              type: "object",
              properties: {
                id: { type: "string", format: "uuid" },
                name: { type: "string", example: "Frying Pans" },
              },
            },
            supplier: {
              type: "object",
              properties: {
                id: { type: "string", format: "uuid" },
                name: { type: "string", example: "Global Cookware Co." },
              },
            },
            priceHistory: {
              type: "array",
              items: { $ref: "#/components/schemas/PriceHistory" },
            },
          },
        },
        // ── InventoryItem ────────────────────────────────────
        InventoryItem: {
          type: "object",
          properties: {
            id: { type: "string", format: "uuid" },
            name: { type: "string", example: "26cm Non-Stick Frying Pan" },
            sku: { type: "string", example: "PAN-001" },
            currentStock: { type: "number", example: 47 },
            stockValue: { type: "number", example: 399.5 },
            isLowStock: { type: "boolean", example: false },
            isOutOfStock: { type: "boolean", example: false },
          },
        },
        // ── StockMovement ────────────────────────────────────
        StockMovement: {
          type: "object",
          properties: {
            id: { type: "string", format: "uuid" },
            type: {
              type: "string",
              enum: [
                "purchase",
                "sale",
                "adjustment_in",
                "adjustment_out",
                "return_in",
                "return_out",
              ],
            },
            quantity: { type: "string", example: "10" },
            unitCost: { type: "string", example: "8.50", nullable: true },
            notes: { type: "string", nullable: true },
            referenceId: { type: "string", nullable: true },
            referenceType: { type: "string", nullable: true },
            performedBy: {
              type: "object",
              properties: {
                id: { type: "string", format: "uuid" },
                name: { type: "string", example: "Sara Admin" },
              },
            },
            createdAt: { type: "string", format: "date-time" },
          },
        },
        // ── PurchaseOrder ────────────────────────────────────
        PurchaseOrder: {
          type: "object",
          properties: {
            id: { type: "string", format: "uuid" },
            status: {
              type: "string",
              enum: ["draft", "approved", "received", "cancelled"],
            },
            supplierReference: { type: "string", nullable: true },
            notes: { type: "string", nullable: true },
            expectedAt: { type: "string", format: "date-time", nullable: true },
            receivedAt: { type: "string", format: "date-time", nullable: true },
            approvedAt: { type: "string", format: "date-time", nullable: true },
            supplier: {
              type: "object",
              properties: {
                id: { type: "string", format: "uuid" },
                name: { type: "string", example: "Global Cookware Co." },
              },
            },
            createdBy: {
              type: "object",
              properties: {
                id: { type: "string", format: "uuid" },
                name: { type: "string", example: "Sara Admin" },
              },
            },
            items: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  id: { type: "string", format: "uuid" },
                  quantityOrdered: { type: "string", example: "50" },
                  quantityReceived: { type: "string", example: "50" },
                  unitCost: { type: "string", example: "8.50" },
                  product: {
                    type: "object",
                    properties: {
                      id: { type: "string", format: "uuid" },
                      name: {
                        type: "string",
                        example: "26cm Non-Stick Frying Pan",
                      },
                      sku: { type: "string", example: "PAN-001" },
                    },
                  },
                },
              },
            },
          },
        },
        // ── Customer ─────────────────────────────────────────
        Customer: {
          type: "object",
          properties: {
            id: { type: "string", format: "uuid" },
            name: { type: "string", example: "John Kamau" },
            phone: { type: "string", example: "+254 712 111 222" },
            email: {
              type: "string",
              example: "john@example.com",
              nullable: true,
            },
            type: { type: "string", enum: ["retail", "wholesale"] },
            creditLimit: { type: "string", example: "0.00" },
            _count: {
              type: "object",
              properties: {
                salesOrders: { type: "integer", example: 5 },
              },
            },
          },
        },
        // ── SalesOrder ───────────────────────────────────────
        SalesOrder: {
          type: "object",
          properties: {
            id: { type: "string", format: "uuid" },
            invoiceNumber: { type: "string", example: "INV-0047" },
            type: { type: "string", enum: ["retail", "wholesale"] },
            status: {
              type: "string",
              enum: ["completed", "returned", "partial_return"],
            },
            discount: { type: "string", example: "10" },
            totalAmount: { type: "string", example: "125.90" },
            customer: {
              nullable: true,
              type: "object",
              properties: {
                id: { type: "string", format: "uuid" },
                name: { type: "string", example: "John Kamau" },
              },
            },
            createdBy: {
              type: "object",
              properties: {
                id: { type: "string", format: "uuid" },
                name: { type: "string", example: "James Cashier" },
              },
            },
            items: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  id: { type: "string", format: "uuid" },
                  quantity: { type: "string", example: "2" },
                  unitPrice: { type: "string", example: "14.99" },
                  discountPct: { type: "string", example: "0" },
                  lineTotal: { type: "string", example: "29.98" },
                  product: {
                    type: "object",
                    properties: {
                      id: { type: "string", format: "uuid" },
                      name: {
                        type: "string",
                        example: "26cm Non-Stick Frying Pan",
                      },
                      sku: { type: "string", example: "PAN-001" },
                    },
                  },
                },
              },
            },
          },
        },
        // ── AuditLog ─────────────────────────────────────────
        AuditLog: {
          type: "object",
          properties: {
            id: { type: "string", format: "uuid" },
            action: { type: "string", example: "PRODUCT_PRICE_UPDATED" },
            tableName: { type: "string", nullable: true, example: "products" },
            recordId: { type: "string", nullable: true },
            beforeState: { type: "object", nullable: true },
            afterState: { type: "object", nullable: true },
            ipAddress: { type: "string", example: "::1" },
            createdAt: { type: "string", format: "date-time" },
            user: {
              type: "object",
              properties: {
                id: { type: "string", format: "uuid" },
                name: { type: "string", example: "Sara Admin" },
                email: { type: "string", example: "sara@shop.com" },
              },
            },
          },
        },
      },
      // ── Reusable responses ───────────────────────────────────
      responses: {
        Unauthorized: {
          description: "Authentication required",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/ErrorResponse" },
              example: {
                success: false,
                code: "UNAUTHORIZED",
                message: "Authentication required",
              },
            },
          },
        },
        Forbidden: {
          description: "Insufficient role permissions",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/ErrorResponse" },
              example: {
                success: false,
                code: "FORBIDDEN",
                message: "Requires one of these roles: admin, manager",
              },
            },
          },
        },
        NotFound: {
          description: "Resource not found",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/ErrorResponse" },
              example: {
                success: false,
                code: "NOT_FOUND",
                message: "Resource not found",
              },
            },
          },
        },
        ValidationError: {
          description: "Request validation failed",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/ErrorResponse" },
              example: {
                success: false,
                code: "VALIDATION_ERROR",
                errors: [
                  {
                    field: "body.email",
                    message: "Must be a valid email address",
                  },
                ],
              },
            },
          },
        },
        Conflict: {
          description: "Conflict — duplicate or business rule violation",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/ErrorResponse" },
              example: {
                success: false,
                code: "CONFLICT",
                message: "A record with this value already exists",
              },
            },
          },
        },
      },
    },
    // Apply bearer auth globally (can be overridden per endpoint)
    security: [{ bearerAuth: [] }],
    tags: [
      { name: "Auth", description: "Authentication and session management" },
      { name: "Users", description: "User management (admin only)" },
      { name: "Categories", description: "Product category management" },
      { name: "Suppliers", description: "Supplier management" },
      { name: "Products", description: "Product catalog and pricing" },
      { name: "Inventory", description: "Stock levels and movements" },
      { name: "Purchases", description: "Purchase order workflow" },
      { name: "Sales", description: "Sales orders and POS" },
      { name: "Customers", description: "Customer management" },
      {
        name: "Reports",
        description: "Analytics and reporting (admin/manager)",
      },
      { name: "Audit", description: "Audit log (admin only)" },
    ],
  },
  // Read JSDoc comments from all route files
  apis: ["./src/modules/*/*.routes.ts"],
};

export const swaggerSpec = swaggerJsdoc(options);
