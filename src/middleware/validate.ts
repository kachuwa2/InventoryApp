import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';

// Takes a Zod schema and returns an Express middleware function.
// The middleware validates the request before the controller runs.
// If validation fails, it passes a ZodError to the error handler.
// If validation passes, it calls next() and the controller runs.
export const validate = (schema: z.ZodType) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      await schema.parseAsync({
        body: req.body,
        query: req.query,
        params: req.params,
      });
      next();
    } catch (error) {
      next(error);
    }
  };
};