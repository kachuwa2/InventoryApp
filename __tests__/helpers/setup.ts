// All env vars are already set by `dotenv -e .env.test` before Jest starts,
// so database.ts will connect to inventory_db_test (not inventory_db).
import { db } from '../../src/config/database';
import request from 'supertest';
import app from '../../src/app';

export { app, db };

export interface AuthResult {
  token: string;
  userId: string;
}

/**
 * Register a fresh admin user and return their access token.
 * Uses Date.now() + a suffix to guarantee a unique email each call.
 */
export async function registerAdmin(suffix = ''): Promise<AuthResult> {
  const email    = `admin-${Date.now()}${suffix}@test.local`;
  const password = 'Admin@12345';

  const reg = await request(app).post('/api/auth/register').send({
    name: 'Test Admin',
    email,
    password,
    role: 'admin',
  });
  if (reg.status !== 201) {
    throw new Error(`registerAdmin failed (${reg.status}): ${JSON.stringify(reg.body)}`);
  }

  const login = await request(app).post('/api/auth/login').send({ email, password });
  if (login.status !== 200) {
    throw new Error(`loginAdmin failed (${login.status}): ${JSON.stringify(login.body)}`);
  }

  return {
    token:  login.body.data.accessToken as string,
    userId: login.body.data.user.id     as string,
  };
}

/** Delete all rows in dependency order — call in beforeAll / afterAll. */
export async function cleanDb(): Promise<void> {
  await db.auditLog.deleteMany();
  await db.salesOrderItem.deleteMany();
  await db.salesOrder.deleteMany();
  await db.stockMovement.deleteMany();
  await db.purchaseOrderItem.deleteMany();
  await db.purchaseOrder.deleteMany();
  await db.productPriceHistory.deleteMany();
  await db.product.deleteMany();
  await db.customer.deleteMany();
  await db.supplier.deleteMany();
  // children before parents (self-referencing categories)
  await db.category.deleteMany({ where: { parentId: { not: null } } });
  await db.category.deleteMany();
  await db.user.deleteMany();
}
