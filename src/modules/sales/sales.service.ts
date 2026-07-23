import { Prisma } from '../../generated/prisma'
import { db } from '../../config/database'
import { NotFoundError, ValidationError } from '../../utils/errors'
import type { CreateSaleInput } from './sales.schema'

// Aggregate duplicate product lines
function aggregateItems(items: CreateSaleInput['items']) {
  const map = new Map<string, {
    productId:   string
    quantity:    number
    discountPct: number
  }>()
  for (const item of items) {
    const existing = map.get(item.productId)
    if (!existing) {
      map.set(item.productId, {
        productId:   item.productId,
        quantity:    Number(item.quantity),
        discountPct: Number(item.discountPct ?? 0),
      })
    } else {
      existing.quantity += Number(item.quantity)
    }
  }
  return [...map.values()]
}

// Read current stock inside an existing transaction
async function getCurrentStockInTx(
  tx: Prisma.TransactionClient,
  productId: string
): Promise<number> {
  const [inbound, outbound] = await Promise.all([
    tx.stockMovement.aggregate({
      where: {
        productId,
        type: { in: ['purchase', 'adjustment_in', 'return_in'] },
      },
      _sum: { quantity: true },
    }),
    tx.stockMovement.aggregate({
      where: {
        productId,
        type: { in: ['sale', 'adjustment_out', 'return_out'] },
      },
      _sum: { quantity: true },
    }),
  ])
  return (
    Number(inbound._sum.quantity ?? 0) -
    Number(outbound._sum.quantity ?? 0)
  )
}

export async function createSale(
  data: CreateSaleInput,
  userId: string,
  ip: string
) {
  // Aggregate duplicate lines first
  const aggregatedItems = aggregateItems(data.items)
  const productIds = aggregatedItems.map(i => i.productId)

  // Load products with latest prices outside transaction
  // This is a read-only operation — safe outside tx
  const products = await db.product.findMany({
    where: {
      id: { in: productIds },
      deletedAt: null,
    },
    include: {
      priceHistory: {
        orderBy: { effectiveFrom: 'desc' },
        take: 1,
      },
    },
  })

  // Build product lookup map
  const productMap = new Map(products.map(p => [p.id, p]))

  // Validate all products exist and have prices
  for (const item of aggregatedItems) {
    const product = productMap.get(item.productId)
    if (!product) {
      throw new NotFoundError(`Product ${item.productId}`)
    }
    if (!product.priceHistory[0]) {
      throw new ValidationError(
        `Product "${product.name}" has no price set. ` +
        `Set a price before selling.`
      )
    }
  }

  // Calculate line totals using correct prices
  const saleType = data.type ?? 'retail'
  const itemsWithTotals = aggregatedItems.map(item => {
    const product    = productMap.get(item.productId)!
    const price      = product.priceHistory[0]!
    const unitPrice  = saleType === 'wholesale'
      ? Number(price.wholesalePrice)
      : Number(price.retailPrice)
    // Cost snapshot — what we paid for this item
    // This is snapshotted forever at time of sale
    const unitCostAtSale = Number(price.costPrice)
    const discountMult  = 1 - (item.discountPct / 100)
    const lineTotal     = unitPrice * discountMult * item.quantity
    // COGS for this line = cost × quantity
    const cogsTotal = unitCostAtSale * item.quantity
    return {
      productId:       item.productId,
      productName:     product.name,
      quantity:        item.quantity,
      unitPrice,
      discountPct:     item.discountPct,
      lineTotal,
      unitCostAtSale,  // snapshot
      cogsTotal,       // snapshot
    }
  })

  // Calculate order total
  const subtotal      = itemsWithTotals.reduce(
    (sum, i) => sum + i.lineTotal, 0
  )
  const orderDiscount = Number(data.discount ?? 0)
  const totalAmount   = subtotal * (1 - orderDiscount / 100)

  // Run everything inside a serializable transaction
  // with row-level locking for race condition protection
  return db.$transaction(
    async (tx) => {
      // Lock product rows — prevents concurrent oversell
      await tx.$queryRaw`
        SELECT id FROM "products"
        WHERE id = ANY(${productIds}::text[])
        FOR UPDATE
      `

      // Re-check stock INSIDE transaction after lock
      for (const item of itemsWithTotals) {
        const stock = await getCurrentStockInTx(
          tx, item.productId
        )
        if (stock < item.quantity) {
          throw new ValidationError(
            `Insufficient stock for "${item.productName}". ` +
            `Available: ${stock}, ` +
            `Requested: ${item.quantity}`
          )
        }
      }

      // Create sales order with line items
      const sale = await tx.salesOrder.create({
        data: {
          type:        saleType,
          discount:    orderDiscount,
          totalAmount,
          notes:       data.notes ?? null,
          customer:    data.customerId
            ? { connect: { id: data.customerId } }
            : undefined,
          createdBy:   { connect: { id: userId } },
          items: {
            create: itemsWithTotals.map(item => ({
              product:       { connect: { id: item.productId } },
              quantity:      item.quantity,
              unitPrice:     item.unitPrice,
              discountPct:   item.discountPct,
              lineTotal:     item.lineTotal,
              unitCostAtSale: item.unitCostAtSale,  // persist snapshot
              cogsTotal:     item.cogsTotal,        // persist snapshot
            })),
          },
        },
        include: {
          customer:  { select: { id: true, name: true, type: true } },
          createdBy: { select: { id: true, name: true } },
          items: {
            include: {
              product: {
                select: { id: true, name: true, sku: true },
              },
            },
          },
        },
      })

      // Create stock movements — one per product
      // type 'sale' = stock going out
      await Promise.all(
        itemsWithTotals.map(item =>
          tx.stockMovement.create({
            data: {
              product:       { connect: { id: item.productId } },
              type:          'sale',
              quantity:      item.quantity,
              referenceId:   sale.id,
              referenceType: 'sales_order',
              notes:         `Sale order ${sale.id}`,
              performedBy:   { connect: { id: userId } },
            },
          })
        )
      )

      // Audit log
      await tx.auditLog.create({
        data: {
          user:      { connect: { id: userId } },
          action:    'SALE_CREATED',
          tableName: 'sales_orders',
          recordId:  sale.id,
          afterState: {
            type:        saleType,
            totalAmount: Number(sale.totalAmount),
            itemCount:   itemsWithTotals.length,
            customerId:  data.customerId ?? null,
          },
          ipAddress: ip,
        },
      })

      return sale
    },
    {
      isolationLevel:
        Prisma.TransactionIsolationLevel.Serializable,
      timeout: 10000,
    }
  )
}

