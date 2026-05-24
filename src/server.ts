/**
 * Inventory Management System - Server Entry Point
 * 
 * Starts the Express server on the configured port.
 * This is the main entry point for the application.
 */

import app from './app';

// ─── Server Configuration ───────────────────────────────────

const PORT = process.env.PORT || 8080;

// ─── Start Server ───────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`
    ╔═══════════════════════════════════════════╗
    ║  Inventory Management System Running      ║
    ╠═══════════════════════════════════════════╣
    ║  API:   http://localhost:${PORT}          ╣
    ║  Docs:  http://localhost:${PORT}/api-docs ╣
    ║  Env:   ${process.env.NODE_ENV}           ╣  
    ╚═══════════════════════════════════════════╝  
  `);
});

