import request from 'supertest';
import { app, cleanDb, registerAdmin } from './helpers/setup';

describe('Purchases module — full PO lifecycle', () => {
  let token: string;
  let supplierId: string;
  let productId: string;

  beforeAll(async () => {
    await cleanDb();
    ({ token } = await registerAdmin());

    const supRes = await request(app)
      .post('/api/suppliers')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'PO Lifecycle Supplier' });
    supplierId = supRes.body.data.id;

    const catRes = await request(app)
      .post('/api/categories')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'PO Lifecycle Category' });

    const prodRes = await request(app)
      .post('/api/products')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'PO Lifecycle Frying Pan',
        sku: 'PO-LC-001',
        categoryId: catRes.body.data.id,
        supplierId,
        costPrice: 12,
        retailPrice: 28,
        wholesalePrice: 20,
      });
    productId = prodRes.body.data.id;
  });

  afterAll(async () => {
    await cleanDb();
  });

  it('create → approve → receive → stock increases to ordered quantity', async () => {
    // ── 1. Create purchase order (status: draft) ───────────────
    const createRes = await request(app)
      .post('/api/purchases')
      .set('Authorization', `Bearer ${token}`)
      .send({
        supplierId,
        notes: 'Lifecycle integration test order',
        items: [{ productId, quantityOrdered: 50, unitCost: 12 }],
      });
    expect(createRes.status).toBe(201);
    const poId = createRes.body.data.id;
    expect(createRes.body.data.status).toBe('draft');

    // ── 2. Approve the purchase order ──────────────────────────
    const approveRes = await request(app)
      .post(`/api/purchases/${poId}/approve`)
      .set('Authorization', `Bearer ${token}`);
    expect(approveRes.status).toBe(200);
    expect(approveRes.body.data.status).toBe('approved');

    // ── 3. Fetch the order to get line-item IDs ────────────────
    const getRes = await request(app)
      .get(`/api/purchases/${poId}`)
      .set('Authorization', `Bearer ${token}`);
    expect(getRes.status).toBe(200);
    const itemId: string = getRes.body.data.items[0].id;

    // ── 4. Receive the goods ───────────────────────────────────
    const receiveRes = await request(app)
      .post(`/api/purchases/${poId}/receive`)
      .set('Authorization', `Bearer ${token}`)
      .send({ items: [{ itemId, quantityReceived: 50 }] });
    expect(receiveRes.status).toBe(200);
    expect(receiveRes.body.data.status).toBe('received');

    // ── 5. Confirm stock movements created the correct stock ───
    const stockRes = await request(app)
      .get(`/api/inventory/${productId}/movements`)
      .set('Authorization', `Bearer ${token}`);
    expect(stockRes.status).toBe(200);
    expect(stockRes.body.data.currentStock).toBe(50);
  });
});
