import { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/errors';
import { ZodError } from 'zod';
import { logger } from '../utils/logger';
import { captureError } from '../config/sentry';

// This function has FOUR parameters.
// Express identifies error handlers by the four
// parameters — (err, req, res, next).
// Normal middleware has three — (req, res, next).
// This distinction is how Express knows to send errors here instead of normal routes.
export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
) {
  // Ensure CORS headers are present on error responses
  // so browsers can read the error instead of showing
  // a misleading CORS error
  const origin = req.headers.origin as string
  if (origin) {
    res.setHeader('Access-Control-Allow-Origin', origin)
    res.setHeader('Access-Control-Allow-Credentials', 'true')
  }

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

  // Body parser error - request too large
  if ((err as any).type === 'entity.too.large') {
    return res.status(413).json({
      success: false,
      code: 'PAYLOAD_TOO_LARGE',
      message: 'Request payload is too large',
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

  // Unknown error — capture in Sentry and log
  if (!(err instanceof AppError) && !(err instanceof ZodError)) {
    captureError(err, {
      method: req.method,
      path: req.path,
      userId: req.user?.userId,
      timestamp: new Date().toISOString(),
    });
  }

  logger.error('Unhandled error', err, {
    method: req.method,
    path: req.path,
  });

  return res.status(500).json({
    success: false,
    code: 'INTERNAL_ERROR',
    message: 'Something went wrong. Please try again.',
  });
}