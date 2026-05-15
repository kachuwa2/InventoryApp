'use strict';

// Plain CommonJS — avoids ts-jest transformation issues for globalSetup.
// Creates inventory_db_test if it doesn't exist, then deploys all migrations.
// dotenv is loaded here because globalSetup runs before setupFiles.

require('dotenv').config({ path: '.env.test', override: true });

const { Client } = require('pg');
const { execSync } = require('child_process');

module.exports = async function globalSetup() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL is not set — check that .env.test exists');
  }

  // Parse the DB name and build an admin URL that connects to the
  // maintenance "postgres" database so we can CREATE DATABASE.
  const url = new URL(connectionString);
  const dbName = url.pathname.replace(/^\//, '');
  url.pathname = '/postgres';
  const adminUrl = url.toString();

  const client = new Client({ connectionString: adminUrl });
  await client.connect();

  try {
    await client.query(`CREATE DATABASE "${dbName}"`);
    console.log(`\n  ✓ Created test database: ${dbName}`);
  } catch (err) {
    if (err.code === '42P04') {
      // 42P04 = duplicate_database — already exists, that's fine
      console.log(`\n  ✓ Test database "${dbName}" already exists`);
    } else {
      throw err;
    }
  } finally {
    await client.end();
  }

  // Apply all pending Prisma migrations to the test DB.
  // DATABASE_URL is already pointing to the test DB (set by dotenv-cli).
  execSync('npx prisma migrate deploy --config prisma.config.mjs', {
    stdio: 'inherit',
    env: process.env,
  });
};
