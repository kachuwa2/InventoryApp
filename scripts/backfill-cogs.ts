import { db } from '../src/config/database'
import { config } from 'dotenv'

config()

async function backfillCogs() {
  console.log('Starting COGS backfill...')

  // Get all sale items that have no cost snapshot
  const items = await db.salesOrderItem.findMany({
    where: {
      unitCostAtSale: 0,
    },
    include: {
      product: {
        include: {
          priceHistory: {
            orderBy: { effectiveFrom: 'asc' },
          },
        },
      },
      salesOrder: {
        select: { createdAt: true },
      },
    },
  })

  console.log(`Found ${items.length} items to backfill`)

  let updated = 0

  for (const item of items) {
    // Find the cost price that was active at sale time
    // Use the price history entry that was effective
    // at or before the sale date
    const saleDate = item.salesOrder.createdAt
    const priceAtSaleTime = item.product.priceHistory
      .filter(p => new Date(p.effectiveFrom) <= saleDate)
      .sort((a, b) =>
        new Date(b.effectiveFrom).getTime() -
        new Date(a.effectiveFrom).getTime()
      )[0]

    if (!priceAtSaleTime) {
      console.log(
        `No price history found for product ${item.productId} ` +
        `at ${saleDate} — skipping`
      )
      continue
    }

    const unitCostAtSale = Number(priceAtSaleTime.costPrice)
    const cogsTotal      = unitCostAtSale * Number(item.quantity)

    await db.salesOrderItem.update({
      where: { id: item.id },
      data:  { unitCostAtSale, cogsTotal },
    })

    updated++
  }

  console.log(`Backfilled ${updated} items`)
  await db.$disconnect()
}

backfillCogs().catch(console.error)