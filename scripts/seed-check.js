const { PrismaClient } = require('../dist/generated/prisma')
const { PrismaPg } = require('@prisma/adapter-pg')

async function checkDatabase() {
  const adapter = new PrismaPg({
    connectionString: process.env.DATABASE_URL,
  })
  const db = new PrismaClient({ adapter })

  try {
    const userCount = await db.user.count()
    if (userCount === 0) {
      console.log('⚠️  No users found in database.')
      console.log('    Visit /setup to create the first admin.')
      console.log('    Or run: npm run create-admin')
    } else {
      console.log(`✅ Database ready — ${userCount} user(s) found`)
    }
  } catch (err) {
    console.error('Database check error:', err.message)
  } finally {
    await db.$disconnect()
  }
}

checkDatabase()