import { z } from 'zod';

// Register Schema 
export const registerSchema = z.object({
  body: z.object({

    name: z
      .string({ error: 'Name is required' })
      .min(2, 'Name must be at least 2 characters')
      .trim(),

    // z.email() is now a top-level function in Zod v4
    // NOT z.string().email() — that is deprecated
    email: z.email({ error: 'Must be a valid email address' }),

    password: z
      .string({ error: 'Password is required' })
      .min(8, 'Password must be at least 8 characters')
      .regex(
        /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
        'Password must contain uppercase, lowercase and a number'
      ),

    role: z
      .enum(['admin', 'manager', 'cashier', 'warehouse', 'viewer'])
      .optional()
      .default('cashier'),

  }),
});

// Login Schema
export const loginSchema = z.object({
  body: z.object({

    email: z.email({ error: 'Must be a valid email address' }),

    password: z
      .string({ error: 'Password is required' })
      .min(1, 'Password is required'),

  }),
});

//Inferred Type
export type RegisterInput = z.infer<typeof registerSchema>['body'];
export type LoginInput   = z.infer<typeof loginSchema>['body'];0