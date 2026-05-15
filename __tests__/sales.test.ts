import request from 'supertest';
import { app, cleanDb, registerAdmin, db } from './helpers/setup';

describe('Sales module', () => {
  let token: string;
  let userId: string;
  let productId: string;

  const COST_PRICE      = 10;
  const RETAIL_PRICE    = 30;
  const WHOLESALE_PRICE = 20;

  beforeAll(async () => {
    await cleanDb();
    ({ token, userId } = await registerAdmin());

    const catRes = await request(app)
      .post('/api/categories')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Sales Test Category' });

    const supRes = await request(app)
      .post('/api/suppliers')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Sales Test Supplier' });

    const prodRes = await request(app)
      .post('/api/products')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Sales Test Skillet',
        sku: 'ST-SKILLET-001',
        categoryId: catRes.body.data.id,
        supplierId: supRes.body.data.id,
        costPrice:      COST_PRICE,
        retailPrice:    RETAIL_PRICE,
        wholesalePrice: WHOLESALE_PRICE,
      });
    productId = prodRes.body.data.id;

    // Seed 100 units so every sale test has stock to consume
    await db.stockMovement.create({
      data: {
        productId,
        type:          'purchase',
        quantity:      100,
        unitCost:      String(COST_PRICE),
        referenceType: 'purchase_order',
        notes:         'Sales test setup stock',
        performedById: userId,
      },
    });
  });

  afterAll(async () => {
    await cleanDb();
  });

  it('retail sale snapshots retailPrice in totalAmount', async () => {
    const qty = 2;
    const res = await request(app)
      .post('/api/sales')
      .set('Authorization', `Bearer ${token}`)
      .send({ type: 'retail', items: [{ productId, quantity: qty }] });

    expect(res.status).toBe(201);
    // totalAmount = qty × retailPrice = 2 × 30 = 60
    expect(Number(res.body.data.totalAmount)).toBe(qty * RETAIL_PRICE);
  });

  it('wholesale sale snapshots wholesalePrice in totalAmount', async () => {
    const qty = 2;
    const res = await request(app)
      .post('/api/sales')
      .set('Authorization', `Bearer ${token}`)
      .send({ type: 'wholesale', items: [{ productId, quantity: qty }] });

    expect(res.status).toBe(201);
    // totalAmount = qty × wholesalePrice = 2 × 20 = 40
    expect(Number(res.body.data.totalAmount)).toBe(qty * WHOLESALE_PRICE);
  });

  it('400 when sale quantity exceeds available stock', async () => {
    // Stock after previous two tests: 100 - 2 - 2 = 96
    // Requesting 200 must be rejected
    const res = await request(app)
      .post('/api/sales')
      .set('Authorization', `Bearer ${token}`)
      .send({ type: 'retail', items: [{ productId, quantity: 200 }] });

    expect(res.status).toBe(400);
  });
});
