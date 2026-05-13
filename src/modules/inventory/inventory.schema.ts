import { z } from 'zod';

export const adjustStockSchema = z.object({
  body: z.object({

    productId: z.string({ error: 'Product ID is required' }),

    quantity: z
      .number({ error: 'Quantity is required' })
      .min(0.01, 'Quantity must be greater than zero'),

    type: z.enum(
      ['adjustment_in', 'adjustment_out'],
      { error: 'Type must be adjustment_in or adjustment_out' }
    ),

    // Notes are required — you must always explain why
    // you are manually adjusting stock
    notes: z
      .string({ error: 'Notes are required' })
      .min(5, 'Please provide a clear reason (minimum 5 characters)')
      .trim(),

    unitCost: z
      .number()
      .min(0)
      .optional(),

  }),
});

export const productIdParamSchema = z.object({
  params: z.object({
    productId: z.string({ error: 'Product ID is required' }),
  }),
});

export type AdjustStockInput = z.infer<typeof adjustStockSchema>['body'];