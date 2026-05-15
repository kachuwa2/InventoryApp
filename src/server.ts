/**
 * Inventory Management System - Server Entry Point
 * 
 * Starts the Express server on the configured port.
 * This is the main entry point for the application.
 */

import app from './app';

// ─── Server Configuration ───────────────────────────────────
// Read PORT from environment variables, default to 3000 for local development
const PORT = process.env.PORT || 3000;

// ─── Start Server ───────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`
    ╔════════════════════════════════════════╗
    ║  Inventory Management System Running   ║
    ╠════════════════════════════════════════╣
    ║  URL:         http://localhost:${PORT}          
    ║  Environment: ${process.env.NODE_ENV}
    ╚════════════════════════════════════════╝
  `);
});