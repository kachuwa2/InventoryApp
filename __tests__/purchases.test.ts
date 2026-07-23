import request from 'supertest'
import { app, cleanDb, registerAdmin } from './helpers/setup'

let token: string
let supplierId: string
let productId: string

// Set up test data before each test
beforeEach(async () => {
  await cleanDb()
  const { token: t } = await registerAdmin()
  token = t

  // Create a category first
  const categoryRes = await request(app)
    .post('/api/categories')
    .set('Authorization', `Bearer ${token}`)
    .send({ name: 'Test Category' })
  const categoryId = categoryRes.body.data.id

  // Create a supplier
  const supplierRes = await request(app)
    .post('/api/suppliers')
    .set('Authorization', `Bearer ${token}`)
    .send({ name: 'Test Supplier' })
  supplierId = supplierRes.body.data.id

  // Create a product with required fields
  const productRes = await request(app)
    .post('/api/products')
    .set('Authorization', `Bearer ${token}`)
    .send({
      name: 'Test Product',
      sku: 'TEST-SKU-001',
      categoryId,
      supplierId,
      costPrice: 10.0,
      retailPrice: 20.0,
      wholesalePrice: 15.0,
    })

  productId = productRes.body.data.id
})

// Clean up after each test (handled by afterEach in describe block if needed)

async function createAndApprovePO() {
  // Create PO
  const createRes = await request(app)
    .post('/api/purchases')
    .set('Authorization', `Bearer ${token}`)
    .send({
      supplierId,
      items: [{
        productId,
        quantityOrdered: 10,
        unitCost: 5.00,
      }],
    })

  const poId = createRes.body.data.id

  // Approve PO
  await request(app)
    .post(`/api/purchases/${poId}/approve`)
    .set('Authorization', `Bearer ${token}`)

  const poRes = await request(app)
    .get(`/api/purchases/${poId}`)
    .set('Authorization', `Bearer ${token}`)

  return poRes.body.data
}

describe('Purchase Order Receiving', () => {

  it('receives stock correctly', async () => {
    const po = await createAndApprovePO()
    const item = po.items[0]

    const res = await request(app)
      .post(`/api/purchases/${po.id}/receive`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        items: [{
          itemId:           item.id,
          quantityReceived: 10,
        }],
        notes: 'Full delivery received',
      })

    expect(res.status).toBe(200)
    expect(res.body.data.status).toBe('received')
  })

  it('prevents duplicate itemId from inflating stock', async () => {
    const po = await createAndApprovePO()
    const item = po.items[0]

    // Send same itemId twice with qty 6 each = 12
    // But only 10 ordered so should fail
    const res = await request(app)
      .post(`/api/purchases/${po.id}/receive`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        items: [
          { itemId: item.id, quantityReceived: 6 },
          { itemId: item.id, quantityReceived: 6 },
        ],
      })

    // Combined 12 > ordered 10 so should fail
    expect(res.status).toBe(400)
    expect(res.body.message).toMatch(/cannot receive/i)
  })

  it('keeps PO approved after partial receipt', async () => {
    const po = await createAndApprovePO()
    const item = po.items[0]

    // Receive only 5 of 10 ordered
    const res = await request(app)
      .post(`/api/purchases/${po.id}/receive`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        items: [{
          itemId:           item.id,
          quantityReceived: 5,
        }],
        notes: 'Partial delivery',
      })

    expect(res.status).toBe(200)
    // Not fully received so status stays approved
    expect(res.body.data.status).toBe('approved')
  })

  it('sets status to received when all items fully received', async () => {
    const po = await createAndApprovePO()
    const item = po.items[0]

    // First partial receipt
    await request(app)
      .post(`/api/purchases/${po.id}/receive`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        items: [{ itemId: item.id, quantityReceived: 5 }],
      })

    // Second receipt completes the order
    const res = await request(app)
      .post(`/api/purchases/${po.id}/receive`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        items: [{ itemId: item.id, quantityReceived: 5 }],
      })

    expect(res.status).toBe(200)
    // Now fully received so status is received
    expect(res.body.data.status).toBe('received')
  })

  it('cannot receive more than ordered quantity', async () => {
    const po = await createAndApprovePO()
    const item = po.items[0]

    const res = await request(app)
      .post(`/api/purchases/${po.id}/receive`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        items: [{
          itemId:           item.id,
          quantityReceived: 999,
        }],
      })

    expect(res.status).toBe(400)
    expect(res.body.message).toMatch(/cannot receive/i)
  })

  it('creates stock movement for received items', async () => {
    const po = await createAndApprovePO()
    const item = po.items[0]

    await request(app)
      .post(`/api/purchases/${po.id}/receive`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        items: [{ itemId: item.id, quantityReceived: 10 }],
      })

    // Check movement was created
    const movementsRes = await request(app)
      .get(`/api/inventory/${item.productId}/movements`)
      .set('Authorization', `Bearer ${token}`)

    const purchaseMovements = movementsRes.body.data.movements.filter(
      (m: any) =>
        m.type === 'purchase' &&
        m.referenceId === po.id
    )

    expect(purchaseMovements.length).toBeGreaterThan(0)
    expect(Number(purchaseMovements[0].quantity)).toBe(10)
  })
})