/**
 * Inventory Management System - Server Entry Point
 *
 * Starts the Express server on the configured port.
 * This is the main entry point for the application.
 */

import { validateEnv } from './utils/validateEnv';
validateEnv();
import app from './app';
import { startDeliveryReminderJob } from './jobs/delivery-reminders';
import { logger } from './utils/logger';

// ─── Server Configuration ────

const PORT = process.env.PORT || 8080;

// ─── Start Server ──────
app.listen(PORT, () => {
  logger.info('Server started', {
    port: PORT,
    environment: process.env.NODE_ENV,
    url: `http://localhost:${PORT}`,
    docs: `http://localhost:${PORT}/api-docs`,
  });

  startDeliveryReminderJob();
});