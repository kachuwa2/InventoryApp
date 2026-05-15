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
import { errorHandler }     from './middleware/errorHandler';
import authRoutes           from './modules/auth/auth.routes';
import categoriesRoutes     from './modules/categories/categories.routes';
import suppliersRoutes      from './modules/suppliers/suppliers.routes';
import productsRoutes       from './modules/products/products.routes';
import inventoryRoutes      from './modules/inventory/inventory.routes';
import purchasesRoutes      from './modules/purchases/purchases.routes';
import customersRoutes      from './modules/customers/customers.routes';
import salesRoutes          from './modules/sales/sales.routes';
import reportsRoutes from './modules/reports/reports.routes';

// Load environment variables from .env file
dotenv.config();

// Initialize Express application
const app = express();

// ─── Middleware Setup ───────────────────────────────────────
// Parse incoming JSON request bodies
app.use(express.json());
// Parse HTTP cookies from request headers
app.use(cookieParser());

// ─── Health Check Endpoint ──────────────────────────────────
// Used for monitoring and load balancer health checks
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
  });
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
app.use('/api/reports', reportsRoutes);        // Business analytics and KPIs

// ─── Error Handling Middleware ──────────────────────────────
// Must be registered last to catch all errors from routes above
app.use(errorHandler);

export default app;