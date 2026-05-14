import { z } from 'zod';

export const createCustomerSchema = z.object({
  body: z.object({

    name: z
      .string({ error: 'Name is required' })
      .min(2, 'Name must be at least 2 characters')
      .trim(),

    phone: z
      .string()
      .trim()
      .optional(),

    email: z
      .email()
      .optional(),

    address: z
      .string()
      .trim()
      .optional(),

    type: z
      .enum(['retail', 'wholesale'])
      .optional()
      .default('retail'),

    creditLimit: z
      .number()
      .min(0, 'Credit limit cannot be negative')
      .optional()
      .default(0),

  }),
});

export const updateCustomerSchema = z.object({
  params: z.object({
    id: z.string({ error: 'ID is required' }),
  }),
  body: z.object({
    name:        z.string().min(2).trim().optional(),
    phone:       z.string().trim().optional(),
    email:       z.email().optional(),
    address:     z.string().trim().optional(),
    type:        z.enum(['retail', 'wholesale']).optional(),
    creditLimit: z.number().min(0).optional(),
  }),
});

export const idParamSchema = z.object({
  params: z.object({
    id: z.string({ error: 'ID is required' }),
  }),
});

export type CreateCustomerInput = z.infer<typeof createCustomerSchema>['body'];
export type UpdateCustomerInput = z.infer<typeof updateCustomerSchema>['body'];