export async function getAllSales(filters?: {
  type?:       string
  customerId?: string
}) {
  return db.salesOrder.findMany({
    where: {
      ...(filters?.type       && { type: filters.type as any }),
      ...(filters?.customerId && { customerId: filters.customerId }),
    },
    include: {
      customer:  { select: { id: true, name: true, type: true } },
      createdBy: { select: { id: true, name: true } },
      _count:    { select: { items: true } },
    },
    orderBy: { createdAt: 'desc' },
  })
}

export async function getSaleById(id: string) {
  const sale = await db.salesOrder.findFirst({
    where: { id },
    include: {
      customer:  { select: { id: true, name: true, type: true } },
      createdBy: { select: { id: true, name: true } },
      items: {
        include: {
          product: {
            select: {
              id: true, name: true, sku: true, unit: true
            },
          },
        },
      },
    },
  })
  if (!sale) throw new NotFoundError('Sale')
  return sale
}

export async function getDailySummary() {
  const today    = new Date()
  today.setHours(0, 0, 0, 0)
  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)

  const sales = await db.salesOrder.findMany({
    where: { createdAt: { gte: today, lt: tomorrow } },
    select: { type: true, totalAmount: true },
  })

  const total = (arr: typeof sales) =>
    arr.reduce((s, x) => s + Number(x.totalAmount), 0)
  const retail    = sales.filter(s => s.type === 'retail')
  const wholesale = sales.filter(s => s.type === 'wholesale')

  return {
    totalOrders:      sales.length,
    totalRevenue:     total(sales),
    retailOrders:     retail.length,
    retailRevenue:    total(retail),
    wholesaleOrders:  wholesale.length,
    wholesaleRevenue: total(wholesale),
  }
}