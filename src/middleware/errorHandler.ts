import { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/errors';
import { ZodError } from 'zod';

// This function has FOUR parameters.
// Express identifies error handlers by the four
// parameters — (err, req, res, next).
// Normal middleware has three — (req, res, next).
// This distinction is how Express knows to send
// errors here instead of normal routes.
export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
) {
  // Zod throws this when request body fails validation
  if (err instanceof ZodError) {
    return res.status(400).json({
      success: false,
      code: 'VALIDATION_ERROR',
      errors: err.issues.map(e => ({
        field: e.path.join('.'),
        message: e.message,
      })),
    });
  }

  // Our own custom errors
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      success: false,
      code: err.code,
      message: err.message,
    });
  }

  // Prisma throws this when a unique constraint is violated
  // e.g. trying to register with an email that already exists
  if ((err as any).code === 'P2002') {
    return res.status(409).json({
      success: false,
      code: 'CONFLICT',
      message: 'A record with this value already exists',
    });
  }

  // Unknown error — don't leak internal details to the client
  // Log it on the server for debugging
  console.error('[Unhandled error]', err);

  return res.status(500).json({
    success: false,
    code: 'INTERNAL_ERROR',
    message: 'Something went wrong. Please try again.',
  });
}