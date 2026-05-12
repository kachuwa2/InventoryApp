import { db } from '../../config/database';
import { Prisma } from '../../generated/prisma';
import { NotFoundError, ConflictError } from '../../utils/errors';
import {
  CreateProductInput,
  UpdateProductInput,
  UpdatePriceInput,
} from './products.schema';

// ─── Helper: get current price ──────────────────────────
// This is one of the most important helpers in the system.
// Given a product ID, it finds the most recent price history
// record — the one with the latest effectiveFrom timestamp.
// This is what "current price" means in an append-only system.
export async function getCurrentPrice(productId: string) {
  return db.productPriceHistory.findFirst({
    where: { productId },
    orderBy: { effectiveFrom: 'desc' },
  });
}

// ─── Get all products ───────────────────────────────────
export async function getAllProducts(filters?: {
  categoryId?: string;
  supplierId?: string;
  search?: string;
}) {
  const products = await db.product.findMany({
    where: {
      deletedAt: null,
      // If categoryId filter is provided, only return
      // products in that category — otherwise return all
      ...(filters?.categoryId && { categoryId: filters.categoryId }),
      ...(filters?.supplierId && { supplierId: filters.supplierId }),
      // If search is provided, do a case-insensitive search
      // across name, SKU, and barcode simultaneously.
      // This is how the POS barcode lookup works —
      // the cashier scans and we search all three fields.
      ...(filters?.search && {
        OR: [
          { name:    { contains: filters.search, mode: 'insensitive' } },
          { sku:     { contains: filters.search, mode: 'insensitive' } },
          { barcode: { contains: filters.search, mode: 'insensitive' } },
        ],
      }),
    },
    include: {
      category: { select: { id: true, name: true } },
      supplier: { select: { id: true, name: true } },
      // We include only the most recent price history record
      // so the response always shows the current prices.
      priceHistory: {
        orderBy: { effectiveFrom: 'desc' },
        take: 1,
      },
    },
    orderBy: { name: 'asc' },
  });

  return products;
}

// ─── Get single product ─────────────────────────────────
export async function getProductById(id: string) {
  const product = await db.product.findFirst({
    where: { id, deletedAt: null },
    include: {
      category: true,
      supplier: { select: { id: true, name: true, phone: true } },
      // For the detail view we include ALL price history
      // so the manager can see the full price timeline
      priceHistory: {
        orderBy: { effectiveFrom: 'desc' },
        include: {
          changedBy: { select: { id: true, name: true } },
        },
      },
    },
  });

  if (!product) throw new NotFoundError('Product');
  return product;
}

// ─── Get product by barcode ─────────────────────────────
// This is the POS critical path — called every time
// a cashier scans a product. It must be fast.
export async function getProductByBarcode(barcode: string) {
  const product = await db.product.findFirst({
    where: { barcode, deletedAt: null },
    include: {
      category: { select: { id: true, name: true } },
      // Only the latest price — the cashier needs to know
      // the current selling price, not the history
      priceHistory: {
        orderBy: { effectiveFrom: 'desc' },
        take: 1,
      },
    },
  });

  if (!product) throw new NotFoundError('Product with this barcode');
  return product;
}

// ─── Create product ─────────────────────────────────────
export async function createProduct(
  data: CreateProductInput,
  userId: string,
  ip: string
) {
  // Check SKU uniqueness — two products cannot share an SKU
  const existingSku = await db.product.findFirst({
    where: { sku: data.sku, deletedAt: null },
  });
  if (existingSku) {
    throw new ConflictError(`SKU "${data.sku}" is already in use`);
  }

  // Check barcode uniqueness if one was provided
  if (data.barcode) {
    const existingBarcode = await db.product.findFirst({
      where: { barcode: data.barcode, deletedAt: null },
    });
    if (existingBarcode) {
      throw new ConflictError(`Barcode "${data.barcode}" is already in use`);
    }
  }

  // Verify category exists
  const category = await db.category.findFirst({
    where: { id: data.categoryId, deletedAt: null },
  });
  if (!category) throw new NotFoundError('Category');

  // Verify supplier exists
  const supplier = await db.supplier.findFirst({
    where: { id: data.supplierId, deletedAt: null },
  });
  if (!supplier) throw new NotFoundError('Supplier');

  // Everything is valid — now create the product AND
  // its first price history record together in one transaction.
  // If either fails, neither is saved.
  return db.$transaction(async (tx) => {
    const product = await tx.product.create({
      data: {
        name:         data.name,
        sku:          data.sku,
        barcode:      data.barcode,
        description:  data.description,
        unit:         data.unit,
        reorderPoint: data.reorderPoint,
        categoryId:   data.categoryId,
        supplierId:   data.supplierId,
      },
    });

    // The very first price record — this is the starting
    // point of the product's price history timeline
    await tx.productPriceHistory.create({
      data: {
        productId:      product.id,
        costPrice:      data.costPrice,
        retailPrice:    data.retailPrice,
        wholesalePrice: data.wholesalePrice,
        changedById:    userId,
        note:           data.priceNote ?? 'Initial price set at product creation',
      },
    });

    await tx.auditLog.create({
      data: {
        userId,
        action:     'PRODUCT_CREATED',
        tableName:  'products',
        recordId:   product.id,
        afterState: {
          name:          product.name,
          sku:           product.sku,
          costPrice:     data.costPrice,
          retailPrice:   data.retailPrice,
          wholesalePrice: data.wholesalePrice,
        },
        ipAddress: ip,
      },
    });

    return product;
  });
}

