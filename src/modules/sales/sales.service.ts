import { db } from '../../config/database';
import { Prisma } from '../../generated/prisma';
import {
  NotFoundError,
  ValidationError,
} from '../../utils/errors';
import { CreateSaleInput } from './sales.schema';
import { getCurrentStock } from '../inventory/inventory.service';
import { getCurrentPrice } from '../products/products.service';

// ─── Get all sales ──────────────────────────────────────
export async function getAllSales(filters?: {
  customerId?: string;
  type?:       string;
}) {
  return db.salesOrder.findMany({
    where: {
      ...(filters?.customerId && { customerId: filters.customerId }),
      ...(filters?.type       && { type: filters.type as any }),
    },
    include: {
      customer:  { select: { id: true, name: true, type: true } },
      createdBy: { select: { id: true, name: true } },
      _count:    { select: { items: true } },
    },
    orderBy: { createdAt: 'desc' },
  });
}

// ─── Get single sale ────────────────────────────────────
export async function getSaleById(id: string) {
  const sale = await db.salesOrder.findFirst({
    where: { id },
    include: {
      customer:  true,
      createdBy: { select: { id: true, name: true } },
      items: {
        include: {
          product: {
            select: { id: true, name: true, sku: true, unit: true },
          },
        },
      },
    },
  });

  if (!sale) throw new NotFoundError('Sale');
  return sale;
}

// ─── Create sale ────────────────────────────────────────
// This is the POS checkout function.
// Everything that happens when a cashier
// processes a sale happens here.
export async function createSale(
  data: CreateSaleInput,
  userId: string,
  ip: string
) {
  // Verify customer exists if one was provided
  if (data.customerId) {
    const customer = await db.customer.findFirst({
      where: { id: data.customerId, deletedAt: null },
    });
    if (!customer) throw new NotFoundError('Customer');
  }

  // Default values — handle undefined safely
  const saleType     = data.type     ?? 'retail';
  const saleDiscount = data.discount ?? 0;

  const resolvedItems: {
    product:     { id: string; name: string };
    unitPrice:   number;
    quantity:    number;
    discountPct: number;
    lineTotal:   number;
  }[] = [];

  for (const item of data.items) {
    const product = await db.product.findFirst({
      where: { id: item.productId, deletedAt: null },
    });
    if (!product) throw new NotFoundError(`Product ${item.productId}`);

    const currentPrice = await getCurrentPrice(item.productId);
    if (!currentPrice) {
      throw new ValidationError(
        `Product "${product.name}" has no price set. Set a price before selling.`
      );
    }

    // Choose retail or wholesale price based on sale type
    const unitPrice = saleType === 'wholesale'
      ? Number(currentPrice.wholesalePrice)
      : Number(currentPrice.retailPrice);

    // Check sufficient stock
    const currentStock = await getCurrentStock(item.productId);
    if (item.quantity > currentStock) {
      throw new ValidationError(
        `Insufficient stock for "${product.name}". ` +
        `Requested: ${item.quantity}, Available: ${currentStock}`
      );
    }

    const itemDiscount = item.discountPct ?? 0;
    const discountMultiplier = 1 - (itemDiscount / 100);
    const lineTotal = Math.round(
      unitPrice * item.quantity * discountMultiplier * 100
    ) / 100;

    resolvedItems.push({
      product:     { id: product.id, name: product.name },
      unitPrice,
      quantity:    item.quantity,
      discountPct: itemDiscount,
      lineTotal,
    });
  }

  // Calculate order total with order-level discount
  const subtotal = resolvedItems.reduce(
    (sum, item) => sum + item.lineTotal, 0
  );
  const orderDiscountMultiplier = 1 - (saleDiscount / 100);
  const totalAmount = Math.round(
    subtotal * orderDiscountMultiplier * 100
  ) / 100;

  return db.$transaction(async (tx) => {
    // Prisma 7 requires explicit connect for relation fields
    // when using scalar foreign key fields together
    const sale = await tx.salesOrder.create({
      data: {
        type:        saleType as any,
        status:      'completed',
        discount:    saleDiscount,
        totalAmount,
        notes:       data.notes,
        // Prisma 7 — use connect for relations
        createdBy: {
          connect: { id: userId },
        },
        // Only connect customer if one was provided
        ...(data.customerId && {
          customer: {
            connect: { id: data.customerId },
          },
        }),
      },
    });

    for (const item of resolvedItems) {
      await tx.salesOrderItem.create({
        data: {
          salesOrder: { connect: { id: sale.id } },
          product:    { connect: { id: item.product.id } },
          quantity:    item.quantity,
          unitPrice:   item.unitPrice,
          discountPct: item.discountPct,
          lineTotal:   item.lineTotal,
        },
      });

      await tx.stockMovement.create({
        data: {
          product:      { connect: { id: item.product.id } },
          type:         'sale',
          quantity:     item.quantity,
          referenceId:  sale.id,
          referenceType: 'sales_order',
          notes:        `Sold via order ${sale.id}`,
          performedBy:  { connect: { id: userId } },
        },
      });
    }

    await tx.auditLog.create({
      data: {
        user:      { connect: { id: userId } },
        action:    'SALE_CREATED',
        tableName: 'sales_orders',
        recordId:  sale.id,
        afterState: {
          type:       saleType,
          totalAmount,
          itemCount:  resolvedItems.length,
          customerId: data.customerId,
        },
        ipAddress: ip,
      },
    });

    return sale;
  });
}

// ─── Get daily sales summary ────────────────────────────
export async function getDailySummary() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const sales = await db.salesOrder.findMany({
    where: {
      createdAt: {
        gte: today,
        lt:  tomorrow,
      },
    },
    include: {
      _count: { select: { items: true } },
    },
  });

  const totalRevenue = sales.reduce(
    (sum, sale) => sum + Number(sale.totalAmount), 0
  );

  const retailSales = sales.filter(s => s.type === 'retail');
  const wholesaleSales = sales.filter(s => s.type === 'wholesale');

  return {
    date:           today.toISOString().split('T')[0],
    totalOrders:    sales.length,
    totalRevenue:   Math.round(totalRevenue * 100) / 100,
    retailOrders:   retailSales.length,
    wholesaleOrders: wholesaleSales.length,
    retailRevenue:  Math.round(
      retailSales.reduce((s, o) => s + Number(o.totalAmount), 0) * 100
    ) / 100,
    wholesaleRevenue: Math.round(
      wholesaleSales.reduce((s, o) => s + Number(o.totalAmount), 0) * 100
    ) / 100,
  };
}