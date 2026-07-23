import { db } from '../../config/database';
import { getCurrentStock } from '../inventory/inventory.service';

// ─── Dashboard KPIs ─────────────────────────────────────
export async function getDashboardKPIs() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const thisMonthStart = new Date(today.getFullYear(), today.getMonth(), 1);

  const [
    todaySales,
    monthSales,
    totalProducts,
    lowStockCount,
    pendingPOs,
    recentActivity,
  ] = await Promise.all([
    db.salesOrder.aggregate({
      where: { createdAt: { gte: today, lt: tomorrow } },
      _sum:   { totalAmount: true },
      _count: { id: true },
    }),
    db.salesOrder.aggregate({
      where: { createdAt: { gte: thisMonthStart } },
      _sum:   { totalAmount: true },
      _count: { id: true },
    }),
    db.product.count({ where: { deletedAt: null } }),
    db.product.findMany({
      where: { deletedAt: null },
      select: { id: true, name: true, reorderPoint: true },
    }),
    db.purchaseOrder.count({
      where: { status: { in: ['draft', 'approved'] } },
    }),
    db.auditLog.findMany({
      take:    10,
      orderBy: { createdAt: 'desc' },
      where: {
        action: {
          in: [
            'SALE_CREATED',
            'PURCHASE_ORDER_RECEIVED',
            'STOCK_ADJUSTED_IN',
            'STOCK_ADJUSTED_OUT',
            'PRODUCT_PRICE_UPDATED',
          ],
        },
      },
      include: { user: { select: { id: true, name: true } } },
    }),
  ]);

  const lowStockProducts = await Promise.all(
    lowStockCount.map(async (product) => {
      const stock = await getCurrentStock(product.id);
      return stock <= Number(product.reorderPoint) ? product : null;
    })
  );
  const lowStockTotal = lowStockProducts.filter(Boolean).length;

  return {
    today: {
      revenue:        Number(todaySales._sum.totalAmount ?? 0),
      orderCount:     todaySales._count.id,
      retailCount:    0,
      wholesaleCount: 0,
    },
    thisMonth: {
      revenue:    Number(monthSales._sum.totalAmount ?? 0),
      orderCount: monthSales._count.id,
    },
    inventory: {
      totalProducts,
      lowStockCount: lowStockTotal,
      pendingPurchaseOrders: pendingPOs,
    },
    recentActivity: recentActivity.map((l) => ({
      id:        l.id,
      action:    l.action,
      tableName: l.tableName ?? '',
      recordId:  l.recordId ?? '',
      userId:    l.userId,
      ipAddress: l.ipAddress ?? '',
      before:    l.beforeState as Record<string, unknown> | null,
      after:     l.afterState as Record<string, unknown> | null,
      createdAt: l.createdAt,
      user:      l.user,
    })),
  };
}

// ─── Profit & Loss Report ───────────────────────────────
export async function getProfitLoss(from: Date, to: Date) {
  const sales = await db.salesOrder.findMany({
    where: { createdAt: { gte: from, lte: to } },
    include: {
      items: {
        include: {
          product: { select: { id: true, name: true, sku: true } },
        },
      },
    },
  });

  // Aggregate by product using STORED snapshots
  // Never use current priceHistory here
  const byProduct = new Map<string, {
    name:        string
    revenue:     number
    cogs:        number
    quantity:    number
    orderCount:  number
  }>();

  let totalRevenue = 0
  let totalCogs    = 0

  for (const sale of sales) {
    for (const item of sale.items) {
      totalRevenue += Number(item.lineTotal)

      // Use stored snapshot — not current cost
      totalCogs += Number(item.cogsTotal)

      const existing = byProduct.get(item.productId)
      if (!existing) {
        byProduct.set(item.productId, {
          name:       item.product.name,
          revenue:    Number(item.lineTotal),
          cogs:       Number(item.cogsTotal),
          quantity:   Number(item.quantity),
          orderCount: 1,
        })
      } else {
        existing.revenue    += Number(item.lineTotal)
        existing.cogs       += Number(item.cogsTotal)
        existing.quantity   += Number(item.quantity)
        existing.orderCount += 1
      }
    }
  }

  const grossProfit = totalRevenue - totalCogs
  const grossMargin = totalRevenue > 0
    ? ((grossProfit / totalRevenue) * 100).toFixed(2)
    : '0.00'

  return {
    period: {
      from: from.toISOString().split('T')[0],
      to:   to.toISOString().split('T')[0],
    },
    summary: {
      totalRevenue:  Math.round(totalRevenue * 100) / 100,
      totalCost:     Math.round(totalCogs * 100) / 100,
      grossProfit:   Math.round(grossProfit * 100) / 100,
      grossMargin,
      totalOrders:   sales.length,
    },
    byProduct: [...byProduct.values()]
      .map(p => ({
        name:       p.name,
        revenue:    Math.round(p.revenue * 100) / 100,
        cost:       Math.round(p.cogs * 100) / 100,
        profit:     Math.round((p.revenue - p.cogs) * 100) / 100,
        margin:     p.revenue > 0
          ? ((p.revenue - p.cogs) / p.revenue * 100).toFixed(2)
          : '0.00',
        quantity:   p.quantity,
        orderCount: p.orderCount,
      }))
      .sort((a, b) => b.profit - a.profit),
  }
}

