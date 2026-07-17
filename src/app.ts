/**
 * Inventory Management System - Express Application
 * 
 * Main Express application setup with middleware configuration and route mounting.
 * Handles all HTTP requests and delegates to appropriate module controllers.
 * 
 * Features:
 * - JSON and cookie parsing middleware
 * - Health check endpoint for monitoring
 * - 9 feature modules (auth, categories, suppliers, products, inventory, purchases, customers, sales, reports)
 * - Centralized error handling middleware
 */

import express from 'express';
import dotenv from 'dotenv';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import cors from 'cors';
import swaggerUi from 'swagger-ui-express';
import { swaggerSpec } from './config/swagger';
import { rateLimit } from 'express-rate-limit';
import { errorHandler }     from './middleware/errorHandler';
import { getIp }            from './utils/request';
import authRoutes           from './modules/auth/auth.routes';
import categoriesRoutes     from './modules/categories/categories.routes';
import suppliersRoutes      from './modules/suppliers/suppliers.routes';
import productsRoutes       from './modules/products/products.routes';
import inventoryRoutes      from './modules/inventory/inventory.routes';
import purchasesRoutes      from './modules/purchases/purchases.routes';
import customersRoutes      from './modules/customers/customers.routes';
import salesRoutes          from './modules/sales/sales.routes';
import reportsRoutes    from './modules/reports/reports.routes';
import usersRoutes      from './modules/users/users.routes';
import auditLogsRoutes  from './modules/auditLogs/auditLogs.routes';

// Load environment variables from .env file
dotenv.config();

// Initialize Express application
const app = express();

// Required for Railway (sits behind a reverse proxy) so Express
// correctly detects HTTPS and secure cookies work.
app.set('trust proxy', 1);

// ─── CORS ───────────────────────────────────────────────────
app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true)
    if (origin.includes('localhost')) return callback(null, true)
    if (origin.includes('vercel.app')) return callback(null, true)
    if (origin.includes('devtunnels.ms')) return callback(null, true)
    if (origin.includes('railway.app')) return callback(null, true)
    callback(new Error(`CORS blocked: ${origin}`))
  },
  credentials: true,
  methods: ['GET','POST','PUT','DELETE','PATCH','OPTIONS'],
  allowedHeaders: ['Content-Type','Authorization'],
  exposedHeaders: ['Set-Cookie'],
}))

//Express v5 uses path-to-regexp v8 which no longer accepts the wildcard * as a route pattern. This is an Express v5 breaking change.
// app.options('*', cors())

// Handle preflight requests for all cross-origin routes
app.options('/{*path}', cors())

// ─── Security Headers ───────────────────────────────────────
app.use(helmet());

// ─── Middleware Setup ───────────────────────────────────────
app.use(express.json());
app.use(cookieParser());

// ─── Rate Limiting ──────────────────────────────────────────
if (process.env.NODE_ENV === 'production') {
  const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 5,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    keyGenerator: (req) => getIp(req),
    message: { success: false, message: 'Too many login attempts. Try again in 15 minutes.' },
  });
  app.post('/api/auth/login', loginLimiter);

  const generalLimiter = rateLimit({
    windowMs: 60 * 1000,
    limit: 100,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    keyGenerator: (req) => getIp(req),
    message: { success: false, message: 'Too many requests. Slow down.' },
  });
  app.use(generalLimiter);
}

// ─── Health Check Endpoint ──────────────────────────────────
// Used for monitoring and load balancer health checks
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
  });
});

// ─── Readiness Check Endpoint ───────────────────────────────────
// Used by orchestration platforms to check if the app is ready to serve traffic
app.get('/ready', async (req, res) => {
  try {
    // Import db here to avoid circular dependencies
    const { db } = await import('./config/database');
    await db.$queryRaw`SELECT 1`;
    res.json({ status: 'ready', database: 'connected' });
  } catch (err) {
    console.error('Readiness check failed:', err);
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    res.status(503).json({
      status: 'not ready',
      database: 'disconnected',
      error: errorMessage
    });
  }
});

// ─── API Routes Mounting ────────────────────────────────────
// Each route is mounted with its base path and module routes
app.use('/api/auth',       authRoutes);        // Authentication (login, register, token refresh)
app.use('/api/categories', categoriesRoutes);  // Product categories (hierarchical)
app.use('/api/suppliers',  suppliersRoutes);   // Supplier management
app.use('/api/products',   productsRoutes);    // Product catalog and pricing
app.use('/api/inventory',  inventoryRoutes);   // Stock levels and movements
app.use('/api/purchases',  purchasesRoutes);   // Purchase order workflows
app.use('/api/customers',  customersRoutes);   // Customer relationship management
app.use('/api/sales',      salesRoutes);       // Point-of-sale and sales orders
app.use('/api/reports',    reportsRoutes);     // Business analytics and KPIs
app.use('/api/users',      usersRoutes);       // User management (admin only)
app.use('/api/audit-logs', auditLogsRoutes);   // Audit trail (admin only)

// ─── Swagger UI ────────────────────────────────────────────
// Custom CSS for dark theme matching the app design
const swaggerUiOptions = {
  customCss: `
    .swagger-ui { font-family: Inter, system-ui, sans-serif; }
    .swagger-ui .topbar { background: #13151C; }
    .swagger-ui .topbar .download-url-wrapper { display: none; }
    .swagger-ui .info .title { color: #7C6EF8; }
    .swagger-ui .scheme-container { background: #13151C; padding: 16px; }
    .swagger-ui .opblock-tag { font-size: 16px; font-weight: 600; }
    .swagger-ui .opblock.opblock-get .opblock-summary-method {
      background: #1D9E75; }
    .swagger-ui .opblock.opblock-post .opblock-summary-method {
      background: #4DA8F5; }
    .swagger-ui .opblock.opblock-put .opblock-summary-method {
      background: #F5A742; }
    .swagger-ui .opblock.opblock-delete .opblock-summary-method {
      background: #F56B6B; }
    .swagger-ui .btn.authorize { border-color: #7C6EF8; color: #7C6EF8; }
    .swagger-ui .btn.authorize svg { fill: #7C6EF8; }
  `,
  customSiteTitle: 'StockFlow API Docs',
  swaggerOptions: {
    persistAuthorization: true,
    displayRequestDuration: true,
    filter: true,
    tryItOutEnabled: true,
  },
}

app.use(
  '/api-docs',
  swaggerUi.serve,
  swaggerUi.setup(swaggerSpec, swaggerUiOptions)
)

// Serve raw OpenAPI JSON (useful for Postman import)
app.get('/api-docs.json', (req, res) => {
  res.setHeader('Content-Type', 'application/json')
  res.send(swaggerSpec)
})

// ─── Error Handling Middleware ──────────────────────────────
// Must be registered last to catch all errors from routes above
app.use(errorHandler);

export default app;