// ─── Update product ─────────────────────────────────────
// Note: prices are NOT updated here.
// Prices have their own dedicated endpoint — updatePrice().
// This separation enforces the rule that price changes
// always go through the history log, never a silent update.
export async function updateProduct(
  id: string,
  data: UpdateProductInput,
  userId: string,
  ip: string
) {
  const existing = await db.product.findFirst({
    where: { id, deletedAt: null },
  });
  if (!existing) throw new NotFoundError('Product');

  return db.$transaction(async (tx) => {
    const updated = await tx.product.update({
      where: { id },
      data: {
        name:         data.name,
        description:  data.description,
        unit:         data.unit,
        reorderPoint: data.reorderPoint,
        categoryId:   data.categoryId,
        supplierId:   data.supplierId,
      },
    });

    await tx.auditLog.create({
      data: {
        userId,
        action:      'PRODUCT_UPDATED',
        tableName:   'products',
        recordId:    id,
        beforeState: { name: existing.name, sku: existing.sku },
        afterState:  { name: updated.name,  sku: updated.sku  },
        ipAddress:   ip,
      },
    });

    return updated;
  });
}

// ─── Update price ───────────────────────────────────────
// This is the ONLY way prices should ever be changed.
// It inserts a new record into product_price_history —
// the old price records are never touched.
export async function updatePrice(
  productId: string,
  data: UpdatePriceInput,
  userId: string,
  ip: string
) {
  const product = await db.product.findFirst({
    where: { id: productId, deletedAt: null },
  });
  if (!product) throw new NotFoundError('Product');

  // Get the current price so we can store it as beforeState
  const currentPrice = await getCurrentPrice(productId);

  return db.$transaction(async (tx) => {
    // INSERT a new price record — never UPDATE the old one
    const newPrice = await tx.productPriceHistory.create({
      data: {
        productId,
        costPrice:      data.costPrice,
        retailPrice:    data.retailPrice,
        wholesalePrice: data.wholesalePrice,
        changedById:    userId,
        note:           data.note,
      },
    });

    await tx.auditLog.create({
      data: {
        userId,
        action:    'PRODUCT_PRICE_UPDATED',
        tableName: 'product_price_history',
        recordId:  productId,
       beforeState: currentPrice
  ? {
      costPrice:      currentPrice.costPrice.toString(),
      retailPrice:    currentPrice.retailPrice.toString(),
      wholesalePrice: currentPrice.wholesalePrice.toString(),
    }
  : Prisma.JsonNull,
        afterState: {
          costPrice:      data.costPrice,
          retailPrice:    data.retailPrice,
          wholesalePrice: data.wholesalePrice,
          note:           data.note,
        },
        ipAddress: ip,
      },
    });

    return newPrice;
  });
}

// ─── Soft delete product ────────────────────────────────
export async function deleteProduct(
  id: string,
  userId: string,
  ip: string
) {
  const existing = await db.product.findFirst({
    where: { id, deletedAt: null },
  });
  if (!existing) throw new NotFoundError('Product');

  return db.$transaction(async (tx) => {
    await tx.product.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    await tx.auditLog.create({
      data: {
        userId,
        action:      'PRODUCT_DELETED',
        tableName:   'products',
        recordId:    id,
        beforeState: { name: existing.name, sku: existing.sku },
        ipAddress:   ip,
      },
    });
  }).then(() => ({ message: 'Product deleted successfully' }));
}