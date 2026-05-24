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
    ╔═══════════════════════════════════════════╗
    ║  Inventory Management System Running      ║
    ╠═══════════════════════════════════════════╣
    ║  API:   http://localhost:${PORT}          ╣
    ║  Docs:  http://localhost:${PORT}/api-docs ╣
    ║  Env:   ${process.env.NODE_ENV}           ╣  
    ╚═══════════════════════════════════════════╝  
  `);
});

// Run seed on first deployment if SEED_ON_START is set
if (process.env.SEED_ON_START === 'true') {
  // Use a runtime require with a constructed path so TypeScript won't try
  // to resolve the module at compile time (avoids rootDir errors).
  try {
    const path = require('path')
    const seedPath = path.join(__dirname, '..', 'prisma', 'seed')
    // require the seed file at runtime; it should execute on import
    require(seedPath)
    console.log('✅ Seed completed')
  } catch (err) {
    console.error('Seed error:', err)
  }
}