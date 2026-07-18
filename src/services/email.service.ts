import { Resend } from 'resend'
import { db } from '../config/database'

const apiKey = process.env.RESEND_API_KEY;

if (!apiKey) {
  throw new Error('RESEND_API_KEY is not configured');
}

const resend = new Resend(apiKey);

const FROM   = process.env.EMAIL_FROM || 'StockFlow <onboarding@resend.dev>'

const APP_URL = process.env.APP_URL || 'http://localhost:5173'



// ── Shared wrapper ───────────────────────────────────────
function emailWrapper(title: string, body: string): string {
  return `
  <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;background:#fff;">
    <div style="background:#7C6EF8;padding:20px;text-align:center;">
      <h1 style="color:#fff;margin:0;font-size:20px;">StockFlow Kitchen Utensils</h1>
    </div>
    <div style="padding:24px;">
      <h2 style="color:#333;font-size:18px;margin-top:0;">${title}</h2>
      ${body}
    </div>
    <div style="background:#f5f5f5;padding:16px;text-align:center;color:#999;font-size:12px;">
      Powered by StockFlow Inventory System
    </div>
  </div>
  `
}

async function send(
  to: string | string[],
  subject: string,
  html: string
): Promise<{ success: boolean; error?: string }> {
  try {
    await resend.emails.send({ from: FROM, to, subject, html })
    return { success: true }
  } catch (error) {
    logger.error(error, 'Email error')
    return { success: false, error: (error as Error).message }
  }
}

// ── Helper: admin + manager emails ───────────────────────
export async function getNotificationRecipients(): Promise<string[]> {
  const users = await db.user.findMany({
    where: {
      role: { in: ['admin', 'manager'] },
      isActive: true,
      deletedAt: null,
    },
    select: { email: true },
  })
  return users.map(u => u.email)
}

// ── Helper: compute current stock (no circular import) ──
async function computeStock(productId: string): Promise<number> {
  const [inbound, outbound] = await Promise.all([
    db.stockMovement.aggregate({
      where: { productId, type: { in: ['purchase', 'adjustment_in', 'return_in'] } },
      _sum: { quantity: true },
    }),
    db.stockMovement.aggregate({
      where: { productId, type: { in: ['sale', 'adjustment_out', 'return_out'] } },
      _sum: { quantity: true },
    }),
  ])
  return Number(inbound._sum.quantity ?? 0) - Number(outbound._sum.quantity ?? 0)
}

// ── 1. LOW STOCK ALERT ────────────────────────────────────
export async function sendLowStockAlert(
  recipients: string[],
  products: Array<{
    name: string
    sku: string
    currentStock: number
    reorderPoint: number
  }>
) {
  const rows = products.map(p => `
    <tr>
      <td style="padding:8px;border-bottom:1px solid #eee;">
        ${p.name}<br/>
        <span style="color:#999;font-size:12px;">${p.sku}</span>
      </td>
      <td style="padding:8px;border-bottom:1px solid #eee;text-align:center;color:#e74c3c;font-weight:bold;">
        ${p.currentStock}
      </td>
      <td style="padding:8px;border-bottom:1px solid #eee;text-align:center;">
        ${p.reorderPoint}
      </td>
    </tr>
  `).join('')

  const body = `
    <p style="color:#555;">
      The following ${products.length} product(s) have reached
      or fallen below their reorder point and need restocking:
    </p>
    <table style="width:100%;border-collapse:collapse;font-size:14px;margin-top:12px;">
      <thead>
        <tr style="background:#f5f5f5;">
          <th style="padding:8px;text-align:left;">Product</th>
          <th style="padding:8px;text-align:center;">Current</th>
          <th style="padding:8px;text-align:center;">Reorder At</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
    <p style="margin-top:20px;">
      <a href="${APP_URL}/purchases/new"
         style="background:#7C6EF8;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;display:inline-block;">
        Create Purchase Order
      </a>
    </p>
  `
  return send(
    recipients,
    `⚠️ Low Stock Alert — ${products.length} product(s) need restocking`,
    emailWrapper('Low Stock Alert', body)
  )
}

// ── Check stock levels and alert if low ─────────────────
export async function checkAndSendLowStockAlert(productIds: string[]): Promise<void> {
  try {
    const lowProducts: Array<{
      name: string; sku: string; currentStock: number; reorderPoint: number
    }> = []

    for (const productId of productIds) {
      const product = await db.product.findUnique({
        where: { id: productId },
        select: { name: true, sku: true, reorderPoint: true },
      })
      if (!product) continue

      const stock = await computeStock(productId)
      if (stock <= Number(product.reorderPoint)) {
        lowProducts.push({
          name:         product.name,
          sku:          product.sku,
          currentStock: stock,
          reorderPoint: Number(product.reorderPoint),
        })
      }
    }

    if (lowProducts.length === 0) return

    const recipients = await getNotificationRecipients()
    if (recipients.length > 0) {
      await sendLowStockAlert(recipients, lowProducts)
    }
  } catch (err) {
    logger.error(err, 'Low stock alert error')
  }
}

