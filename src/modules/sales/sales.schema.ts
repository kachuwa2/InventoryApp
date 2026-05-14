import { z } from 'zod';

const saleItemSchema = z.object({
  productId: z
    .string({ error: 'Product ID is required' }),

  quantity: z
    .number({ error: 'Quantity is required' })
    .min(0.01, 'Quantity must be greater than zero'),

  // Optional per-item discount percentage
  discountPct: z
    .number()
    .min(0)
    .max(100)
    .optional()
    .default(0),
});

export const createSaleSchema = z.object({
  body: z.object({

    // Customer is optional — walk-in customers
    // have no account in the system
    customerId: z
      .string()
      .optional(),

    // retail or wholesale — determines pricing tier
    type: z
      .enum(['retail', 'wholesale'])
      .optional()
      .default('retail'),

    // Order-level discount percentage
    discount: z
      .number()
      .min(0, 'Discount cannot be negative')
      .max(100, 'Discount cannot exceed 100%')
      .optional()
      .default(0),

    notes: z
      .string()
      .trim()
      .optional(),

    items: z
      .array(saleItemSchema)
      .min(1, 'Sale must have at least one item'),

  }),
});

export const idParamSchema = z.object({
  params: z.object({
    id: z.string({ error: 'ID is required' }),
  }),
});

export type CreateSaleInput = z.infer<typeof createSaleSchema>['body'];