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

  const saleMovements = await db.stockMovement.findMany({
    where: { type: 'sale', createdAt: { gte: from, lte: to } },
    include: { product: { select: { id: true, name: true } } },
  });

  const totalRevenue = sales.reduce(
    (sum, sale) => sum + Number(sale.totalAmount), 0
  );

  const productIds = [...new Set(saleMovements.map((m) => m.productId))];

  const costByProduct: Record<string, number> = {};
  for (const productId of productIds) {
    const latestPurchase = await db.stockMovement.findFirst({
      where: { productId, type: 'purchase' },
      orderBy: { createdAt: 'desc' },
    });
    costByProduct[productId] = Number(latestPurchase?.unitCost ?? 0);
  }

  const totalCost = saleMovements.reduce((sum, movement) => {
    const unitCost = costByProduct[movement.productId] ?? 0;
    return sum + unitCost * Number(movement.quantity);
  }, 0);

  const grossProfit = totalRevenue - totalCost;
  const grossMargin =
    totalRevenue > 0
      ? Math.round((grossProfit / totalRevenue) * 100 * 100) / 100
      : 0;

  const byProduct: Record<
    string,
    { name: string; revenue: number; quantity: number; cost: number; profit: number }
  > = {};

  for (const sale of sales) {
    for (const item of sale.items) {
      const pid = item.product.id;
      if (!byProduct[pid]) {
        byProduct[pid] = { name: item.product.name, revenue: 0, quantity: 0, cost: 0, profit: 0 };
      }
      byProduct[pid].revenue  += Number(item.lineTotal);
      byProduct[pid].quantity += Number(item.quantity);
      byProduct[pid].cost     += (costByProduct[pid] ?? 0) * Number(item.quantity);
      byProduct[pid].profit    = byProduct[pid].revenue - byProduct[pid].cost;
    }
  }

  return {
    period: {
      from: from.toISOString().split('T')[0],
      to:   to.toISOString().split('T')[0],
    },
    summary: {
      revenue:     totalRevenue.toFixed(2),
      cogs:        totalCost.toFixed(2),
      grossProfit: grossProfit.toFixed(2),
      marginPct:   grossMargin.toFixed(2),
    },
    byProduct: Object.entries(byProduct)
      .map(([productId, d]) => {
        const marginPct = d.revenue > 0 ? (d.profit / d.revenue) * 100 : 0;
        return {
          productId,
          productName: d.name,
          unitsSold:   d.quantity,
          revenue:     d.revenue.toFixed(2),
          cogs:        d.cost.toFixed(2),
          profit:      d.profit.toFixed(2),
          marginPct:   marginPct.toFixed(2),
        };
      })
      .sort((a, b) => Number(b.revenue) - Number(a.revenue)),
  };
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
