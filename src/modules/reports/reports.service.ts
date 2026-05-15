import { db } from '../../config/database';
import { getCurrentStock } from '../inventory/inventory.service';

// ─── Dashboard KPIs ─────────────────────────────────────
// This is the first thing a manager sees every morning.
// It answers: how is the business doing right now?
export async function getDashboardKPIs() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const thisMonthStart = new Date(today.getFullYear(), today.getMonth(), 1);

  // Run all queries in parallel — much faster than
  // running them one after another sequentially
  const [
    todaySales,
    monthSales,
    totalProducts,
    lowStockCount,
    pendingPOs,
    recentActivity,
  ] = await Promise.all([

    // Today's sales
    db.salesOrder.aggregate({
      where: {
        createdAt: { gte: today, lt: tomorrow },
      },
      _sum:   { totalAmount: true },
      _count: { id: true },
    }),

    // This month's sales
    db.salesOrder.aggregate({
      where: {
        createdAt: { gte: thisMonthStart },
      },
      _sum:   { totalAmount: true },
      _count: { id: true },
    }),

    // Total active products
    db.product.count({
      where: { deletedAt: null },
    }),

    // Products below reorder point
    // We fetch all products and filter in memory
    // because stock is computed not stored
    db.product.findMany({
      where: { deletedAt: null },
      select: {
        id:          true,
        name:        true,
        reorderPoint: true,
      },
    }),

    // Purchase orders awaiting approval or receiving
    db.purchaseOrder.count({
      where: {
        status: { in: ['draft', 'approved'] },
      },
    }),

    // Recent activity — last 10 events across sales and purchases
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
      include: {
        user: { select: { id: true, name: true } },
      },
    }),

  ]);

  // Compute low stock count from the products list
  const lowStockProducts = await Promise.all(
    lowStockCount.map(async (product) => {
      const stock = await getCurrentStock(product.id);
      return stock <= Number(product.reorderPoint) ? product : null;
    })
  );
  const lowStockTotal = lowStockProducts.filter(Boolean).length;

  return {
    today: {
      revenue:    Number(todaySales._sum.totalAmount ?? 0),
      orderCount: todaySales._count.id,
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
    recentActivity,
  };
}

// ─── Profit & Loss Report ───────────────────────────────
// Revenue comes from sales.
// Cost comes from the unit_cost on stock movements
// that were triggered by sales.
// Gross profit = revenue - cost of goods sold
export async function getProfitLoss(from: Date, to: Date) {

  // Get all sales in the date range with their items
  const sales = await db.salesOrder.findMany({
    where: {
      createdAt: { gte: from, lte: to },
    },
    include: {
      items: {
        include: {
          product: { select: { id: true, name: true, sku: true } },
        },
      },
    },
  });

  // Get all sale stock movements in the date range
  // to compute cost of goods sold
  const saleMovements = await db.stockMovement.findMany({
    where: {
      type:      'sale',
      createdAt: { gte: from, lte: to },
    },
    include: {
      product: { select: { id: true, name: true } },
    },
  });

  // Total revenue from all sales
  const totalRevenue = sales.reduce(
    (sum, sale) => sum + Number(sale.totalAmount), 0
  );

  // For cost of goods sold, we need the unit cost
  // from purchase movements for the products sold.
  // We approximate by finding the most recent purchase
  // cost for each product sold.
  const productIds = [
    ...new Set(saleMovements.map(m => m.productId))
  ];

  const costByProduct: Record<string, number> = {};

  for (const productId of productIds) {
    const latestPurchase = await db.stockMovement.findFirst({
      where: {
        productId,
        type: 'purchase',
      },
      orderBy: { createdAt: 'desc' },
    });
    costByProduct[productId] = Number(latestPurchase?.unitCost ?? 0);
  }

  // Calculate cost of goods sold
  const totalCost = saleMovements.reduce((sum, movement) => {
    const unitCost = costByProduct[movement.productId] ?? 0;
    return sum + (unitCost * Number(movement.quantity));
  }, 0);

  const grossProfit  = totalRevenue - totalCost;
  const grossMargin  = totalRevenue > 0
    ? Math.round((grossProfit / totalRevenue) * 100 * 100) / 100
    : 0;

  // Break down by product
  const byProduct: Record<string, {
    name:     string;
    revenue:  number;
    quantity: number;
    cost:     number;
    profit:   number;
  }> = {};

  for (const sale of sales) {
    for (const item of sale.items) {
      const pid = item.product.id;
      if (!byProduct[pid]) {
        byProduct[pid] = {
          name:     item.product.name,
          revenue:  0,
          quantity: 0,
          cost:     0,
          profit:   0,
        };
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
      totalRevenue:  Math.round(totalRevenue  * 100) / 100,
      totalCost:     Math.round(totalCost     * 100) / 100,
      grossProfit:   Math.round(grossProfit   * 100) / 100,
      grossMargin:   `${grossMargin}%`,
      totalOrders:   sales.length,
    },
    byProduct: Object.values(byProduct)
      .sort((a, b) => b.revenue - a.revenue),
  };
}

// ─── Top selling products ───────────────────────────────
export async function getTopProducts(limit: number = 10) {
  const items = await db.salesOrderItem.groupBy({
    by:      ['productId'],
    _sum:    { lineTotal: true, quantity: true },
    _count:  { id: true },
    orderBy: { _sum: { lineTotal: 'desc' } },
    take:    limit,
  });

  // Attach product details to each result
  const withDetails = await Promise.all(
    items.map(async (item) => {
      const product = await db.product.findFirst({
        where: { id: item.productId },
        select: { id: true, name: true, sku: true },
      });
      return {
        product,
        totalRevenue:  Math.round(Number(item._sum.lineTotal ?? 0) * 100) / 100,
        totalQuantity: Number(item._sum.quantity ?? 0),
        orderCount:    item._count.id,
      };
    })
  );

  return withDetails;
}

// ─── Slow moving products ───────────────────────────────
// Products that have stock but haven't sold recently.
// These tie up cash and warehouse space.
export async function getSlowMovingProducts(days: number = 30) {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - days);

  // Get all products
  const products = await db.product.findMany({
    where: { deletedAt: null },
    select: { id: true, name: true, sku: true, reorderPoint: true },
  });

  const slowMoving: {
    product:      { id: string; name: string; sku: string };
    currentStock: number;
    lastSoldAt:   string | null;
    daysSinceSold: number | null;
  }[] = [];

  for (const product of products) {
    // Find the most recent sale for this product
    const lastSale = await db.stockMovement.findFirst({
      where: {
        productId: product.id,
        type:      'sale',
      },
      orderBy: { createdAt: 'desc' },
    });

    const currentStock = await getCurrentStock(product.id);

    // Only include products that have stock but haven't sold recently
    if (currentStock > 0) {
      const daysSinceSold = lastSale
        ? Math.floor(
            (Date.now() - lastSale.createdAt.getTime()) / (1000 * 60 * 60 * 24)
          )
        : null;

      // Include if never sold OR not sold within the cutoff period
      if (!lastSale || lastSale.createdAt < cutoffDate) {
        slowMoving.push({
          product: {
            id:   product.id,
            name: product.name,
            sku:  product.sku,
          },
          currentStock,
          lastSoldAt:    lastSale?.createdAt.toISOString() ?? null,
          daysSinceSold,
        });
      }
    }
  }

  return slowMoving.sort(
    (a, b) => (b.daysSinceSold ?? 999) - (a.daysSinceSold ?? 999)
  );
}