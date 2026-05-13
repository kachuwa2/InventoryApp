import { z } from 'zod';

// Each line item on the purchase order
const orderItemSchema = z.object({
  productId: z
    .string({ error: 'Product ID is required' }),

  quantityOrdered: z
    .number({ error: 'Quantity is required' })
    .min(0.01, 'Quantity must be greater than zero'),

  unitCost: z
    .number({ error: 'Unit cost is required' })
    .min(0.01, 'Unit cost must be greater than zero'),
});

export const createPurchaseOrderSchema = z.object({
  body: z.object({
    supplierId: z
      .string({ error: 'Supplier is required' }),

    supplierReference: z
      .string()
      .trim()
      .optional(),

    notes: z
      .string()
      .trim()
      .optional(),

    expectedAt: z
      .string()
      .optional(),

    // A purchase order must have at least one item.
    // An empty order makes no business sense.
    items: z
      .array(orderItemSchema)
      .min(1, 'Purchase order must have at least one item'),
  }),
});

export const updatePurchaseOrderSchema = z.object({
  params: z.object({
    id: z.string({ error: 'ID is required' }),
  }),
  body: z.object({
    supplierReference: z.string().trim().optional(),
    notes:             z.string().trim().optional(),
    expectedAt:        z.string().optional(),
    items: z
      .array(orderItemSchema)
      .min(1, 'Purchase order must have at least one item')
      .optional(),
  }),
});

// When receiving stock, you confirm how many
// units actually arrived for each item
const receiveItemSchema = z.object({
  itemId: z
    .string({ error: 'Item ID is required' }),

  quantityReceived: z
    .number({ error: 'Quantity received is required' })
    .min(0, 'Quantity received cannot be negative'),
});

export const receivePurchaseOrderSchema = z.object({
  params: z.object({
    id: z.string({ error: 'ID is required' }),
  }),
  body: z.object({
    items: z
      .array(receiveItemSchema)
      .min(1, 'Must confirm at least one item'),

    notes: z.string().trim().optional(),
  }),
});

export const idParamSchema = z.object({
  params: z.object({
    id: z.string({ error: 'ID is required' }),
  }),
});

export type CreatePurchaseOrderInput = z.infer<typeof createPurchaseOrderSchema>['body'];
export type UpdatePurchaseOrderInput = z.infer<typeof updatePurchaseOrderSchema>['body'];
export type ReceivePurchaseOrderInput = z.infer<typeof receivePurchaseOrderSchema>['body'];