const fs   = require('fs')
const path = require('path')

function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true })
  const entries = fs.readdirSync(src, { withFileTypes: true })

  for (const entry of entries) {
    const srcPath  = path.join(src,  entry.name)
    const destPath = path.join(dest, entry.name)

    if (entry.isDirectory()) {
      copyDir(srcPath, destPath)
    } else {
      fs.copyFileSync(srcPath, destPath)
    }
  }
}

const src  = path.join(__dirname, '..', 'src',  'generated')
const dest = path.join(__dirname, '..', 'dist', 'generated')

if (!fs.existsSync(src)) {
  console.error('Source not found:', src)
  process.exit(1)
}

copyDir(src, dest)
console.log('✅ Prisma client copied to dist/generated/')