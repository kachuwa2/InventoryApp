import request from 'supertest';
import { app, cleanDb, registerAdmin } from './helpers/setup';

describe('Products module', () => {
  let token: string;
  let categoryId: string;
  let supplierId: string;

  const KNOWN_BARCODE = '5012300000014';  // pre-seeded for barcode tests

  beforeAll(async () => {
    await cleanDb();
    ({ token } = await registerAdmin());

    // Create the minimum supporting data every product needs
    const catRes = await request(app)
      .post('/api/categories')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Test Cookware Category' });
    categoryId = catRes.body.data.id;

    const supRes = await request(app)
      .post('/api/suppliers')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Test Kitchen Supplier' });
    supplierId = supRes.body.data.id;

    // Pre-create one product so the barcode-found test has something to hit
    await request(app)
      .post('/api/products')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Barcode Test Saucepan',
        sku: 'BTS-001',
        barcode: KNOWN_BARCODE,
        categoryId,
        supplierId,
        costPrice: 10,
        retailPrice: 22,
        wholesalePrice: 16,
      });
  });

  afterAll(async () => {
    await cleanDb();
  });

  // ── POST /api/products ─────────────────────────────────────────
  describe('POST /api/products', () => {
    it('201 with valid data', async () => {
      const res = await request(app)
        .post('/api/products')
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: 'Stainless Steel Saucepan 24cm',
          sku: 'SSS-24-001',
          categoryId,
          supplierId,
          costPrice: 12.50,
          retailPrice: 34.99,
          wholesalePrice: 22.00,
        });
      expect(res.status).toBe(201);
      expect(res.body.data).toHaveProperty('id');
      expect(res.body.data.sku).toBe('SSS-24-001');
    });

    it('400 when retailPrice is less than costPrice', async () => {
      const res = await request(app)
        .post('/api/products')
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: 'Bad Price Pan',
          sku: 'BPP-001',
          categoryId,
          supplierId,
          costPrice: 50,    // cost > retail → invalid
          retailPrice: 10,
          wholesalePrice: 8,
        });
      expect(res.status).toBe(400);
    });
  });

  // ── GET /api/products/barcode/:code ───────────────────────────
  describe('GET /api/products/barcode/:code', () => {
    it('200 with the matching product for a known barcode', async () => {
      const res = await request(app)
        .get(`/api/products/barcode/${KNOWN_BARCODE}`)
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.data.barcode).toBe(KNOWN_BARCODE);
    });

    it('404 for a barcode that does not exist', async () => {
      const res = await request(app)
        .get('/api/products/barcode/0000000000000')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(404);
    });
  });
});
