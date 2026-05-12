import { db } from '../../config/database';
import { NotFoundError, ConflictError } from '../../utils/errors';
import { CreateSupplierInput, UpdateSupplierInput } from './suppliers.schema';

// ─── Get all suppliers ──────────────────────────────────
export async function getAllSuppliers() {
  return db.supplier.findMany({
    where: { deletedAt: null },
    // _count tells us how many products each supplier
    // provides without loading all the product data —
    // much more efficient than fetching the full list
    include: {
      _count: { select: { products: true } },
    },
    orderBy: { name: 'asc' },
  });
}

// ─── Get single supplier ────────────────────────────────
export async function getSupplierById(id: string) {
  const supplier = await db.supplier.findFirst({
    where: { id, deletedAt: null },
    include: {
      _count: { select: { products: true } },
      // Include the first 10 products for a preview —
      // a full product list has its own endpoint
      products: {
        where: { deletedAt: null },
        take: 10,
        select: {
          id: true,
          name: true,
          sku: true,
        },
      },
    },
  });

  if (!supplier) throw new NotFoundError('Supplier');
  return supplier;
}

// ─── Create supplier ────────────────────────────────────
export async function createSupplier(
  data: CreateSupplierInput,
  userId: string,
  ip: string
) {
  // Two suppliers with the same name is almost certainly
  // a mistake — warn the user rather than creating a duplicate
  const existing = await db.supplier.findFirst({
    where: { name: data.name, deletedAt: null },
  });

  if (existing) {
    throw new ConflictError('A supplier with this name already exists');
  }

  return db.$transaction(async (tx) => {
    const supplier = await tx.supplier.create({
      data: {
        name:          data.name,
        contactPerson: data.contactPerson,
        phone:         data.phone,
        email:         data.email,
        address:       data.address,
        // Prisma's Decimal type expects a number here.
        // We store money as Decimal(12,2) in PostgreSQL
        // to avoid floating point precision errors.
        creditLimit:   data.creditLimit ?? 0,
      },
    });

    await tx.auditLog.create({
      data: {
        userId,
        action:     'SUPPLIER_CREATED',
        tableName:  'suppliers',
        recordId:   supplier.id,
        afterState: {
          name:        supplier.name,
          creditLimit: supplier.creditLimit,
        },
        ipAddress: ip,
      },
    });

    return supplier;
  });
}

// ─── Update supplier ────────────────────────────────────
export async function updateSupplier(
  id: string,
  data: UpdateSupplierInput,
  userId: string,
  ip: string
) {
  const existing = await db.supplier.findFirst({
    where: { id, deletedAt: null },
  });

  if (!existing) throw new NotFoundError('Supplier');

  return db.$transaction(async (tx) => {
    const updated = await tx.supplier.update({
      where: { id },
      data: {
        name:          data.name,
        contactPerson: data.contactPerson,
        phone:         data.phone,
        email:         data.email,
        address:       data.address,
        creditLimit:   data.creditLimit,
      },
    });

    await tx.auditLog.create({
      data: {
        userId,
        action:      'SUPPLIER_UPDATED',
        tableName:   'suppliers',
        recordId:    id,
        // beforeState records what the data looked like
        // BEFORE the change — essential for audit trails
        beforeState: {
          name:        existing.name,
          creditLimit: existing.creditLimit,
        },
        afterState: {
          name:        updated.name,
          creditLimit: updated.creditLimit,
        },
        ipAddress: ip,
      },
    });

    return updated;
  });
}

// ─── Soft delete supplier ───────────────────────────────
export async function deleteSupplier(
  id: string,
  userId: string,
  ip: string
) {
  const existing = await db.supplier.findFirst({
    where: { id, deletedAt: null },
    include: { _count: { select: { products: true } } },
  });

  if (!existing) throw new NotFoundError('Supplier');

  // Business rule — you cannot delete a supplier that
  // still has active products. Those products need a
  // supplier for purchase orders to work correctly.
  // The manager must reassign or delete those products first.
  if (existing._count.products > 0) {
    throw new ConflictError(
      `Cannot delete — this supplier has ${existing._count.products} active product(s). Reassign them first.`
    );
  }

  return db.$transaction(async (tx) => {
    await tx.supplier.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    await tx.auditLog.create({
      data: {
        userId,
        action:      'SUPPLIER_DELETED',
        tableName:   'suppliers',
        recordId:    id,
        beforeState: { name: existing.name },
        ipAddress:   ip,
      },
    });
  }).then(() => ({ message: 'Supplier deleted successfully' }));
}