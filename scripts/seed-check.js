const { PrismaClient } = require('../dist/generated/prisma')
const { PrismaPg } = require('@prisma/adapter-pg')

async function checkAndSeed() {
  const adapter = new PrismaPg({
    connectionString: process.env.DATABASE_URL,
  })
  const prisma = new PrismaClient({ adapter })

  try {
    const userCount = await prisma.user.count()

    if (userCount === 0) {
      console.log('📦 Empty database detected — running seed...')
      // Import and run the compiled seed
      const { execSync } = require('child_process')
      execSync('npx ts-node prisma/seed.ts', {
        stdio: 'inherit',
        env: process.env,
      })
      console.log('✅ Seed completed successfully')
    } else {
      console.log(`✅ Database already has ${userCount} users — skipping seed`)
    }
  } catch (err) {
    console.error('⚠️ Seed check failed:', err.message)
    // Do not crash the server if seed fails
    // The app can still run without seed data
  } finally {
    await prisma.$disconnect()
  }
}

checkAndSeed()