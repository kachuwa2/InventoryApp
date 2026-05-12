import { z } from 'zod';

export const createCategorySchema = z.object({
  body: z.object({
    name: z
      .string({ error: 'Name is required' })
      .min(2, 'Name must be at least 2 characters')
      .trim(),

    description: z
      .string()
      .trim()
      .optional(),

    // parentId is optional — top-level categories
    // have no parent. If provided it must be a valid UUID.
    parentId: z
      .string()
      .optional(),
  }),
});

export const updateCategorySchema = z.object({
  params: z.object({
    id: z.string({ error: 'ID is required' }),
  }),
  body: z.object({
    name: z
      .string()
      .min(2, 'Name must be at least 2 characters')
      .trim()
      .optional(),

    description: z
      .string()
      .trim()
      .optional(),

    parentId: z
      .string()
      .optional(),
  }),
});

export const idParamSchema = z.object({
  params: z.object({
    id: z.string({ error: 'ID is required' }),
  }),
});

export type CreateCategoryInput = z.infer<typeof createCategorySchema>['body'];
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>['body'];