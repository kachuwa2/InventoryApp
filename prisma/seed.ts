import { config } from 'dotenv';
config();

import { PrismaClient } from '../src/generated/prisma';
import { PrismaPg } from '@prisma/adapter-pg';
import bcrypt from 'bcryptjs';

// ─── EAN-13 check digit calculator ──────────────────────────────────────────
function ean13(base12: string): string {
  const digits = base12.slice(0, 12).padStart(12, '0');
  const sum = digits
    .split('')
    .reduce((acc, d, i) => acc + parseInt(d) * (i % 2 === 0 ? 1 : 3), 0);
  return digits + ((10 - (sum % 10)) % 10).toString();
}

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
  // ─── Clean database (reverse dependency order) ───────────────────────────
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
  // child categories before parents
  await prisma.category.deleteMany({ where: { parentId: { not: null } } });
  await prisma.category.deleteMany();
  await prisma.user.deleteMany();
  console.log('    ✓ Database cleaned\n');

  // ─── Admin user ───────────────────────────────────────────────────────────
  console.log('👤  Creating admin user...');
  const passwordHash = await bcrypt.hash('Admin@12345', 12);
  const admin = await prisma.user.create({
    data: {
      name: 'System Admin',
      email: 'admin@inventory.local',
      passwordHash,
      role: 'admin',
      isActive: true,
    },
  });
  console.log(`    ✓ ${admin.email}\n`);

  // ─── Parent categories ────────────────────────────────────────────────────
  console.log('📂  Creating categories...');
  const [cookware, cutlery, bakeware] = await Promise.all([
    prisma.category.create({
      data: { name: 'Cookware', description: 'Pots, pans, and cooking vessels for stovetop use' },
    }),
    prisma.category.create({
      data: { name: 'Cutlery', description: 'Knives, scissors, and professional cutting tools' },
    }),
    prisma.category.create({
      data: { name: 'Bakeware', description: 'Trays, tins, and moulds for oven baking' },
    }),
  ]);

  // Child categories (2 per parent)
  const [potsAndPans, nonStick, kitchenKnives, utilityKnives, bakingTrays, cakeTins] =
    await Promise.all([
      prisma.category.create({
        data: {
          name: 'Pots & Pans',
          description: 'Saucepans, stockpots, and cast iron skillets',
          parentId: cookware.id,
        },
      }),
      prisma.category.create({
        data: {
          name: 'Non-stick Cookware',
          description: 'PTFE-coated frying pans and woks',
          parentId: cookware.id,
        },
      }),
      prisma.category.create({
        data: {
          name: 'Kitchen Knives',
          description: "Chef's, bread, and santoku knives",
          parentId: cutlery.id,
        },
      }),
      prisma.category.create({
        data: {
          name: 'Utility & Steak Knives',
          description: 'Boning, paring, and steak knife sets',
          parentId: cutlery.id,
        },
      }),
      prisma.category.create({
        data: {
          name: 'Baking Trays & Sheets',
          description: 'Sheet pans, roasting trays, and muffin trays',
          parentId: bakeware.id,
        },
      }),
      prisma.category.create({
        data: {
          name: 'Cake & Mould Tins',
          description: 'Round tins, loaf tins, and springform moulds',
          parentId: bakeware.id,
        },
      }),
    ]);
  console.log('    ✓ 3 parent + 6 child categories\n');

  // ─── Suppliers ────────────────────────────────────────────────────────────
  console.log('🏭  Creating suppliers...');
  const [globalCookware, bladeMasters] = await Promise.all([
    prisma.supplier.create({
      data: {
        name: 'Global Cookware Co.',
        contactPerson: 'Sarah Mitchell',
        phone: '+44-20-7946-0100',
        email: 'orders@globalcookware.co.uk',
        address: '14 Metalwork Estate, Birmingham, B1 1BB, United Kingdom',
        creditLimit: '5000.00',
      },
    }),
    prisma.supplier.create({
      data: {
        name: 'Blade Masters Ltd.',
        contactPerson: 'James Thornton',
        phone: '+44-114-496-0200',
        email: 'wholesale@blademasters.co.uk',
        address: '7 Cutlery Quarter, Sheffield, S1 2CD, United Kingdom',
        creditLimit: '3000.00',
      },
    }),
  ]);
  console.log('    ✓ Global Cookware Co. & Blade Masters Ltd.\n');

  // ─── Products ─────────────────────────────────────────────────────────────
  console.log('📦  Creating 10 products with price history...');

  type ProductDef = {
    name: string;
    sku: string;
    barcode: string;
    description: string;
    categoryId: string;
    supplierId: string;
    unit: string;
    reorderPoint: string;
    cost: number;
    wholesale: number;
    retail: number;
  };

  const productDefs: ProductDef[] = [
    // ── Pots & Pans (Global Cookware) ───────────────────────────────────────
    {
      name: '24cm Stainless Steel Saucepan',
      sku: 'CW-SS-24-001',
      barcode: ean13('501234000001'),
      description: '3-ply stainless steel, induction-compatible, 2.8L capacity with lid',
      categoryId: potsAndPans.id,
      supplierId: globalCookware.id,
      unit: 'piece',
      reorderPoint: '10',
      cost: 12.50,
      wholesale: 22.00,
      retail: 34.99,
    },
    {
      name: '28cm Cast Iron Skillet',
      sku: 'CW-CI-28-002',
      barcode: ean13('501234000002'),
      description: 'Pre-seasoned cast iron, oven-safe to 260°C, 1.5kg, helper handle',
      categoryId: potsAndPans.id,
      supplierId: globalCookware.id,
      unit: 'piece',
      reorderPoint: '8',
      cost: 18.50,
      wholesale: 32.00,
      retail: 49.99,
    },
    // ── Non-stick Cookware (Global Cookware) ────────────────────────────────
    {
      name: '20cm Non-stick Frying Pan',
      sku: 'CW-NS-20-003',
      barcode: ean13('501234000003'),
      description: 'PFOA-free non-stick coating, heat-resistant Bakelite handle, 20cm',
      categoryId: nonStick.id,
      supplierId: globalCookware.id,
      unit: 'piece',
      reorderPoint: '15',
      cost: 8.50,
      wholesale: 15.00,
      retail: 24.99,
    },
    {
      name: '26cm Non-stick Wok',
      sku: 'CW-NS-26-004',
      barcode: ean13('501234000004'),
      description: 'Deep non-stick wok with helper handle, 26cm, induction-compatible',
      categoryId: nonStick.id,
      supplierId: globalCookware.id,
      unit: 'piece',
      reorderPoint: '10',
      cost: 10.50,
      wholesale: 18.50,
      retail: 29.99,
    },
    // ── Kitchen Knives (Blade Masters) ──────────────────────────────────────
    {
      name: "20cm Professional Chef's Knife",
      sku: 'CT-CK-20-005',
      barcode: ean13('501234000005'),
      description: 'Forged German high-carbon steel, full tang, triple-riveted handle',
      categoryId: kitchenKnives.id,
      supplierId: bladeMasters.id,
      unit: 'piece',
      reorderPoint: '10',
      cost: 14.00,
      wholesale: 25.00,
      retail: 39.99,
    },
    // ── Utility & Steak Knives (Blade Masters) ──────────────────────────────
    {
      name: '15cm Flexible Boning Knife',
      sku: 'CT-BN-15-006',
      barcode: ean13('501234000006'),
      description: 'Flexible high-carbon steel blade, ideal for deboning poultry and fish',
      categoryId: utilityKnives.id,
      supplierId: bladeMasters.id,
      unit: 'piece',
      reorderPoint: '8',
      cost: 9.50,
      wholesale: 16.50,
      retail: 27.99,
    },
    {
      name: 'Steak Knife Set 4-Piece',
      sku: 'CT-SK-4P-007',
      barcode: ean13('501234000007'),
      description: 'Serrated stainless steel blades with rosewood handles, gift box',
      categoryId: utilityKnives.id,
      supplierId: bladeMasters.id,
      unit: 'set',
      reorderPoint: '5',
      cost: 16.00,
      wholesale: 28.00,
      retail: 44.99,
    },
    // ── Baking Trays & Sheets (Global Cookware) ─────────────────────────────
    {
      name: '30cm Heavy-Duty Baking Tray',
      sku: 'BW-BT-30-008',
      barcode: ean13('501234000008'),
      description: 'Carbon steel with non-stick coating, 30×20cm, oven-safe to 230°C',
      categoryId: bakingTrays.id,
      supplierId: globalCookware.id,
      unit: 'piece',
      reorderPoint: '15',
      cost: 5.50,
      wholesale: 9.50,
      retail: 16.99,
    },
    // ── Cake & Mould Tins (Global Cookware) ─────────────────────────────────
    {
      name: '23cm Non-stick Round Cake Tin',
      sku: 'BW-CT-23-009',
      barcode: ean13('501234000009'),
      description: 'Springform tin with removable base, 23cm diameter, PFOA-free coating',
      categoryId: cakeTins.id,
      supplierId: globalCookware.id,
      unit: 'piece',
      reorderPoint: '10',
      cost: 6.00,
      wholesale: 11.00,
      retail: 18.99,
    },
    // ── Baking Trays & Sheets (Global Cookware) ─────────────────────────────
    {
      name: '12-Cup Silicone Muffin Tray',
      sku: 'BW-MT-12-010',
      barcode: ean13('501234000010'),
      description: 'Food-grade silicone, 12 standard cups, dishwasher-safe, flexible',
      categoryId: bakingTrays.id,
      supplierId: globalCookware.id,
      unit: 'piece',
      reorderPoint: '12',
      cost: 7.50,
      wholesale: 13.00,
      retail: 21.99,
    },
  ];

  type CreatedProduct = {
    id: string;
    name: string;
    sku: string;
    cost: number;
    wholesale: number;
    retail: number;
  };

  const products: CreatedProduct[] = [];
  for (const def of productDefs) {
    const product = await prisma.product.create({
      data: {
        name: def.name,
        sku: def.sku,
        barcode: def.barcode,
        description: def.description,
        categoryId: def.categoryId,
        supplierId: def.supplierId,
        unit: def.unit,
        reorderPoint: def.reorderPoint,
      },
    });
    await prisma.productPriceHistory.create({
      data: {
        productId: product.id,
        costPrice: def.cost.toFixed(2),
        wholesalePrice: def.wholesale.toFixed(2),
        retailPrice: def.retail.toFixed(2),
        changedById: admin.id,
        effectiveFrom: new Date('2026-02-01T00:00:00.000Z'),
        note: 'Initial product pricing',
      },
    });
    products.push({
      id: product.id,
      name: product.name,
      sku: product.sku,
      cost: def.cost,
      wholesale: def.wholesale,
      retail: def.retail,
    });
  }
  console.log(`    ✓ ${products.length} products\n`);

  // ─── Customers ────────────────────────────────────────────────────────────
  console.log('👥  Creating 5 customers...');
  const [emma, oliver, sarah, kitchenPro, homeGoods] = await Promise.all([
    prisma.customer.create({
      data: {
        name: 'Emma Watson',
        phone: '+44-7700-900001',
        email: 'emma.watson@email.com',
        address: '15 Rose Street, London, E1 5AB',
        type: 'retail',
        creditLimit: '500.00',
      },
    }),
    prisma.customer.create({
      data: {
        name: 'Oliver Smith',
        phone: '+44-7700-900002',
        email: 'oliver.smith@email.com',
        address: '8 Oak Avenue, Manchester, M1 2BC',
        type: 'retail',
        creditLimit: '300.00',
      },
    }),
    prisma.customer.create({
      data: {
        name: 'Sarah Johnson',
        phone: '+44-7700-900003',
        email: 'sarah.johnson@email.com',
        address: '22 Pine Road, Birmingham, B3 4CD',
        type: 'retail',
        creditLimit: '200.00',
      },
    }),
    prisma.customer.create({
      data: {
        name: 'KitchenPro Ltd',
        phone: '+44-20-8900-1234',
        email: 'orders@kitchenpro.co.uk',
        address: '100 Trade Park, Leeds, LS1 5EF',
        type: 'wholesale',
        creditLimit: '10000.00',
      },
    }),
    prisma.customer.create({
      data: {
        name: 'HomeGoods Supplies',
        phone: '+44-113-900-5678',
        email: 'procurement@homegoods.co.uk',
        address: '45 Commerce Road, Bristol, BS1 6GH',
        type: 'wholesale',
        creditLimit: '8000.00',
      },
    }),
  ]);
  console.log('    ✓ 3 retail (Emma, Oliver, Sarah) + 2 wholesale (KitchenPro, HomeGoods)\n');

  // ─── Purchase Orders ──────────────────────────────────────────────────────
  // Each PO is created with status 'received' and stock movements are created
  // to populate the ledger. This mirrors what receivePurchaseOrder() does.
  //
  // Stock after all 6 POs (per product index 0–9): 150 units each
  //   PO1+PO2 (Feb 14–15): initial 100 units per product
  //   PO3+PO4 (Mar 18–19): +50 units for indices [0,2,4,7,9]
  //   PO5+PO6 (Apr 17–18): +50 units for indices [1,3,5,6,8]
  console.log('🛒  Creating 6 purchase orders with stock movements...');

  type POItemDef = { productIdx: number; qty: number };

  async function createReceivedPO(params: {
    supplierId: string;
    supplierReference: string;
    notes: string;
    poCreatedAt: Date;
    approvedAt: Date;
    receivedAt: Date;
    items: POItemDef[];
  }) {
    const po = await prisma.purchaseOrder.create({
      data: {
        supplierId: params.supplierId,
        status: 'received',
        supplierReference: params.supplierReference,
        notes: params.notes,
        createdById: admin.id,
        approvedById: admin.id,
        approvedAt: params.approvedAt,
        expectedAt: params.receivedAt,
        receivedAt: params.receivedAt,
        createdAt: params.poCreatedAt,
        items: {
          create: params.items.map(({ productIdx, qty }) => ({
            productId: products[productIdx].id,
            quantityOrdered: qty,
            quantityReceived: qty,
            unitCost: products[productIdx].cost.toFixed(2),
          })),
        },
      },
    });

    for (const { productIdx, qty } of params.items) {
      await prisma.stockMovement.create({
        data: {
          productId: products[productIdx].id,
          type: 'purchase',
          quantity: qty.toString(),
          unitCost: products[productIdx].cost.toFixed(2),
          referenceId: po.id,
          referenceType: 'purchase_order',
          notes: `Received via PO ${params.supplierReference}`,
          performedById: admin.id,
          createdAt: params.receivedAt,
        },
      });
    }
    return po;
  }

  // PO1 — Feb initial stock: Global Cookware products (indices 0,1,2,3,7,8,9)
  await createReceivedPO({
    supplierId: globalCookware.id,
    supplierReference: 'GCC-2026-001',
    notes: 'Opening inventory — cookware and bakeware lines',
    poCreatedAt: new Date('2026-02-08T09:00:00.000Z'),
    approvedAt:  new Date('2026-02-10T10:00:00.000Z'),
    receivedAt:  new Date('2026-02-14T14:00:00.000Z'),
    items: [0, 1, 2, 3, 7, 8, 9].map(i => ({ productIdx: i, qty: 100 })),
  });

  // PO2 — Feb initial stock: Blade Masters products (indices 4,5,6)
  await createReceivedPO({
    supplierId: bladeMasters.id,
    supplierReference: 'BML-2026-001',
    notes: 'Opening inventory — cutlery lines',
    poCreatedAt: new Date('2026-02-08T09:30:00.000Z'),
    approvedAt:  new Date('2026-02-10T10:30:00.000Z'),
    receivedAt:  new Date('2026-02-15T11:00:00.000Z'),
    items: [4, 5, 6].map(i => ({ productIdx: i, qty: 100 })),
  });

  // PO3 — Mar restock: Global Cookware (indices 0,2,7,9 — fast-movers)
  await createReceivedPO({
    supplierId: globalCookware.id,
    supplierReference: 'GCC-2026-002',
    notes: 'March restock — fast-moving cookware and bakeware',
    poCreatedAt: new Date('2026-03-13T09:00:00.000Z'),
    approvedAt:  new Date('2026-03-14T10:00:00.000Z'),
    receivedAt:  new Date('2026-03-18T15:30:00.000Z'),
    items: [0, 2, 7, 9].map(i => ({ productIdx: i, qty: 50 })),
  });

  // PO4 — Mar restock: Blade Masters (index 4 — chef's knife demand)
  await createReceivedPO({
    supplierId: bladeMasters.id,
    supplierReference: 'BML-2026-002',
    notes: "March restock — chef's knives high demand",
    poCreatedAt: new Date('2026-03-14T09:00:00.000Z'),
    approvedAt:  new Date('2026-03-15T10:00:00.000Z'),
    receivedAt:  new Date('2026-03-19T12:00:00.000Z'),
    items: [{ productIdx: 4, qty: 50 }],
  });

  // PO5 — Apr restock: Global Cookware (indices 1,3,8)
  await createReceivedPO({
    supplierId: globalCookware.id,
    supplierReference: 'GCC-2026-003',
    notes: 'April restock — cast iron, wok, and cake tins',
    poCreatedAt: new Date('2026-04-12T09:00:00.000Z'),
    approvedAt:  new Date('2026-04-13T10:00:00.000Z'),
    receivedAt:  new Date('2026-04-17T16:00:00.000Z'),
    items: [1, 3, 8].map(i => ({ productIdx: i, qty: 50 })),
  });

  // PO6 — Apr restock: Blade Masters (indices 5,6)
  await createReceivedPO({
    supplierId: bladeMasters.id,
    supplierReference: 'BML-2026-003',
    notes: 'April restock — boning knives and steak knife sets',
    poCreatedAt: new Date('2026-04-13T09:00:00.000Z'),
    approvedAt:  new Date('2026-04-14T10:00:00.000Z'),
    receivedAt:  new Date('2026-04-18T11:00:00.000Z'),
    items: [5, 6].map(i => ({ productIdx: i, qty: 50 })),
  });

  console.log('    ✓ 6 purchase orders (all received, 150 units per product in stock)\n');

  // ─── Sales Orders ─────────────────────────────────────────────────────────
  // 20 orders: 12 retail (60%) + 8 wholesale (40%)
  // All stock movements reference the sales order as referenceId.
  // unitPrice is snapshotted at time of sale (retail or wholesale price).
  // unitCost on the movement records cost-of-goods at time of sale.
  console.log('🧾  Creating 20 sales orders with stock movements...');

  type SaleItemSpec = { idx: number; qty: number };
  type OrderSpec = {
    customerId: string | null;
    date: string;
    type: 'retail' | 'wholesale';
    items: SaleItemSpec[];
  };

  // Total units sold per product (all ≤ 150, confirming no stockout):
  // 0: 2+3+1+20+15 = 41   1: 1+1+10+8 = 20   2: 1+2+15+10 = 28
  // 3: 1+2+12+10 = 25     4: 1+2+10+12 = 25  5: 1+2+8 = 11
  // 6: 1+2+10 = 13        7: 3+4+2+1+25+20 = 55  8: 2+1+2+15 = 20
  // 9: 2+3+1+20 = 26
  const orderSpecs: OrderSpec[] = [
    // ── 12 Retail orders ─────────────────────────────────────────────────────
    { customerId: emma.id,    date: '2026-02-20', type: 'retail',    items: [{ idx: 0, qty: 2  }, { idx: 7, qty: 3  }] },
    { customerId: oliver.id,  date: '2026-02-25', type: 'retail',    items: [{ idx: 2, qty: 1  }, { idx: 9, qty: 2  }] },
    { customerId: sarah.id,   date: '2026-03-02', type: 'retail',    items: [{ idx: 4, qty: 1  }, { idx: 6, qty: 1  }] },
    { customerId: emma.id,    date: '2026-03-08', type: 'retail',    items: [{ idx: 1, qty: 1  }, { idx: 8, qty: 2  }] },
    { customerId: oliver.id,  date: '2026-03-14', type: 'retail',    items: [{ idx: 3, qty: 1  }, { idx: 5, qty: 1  }] },
    { customerId: sarah.id,   date: '2026-03-20', type: 'retail',    items: [{ idx: 0, qty: 3  }, { idx: 4, qty: 2  }] },
    { customerId: null,       date: '2026-03-25', type: 'retail',    items: [{ idx: 7, qty: 4  }, { idx: 9, qty: 3  }] }, // walk-in
    { customerId: emma.id,    date: '2026-04-02', type: 'retail',    items: [{ idx: 2, qty: 2  }, { idx: 8, qty: 1  }] },
    { customerId: oliver.id,  date: '2026-04-10', type: 'retail',    items: [{ idx: 1, qty: 1  }, { idx: 6, qty: 2  }] },
    { customerId: sarah.id,   date: '2026-04-18', type: 'retail',    items: [{ idx: 3, qty: 2  }, { idx: 7, qty: 2  }] },
    { customerId: null,       date: '2026-04-25', type: 'retail',    items: [{ idx: 0, qty: 1  }, { idx: 5, qty: 2  }, { idx: 9, qty: 1 }] }, // walk-in
    { customerId: emma.id,    date: '2026-05-05', type: 'retail',    items: [{ idx: 4, qty: 1  }, { idx: 8, qty: 2  }, { idx: 7, qty: 1 }] },
    // ── 8 Wholesale orders ────────────────────────────────────────────────────
    { customerId: kitchenPro.id, date: '2026-02-28', type: 'wholesale', items: [{ idx: 0, qty: 20 }, { idx: 2, qty: 15 }] },
    { customerId: homeGoods.id,  date: '2026-03-05', type: 'wholesale', items: [{ idx: 1, qty: 10 }, { idx: 4, qty: 10 }] },
    { customerId: kitchenPro.id, date: '2026-03-18', type: 'wholesale', items: [{ idx: 7, qty: 25 }, { idx: 9, qty: 20 }] },
    { customerId: homeGoods.id,  date: '2026-03-28', type: 'wholesale', items: [{ idx: 3, qty: 12 }, { idx: 5, qty: 8  }] },
    { customerId: kitchenPro.id, date: '2026-04-05', type: 'wholesale', items: [{ idx: 6, qty: 10 }, { idx: 8, qty: 15 }] },
    { customerId: homeGoods.id,  date: '2026-04-14', type: 'wholesale', items: [{ idx: 0, qty: 15 }, { idx: 7, qty: 20 }] },
    { customerId: kitchenPro.id, date: '2026-04-22', type: 'wholesale', items: [{ idx: 4, qty: 12 }, { idx: 2, qty: 10 }] },
    { customerId: homeGoods.id,  date: '2026-05-08', type: 'wholesale', items: [{ idx: 1, qty: 8  }, { idx: 3, qty: 10 }] },
  ];

  for (const spec of orderSpecs) {
    const orderDate = new Date(`${spec.date}T10:00:00.000Z`);

    // Snapshot price at time of sale
    const lineItems = spec.items.map(({ idx, qty }) => {
      const p = products[idx];
      const unitPrice = spec.type === 'retail' ? p.retail : p.wholesale;
      const lineTotal = parseFloat((unitPrice * qty).toFixed(2));
      return { productId: p.id, qty, unitPrice, lineTotal, costPrice: p.cost };
    });

    const totalAmount = lineItems
      .reduce((sum, li) => sum + li.lineTotal, 0)
      .toFixed(2);

    const salesOrder = await prisma.salesOrder.create({
      data: {
        customerId: spec.customerId,
        type: spec.type,
        status: 'completed',
        discount: '0.00',
        totalAmount,
        createdById: admin.id,
        createdAt: orderDate,
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

    // One stock movement per line item (outbound sale)
    for (const li of lineItems) {
      await prisma.stockMovement.create({
        data: {
          productId:     li.productId,
          type:          'sale',
          quantity:      li.qty.toString(),
          unitCost:      li.costPrice.toFixed(2),
          referenceId:   salesOrder.id,
          referenceType: 'sales_order',
          notes:         `Sale — order ${salesOrder.id.slice(0, 8).toUpperCase()}`,
          performedById: admin.id,
          createdAt:     orderDate,
        },
      });
    }
  }
  console.log('    ✓ 20 sales orders (12 retail, 8 wholesale)\n');

  // ─── Summary ──────────────────────────────────────────────────────────────
  const [
    userCount,
    categoryCount,
    supplierCount,
    productCount,
    priceHistoryCount,
    customerCount,
    poCount,
    soCount,
    movementCount,
  ] = await Promise.all([
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

  console.log('📊  Seed summary:');
  console.log(`    Users:            ${userCount}`);
  console.log(`    Categories:       ${categoryCount}  (3 parent + 6 child)`);
  console.log(`    Suppliers:        ${supplierCount}`);
  console.log(`    Products:         ${productCount}`);
  console.log(`    Price history:    ${priceHistoryCount}`);
  console.log(`    Customers:        ${customerCount}  (3 retail + 2 wholesale)`);
  console.log(`    Purchase orders:  ${poCount}`);
  console.log(`    Sales orders:     ${soCount}  (12 retail + 8 wholesale)`);
  console.log(`    Stock movements:  ${movementCount}`);
  console.log('\n✅  Database seeded successfully!');
  console.log('    Login: admin@inventory.local / Admin@12345');
}

main().catch((e) => {
  console.error('\n❌  Seed failed:', e.message ?? e);
  process.exit(1);
});
