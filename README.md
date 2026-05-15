# Inventory Management System

> A comprehensive wholesale and retail kitchen utensils inventory management platform with real-time stock tracking, purchase order workflows, point-of-sale integration, and business analytics.

[![Node.js](https://img.shields.io/badge/Node.js-18+-green?style=flat-square)](https://nodejs.org/)
[![Express](https://img.shields.io/badge/Express-5.2-blue?style=flat-square)](https://expressjs.com/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-12+-336791?style=flat-square)](https://www.postgresql.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-6.0-3178c6?style=flat-square)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)

## Features

- **🔐 Secure Authentication** - JWT-based authentication with 15-minute access tokens and 7-day refresh tokens
- **👥 Role-Based Access Control** - 5-tier permission system (admin, manager, cashier, warehouse, viewer)
- **📦 Product Management** - SKU/barcode tracking, hierarchical categories, multi-tiered pricing
- **📊 Inventory Tracking** - Real-time stock levels computed from immutable movement ledgers
- **🛒 Purchase Orders** - Complete workflow from draft to receiving with partial shipment support
- **💳 Point-of-Sale** - Retail and wholesale sales processing with customer management
- **📈 Business Analytics** - Dashboard KPIs, profit/loss reporting, product performance analysis
- **📋 Audit Logging** - Comprehensive immutable audit trail of all actions
- **💰 Financial Precision** - Decimal-based money handling (no floating-point errors)

## Tech Stack

| Layer | Technology |
|-------|------------|
| **Runtime** | Node.js (LTS) |
| **Language** | TypeScript 6.0.3 |
| **Framework** | Express 5.2.1 |
| **Database** | PostgreSQL 12+ |
| **ORM** | Prisma 7.8.0 |
| **Validation** | Zod 4.4.2 |
| **Authentication** | JWT + bcryptjs |

## Quick Start

### Prerequisites

- Node.js 18+ and npm 8+
- PostgreSQL 12+ running locally
- Git

### Installation

```bash
# Clone repository
git clone https://github.com/yourusername/inventory_system.git
cd inventory_system

# Install dependencies
npm install

# Configure environment
cp .env.example .env
# Edit .env with your database credentials

# Initialize database
npx prisma migrate dev --name init

# Start development server
npm run dev
```

Server runs on `http://localhost:3000`

### Verify Installation

```bash
curl http://localhost:3000/health
```

## Development

```bash
# Start with hot reload
npm run dev

# Build for production
npm run build

# Run production build
npm start

# Open database browser
npx prisma studio --config prisma.config.mjs

# Create new migration
npx prisma migrate dev --name description_of_changes
```

## Project Structure

```
inventory_system/
├── src/
│   ├── app.ts                  # Express app setup
│   ├── server.ts               # Server entry point
│   ├── config/database.ts      # Database initialization
│   ├── middleware/             # Authentication, validation, error handling
│   ├── modules/                # Feature modules (9 total)
│   │   ├── auth/              # User authentication
│   │   ├── products/          # Product catalog
│   │   ├── inventory/         # Stock tracking
│   │   ├── purchases/         # Purchase orders
│   │   ├── sales/             # Point-of-sale
│   │   └── ... (4 more modules)
│   ├── types/                  # TypeScript type definitions
│   └── utils/                  # Helper utilities
├── prisma/
│   ├── schema.prisma           # Database schema
│   └── migrations/             # Migration history
├── SPECS/                      # Complete documentation
│   ├── PROJECT_SPEC.md         # Project overview
│   ├── DATABASE_SPEC.md        # Database schema details
│   ├── API_SPEC.md             # Complete API reference
│   └── ARCHITECTURE_SPEC.md    # System architecture
├── tsconfig.json              # TypeScript configuration
├── package.json               # Dependencies
└── .env                       # Environment variables (not in git)
```

## API Endpoints Overview

### 9 Modules with 35+ Endpoints

- **Authentication** - Register, login, token refresh, logout
- **Categories** - Hierarchical product categories
- **Suppliers** - Supplier relationships and credit tracking
- **Products** - SKU/barcode management, multi-tiered pricing
- **Inventory** - Real-time stock levels, movement history
- **Purchases** - Order workflows (draft → approved → received)
- **Customers** - Retail and wholesale customer management
- **Sales** - Point-of-sale order processing
- **Reports** - Dashboard, P&L, product analytics

For complete API documentation, see [SPECS/API_SPEC.md](SPECS/API_SPEC.md)

## Database Architecture

### Append-Only Ledgers

- **Stock Movements**: Immutable transaction ledger - stock computed from movements, never stored
- **Price History**: Append-only pricing changes - ensures historical accuracy
- **Audit Logs**: Complete action trail with before/after snapshots

### Soft Deletes

All data is soft-deleted (marked with `deletedAt`), ensuring:
- No accidental data loss
- Complete audit trail
- Easy recovery if needed

### Financial Precision

All monetary values stored as `Decimal(12,2)` to prevent floating-point errors:
- 12 total digits, 2 decimal places
- Range: -999,999,999.99 to 999,999,999.99

For complete database documentation, see [SPECS/DATABASE_SPEC.md](SPECS/DATABASE_SPEC.md)

## Security Features

- **Password Hashing**: bcryptjs with 12-round salt
- **JWT Tokens**: Secure short-lived access tokens + long-lived refresh tokens
- **Role-Based Authorization**: Granular permission system
- **Input Validation**: Zod schema validation on all endpoints
- **Audit Logging**: Every action logged with user, IP, user agent, before/after state
- **Transaction Safety**: All database writes wrapped in transactions

## Configuration

### Environment Variables

```bash
# Database
DATABASE_URL="postgresql://user:password@localhost:5432/inventory_db"

# Server
NODE_ENV=development
PORT=3000

# Authentication
JWT_SECRET="your-super-secret-key-min-32-characters"
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d
```

## Documentation

Complete documentation is available in the [SPECS](SPECS/) directory:

- [README.md](SPECS/README.md) - Documentation index
- [PROJECT_SPEC.md](SPECS/PROJECT_SPEC.md) - Project goals, setup, architecture
- [DATABASE_SPEC.md](SPECS/DATABASE_SPEC.md) - Complete schema documentation
- [API_SPEC.md](SPECS/API_SPEC.md) - Full REST API reference (35+ endpoints)
- [ARCHITECTURE_SPEC.md](SPECS/ARCHITECTURE_SPEC.md) - System design and patterns

## Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes with clear messages
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## Code Standards

- **Language**: TypeScript with strict mode enabled
- **Style**: Consistent formatting with clear variable names
- **Modules**: Schema → Service → Controller → Routes pattern
- **Errors**: Custom AppError hierarchy with consistent response format
- **Database**: Transactions for all writes, soft deletes for all deletions

## Performance Considerations

- PostgreSQL connection pooling for efficient database access
- Indexed foreign keys and frequently-queried fields
- Computed stock from ledger (no sync issues)
- Type-safe validation with Zod

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Support

For issues, questions, or suggestions:

- Open an issue on GitHub
- Check existing documentation in [SPECS](SPECS/)
- Review API examples in [SPECS/API_SPEC.md](SPECS/API_SPEC.md)

## Roadmap

- [ ] Barcode generation and thermal printing
- [ ] Mobile application
- [ ] Multi-warehouse support
- [ ] Advanced forecasting and demand planning
- [ ] Integration with external accounting software
- [ ] Real-time WebSocket updates
- [ ] Rate limiting and advanced caching
- [ ] Docker containerization

---

**Built with ❤️ for efficient inventory management**
