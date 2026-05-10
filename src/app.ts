import express from 'express';
import dotenv from 'dotenv';
import cookieParser from 'cookie-parser';
import { errorHandler } from './middleware/errorHandler';
import authRoutes from './modules/auth/auth.routes';

dotenv.config();

const app = express();

app.use(express.json());
app.use(cookieParser());

// ─── Health check ────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
  });
});

// ─── Routes ──────────────────────────────────────────────
app.use('/api/auth', authRoutes);

// ─── Error handler — must be last ────────────────────────
app.use(errorHandler);

export default app;