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

dotenv.config();

const app = express();
app.use(express.json());
app.use(cookieParser());

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
  });
});

app.use('/api/auth',       authRoutes);
app.use('/api/categories', categoriesRoutes);
app.use('/api/suppliers',  suppliersRoutes);
app.use('/api/products',   productsRoutes);
app.use('/api/inventory',  inventoryRoutes);
app.use('/api/purchases',  purchasesRoutes);
app.use('/api/customers',  customersRoutes);
app.use('/api/sales',      salesRoutes);

app.use(errorHandler);

export default app;