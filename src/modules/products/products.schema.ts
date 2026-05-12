import { z } from 'zod';

export const createProductSchema = z.object({
  body: z.object({

    name: z
      .string({ error: 'Product name is required' })
      .min(2, 'Name must be at least 2 characters')
      .trim(),

    sku: z
      .string({ error: 'SKU is required' })
      .min(2, 'SKU must be at least 2 characters')
      .trim()
      .toUpperCase(), // SKUs are always uppercase — e.g. PAN-001

    // Barcode is optional at creation time.
    // If not provided, the system generates one automatically.
    barcode: z
      .string()
      .trim()
      .optional(),

    description: z
      .string()
      .trim()
      .optional(),

    // The unit describes how the product is measured.
    // A frying pan is sold per "piece". Sugar is sold per "kg".
    unit: z
      .string()
      .trim()
      .optional()
      .default('piece'),

    // The stock level that triggers a low-stock alert.
    // A kitchen shop might set reorderPoint to 10 for a popular
    // pan — meaning "alert us when we have fewer than 10 left".
    reorderPoint: z
      .number()
      .min(0, 'Reorder point cannot be negative')
      .optional()
      .default(0),

    categoryId: z
      .string({ error: 'Category is required' }),

    supplierId: z
      .string({ error: 'Supplier is required' }),

    // Prices are required when creating a product.
    // You cannot add a product without knowing what it
    // costs and what you will sell it for.
    costPrice: z
      .number({ error: 'Cost price is required' })
      .min(0.01, 'Cost price must be greater than zero'),

    retailPrice: z
      .number({ error: 'Retail price is required' })
      .min(0.01, 'Retail price must be greater than zero'),

    wholesalePrice: z
      .number({ error: 'Wholesale price is required' })
      .min(0.01, 'Wholesale price must be greater than zero'),

    priceNote: z
      .string()
      .trim()
      .optional(),

  // This is a cross-field validation — it runs AFTER all the
  // individual fields are validated. It checks that the three
  // prices make business sense relative to each other.
  // A product's retail price must always be higher than its
  // cost price — otherwise you're selling at a loss.
  // Wholesale is typically between cost and retail.
  }).refine(
    (data) => data.retailPrice > data.costPrice,
    {
      error: 'Retail price must be greater than cost price',
      path: ['retailPrice'],
    }
  ).refine(
    (data) => data.wholesalePrice > data.costPrice,
    {
      error: 'Wholesale price must be greater than cost price',
      path: ['wholesalePrice'],
    }
  ).refine(
    (data) => data.retailPrice >= data.wholesalePrice,
    {
      error: 'Retail price must be greater than or equal to wholesale price',
      path: ['wholesalePrice'],
    }
  ),
});

export const updateProductSchema = z.object({
  params: z.object({
    id: z.string({ error: 'ID is required' }),
  }),
  body: z.object({
    name:         z.string().min(2).trim().optional(),
    description:  z.string().trim().optional(),
    unit:         z.string().trim().optional(),
    reorderPoint: z.number().min(0).optional(),
    categoryId:   z.string().optional(),
    supplierId:   z.string().optional(),
  }),
});

// This schema is used when a manager deliberately
// sets new prices for an existing product.
// It creates a new row in product_price_history.
export const updatePriceSchema = z.object({
  params: z.object({
    id: z.string({ error: 'Product ID is required' }),
  }),
  body: z.object({
    costPrice:      z.number().min(0.01, 'Cost price must be greater than zero'),
    retailPrice:    z.number().min(0.01, 'Retail price must be greater than zero'),
    wholesalePrice: z.number().min(0.01, 'Wholesale price must be greater than zero'),
    note:           z.string().trim().optional(),
  }).refine(
    (data) => data.retailPrice > data.costPrice,
    {
      error: 'Retail price must be greater than cost price',
      path: ['retailPrice'],
    }
  ).refine(
    (data) => data.wholesalePrice > data.costPrice,
    {
      error: 'Wholesale price must be greater than cost price',
      path: ['wholesalePrice'],
    }
  ),
});

export const idParamSchema = z.object({
  params: z.object({
    id: z.string({ error: 'ID is required' }),
  }),
});

export const barcodeParamSchema = z.object({
  params: z.object({
    code: z.string({ error: 'Barcode is required' }),
  }),
});

export type CreateProductInput = z.infer<typeof createProductSchema>['body'];
export type UpdateProductInput = z.infer<typeof updateProductSchema>['body'];
export type UpdatePriceInput   = z.infer<typeof updatePriceSchema>['body'];