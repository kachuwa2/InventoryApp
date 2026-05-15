import request from 'supertest';
import { app, cleanDb } from './helpers/setup';

const SEED_EMAIL = 'seed-user@test.local';
const SEED_PASS  = 'Seeded@123';

describe('Auth module', () => {
  let token: string;

  beforeAll(async () => {
    await cleanDb();

    // Create one persistent user for login / getMe tests
    await request(app).post('/api/auth/register').send({
      name: 'Seed User',
      email: SEED_EMAIL,
      password: SEED_PASS,
    });

    const res = await request(app).post('/api/auth/login').send({
      email: SEED_EMAIL,
      password: SEED_PASS,
    });
    token = res.body.data.accessToken;
  });

  afterAll(async () => {
    await cleanDb();
  });

  // ── POST /api/auth/register ────────────────────────────────────
  describe('POST /api/auth/register', () => {
    it('201 with valid data — returns user without passwordHash', async () => {
      const res = await request(app).post('/api/auth/register').send({
        name: 'Jane Kitchen',
        email: 'jane.kitchen@test.local',
        password: 'Kitchen@123',
      });
      expect(res.status).toBe(201);
      expect(res.body.data).toHaveProperty('id');
      expect(res.body.data.email).toBe('jane.kitchen@test.local');
      expect(res.body.data).not.toHaveProperty('passwordHash');
    });

    it('409 for duplicate email', async () => {
      const res = await request(app).post('/api/auth/register').send({
        name: 'Duplicate',
        email: SEED_EMAIL,           // already exists
        password: 'Another@456',
      });
      expect(res.status).toBe(409);
    });

    it('400 for weak password (no uppercase / no digit)', async () => {
      const res = await request(app).post('/api/auth/register').send({
        name: 'Weak Password User',
        email: 'weak@test.local',
        password: 'weakpassword',    // violates the regex
      });
      expect(res.status).toBe(400);
    });
  });

  // ── POST /api/auth/login ───────────────────────────────────────
  describe('POST /api/auth/login', () => {
    it('200 with accessToken and user object for valid credentials', async () => {
      const res = await request(app).post('/api/auth/login').send({
        email: SEED_EMAIL,
        password: SEED_PASS,
      });
      expect(res.status).toBe(200);
      expect(res.body.data).toHaveProperty('accessToken');
      expect(res.body.data.user.email).toBe(SEED_EMAIL);
    });

    it('401 for wrong password', async () => {
      const res = await request(app).post('/api/auth/login').send({
        email: SEED_EMAIL,
        password: 'Totally@Wrong999',
      });
      expect(res.status).toBe(401);
    });
  });

  // ── GET /api/auth/me ───────────────────────────────────────────
  describe('GET /api/auth/me', () => {
    it('200 with user data for a valid Bearer token', async () => {
      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.data.email).toBe(SEED_EMAIL);
      expect(res.body.data).not.toHaveProperty('passwordHash');
    });

    it('401 when Authorization header is absent', async () => {
      const res = await request(app).get('/api/auth/me');
      expect(res.status).toBe(401);
    });
  });
});