// ── 2. PASSWORD RESET ─────────────────────────────────────
export async function sendPasswordResetEmail(
  to: string,
  name: string,
  resetToken: string
) {
  const resetLink = `${APP_URL}/reset-password?token=${resetToken}`
  const body = `
    <p style="color:#555;">Hi ${name},</p>
    <p style="color:#555;">
      We received a request to reset your password.
      Click the button below to set a new password.
      This link expires in 1 hour.
    </p>
    <p style="margin:24px 0;">
      <a href="${resetLink}"
         style="background:#7C6EF8;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;display:inline-block;">
        Reset Password
      </a>
    </p>
    <p style="color:#999;font-size:13px;">
      If you did not request this, ignore this email.
      Your password will not change.
    </p>
    <p style="color:#999;font-size:12px;word-break:break-all;">
      Or paste this link: ${resetLink}
    </p>
  `
  return send(
    to,
    'Reset your StockFlow password',
    emailWrapper('Password Reset Request', body)
  )
}

// ── 3. DELIVERY REMINDER ──────────────────────────────────
export async function sendDeliveryReminder(
  recipients: string[],
  po: {
    reference: string
    supplierName: string
    expectedDate: string
    itemCount: number
  }
) {
  const body = `
    <p style="color:#555;">A purchase order is expected to arrive soon:</p>
    <table style="width:100%;font-size:14px;margin:16px 0;">
      <tr><td style="color:#999;padding:4px;">PO Reference:</td>
          <td style="padding:4px;font-weight:bold;">${po.reference}</td></tr>
      <tr><td style="color:#999;padding:4px;">Supplier:</td>
          <td style="padding:4px;">${po.supplierName}</td></tr>
      <tr><td style="color:#999;padding:4px;">Expected:</td>
          <td style="padding:4px;color:#f39c12;font-weight:bold;">${po.expectedDate}</td></tr>
      <tr><td style="color:#999;padding:4px;">Items:</td>
          <td style="padding:4px;">${po.itemCount} product(s)</td></tr>
    </table>
    <p style="color:#555;">Please prepare to receive and inspect this delivery.</p>
  `
  return send(
    recipients,
    `📦 Delivery reminder — ${po.reference} arriving ${po.expectedDate}`,
    emailWrapper('Upcoming Delivery', body)
  )
}

// ── 4. DELIVERY ARRIVED ───────────────────────────────────
export async function sendDeliveryArrivedEmail(
  recipients: string[],
  po: {
    reference: string
    supplierName: string
    receivedDate: string
    itemsReceived: Array<{ name: string; ordered: number; received: number }>
  }
) {
  const rows = po.itemsReceived.map(item => {
    const short = item.received < item.ordered
    return `
    <tr>
      <td style="padding:8px;border-bottom:1px solid #eee;">${item.name}</td>
      <td style="padding:8px;border-bottom:1px solid #eee;text-align:center;">${item.ordered}</td>
      <td style="padding:8px;border-bottom:1px solid #eee;text-align:center;color:${short ? '#f39c12' : '#27ae60'};">
        ${item.received}${short ? ' ⚠️' : ' ✓'}
      </td>
    </tr>`
  }).join('')

  const body = `
    <p style="color:#555;">The following delivery has been received and stock updated:</p>
    <table style="width:100%;font-size:14px;margin:12px 0;">
      <tr><td style="color:#999;padding:4px;">PO Reference:</td>
          <td style="padding:4px;font-weight:bold;">${po.reference}</td></tr>
      <tr><td style="color:#999;padding:4px;">Supplier:</td>
          <td style="padding:4px;">${po.supplierName}</td></tr>
      <tr><td style="color:#999;padding:4px;">Received:</td>
          <td style="padding:4px;color:#27ae60;">${po.receivedDate}</td></tr>
    </table>
    <table style="width:100%;border-collapse:collapse;font-size:13px;">
      <thead>
        <tr style="background:#f5f5f5;">
          <th style="padding:8px;text-align:left;">Product</th>
          <th style="padding:8px;text-align:center;">Ordered</th>
          <th style="padding:8px;text-align:center;">Received</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  `
  return send(
    recipients,
    `✅ Delivery received — ${po.reference}`,
    emailWrapper('Delivery Received', body)
  )
}
