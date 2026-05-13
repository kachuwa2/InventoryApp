import { db } from '../../config/database';
import { Prisma } from '../../generated/prisma';
import { NotFoundError, ValidationError } from '../../utils/errors';

// ─── Movement type groups ───────────────────────────────
// These are the movement types that ADD stock.
// All other types REMOVE stock.
const INBOUND_TYPES = [
  'purchase',
  'adjustment_in',
  'return_in',
] as const;

const OUTBOUND_TYPES = [
  'sale',
  'adjustment_out',
  'return_out',
] as const;

// ─── Get current stock for one product ─────────────────
// This is the most important function in the system.
// Stock is NEVER stored as a number — it is always
// computed by summing the movement ledger.
//
// Think of it exactly like a bank balance:
// Your bank does not store your balance as one number.
// It stores every transaction and computes the balance
// from them. We do exactly the same thing here.
export async function getCurrentStock(
  productId: string
): Promise<number> {
  // Sum all inbound movements
  const inbound = await db.stockMovement.aggregate({
    where: {
      productId,
      type: { in: [...INBOUND_TYPES] },
    },
    _sum: { quantity: true },
  });

  // Sum all outbound movements
  const outbound = await db.stockMovement.aggregate({
    where: {
      productId,
      type: { in: [...OUTBOUND_TYPES] },
    },
    _sum: { quantity: true },
  });

  const inQty  = Number(inbound._sum.quantity  ?? 0);
  const outQty = Number(outbound._sum.quantity ?? 0);

  // Current stock = everything that came in minus
  // everything that went out. Simple and always accurate.
  return inQty - outQty;
}

// ─── Get stock levels for all products ─────────────────
export async function getAllStockLevels() {
  // Get all active products with their details
  const products = await db.product.findMany({
    where: { deletedAt: null },
    include: {
      category: { select: { id: true, name: true } },
      supplier: { select: { id: true, name: true } },
      // Get current price for valuation
      priceHistory: {
        orderBy: { effectiveFrom: 'desc' },
        take: 1,
      },
    },
    orderBy: { name: 'asc' },
  });

  // For each product, compute its current stock
  // and attach it to the product data
  const stockLevels = await Promise.all(
    products.map(async (product) => {
      const currentStock = await getCurrentStock(product.id);
      const currentPrice = product.priceHistory[0];

      // Stock value = quantity × cost price
      // This is what the inventory is worth at cost
      const stockValue = currentPrice
        ? currentStock * Number(currentPrice.costPrice)
        : 0;

      return {
        ...product,
        currentStock,
        stockValue: Math.round(stockValue * 100) / 100,
        // Is the stock below the reorder point?
        // If yes, the manager needs to order more
        isLowStock: currentStock <= Number(product.reorderPoint),
        // Is the product completely out of stock?
        isOutOfStock: currentStock <= 0,
      };
    })
  );

  return stockLevels;
}

// ─── Get low stock products ─────────────────────────────
// Returns only products that need reordering
export async function getLowStockProducts() {
  const allStock = await getAllStockLevels();
  return allStock.filter(p => p.isLowStock);
}

// ─── Get movement history for one product ──────────────
export async function getProductMovements(productId: string) {
  // Verify product exists first
  const product = await db.product.findFirst({
    where: { id: productId, deletedAt: null },
  });
  if (!product) throw new NotFoundError('Product');

  const movements = await db.stockMovement.findMany({
    where: { productId },
    include: {
      performedBy: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  const currentStock = await getCurrentStock(productId);

  return { product, movements, currentStock };
}

// ─── Manual stock adjustment ────────────────────────────
// Used when a physical stock count reveals a discrepancy,
// or when items are damaged, expired, or lost.
// Every adjustment MUST have a reason — this is a business
// rule. You cannot silently change stock numbers.
export async function adjustStock(
  data: {
    productId:  string;
    quantity:   number;
    type:       'adjustment_in' | 'adjustment_out';
    notes:      string;
    unitCost?:  number;
  },
  userId: string,
  ip: string
) {
  // Verify product exists
  const product = await db.product.findFirst({
    where: { id: data.productId, deletedAt: null },
  });
  if (!product) throw new NotFoundError('Product');

  if (data.quantity <= 0) {
    throw new ValidationError('Quantity must be greater than zero');
  }

  // Notes are mandatory for adjustments.
  // "I reduced stock by 5" is useless without knowing why.
  // "5 units damaged in storage — cracked handles" is useful.
  if (!data.notes || data.notes.trim().length < 5) {
    throw new ValidationError(
      'Please provide a clear reason for this adjustment (minimum 5 characters)'
    );
  }

  // If removing stock, make sure there is enough to remove.
  // You cannot have negative stock — that's a physical impossibility.
  if (data.type === 'adjustment_out') {
    const currentStock = await getCurrentStock(data.productId);
    if (data.quantity > currentStock) {
      throw new ValidationError(
        `Cannot remove ${data.quantity} units — only ${currentStock} in stock`
      );
    }
  }

  return db.$transaction(async (tx) => {
    const movement = await tx.stockMovement.create({
      data: {
        productId:    data.productId,
        type:         data.type,
        quantity:     data.quantity,
        unitCost:     data.unitCost,
        notes:        data.notes,
        referenceType: 'manual_adjustment',
        performedById: userId,
      },
    });

    await tx.auditLog.create({
      data: {
        userId,
        action:    data.type === 'adjustment_in'
          ? 'STOCK_ADJUSTED_IN'
          : 'STOCK_ADJUSTED_OUT',
        tableName: 'stock_movements',
        recordId:  movement.id,
        afterState: {
          productId: data.productId,
          quantity:  data.quantity,
          type:      data.type,
          notes:     data.notes,
        },
        ipAddress: ip,
      },
    });

    return movement;
  });
}

// ─── Get inventory valuation ────────────────────────────
// Total value of all stock at cost price.
// This is what you would need to replace everything
// you currently have in the warehouse.
export async function getInventoryValuation() {
  const stockLevels = await getAllStockLevels();

  const totalValue = stockLevels.reduce(
    (sum, product) => sum + product.stockValue,
    0
  );

  const byCategory = stockLevels.reduce(
    (acc, product) => {
      const categoryName = product.category.name;
      if (!acc[categoryName]) {
        acc[categoryName] = { totalValue: 0, productCount: 0 };
      }
      acc[categoryName].totalValue     += product.stockValue;
      acc[categoryName].productCount   += 1;
      return acc;
    },
    {} as Record<string, { totalValue: number; productCount: number }>
  );

  return {
    totalValue:   Math.round(totalValue * 100) / 100,
    productCount: stockLevels.length,
    byCategory,
    products:     stockLevels,
  };
}