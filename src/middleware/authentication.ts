import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { UnauthorizedError } from '../utils/errors';

export function authenticate(req: Request, res: Response, next: NextFunction) {
  // Tokens arrive in the Authorization header like:
  // "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next(new UnauthorizedError('No token provided'));
  }

  // Split "Bearer <token>" and take the second part
  const token = authHeader.split(' ')[1];

  try {
    const payload = jwt.verify(
      token,
      process.env.JWT_SECRET as string
    ) as { userId: string; role: string };

    // Attach user identity to the request object
    // Every controller after this can read req.user
    req.user = {
      userId: payload.userId,
      role: payload.role as any,
    };

    next();
  } catch {
    return next(new UnauthorizedError('Invalid or expired token'));
  }
}