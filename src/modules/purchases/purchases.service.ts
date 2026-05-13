import { db } from '../../config/database';
import { Prisma } from '../../generated/prisma';
import {
  NotFoundError,
  ConflictError,
  ValidationError,
} from '../../utils/errors';
import {
  CreatePurchaseOrderInput,
  UpdatePurchaseOrderInput,
  ReceivePurchaseOrderInput,
} from './purchases.schema';

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
      // Count items without loading all of them
      _count:    { select: { items: true } },
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
// The approver is recorded for accountability.
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
      `Cannot approve — order is already "${order.status}"`
    );
  }

  return db.$transaction(async (tx) => {
    const approved = await tx.purchaseOrder.update({
      where: { id },
      data: {
        status:      'approved',
        approvedById: userId,
        approvedAt:   new Date(),
      },
    });

    await tx.auditLog.create({
      data: {
        userId,
        action:    'PURCHASE_ORDER_APPROVED',
        tableName: 'purchase_orders',
        recordId:  id,
        beforeState: { status: 'draft' },
        afterState:  { status: 'approved' },
        ipAddress:   ip,
      },
    });

    return approved;
  });
}

// ─── Receive purchase order ─────────────────────────────
// This is the most critical function in the system.
// When stock physically arrives, this function:
// 1. Validates the order is in approved status
// 2. For each item received:
//    a. Creates a stock movement (adds to ledger)
//    b. Updates the quantity received on the order item
// 3. Updates the order status to received
// 4. Writes an audit log entry
// ALL of this happens in ONE database transaction.
// If anything fails, everything rolls back.
export async function receivePurchaseOrder(
  id: string,
  data: ReceivePurchaseOrderInput,
  userId: string,
  ip: string
) {
  // Load the full order with all items
  const order = await db.purchaseOrder.findFirst({
    where: { id },
    include: { items: true },
  });
  if (!order) throw new NotFoundError('Purchase order');

  // Can only receive an approved order
  if (order.status !== 'approved') {
    throw new ConflictError(
      `Cannot receive — order status is "${order.status}". Order must be approved first.`
    );
  }

  // Validate each item being received
  for (const receivedItem of data.items) {
    const orderItem = order.items.find(i => i.id === receivedItem.itemId);

    if (!orderItem) {
      throw new ValidationError(
        `Item ${receivedItem.itemId} does not belong to this order`
      );
    }

    // Cannot receive more than was ordered
    if (receivedItem.quantityReceived > Number(orderItem.quantityOrdered)) {
      throw new ValidationError(
        `Cannot receive ${receivedItem.quantityReceived} units — only ${orderItem.quantityOrdered} were ordered`
      );
    }
  }

  // Everything is valid — now execute the transaction
  return db.$transaction(async (tx) => {
    // Process each received item
    for (const receivedItem of data.items) {
      const orderItem = order.items.find(
        i => i.id === receivedItem.itemId
      )!;

      // Skip items where quantity received is zero —
      // the supplier might not have shipped everything
      if (receivedItem.quantityReceived <= 0) continue;

      // Create a stock movement for this item.
      // This is what actually adds the stock to the ledger.
      // The unitCost records exactly what we paid per unit
      // for this specific batch of goods.
      await tx.stockMovement.create({
        data: {
          productId:     orderItem.productId,
          type:          'purchase',
          quantity:      receivedItem.quantityReceived,
          unitCost:      orderItem.unitCost,
          referenceId:   order.id,
          referenceType: 'purchase_order',
          notes: `Received via PO ${order.id}`,
          performedById: userId,
        },
      });

      // Update how many units were received on this line item
      await tx.purchaseOrderItem.update({
        where: { id: receivedItem.itemId },
        data: {
          quantityReceived: receivedItem.quantityReceived,
        },
      });
    }

    // Mark the entire order as received
    const received = await tx.purchaseOrder.update({
      where: { id },
      data: {
        status:     'received',
        receivedAt: new Date(),
      },
      include: {
        items:    { include: { product: true } },
        supplier: true,
      },
    });

    await tx.auditLog.create({
      data: {
        userId,
        action:    'PURCHASE_ORDER_RECEIVED',
        tableName: 'purchase_orders',
        recordId:  id,
        beforeState: { status: 'approved' },
        afterState:  { status: 'received' },
        ipAddress:   ip,
      },
    });

    return received;
  });
}

// ─── Cancel purchase order ──────────────────────────────
export async function cancelPurchaseOrder(
  id: string,
  userId: string,
  ip: string
) {
  const order = await db.purchaseOrder.findFirst({
    where: { id },
  });
  if (!order) throw new NotFoundError('Purchase order');

  // Cannot cancel an already received order —
  // stock has already been added to the ledger
  if (order.status === 'received') {
    throw new ConflictError(
      'Cannot cancel a received order — stock has already been added'
    );
  }

  if (order.status === 'cancelled') {
    throw new ConflictError('Order is already cancelled');
  }

  return db.$transaction(async (tx) => {
    const cancelled = await tx.purchaseOrder.update({
      where: { id },
      data: { status: 'cancelled' },
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