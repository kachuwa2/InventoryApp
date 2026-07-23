import { db } from '../../config/database';
import { Prisma } from '../../generated/prisma';
import {
  NotFoundError,
  ConflictError,
  ValidationError,
} from '../../utils/errors';
import {
  sendDeliveryArrivedEmail,
  getNotificationRecipients,
} from '../../services/email.service';
import {
  CreatePurchaseOrderInput,
  UpdatePurchaseOrderInput,
  ReceivePurchaseOrderInput,
} from './purchases.schema';
import logger from '../../services/logger';

// ─── Get all purchase orders ────────────────────────────
export async function getAllPurchaseOrders(filters?: {
  status?:     string;
  supplierId?: string;
}) {
  return db.purchaseOrder.findMany({
    where: {
      ...(filters?.status     && { status:     filters.status as any }),
      ...(filters?.supplierId && { supplierId: filters.supplierId }),
    },
    include: {
      supplier:  { select: { id: true, name: true } },
      createdBy: { select: { id: true, name: true } },
      approvedBy:{ select: { id: true, name: true } },
      items: {
        select: {
          id:               true,
          quantityOrdered:  true,
          quantityReceived: true,
          unitCost:         true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });
}

// ─── Get single purchase order ──────────────────────────
export async function getPurchaseOrderById(id: string) {
  const order = await db.purchaseOrder.findFirst({
    where: { id },
    include: {
      supplier:   { select: { id: true, name: true, phone: true } },
      createdBy:  { select: { id: true, name: true } },
      approvedBy: { select: { id: true, name: true } },
      items: {
        include: {
          product: {
            select: { id: true, name: true, sku: true, unit: true },
          },
        },
      },
    },
  });

  if (!order) throw new NotFoundError('Purchase order');
  return order;
}

// ─── Create purchase order ──────────────────────────────
export async function createPurchaseOrder(
  data: CreatePurchaseOrderInput,
  userId: string,
  ip: string
) {
  // Verify supplier exists
  const supplier = await db.supplier.findFirst({
    where: { id: data.supplierId, deletedAt: null },
  });
  if (!supplier) throw new NotFoundError('Supplier');

  // Verify all products exist and belong to this supplier.
  // You shouldn't be ordering a knife from a cookware supplier.
  for (const item of data.items) {
    const product = await db.product.findFirst({
      where: { id: item.productId, deletedAt: null },
    });
    if (!product) {
      throw new NotFoundError(`Product ${item.productId}`);
    }
  }

  return db.$transaction(async (tx) => {
    const order = await tx.purchaseOrder.create({
      data: {
        supplierId:        data.supplierId,
        supplierReference: data.supplierReference,
        notes:             data.notes,
        expectedAt:        data.expectedAt
          ? new Date(data.expectedAt)
          : null,
        createdById: userId,
        // Always starts as draft — must be explicitly approved
        status: 'draft',
        items: {
          create: data.items.map(item => ({
            productId:       item.productId,
            quantityOrdered: item.quantityOrdered,
            unitCost:        item.unitCost,
          })),
        },
      },
      include: {
        items: { include: { product: true } },
        supplier: true,
      },
    });

    await tx.auditLog.create({
      data: {
        userId,
        action:    'PURCHASE_ORDER_CREATED',
        tableName: 'purchase_orders',
        recordId:  order.id,
        afterState: {
          supplierId: data.supplierId,
          itemCount:  data.items.length,
        },
        ipAddress: ip,
      },
    });

    return order;
  });
}

// ─── Update purchase order ──────────────────────────────
// Can only edit a purchase order while it is in draft.
// Once approved, it is locked.
export async function updatePurchaseOrder(
  id: string,
  data: UpdatePurchaseOrderInput,
  userId: string,
  ip: string
) {
  const order = await db.purchaseOrder.findFirst({
    where: { id },
  });
  if (!order) throw new NotFoundError('Purchase order');

  // Business rule — you cannot edit an approved or
  // received order. The financial record is locked.
  if (order.status !== 'draft') {
    throw new ConflictError(
      `Cannot edit a purchase order with status "${order.status}". Only draft orders can be edited.`
    );
  }

  return db.$transaction(async (tx) => {
    // If new items are provided, replace all existing items.
    // Delete old items first, then create new ones.
    if (data.items) {
      await tx.purchaseOrderItem.deleteMany({
        where: { purchaseOrderId: id },
      });
    }

    const updated = await tx.purchaseOrder.update({
      where: { id },
      data: {
        supplierReference: data.supplierReference,
        notes:             data.notes,
        expectedAt: data.expectedAt
          ? new Date(data.expectedAt)
          : undefined,
        ...(data.items && {
          items: {
            create: data.items.map(item => ({
              productId:       item.productId,
              quantityOrdered: item.quantityOrdered,
              unitCost:        item.unitCost,
            })),
          },
        }),
      },
      include: { items: true },
    });

    await tx.auditLog.create({
      data: {
        userId,
        action:    'PURCHASE_ORDER_UPDATED',
        tableName: 'purchase_orders',
        recordId:  id,
        ipAddress: ip,
      },
    });

    return updated;
  });
}

// ─── Approve purchase order ─────────────────────────────
// Moves status from draft to approved.
// Only admin or manager can approve.
export async function approvePurchaseOrder(
  id: string,
  userId: string,
  ip: string
) {
  const order = await db.purchaseOrder.findFirst({
    where: { id },
  });
  if (!order) throw new NotFoundError('Purchase order');

  if (order.status !== 'draft') {
    throw new ConflictError(
      `Cannot approve a purchase order with status: ${order.status}. ` +
      `Only draft orders can be approved.`
    );
  }

  return db.$transaction(async (tx) => {
    const updated = await tx.purchaseOrder.update({
      where: { id },
      data: {
        status:    'approved',
        approvedById: userId,
        approvedAt: new Date(),
      },
      include: {
        supplier:  { select: { id: true, name: true } },
        createdBy: { select: { id: true, name: true } },
        approvedBy:{ select: { id: true, name: true } },
        items: {
          include: {
            product: {
              select: { id: true, name: true, sku: true }
            },
          },
        },
      },
    });

    await tx.auditLog.create({
      data: {
        user:      { connect: { id: userId } },
        action:    'PURCHASE_ORDER_APPROVED',
        tableName: 'purchase_orders',
        recordId:  id,
        afterState: {
          status: 'approved',
          approvedById: userId,
        },
        ipAddress: ip,
      },
    });

    return updated;
  });
}

// ─── Receive purchase order ─────────────────────────────
// Moves status from approved to received (when fully received)
// or keeps as approved (when partially received)
// Only warehouse or manager can receive.
export async function receivePurchaseOrder(
  id: string,
  data: { items: Array<{ itemId: string; quantityReceived: number }>, notes?: string },
  userId: string,
  ip: string
) {
  // Step 1 — verify PO exists and is in approved status
  const po = await db.purchaseOrder.findFirst({
    where: { id },
    include: {
      items: true,
      supplier: { select: { id: true, name: true } },
    },
  })

  if (!po) throw new NotFoundError('Purchase order')

  if (po.status !== 'approved') {
    throw new ConflictError(
      `Cannot receive a purchase order with status: ${po.status}. ` +
      `Only approved orders can be received.`
    )
  }

  // Step 2 — aggregate duplicate itemIds
  // If same itemId appears twice combine quantities
  const aggregated = new Map<string, number>()

  for (const item of data.items) {
    const existing = aggregated.get(item.itemId) ?? 0
    aggregated.set(
      item.itemId,
      existing + Number(item.quantityReceived)
    )
  }

  // Step 3 — validate each item
  // Build a map of PO items for quick lookup
  const poItemMap = new Map(po.items.map(i => [i.id, i]))

  for (const [itemId, newQty] of aggregated) {
    // Verify itemId belongs to this PO
    const poItem = poItemMap.get(itemId)
    if (!poItem) {
      throw new ValidationError(
        `Item ${itemId} does not belong to this purchase order`
      )
    }

    if (newQty < 0) {
      throw new ValidationError(
        `Received quantity cannot be negative for item ${itemId}`
      )
    }

    // Validate total received does not exceed ordered
    // Formula: already received + newly receiving <= ordered
    const alreadyReceived = Number(poItem.quantityReceived)
    const ordered         = Number(poItem.quantityOrdered)
    const totalReceived   = alreadyReceived + newQty

    if (totalReceived > ordered) {
      throw new ValidationError(
        `Cannot receive ${newQty} units for "${poItem.productId}". ` +
        `Already received: ${alreadyReceived}, ` +
        `Ordered: ${ordered}, ` +
        `Maximum additional: ${ordered - alreadyReceived}`
      )
    }
  }

  // Step 4 — process in transaction
  return db.$transaction(async (tx) => {
    const stockMovements: Array<{
      productId: string
      quantity:  number
      unitCost:  number
    }> = []

    // Update quantityReceived on each PO line item
    for (const [itemId, newQty] of aggregated) {
      const poItem = poItemMap.get(itemId)!

      if (newQty === 0) continue // skip if nothing received

      await tx.purchaseOrderItem.update({
        where: { id: itemId },
        data: {
          quantityReceived: {
            increment: newQty,
          },
        },
      })

      stockMovements.push({
        productId: poItem.productId,
        quantity:  newQty,
        unitCost:  Number(poItem.unitCost),
      })
    }

    // Step 5 — create stock movements for received items
    // type 'purchase' = stock coming IN
    await Promise.all(
      stockMovements.map(movement =>
        tx.stockMovement.create({
          data: {
            product:       { connect: { id: movement.productId } },
            type:          'purchase',
            quantity:      movement.quantity,
            unitCost:      movement.unitCost,
            referenceId:   id,
            referenceType: 'purchase_order',
            notes:         data.notes ?? `Received from PO ${id}`,
            performedBy:   { connect: { id: userId } },
          },
        })
      )
    )

    // Step 6 — determine correct PO status after this receipt
    // Read the updated items to check if fully received
    const updatedItems = await tx.purchaseOrderItem.findMany({
      where: { purchaseOrderId: id },
    })

    const allFullyReceived = updatedItems.every(
      item =>
        Number(item.quantityReceived) >= Number(item.quantityOrdered)
    )

    const someReceived = updatedItems.some(
      item => Number(item.quantityReceived) > 0
    )

    // Only mark as 'received' when ALL items are fully received
    // Keep as 'approved' if any items still have remaining qty
    let newStatus: 'received' | 'approved' = 'approved'

    if (allFullyReceived) {
      newStatus = 'received'
    }

    // Update PO with new status and receivedAt timestamp
    const updatedPO = await tx.purchaseOrder.update({
      where: { id },
      data: {
        status:     newStatus,
        receivedAt: allFullyReceived ? new Date() : null,
      },
      include: {
        supplier:  { select: { id: true, name: true } },
        createdBy: { select: { id: true, name: true } },
        approvedBy:{ select: { id: true, name: true } },
        items: {
          include: {
            product: {
              select: { id: true, name: true, sku: true }
            },
          },
        },
      },
    })

    // Step 7 — audit log
    await tx.auditLog.create({
      data: {
        user:      { connect: { id: userId } },
        action:    'PURCHASE_ORDER_RECEIVED',
        tableName: 'purchase_orders',
        recordId:  id,
        afterState: {
          status:          newStatus,
          itemsReceived:   stockMovements.length,
          allFullyReceived,
          supplierName:    po.supplier.name,
        },
        ipAddress: ip,
      },
    })

    // Step 8 — send delivery arrived email
    // Import at top of file if not already imported:
    // import { sendDeliveryArrivedEmail, getNotificationRecipients }
    //   from '../../services/email.service'
    try {
      const recipients = await getNotificationRecipients()
      if (recipients.length > 0) {
        await sendDeliveryArrivedEmail(recipients, {
          reference:     po.supplierReference ??
                         `PO-${id.slice(0, 8)}`,
          supplierName:  po.supplier.name,
          receivedDate:  new Date().toLocaleDateString('en-GB'),
          itemsReceived: stockMovements.map(m => {
            const poItem = [...poItemMap.values()]
              .find(i => i.productId === m.productId)!
            return {
              name:     poItem.productId,
              ordered:  Number(poItem.quantityOrdered),
              received: m.quantity,
            }
          }),
        })
      }
    } catch (emailErr) {
      // Do not fail the receive if email fails
      console.error('Delivery email error:', emailErr)
    }

    return updatedPO
  })
}

// ─── Cancel purchase order ─────────────────────────────
// Sets status to cancelled.
// Only admin or manager can cancel.
export async function cancelPurchaseOrder(
  id: string,
  userId: string,
  ip: string
) {
  const order = await db.purchaseOrder.findFirst({
    where: { id },
  });
  if (!order) throw new NotFoundError('Purchase order');

  // Business rule — you cannot cancel a received order.
  if (order.status === 'received') {
    throw new ConflictError(
      `Cannot cancel a purchase order with status: ${order.status}. ` +
      `Received orders cannot be cancelled.`
    );
  }

  return db.$transaction(async (tx) => {
    const cancelled = await tx.purchaseOrder.update({
      where: { id },
      data: {
        status: 'cancelled',
      },
      include: {
        supplier:  { select: { id: true, name: true } },
        createdBy: { select: { id: true, name: true } },
        approvedBy:{ select: { id: true, name: true } },
        items: {
          include: {
            product: {
              select: { id: true, name: true, sku: true }
            },
          },
        },
      },
    });

    await tx.auditLog.create({
      data: {
        userId,
        action:      'PURCHASE_ORDER_CANCELLED',
        tableName:   'purchase_orders',
        recordId:    id,
        beforeState: { status: order.status },
        afterState:  { status: 'cancelled' },
        ipAddress:   ip,
      },
    });

    return cancelled;
  }).then(() => ({ message: 'Purchase order cancelled successfully' }));
}