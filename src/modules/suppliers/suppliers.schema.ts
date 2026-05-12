import { z } from 'zod';

export const createSupplierSchema = z.object({
  body: z.object({

    name: z
      .string({ error: 'Supplier name is required' })
      .min(2, 'Name must be at least 2 characters')
      .trim(),

    contactPerson: z
      .string()
      .trim()
      .optional(),

    phone: z
      .string()
      .trim()
      .optional(),

    // z.email() is the Zod v4 top-level function —
    // not the deprecated z.string().email()
    email: z
      .email({ error: 'Must be a valid email address' })
      .optional(),

    address: z
      .string()
      .trim()
      .optional(),

    // Credit limit is how much we can owe this supplier
    // before they stop delivering. Must be zero or positive.
    creditLimit: z
      .number()
      .min(0, 'Credit limit cannot be negative')
      .optional()
      .default(0),

  }),
});

export const updateSupplierSchema = z.object({
  params: z.object({
    id: z.string({ error: 'ID is required' }),
  }),
  body: z.object({
    name: z
      .string()
      .min(2, 'Name must be at least 2 characters')
      .trim()
      .optional(),

    contactPerson: z.string().trim().optional(),
    phone:         z.string().trim().optional(),
    email:         z.email().optional(),
    address:       z.string().trim().optional(),

    creditLimit: z
      .number()
      .min(0, 'Credit limit cannot be negative')
      .optional(),
  }),
});

export const idParamSchema = z.object({
  params: z.object({
    id: z.string({ error: 'ID is required' }),
  }),
});

export type CreateSupplierInput = z.infer<typeof createSupplierSchema>['body'];
export type UpdateSupplierInput = z.infer<typeof updateSupplierSchema>['body'];