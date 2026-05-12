import { db } from '../../config/database';
import { NotFoundError, ConflictError } from '../../utils/errors';
import { CreateCategoryInput, UpdateCategoryInput } from './categories.schema';

// ─── Get all categories ─────────────────────────────────
// We include children so the frontend can build
// a tree view of the category hierarchy
export async function getAllCategories() {
  return db.category.findMany({
    where: { deletedAt: null },
    include: {
      // Include direct children of each category
      children: {
        where: { deletedAt: null },
      },
      // Include parent info so we know where
      // this category sits in the tree
      parent: true,
    },
    orderBy: { name: 'asc' },
  });
}

// ─── Get single category ────────────────────────────────
export async function getCategoryById(id: string) {
  const category = await db.category.findFirst({
    where: { id, deletedAt: null },
    include: {
      children: { where: { deletedAt: null } },
      parent: true,
      // Count how many products are in this category
      _count: { select: { products: true } },
    },
  });

  if (!category) throw new NotFoundError('Category');
  return category;
}

// ─── Create category ────────────────────────────────────
export async function createCategory(
  data: CreateCategoryInput,
  userId: string,
  ip: string
) {
  // Check for duplicate name
  const existing = await db.category.findFirst({
    where: { name: data.name, deletedAt: null },
  });

  if (existing) {
    throw new ConflictError('A category with this name already exists');
  }

  // If parentId provided, verify the parent exists
  if (data.parentId) {
    const parent = await db.category.findFirst({
      where: { id: data.parentId, deletedAt: null },
    });
    if (!parent) throw new NotFoundError('Parent category');
  }

  const category = await db.$transaction(async (tx) => {
    const newCategory = await tx.category.create({
      data: {
        name: data.name,
        description: data.description,
        parentId: data.parentId,
      },
    });

    await tx.auditLog.create({
      data: {
        userId,
        action: 'CATEGORY_CREATED',
        tableName: 'categories',
        recordId: newCategory.id,
        afterState: { name: newCategory.name },
        ipAddress: ip,
      },
    });

    return newCategory;
  });

  return category;
}

// ─── Update category ────────────────────────────────────
export async function updateCategory(
  id: string,
  data: UpdateCategoryInput,
  userId: string,
  ip: string
) {
  const existing = await db.category.findFirst({
    where: { id, deletedAt: null },
  });

  if (!existing) throw new NotFoundError('Category');

  // Prevent a category from being its own parent —
  // that would create an infinite loop in the tree
  if (data.parentId === id) {
    throw new ConflictError('A category cannot be its own parent');
  }

  const category = await db.$transaction(async (tx) => {
    const updated = await tx.category.update({
      where: { id },
      data: {
        name: data.name,
        description: data.description,
        parentId: data.parentId,
      },
    });

    await tx.auditLog.create({
      data: {
        userId,
        action: 'CATEGORY_UPDATED',
        tableName: 'categories',
        recordId: id,
        beforeState: { name: existing.name },
        afterState: { name: updated.name },
        ipAddress: ip,
      },
    });

    return updated;
  });

  return category;
}

// ─── Soft delete category ───────────────────────────────
export async function deleteCategory(
  id: string,
  userId: string,
  ip: string
) {
  const existing = await db.category.findFirst({
    where: { id, deletedAt: null },
    include: { _count: { select: { products: true } } },
  });

  if (!existing) throw new NotFoundError('Category');

  // Prevent deleting a category that has products
  // Those products would have no category — broken state
  if (existing._count.products > 0) {
    throw new ConflictError(
      `Cannot delete — this category has ${existing._count.products} product(s). Reassign them first.`
    );
  }

  await db.$transaction(async (tx) => {
    await tx.category.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    await tx.auditLog.create({
      data: {
        userId,
        action: 'CATEGORY_DELETED',
        tableName: 'categories',
        recordId: id,
        beforeState: { name: existing.name },
        ipAddress: ip,
      },
    });
  });

  return { message: 'Category deleted successfully' };
}