// ─── Top selling products ───────────────────────────────
export async function getTopProducts(limit = 10) {
  const items = await db.salesOrderItem.groupBy({
    by:      ['productId'],
    _sum:    { lineTotal: true, quantity: true },
    _count:  { id: true },
    orderBy: { _sum: { lineTotal: 'desc' } },
    take:    limit,
  });

  const withDetails = await Promise.all(
    items.map(async (item) => {
      const product = await db.product.findFirst({
        where:  { id: item.productId },
        select: { id: true, name: true, sku: true },
      });
      const totalRevenue  = Math.round(Number(item._sum.lineTotal ?? 0) * 100) / 100;
      const totalQuantity = Number(item._sum.quantity ?? 0);
      return {
        productId:   product?.id   ?? item.productId,
        productName: product?.name ?? 'Unknown',
        unitsSold:   totalQuantity,
        revenue:     totalRevenue.toFixed(2),
        avgPrice:    totalQuantity > 0
          ? (totalRevenue / totalQuantity).toFixed(2)
          : '0.00',
        orderCount:  item._count.id,
      };
    })
  );

  return withDetails;
}

// ─── Slow moving products ───────────────────────────────
export async function getSlowMovingProducts(days = 30) {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - days);

  const products = await db.product.findMany({
    where:  { deletedAt: null },
    select: {
      id:          true,
      name:        true,
      sku:         true,
      reorderPoint: true,
      category:    { select: { id: true, name: true } },
      priceHistory: {
        orderBy: { effectiveFrom: 'desc' },
        take:    1,
        select:  { costPrice: true },
      },
    },
  });

  const slowMoving: {
    productId:        string;
    productName:      string;
    categoryName:     string;
    currentStock:     number;
    stockValue:       string;
    lastSoldAt:       string | null;
    daysSinceLastSale: number | null;
  }[] = [];

  for (const product of products) {
    const lastSale = await db.stockMovement.findFirst({
      where:   { productId: product.id, type: 'sale' },
      orderBy: { createdAt: 'desc' },
    });

    const currentStock = await getCurrentStock(product.id);
    if (currentStock <= 0) continue;

    if (!lastSale || lastSale.createdAt < cutoffDate) {
      const costPrice  = Number(product.priceHistory[0]?.costPrice ?? 0);
      const stockValue = (currentStock * costPrice).toFixed(2);
      const daysSinceLastSale = lastSale
        ? Math.floor((Date.now() - lastSale.createdAt.getTime()) / 86_400_000)
        : null;

      slowMoving.push({
        productId:        product.id,
        productName:      product.name,
        categoryName:     product.category?.name ?? '—',
        currentStock,
        stockValue,
        lastSoldAt:       lastSale?.createdAt.toISOString() ?? null,
        daysSinceLastSale,
      });
    }
  }

  return slowMoving.sort(
    (a, b) => (b.daysSinceLastSale ?? 999_999) - (a.daysSinceLastSale ?? 999_999)
  );
}

// ─── Sales Audit Report ─────────────────────────────────
export async function getSalesAuditReport(from: Date, to: Date, type?: string) {
  const sales = await db.salesOrder.findMany({
    where: {
      createdAt: { gte: from, lte: to },
      ...(type && { type: type as any }),
    },
    include: {
      customer:  { select: { id: true, name: true, type: true } },
      createdBy: { select: { id: true, name: true } },
      items: {
        include: {
          product: { select: { id: true, name: true, sku: true } },
        },
      },
    },
    orderBy: { createdAt: 'asc' },
  });

  const formatted = sales.map((s) => ({
    invoiceNumber: `INV-${String(s.invoiceNumber).padStart(4, '0')}`,
    type:          s.type,
    status:        s.status,
    customerName:  s.customer?.name ?? 'Walk-in',
    cashierName:   s.createdBy.name,
    discount:      Number(s.discount),
    totalAmount:   Number(s.totalAmount),
    itemCount:     s.items.length,
    createdAt:     s.createdAt.toISOString(),
    items:         s.items.map((i) => ({
      productName: i.product.name,
      sku:         i.product.sku,
      quantity:    Number(i.quantity),
      unitPrice:   Number(i.unitPrice),
      discountPct: Number(i.discountPct),
      lineTotal:   Number(i.lineTotal),
      unitCostAtSale: Number(i.unitCostAtSale),  // snapshot
      cogsTotal:      Number(i.cogsTotal),        // snapshot
      grossProfit:    Number(i.lineTotal) -
                      Number(i.cogsTotal),        // computed
      margin:         Number(i.lineTotal) > 0
        ? (((Number(i.lineTotal) - Number(i.cogsTotal))
            / Number(i.lineTotal)) * 100).toFixed(2)
        : '0.00',
    })),
  }));

  const retail    = formatted.filter((s) => s.type === 'retail');
  const wholesale = formatted.filter((s) => s.type === 'wholesale');

  const sum = (arr: typeof formatted) => arr.reduce((a, s) => a + s.totalAmount, 0);

  return {
    period: {
      from: from.toISOString().split('T')[0],
      to:   to.toISOString().split('T')[0],
    },
    summary: {
      totalOrders:      formatted.length,
      totalRevenue:     sum(formatted),
      retailOrders:     retail.length,
      retailRevenue:    sum(retail),
      wholesaleOrders:  wholesale.length,
      wholesaleRevenue: sum(wholesale),
    },
    sales: formatted,
  };
}
