# Contributing to Inventory Management System

Thank you for your interest in contributing! This document provides guidelines and instructions for contributing to the project.

## Code of Conduct

We are committed to providing a welcoming and inclusive environment for all contributors. Please treat others with respect and professionalism.

## Getting Started

### Prerequisites

- Node.js 18+ and npm 8+
- PostgreSQL 12+
- Git

### Development Setup

1. Fork the repository
2. Clone your fork:
   ```bash
   git clone https://github.com/yourusername/inventory_system.git
   cd inventory_system
   ```

3. Create a feature branch:
   ```bash
   git checkout -b feature/your-feature-name
   ```

4. Set up development environment:
   ```bash
   npm install
   cp .env.example .env
   # Edit .env with your local database credentials
   npx prisma migrate dev --name init
   npm run dev
   ```

## Making Changes

### Code Style

- **Language**: TypeScript with strict mode
- **Naming**: Use camelCase for variables/functions, PascalCase for classes/types
- **Files**: Use pattern `module.purpose.ts` (e.g., `auth.controller.ts`)
- **Imports**: Use relative paths from src root

### Module Structure

When adding features, follow the standard module pattern:

```
modules/feature-name/
├── feature-name.schema.ts      # Zod validation schemas
├── feature-name.service.ts     # Business logic
├── feature-name.controller.ts  # HTTP handlers
└── feature-name.routes.ts      # Route definitions
```

### Database Changes

For database schema changes:

1. Update `prisma/schema.prisma`
2. Create a migration:
   ```bash
   npx prisma migrate dev --name description_of_changes
   ```
3. Test the migration locally
4. Commit both schema and migration files

### Error Handling

- Always use custom `AppError` subclasses
- Throw appropriate errors: `UnauthorizedError`, `ForbiddenError`, `NotFoundError`, `ConflictError`
- Never expose internal errors to clients

### Database Patterns

- Wrap all write operations in `db.$transaction()`
- Use `connect` syntax for relations: `{ connect: { id: userId } }`
- Always include soft delete checks: `WHERE deletedAt IS NULL`
- Append-only for prices and stock movements (never update)

### Validation

- Always validate input with Zod schemas
- Use `z.email()` NOT `z.string().email()`
- Use `z.uuid()` NOT `z.string().uuid()`

### Comments

Add JSDoc comments for public functions:

```typescript
/**
 * Creates a new product with initial price history.
 * 
 * @param input - Product creation input
 * @param userId - ID of user creating the product
 * @returns Created product with price history
 * @throws NotFoundError if category or supplier doesn't exist
 */
export async function createProduct(input: CreateProductInput, userId: string): Promise<Product> {
  // Implementation
}
```

## Testing

While automated tests aren't currently set up, please:

1. Test all new endpoints manually via HTTP requests
2. Verify edge cases (invalid inputs, missing resources, permission checks)
3. Check database state after operations (use `npx prisma studio`)

## Committing Changes

### Commit Messages

Follow conventional commits:

```
feat: add new feature
fix: fix a bug
docs: update documentation
refactor: refactor code
chore: update dependencies
```

Examples:
```
feat(products): add price history tracking
fix(auth): prevent timing attacks in password comparison
docs(api): update endpoint documentation
refactor(inventory): simplify stock calculation
```

### Commit Process

```bash
# Stage changes
git add .

# Commit with clear message
git commit -m "feat(module): description of changes"

# Push to your fork
git push origin feature/your-feature-name
```

## Submitting Changes

1. Push your branch to your fork
2. Open a Pull Request to the main branch
3. Fill out the PR template with:
   - Description of changes
   - Type of change (feat/fix/docs/refactor)
   - Related issues
   - Testing instructions
   - Screenshots (if UI changes)

### PR Guidelines

- Keep PRs focused on a single feature/fix
- Include tests or manual testing steps
- Update documentation as needed
- Request review from maintainers

## Documentation

When adding features, update relevant documentation:

- `SPECS/API_SPEC.md` - For new endpoints
- `SPECS/DATABASE_SPEC.md` - For schema changes
- `SPECS/ARCHITECTURE_SPEC.md` - For architectural changes
- `README.md` - For major features

## Reporting Issues

### Bug Reports

Include:
- Clear title describing the bug
- Steps to reproduce
- Expected behavior
- Actual behavior
- Environment (OS, Node version, npm version)
- Relevant logs/screenshots

### Feature Requests

Include:
- Clear description of the feature
- Use case and benefits
- Proposed implementation (if any)
- Related features or alternatives

## Questions?

- Open a GitHub issue for questions
- Check existing documentation in [SPECS](SPECS/)
- Review similar code patterns in the codebase

## License

By contributing, you agree that your contributions will be licensed under the MIT License.

---

Thank you for contributing to make Inventory Management System better! 🎉
