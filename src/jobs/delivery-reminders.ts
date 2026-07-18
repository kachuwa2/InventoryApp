import cron from 'node-cron'
import { db } from '../config/database'
import { sendDeliveryReminder, getNotificationRecipients } from '../services/email.service'
import logger from '../services/logger'

export function startDeliveryReminderJob() {
  // Run every day at 8:00 AM
  cron.schedule('0 8 * * *', async () => {
    logger.info('Running delivery reminder check')
    try {
      const tomorrow = new Date()
      tomorrow.setDate(tomorrow.getDate() + 2)

      const upcomingPOs = await db.purchaseOrder.findMany({
        where: {
          status: 'approved',
          expectedAt: {
            gte: new Date(),
            lte: tomorrow,
          },
        },
        include: {
          supplier: { select: { name: true } },
          _count:   { select: { items: true } },
        },
      })

      if (upcomingPOs.length === 0) return

      const recipients = await getNotificationRecipients()
      if (recipients.length === 0) return

      for (const po of upcomingPOs) {
        await sendDeliveryReminder(recipients, {
          reference:    po.supplierReference || `PO-${po.id.slice(0, 8)}`,
          supplierName: po.supplier.name,
          expectedDate: po.expectedAt
            ? new Date(po.expectedAt).toLocaleDateString('en-GB')
            : 'soon',
          itemCount: po._count.items,
        })
      }
      logger.info({ count: upcomingPOs.length }, 'Sent delivery reminders')
    } catch (err) {
      logger.error(err, 'Delivery reminder job error')
    }
  })
  logger.info('Delivery reminder job scheduled (daily 8 AM)')
}
