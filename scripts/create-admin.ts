import bcrypt from 'bcryptjs'
import { PrismaClient } from '../src/generated/prisma'
import { PrismaPg } from '@prisma/adapter-pg'
import { config } from 'dotenv'

config()

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!,
})
const db = new PrismaClient({ adapter })

async function createAdmin() {
  const existing = await db.user.count()
  if (existing > 0) {
    console.log('Database already has users. Skipping.')
    await db.$disconnect()
    return
  }

  const passwordHash = await bcrypt.hash('Admin1234', 12)

  const admin = await db.user.create({
    data: {
      name:         'Admin',
      email:        'nischalgear05@gmail.com',
      passwordHash,
      role:         'admin',
      isActive:     true,
    },
    select: {
      id:        true,
      name:      true,
      email:     true,
      role:      true,
      createdAt: true,
    }
  })

  console.log('✅ Admin created:')
  console.log(`   Email:    ${admin.email}`)
  console.log(`   Password: Admin1234`)
  console.log(`   Role:     ${admin.role}`)
  console.log('')
  console.log('Login at: http://localhost:5173')
  console.log('Change your password after first login!')

  await db.$disconnect()
}

createAdmin().catch(e => {
  console.error(e)
  process.exit(1)
})
