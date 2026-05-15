import request from 'supertest';
import { app, cleanDb, registerAdmin, db } from './helpers/setup';

describe('Inventory module', () => {
  let token: string;
  let userId: string;
  let productId: string;

  beforeAll(async () => {
    await cleanDb();
    ({ token, userId } = await registerAdmin());

    // Category + supplier + product
    const catRes = await request(app)
      .post('/api/categories')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Inventory Test Category' });

    const supRes = await request(app)
      .post('/api/suppliers')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Inventory Test Supplier' });

    const prodRes = await request(app)
      .post('/api/products')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Inventory Test Pan',
        sku: 'INV-TEST-001',
        categoryId: catRes.body.data.id,
        supplierId: supRes.body.data.id,
        costPrice: 10,
        retailPrice: 22,
        wholesalePrice: 16,
      });
    productId = prodRes.body.data.id;

    // Seed exactly 20 units of stock via direct DB insert.
    // This keeps the test focused on the adjustment endpoints,
    // not on the purchase-order workflow.
    await db.stockMovement.create({
      data: {
        productId,
        type:          'purchase',
        quantity:      20,
        unitCost:      '10.00',
        referenceType: 'purchase_order',
        notes:         'Test stock setup',
        performedById: userId,
      },
    });
  });

  afterAll(async () => {
    await cleanDb();
  });

  describe('POST /api/inventory/adjust', () => {
    it('201 for a valid adjustment_in', async () => {
      const res = await request(app)
        .post('/api/inventory/adjust')
        .set('Authorization', `Bearer ${token}`)
        .send({
          productId,
          type:     'adjustment_in',
          quantity: 5,
          notes:    'Found extra units during stock count',
        });
      expect(res.status).toBe(201);
      expect(res.body.data).toHaveProperty('id');
      expect(res.body.data.type).toBe('adjustment_in');
    });

    it('400 when adjustment_out quantity exceeds current stock', async () => {
      // Current stock: 20 (purchase) + 5 (previous test) = 25
      // Requesting 100 → should be rejected
      const res = await request(app)
        .post('/api/inventory/adjust')
        .set('Authorization', `Bearer ${token}`)
        .send({
          productId,
          type:     'adjustment_out',
          quantity: 100,
          notes:    'Trying to remove too many units',
        });
      expect(res.status).toBe(400);
    });

    it('400 when notes are shorter than 5 characters', async () => {
      const res = await request(app)
        .post('/api/inventory/adjust')
        .set('Authorization', `Bearer ${token}`)
        .send({
          productId,
          type:     'adjustment_in',
          quantity: 1,
          notes:    'Hi',   // only 2 chars — validation requires ≥ 5
        });
      expect(res.status).toBe(400);
    });
  });
});
