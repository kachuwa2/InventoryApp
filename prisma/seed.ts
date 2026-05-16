import { config } from 'dotenv';
config();

import { PrismaClient } from '../src/generated/prisma';
import { PrismaPg } from '@prisma/adapter-pg';
import bcrypt from 'bcryptjs';

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error('DATABASE_URL is not set in .env');

  const adapter = new PrismaPg({ connectionString });
  const prisma = new PrismaClient({ adapter });

  try {
    await seed(prisma);
  } finally {
    await prisma.$disconnect();
  }
}

async function seed(prisma: PrismaClient) {
  // ─── 0. Clean (reverse dependency order) ────────────────────────────────────
  console.log('🧹  Cleaning existing data...');
  await prisma.auditLog.deleteMany();
  await prisma.salesOrderItem.deleteMany();
  await prisma.salesOrder.deleteMany();
  await prisma.stockMovement.deleteMany();
  await prisma.purchaseOrderItem.deleteMany();
  await prisma.purchaseOrder.deleteMany();
  await prisma.productPriceHistory.deleteMany();
  await prisma.product.deleteMany();
  await prisma.customer.deleteMany();
  await prisma.supplier.deleteMany();
  await prisma.category.deleteMany({ where: { parentId: { not: null } } });
  await prisma.category.deleteMany();
  await prisma.user.deleteMany();
  console.log('    ✓ done\n');

  // ─── 1. USERS ────────────────────────────────────────────────────────────────
  console.log('👤  Creating users...');
  const [sara, james] = await Promise.all([
    prisma.user.create({
      data: {
        name: 'Sara Admin',
        email: 'sara@shop.com',
        passwordHash: await bcrypt.hash('Admin1234', 12),
        role: 'admin',
        isActive: true,
      },
    }),
    prisma.user.create({
      data: {
        name: 'James Cashier',
        email: 'james@shop.com',
        passwordHash: await bcrypt.hash('Cashier1234', 12),
        role: 'cashier',
        isActive: true,
      },
    }),
    prisma.user.create({
      data: {
        name: 'David Warehouse',
        email: 'david@shop.com',
        passwordHash: await bcrypt.hash('Warehouse1234', 12),
        role: 'warehouse',
        isActive: true,
      },
    }),
  ]);
  console.log(`    ✓ sara@shop.com (admin), james@shop.com (cashier), david@shop.com (warehouse)\n`);

  // ─── 2. CATEGORIES ───────────────────────────────────────────────────────────
  console.log('📂  Creating categories...');
  const [cookware, cutlery, bakeware] = await Promise.all([
    prisma.category.create({ data: { name: 'Cookware',  description: 'Pots, pans, and cooking vessels for stovetop use' } }),
    prisma.category.create({ data: { name: 'Cutlery',   description: 'Knives, scissors, and professional cutting tools' } }),
    prisma.category.create({ data: { name: 'Bakeware',  description: 'Trays, tins, and moulds for oven baking' } }),
  ]);

  const [fryingPans, potsAndSaucepans, knives, kitchenScissors, cakeTins, bakingTrays] =
    await Promise.all([
      prisma.category.create({ data: { name: 'Frying Pans',       description: 'Non-stick and stainless frying pans and woks', parentId: cookware.id } }),
      prisma.category.create({ data: { name: 'Pots & Saucepans',  description: 'Saucepans, stockpots, and saucepan sets',       parentId: cookware.id } }),
      prisma.category.create({ data: { name: 'Knives',            description: "Chef's, paring, and knife sets",                parentId: cutlery.id  } }),
      prisma.category.create({ data: { name: 'Kitchen Scissors',  description: 'Heavy-duty multipurpose kitchen scissors',      parentId: cutlery.id  } }),
      prisma.category.create({ data: { name: 'Cake Tins',         description: 'Round tins, springform moulds, and loaf tins',  parentId: bakeware.id } }),
      prisma.category.create({ data: { name: 'Baking Trays',      description: 'Sheet pans, roasting trays, and baking sheets', parentId: bakeware.id } }),
    ]);
  console.log('    ✓ 3 parent + 6 child categories\n');

  // ─── 3. SUPPLIERS ────────────────────────────────────────────────────────────
  console.log('🏭  Creating suppliers...');
  const [globalCookware, bladeMasters] = await Promise.all([
    prisma.supplier.create({
      data: {
        name: 'Global Cookware Co.',
        contactPerson: 'David Mwangi',
        email: 'david@globalcookware.com',
        creditLimit: '50000.00',
      },
    }),
    prisma.supplier.create({
      data: {
        name: 'Blade Masters Ltd.',
        contactPerson: 'Amina Osei',
        email: 'amina@blademasters.com',
        creditLimit: '25000.00',
      },
    }),
  ]);
  console.log('    ✓ Global Cookware Co. + Blade Masters Ltd.\n');

  // ─── 4. CUSTOMERS ────────────────────────────────────────────────────────────
  console.log('👥  Creating customers...');
  const [johnKamau, graceWanjiku, metroKitchen, quickMart, aminaHassan] = await Promise.all([
    prisma.customer.create({ data: { name: 'John Kamau',              phone: '+254712111222', type: 'retail',    creditLimit: '500.00'   } }),
    prisma.customer.create({ data: { name: 'Grace Wanjiku',           phone: '+254725888999', type: 'retail',    creditLimit: '500.00'   } }),
    prisma.customer.create({ data: { name: 'Metro Kitchen Supplies',  phone: '+254733999888', type: 'wholesale', creditLimit: '50000.00' } }),
    prisma.customer.create({ data: { name: 'Quick Mart Ltd',          phone: '+254718600700', type: 'wholesale', creditLimit: '50000.00' } }),
    prisma.customer.create({ data: { name: 'Amina Hassan',            phone: '+254700444555', type: 'retail',    creditLimit: '500.00'   } }),
  ]);
  console.log('    ✓ 3 retail (John, Grace, Amina) + 2 wholesale (Metro Kitchen, Quick Mart)\n');

  // ─── 5. PRODUCTS + PRICE HISTORY ─────────────────────────────────────────────
  console.log('📦  Creating 10 products with price history...');

  type ProductSpec = {
    name: string; sku: string; barcode: string; unit: string;
    reorderPoint: string; categoryId: string; supplierId: string;
    cost: number; retail: number; wholesale: number;
  };

  const specs: ProductSpec[] = [
    // ── Frying Pans — Global Cookware ──────────────────────────────────────────
    { name: '26cm Non-Stick Frying Pan',  sku: 'PAN-001',     barcode: '5012345001234', unit: 'piece', reorderPoint: '10', categoryId: fryingPans.id,      supplierId: globalCookware.id, cost: 8.50,  retail: 14.99, wholesale: 11.50 },
    { name: '28cm Non-Stick Wok',         sku: 'WOK-001',     barcode: '5012345003456', unit: 'piece', reorderPoint: '8',  categoryId: fryingPans.id,      supplierId: globalCookware.id, cost: 14.00, retail: 24.99, wholesale: 19.00 },
    // ── Pots & Saucepans — Global Cookware ────────────────────────────────────
    { name: '20cm Stainless Saucepan',    sku: 'SAU-001',     barcode: '5012345002345', unit: 'piece', reorderPoint: '8',  categoryId: potsAndSaucepans.id, supplierId: globalCookware.id, cost: 12.00, retail: 21.99, wholesale: 16.50 },
    { name: '3-Piece Saucepan Set',       sku: 'SAU-SET-001', barcode: '5012345010123', unit: 'set',   reorderPoint: '5',  categoryId: potsAndSaucepans.id, supplierId: globalCookware.id, cost: 35.00, retail: 64.99, wholesale: 49.00 },
    // ── Knives — Blade Masters ────────────────────────────────────────────────
    { name: '20cm Chef Knife',            sku: 'KNF-001',     barcode: '5012345004567', unit: 'piece', reorderPoint: '15', categoryId: knives.id,          supplierId: bladeMasters.id,   cost: 12.00, retail: 24.99, wholesale: 18.00 },
    { name: '15cm Paring Knife',          sku: 'KNF-002',     barcode: '5012345005678', unit: 'piece', reorderPoint: '15', categoryId: knives.id,          supplierId: bladeMasters.id,   cost: 6.00,  retail: 12.99, wholesale: 9.50  },
    { name: '6-Piece Knife Set',          sku: 'KNF-SET-001', barcode: '5012345009012', unit: 'set',   reorderPoint: '5',  categoryId: knives.id,          supplierId: bladeMasters.id,   cost: 28.00, retail: 54.99, wholesale: 42.00 },
    // ── Kitchen Scissors — Blade Masters ──────────────────────────────────────
    { name: 'Heavy Duty Kitchen Scissors',sku: 'SCI-001',     barcode: '5012345006789', unit: 'piece', reorderPoint: '20', categoryId: kitchenScissors.id, supplierId: bladeMasters.id,   cost: 4.50,  retail: 8.99,  wholesale: 6.75  },
    // ── Cake Tins — Global Cookware ───────────────────────────────────────────
    { name: '23cm Round Cake Tin',        sku: 'CAK-001',     barcode: '5012345007890', unit: 'piece', reorderPoint: '12', categoryId: cakeTins.id,        supplierId: globalCookware.id, cost: 5.00,  retail: 9.99,  wholesale: 7.50  },
    // ── Baking Trays — Global Cookware ────────────────────────────────────────
    { name: '30x20cm Baking Tray',        sku: 'TRY-001',     barcode: '5012345008901', unit: 'piece', reorderPoint: '12', categoryId: bakingTrays.id,     supplierId: globalCookware.id, cost: 4.00,  retail: 7.99,  wholesale: 5.99  },
  ];

  // Index for quick reference later (matches specs[] order 0–9)
  // [0]=PAN-001  [1]=WOK-001  [2]=SAU-001  [3]=SAU-SET-001
  // [4]=KNF-001  [5]=KNF-002  [6]=KNF-SET-001  [7]=SCI-001
  // [8]=CAK-001  [9]=TRY-001

  type CreatedProduct = { id: string; cost: number; retail: number; wholesale: number };
  const products: CreatedProduct[] = [];

  for (const s of specs) {
    const p = await prisma.product.create({
      data: {
        name: s.name, sku: s.sku, barcode: s.barcode, unit: s.unit,
        reorderPoint: s.reorderPoint, categoryId: s.categoryId, supplierId: s.supplierId,
      },
    });
    await prisma.productPriceHistory.create({
      data: {
        productId:      p.id,
        costPrice:      s.cost.toFixed(2),
        retailPrice:    s.retail.toFixed(2),
        wholesalePrice: s.wholesale.toFixed(2),
        changedById:    sara.id,
        effectiveFrom:  new Date('2026-02-01T00:00:00.000Z'),
        note:           'Initial pricing',
      },
    });
    products.push({ id: p.id, cost: s.cost, retail: s.retail, wholesale: s.wholesale });
  }
  console.log(`    ✓ ${products.length} products with price history\n`);

  // ─── 6. OPENING STOCK — adjustment_in ────────────────────────────────────────
  // Quantity scaled by reorder point: reorder×10 (min 50, max 150)
  console.log('📊  Seeding opening stock movements (adjustment_in)...');

  // Quantities indexed to match products[] above
  // [0]PAN(rp10→100) [1]WOK(rp8→80)  [2]SAU(rp8→80)   [3]SAU-SET(rp5→50)
  // [4]KNF(rp15→120) [5]KNF-002(15→120) [6]KNF-SET(5→50) [7]SCI(20→150)
  // [8]CAK(12→100)   [9]TRY(12→100)
  const openingQtys = [100, 80, 80, 50, 120, 120, 50, 150, 100, 100];

  for (let i = 0; i < products.length; i++) {
    await prisma.stockMovement.create({
      data: {
        productId:     products[i].id,
        type:          'adjustment_in',
        quantity:      openingQtys[i].toString(),
        unitCost:      products[i].cost.toFixed(2),
        referenceType: 'opening_stock',
        notes:         'Opening stock entry',
        performedById: sara.id,
        createdAt:     new Date('2026-01-15T08:00:00.000Z'),
      },
    });
  }
  console.log('    ✓ Opening stock seeded\n');

  // ─── 7. PURCHASE ORDERS — 2 received POs ─────────────────────────────────────
  // PO1: Global Cookware products (indices 0,1,2,3,8,9) — 50 units each
  // PO2: Blade Masters products   (indices 4,5,6,7)      — 60 units each
  console.log('🛒  Creating 2 received purchase orders...');

  type POLine = { productIdx: number; qty: number };

  async function createReceivedPO(params: {
    supplierId: string;
    supplierReference: string;
    notes: string;
    createdAt: Date;
    approvedAt: Date;
    receivedAt: Date;
    lines: POLine[];
  }) {
    const po = await prisma.purchaseOrder.create({
      data: {
        supplierId:        params.supplierId,
        status:            'received',
        supplierReference: params.supplierReference,
        notes:             params.notes,
        createdById:       sara.id,
        approvedById:      sara.id,
        approvedAt:        params.approvedAt,
        expectedAt:        params.receivedAt,
        receivedAt:        params.receivedAt,
        createdAt:         params.createdAt,
        items: {
          create: params.lines.map(({ productIdx, qty }) => ({
            productId:        products[productIdx].id,
            quantityOrdered:  qty.toString(),
            quantityReceived: qty.toString(),
            unitCost:         products[productIdx].cost.toFixed(2),
          })),
        },
      },
    });

    for (const { productIdx, qty } of params.lines) {
      await prisma.stockMovement.create({
        data: {
          productId:     products[productIdx].id,
          type:          'purchase',
          quantity:      qty.toString(),
          unitCost:      products[productIdx].cost.toFixed(2),
          referenceId:   po.id,
          referenceType: 'purchase_order',
          notes:         `Received — PO ${params.supplierReference}`,
          performedById: sara.id,
          createdAt:     params.receivedAt,
        },
      });
    }
    return po;
  }

  await createReceivedPO({
    supplierId:        globalCookware.id,
    supplierReference: 'GCC-2026-001',
    notes:             'Initial purchase order — cookware and bakeware lines',
    createdAt:         new Date('2026-02-08T09:00:00.000Z'),
    approvedAt:        new Date('2026-02-10T10:00:00.000Z'),
    receivedAt:        new Date('2026-02-12T14:00:00.000Z'),
    // Global Cookware products: [0]PAN [1]WOK [2]SAU [3]SAU-SET [8]CAK [9]TRY
    lines: [0, 1, 2, 3, 8, 9].map(i => ({ productIdx: i, qty: 50 })),
  });

  await createReceivedPO({
    supplierId:        bladeMasters.id,
    supplierReference: 'BML-2026-001',
    notes:             'Initial purchase order — cutlery lines',
    createdAt:         new Date('2026-02-08T09:30:00.000Z'),
    approvedAt:        new Date('2026-02-10T10:30:00.000Z'),
    receivedAt:        new Date('2026-02-12T15:00:00.000Z'),
    // Blade Masters products: [4]KNF-001 [5]KNF-002 [6]KNF-SET [7]SCI
    lines: [4, 5, 6, 7].map(i => ({ productIdx: i, qty: 60 })),
  });

  // Stock after opening + POs (index → total available):
  // [0]PAN     100+50=150   [1]WOK     80+50=130  [2]SAU     80+50=130
  // [3]SAU-SET  50+50=100   [4]KNF    120+60=180  [5]KNF-002 120+60=180
  // [6]KNF-SET  50+60=110   [7]SCI    150+60=210  [8]CAK     100+50=150
  // [9]TRY     100+50=150
  console.log('    ✓ 2 received POs (Global Cookware + Blade Masters)\n');

  // ─── 8. SALES ORDERS — 20 orders ─────────────────────────────────────────────
  // 12 retail (james), 8 wholesale (sara). Spread Feb–May 2026.
  // Stock sold per product checked against available stock above — no stockouts.
  console.log('🧾  Creating 20 sales orders...');

  type SaleLine  = { productIdx: number; qty: number };
  type SaleSpec  = {
    customerId: string | null;
    type: 'retail' | 'wholesale';
    date: string;
    createdById: string;
    lines: SaleLine[];
  };

  const saleSpecs: SaleSpec[] = [
    // ── Retail (james) ────────────────────────────────────────────────────────
    { customerId: johnKamau.id,   type: 'retail', date: '2026-02-20', createdById: james.id, lines: [{ productIdx: 0, qty: 2  }, { productIdx: 9, qty: 3  }] },
    { customerId: graceWanjiku.id,type: 'retail', date: '2026-02-27', createdById: james.id, lines: [{ productIdx: 1, qty: 1  }, { productIdx: 8, qty: 2  }] },
    { customerId: aminaHassan.id, type: 'retail', date: '2026-03-05', createdById: james.id, lines: [{ productIdx: 4, qty: 1  }, { productIdx: 5, qty: 2  }] },
    { customerId: johnKamau.id,   type: 'retail', date: '2026-03-10', createdById: james.id, lines: [{ productIdx: 2, qty: 1  }, { productIdx: 9, qty: 2  }] },
    { customerId: graceWanjiku.id,type: 'retail', date: '2026-03-17', createdById: james.id, lines: [{ productIdx: 0, qty: 2  }, { productIdx: 7, qty: 1  }] },
    { customerId: aminaHassan.id, type: 'retail', date: '2026-03-22', createdById: james.id, lines: [{ productIdx: 1, qty: 1  }, { productIdx: 6, qty: 1  }] },
    { customerId: null,           type: 'retail', date: '2026-03-28', createdById: james.id, lines: [{ productIdx: 4, qty: 2  }, { productIdx: 7, qty: 3  }] }, // walk-in
    { customerId: johnKamau.id,   type: 'retail', date: '2026-04-04', createdById: james.id, lines: [{ productIdx: 8, qty: 2  }, { productIdx: 5, qty: 1  }] },
    { customerId: graceWanjiku.id,type: 'retail', date: '2026-04-11', createdById: james.id, lines: [{ productIdx: 1, qty: 1  }, { productIdx: 9, qty: 1  }] },
    { customerId: aminaHassan.id, type: 'retail', date: '2026-04-19', createdById: james.id, lines: [{ productIdx: 0, qty: 1  }, { productIdx: 7, qty: 2  }] },
    { customerId: null,           type: 'retail', date: '2026-04-27', createdById: james.id, lines: [{ productIdx: 2, qty: 2  }, { productIdx: 8, qty: 1  }] }, // walk-in
    { customerId: johnKamau.id,   type: 'retail', date: '2026-05-06', createdById: james.id, lines: [{ productIdx: 6, qty: 1  }, { productIdx: 5, qty: 1  }] },
    // ── Wholesale (sara) ──────────────────────────────────────────────────────
    { customerId: metroKitchen.id,type: 'wholesale', date: '2026-02-28', createdById: sara.id, lines: [{ productIdx: 0, qty: 20 }, { productIdx: 1, qty: 15 }] },
    { customerId: quickMart.id,   type: 'wholesale', date: '2026-03-07', createdById: sara.id, lines: [{ productIdx: 4, qty: 30 }, { productIdx: 5, qty: 25 }] },
    { customerId: metroKitchen.id,type: 'wholesale', date: '2026-03-18', createdById: sara.id, lines: [{ productIdx: 9, qty: 20 }, { productIdx: 8, qty: 20 }] },
    { customerId: quickMart.id,   type: 'wholesale', date: '2026-03-28', createdById: sara.id, lines: [{ productIdx: 2, qty: 20 }, { productIdx: 3, qty: 10 }] },
    { customerId: metroKitchen.id,type: 'wholesale', date: '2026-04-07', createdById: sara.id, lines: [{ productIdx: 6, qty: 10 }, { productIdx: 7, qty: 30 }] },
    { customerId: quickMart.id,   type: 'wholesale', date: '2026-04-17', createdById: sara.id, lines: [{ productIdx: 0, qty: 15 }, { productIdx: 1, qty: 10 }] },
    { customerId: metroKitchen.id,type: 'wholesale', date: '2026-04-28', createdById: sara.id, lines: [{ productIdx: 4, qty: 25 }, { productIdx: 5, qty: 20 }] },
    { customerId: quickMart.id,   type: 'wholesale', date: '2026-05-10', createdById: sara.id, lines: [{ productIdx: 2, qty: 20 }, { productIdx: 3, qty: 15 }] },
  ];

  for (const spec of saleSpecs) {
    const orderDate = new Date(`${spec.date}T10:00:00.000Z`);

    const lineItems = spec.lines.map(({ productIdx, qty }) => {
      const p = products[productIdx];
      const unitPrice = spec.type === 'retail' ? p.retail : p.wholesale;
      const lineTotal  = parseFloat((unitPrice * qty).toFixed(2));
      return { productId: p.id, qty, unitPrice, lineTotal, cost: p.cost };
    });

    const totalAmount = lineItems
      .reduce((sum, li) => sum + li.lineTotal, 0)
      .toFixed(2);

    const order = await prisma.salesOrder.create({
      data: {
        customerId:  spec.customerId,
        type:        spec.type,
        status:      'completed',
        discount:    '0.00',
        totalAmount,
        createdById: spec.createdById,
        createdAt:   orderDate,
        items: {
          create: lineItems.map(li => ({
            productId:   li.productId,
            quantity:    li.qty.toString(),
            unitPrice:   li.unitPrice.toFixed(2),
            discountPct: '0.00',
            lineTotal:   li.lineTotal.toFixed(2),
          })),
        },
      },
    });

    for (const li of lineItems) {
      await prisma.stockMovement.create({
        data: {
          productId:     li.productId,
          type:          'sale',
          quantity:      li.qty.toString(),
          unitCost:      li.cost.toFixed(2),
          referenceId:   order.id,
          referenceType: 'sales_order',
          notes:         `Sale — ${spec.type}`,
          performedById: spec.createdById,
          createdAt:     orderDate,
        },
      });
    }
  }
  console.log('    ✓ 20 sales orders (12 retail by james, 8 wholesale by sara)\n');

  // ─── Summary ─────────────────────────────────────────────────────────────────
  const [users, categories, suppliers, prods, prices, customers, pos, sos, movements] =
    await Promise.all([
      prisma.user.count(),
      prisma.category.count(),
      prisma.supplier.count(),
      prisma.product.count(),
      prisma.productPriceHistory.count(),
      prisma.customer.count(),
      prisma.purchaseOrder.count(),
      prisma.salesOrder.count(),
      prisma.stockMovement.count(),
    ]);

  console.log('📊  Seed summary');
  console.log(`    Users:            ${users}    (admin: sara, cashier: james, warehouse: david)`);
  console.log(`    Categories:       ${categories}    (3 parent + 6 child)`);
  console.log(`    Suppliers:        ${suppliers}    (Global Cookware Co. + Blade Masters Ltd.)`);
  console.log(`    Products:         ${prods}   (10 kitchen utensils with EAN-13 barcodes)`);
  console.log(`    Price history:    ${prices}   (1 entry per product)`);
  console.log(`    Customers:        ${customers}    (3 retail + 2 wholesale)`);
  console.log(`    Purchase orders:  ${pos}    (2 received — opening stock via POs)`);
  console.log(`    Sales orders:     ${sos}   (12 retail + 8 wholesale)`);
  console.log(`    Stock movements:  ${movements}   (10 adj_in + PO lines + sale lines)`);
  console.log('\n✅  Database seeded successfully!');
  console.log('    Logins:');
  console.log('      sara@shop.com    /  Admin1234     (admin)');
  console.log('      james@shop.com   /  Cashier1234   (cashier)');
  console.log('      david@shop.com   /  Warehouse1234 (warehouse)');
}

main().catch((e) => {
  console.error('\n❌  Seed failed:', e instanceof Error ? e.message : e);
  process.exit(1);
});
