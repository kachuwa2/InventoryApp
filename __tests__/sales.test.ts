import request from 'supertest';
import { app, db } from './helpers/setup';
import { cleanDb, registerAdmin } from './helpers/setup';

describe('Sales Service', () => {
  let adminToken: string;
  let userId: string;
  let productId: string;

  const COST_PRICE = 10;
  const RETAIL_PRICE = 30;
  const WHOLESALE_PRICE = 20;

  beforeAll(async () => {
    await cleanDb();
    const admin = await registerAdmin();
    adminToken = admin.token;
    userId = admin.userId;

    const catRes = await request(app)
      .post('/api/categories')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Sales Test Category' });

    const supRes = await request(app)
      .post('/api/suppliers')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Sales Test Supplier' });

    const prodRes = await request(app)
      .post('/api/products')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Sales Test Skillet',
        sku: 'ST-SKILLET-001',
        categoryId: catRes.body.data.id,
        supplierId: supRes.body.data.id,
        costPrice: COST_PRICE,
        retailPrice: RETAIL_PRICE,
        wholesalePrice: WHOLESALE_PRICE,
      });
    productId = prodRes.body.data.id;

    // Seed 100 units so every sale test has stock to consume
    await db.stockMovement.create({
      data: {
        productId,
        type: 'purchase',
        quantity: 100,
        unitCost: String(COST_PRICE),
        referenceType: 'purchase_order',
        notes: 'Sales test setup stock',
        performedById: userId,
      },
    });
  });

  afterAll(async () => {
    await cleanDb();
  });

  // Helper to get a product with stock (using seeded product)
  async function getProductWithStock() {
    const inventoryRes = await request(app)
      .get('/api/inventory')
      .set('Authorization', `Bearer ${adminToken}`);
    const products = inventoryRes.body.data;
    return products.find((p: any) => p.id === productId);
  }

  it('creates a retail sale successfully', async () => {
    const product = await getProductWithStock();

    const res = await request(app)
      .post('/api/sales')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        type: 'retail',
        items: [{
          productId: product.id,
          quantity: 1,
        }],
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.type).toBe('retail');
    expect(res.body.data.items).toHaveLength(1);
  });

  it('aggregates duplicate product lines', async () => {
    const product = await getProductWithStock();

    const res = await request(app)
      .post('/api/sales')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        type: 'retail',
        items: [
          { productId: product.id, quantity: 1 },
          { productId: product.id, quantity: 1 },
        ],
      });

    // Should succeed with combined quantity of 2
    expect(res.status).toBe(201);
    expect(res.body.data.items).toHaveLength(1);
    expect(Number(res.body.data.items[0].quantity)).toBe(2);
  });

  it('rejects sale when stock is insufficient', async () => {
    const product = await getProductWithStock();

    const res = await request(app)
      .post('/api/sales')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        type: 'retail',
        items: [{
          productId: product.id,
          quantity: 99999,
        }],
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/insufficient stock/i);
  });

  it('rejects duplicate lines that exceed stock', async () => {
    const product = await getProductWithStock();

    const res = await request(app)
      .post('/api/sales')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        type: 'retail',
        items: [
          { productId: product.id, quantity: product.currentStock - 1 },
          { productId: product.id, quantity: 2 },
        ],
      });

    // Combined qty exceeds stock so should fail
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/insufficient stock/i);
  });

  it('applies wholesale prices for wholesale sales', async () => {
    const product = await getProductWithStock();

    const res = await request(app)
      .post('/api/sales')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        type: 'wholesale',
        items: [{
          productId: product.id,
          quantity: 1,
        }],
      });

    expect(res.status).toBe(201);
    expect(res.body.data.type).toBe('wholesale');
  });

  it('applies order level discount correctly', async () => {
    const product = await getProductWithStock();

    const res = await request(app)
      .post('/api/sales')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        type: 'retail',
        discount: 10,
        items: [{
          productId: product.id,
          quantity: 1,
        }],
      });

    expect(res.status).toBe(201);
    expect(Number(res.body.data.discount)).toBe(10);
  });

  it('decreases stock after a successful sale', async () => {
    const product = await getProductWithStock();
    const stockBefore = product.currentStock;

    await request(app)
      .post('/api/sales')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        type: 'retail',
        items: [{ productId: product.id, quantity: 1 }],
      });

    // Check stock decreased
    const inventoryRes = await request(app)
      .get('/api/inventory')
      .set('Authorization', `Bearer ${adminToken}`);

    const updated = inventoryRes.body.data.find(
      (p: any) => p.id === product.id
    );
    expect(updated.currentStock).toBe(stockBefore - 1);
  });

  // Keep existing price snapshot tests for regression
  it('retail sale snapshots retailPrice in totalAmount', async () => {
    const product = await getProductWithStock();
    const qty = 2;
    const res = await request(app)
      .post('/api/sales')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ type: 'retail', items: [{ productId: product.id, quantity: qty }] });

    expect(res.status).toBe(201);
    // totalAmount = qty × retailPrice = 2 × 30 = 60
    expect(Number(res.body.data.totalAmount)).toBe(qty * RETAIL_PRICE);
  });

  it('wholesale sale snapshots wholesalePrice in totalAmount', async () => {
    const product = await getProductWithStock();
    const qty = 2;
    const res = await request(app)
      .post('/api/sales')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ type: 'wholesale', items: [{ productId: product.id, quantity: qty }] });

    expect(res.status).toBe(201);
    // totalAmount = qty × wholesalePrice = 2 × 20 = 40
    expect(Number(res.body.data.totalAmount)).toBe(qty * WHOLESALE_PRICE);
  });

  it('400 when sale quantity exceeds available stock', async () => {
    // Stock after previous two tests: 100 - 2 - 2 = 96
    // Requesting 200 must be rejected
    const product = await getProductWithStock();
    const res = await request(app)
      .post('/api/sales')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ type: 'retail', items: [{ productId: product.id, quantity: 200 }] });

    expect(res.status).toBe(400);
  });

  describe('Financial correctness - COGS snapshot', () => {

    it('stores cost snapshot at time of sale', async () => {
      const product = await getProductWithStock();

      const res = await request(app)
        .post('/api/sales')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          type:  'retail',
          items: [{
            productId: product.id,
            quantity:  1,
          }],
        });

      expect(res.status).toBe(201);

      const saleItem = res.body.data.items[0];

      // Cost snapshot must be stored
      expect(Number(saleItem.unitCostAtSale)).toBeGreaterThan(0);
      expect(Number(saleItem.cogsTotal)).toBeGreaterThan(0);

      // cogsTotal = unitCostAtSale × quantity
      expect(Number(saleItem.cogsTotal)).toBeCloseTo(
        Number(saleItem.unitCostAtSale) * Number(saleItem.quantity),
        2
      );
    })

    it('P&L does not change when cost price is updated', async () => {
      const product = await getProductWithStock();

      // Make a sale
      const saleRes = await request(app)
        .post('/api/sales')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          type:  'retail',
          items: [{ productId: product.id, quantity: 1 }],
        })

      expect(saleRes.status).toBe(201)

      const today = new Date().toISOString().split('T')[0]

      // Get P&L before price change
      const plBefore = await request(app)
        .get(`/api/reports/profit-loss?from=${today}&to=${today}`)
        .set('Authorization', `Bearer ${adminToken}`)

      const cogsBefore = Number(plBefore.body.data.summary.totalCost)

      // Update cost price to a very different value
      await request(app)
        .put(`/api/products/${product.id}/price`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          costPrice:     999.99,
          retailPrice:   1999.99,
          wholesalePrice: 1499.99,
          note:          'Test price change',
        })

      // Get P&L after price change
      const plAfter = await request(app)
        .get(`/api/reports/profit-loss?from=${today}&to=${today}`)
        .set('Authorization', `Bearer ${adminToken}`)

      const cogsAfter = Number(plAfter.body.data.summary.totalCost)

      // COGS must be identical — price change should not affect it
      expect(cogsAfter).toBe(cogsBefore)
    })

  })
})