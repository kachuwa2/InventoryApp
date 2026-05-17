import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { UnauthorizedError } from '../utils/errors';

export function authenticate(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next(new UnauthorizedError('No token provided'));
  }

  const token = authHeader.split(' ')[1];

  try {
    const payload = jwt.verify(
      token,
      process.env.JWT_SECRET as string
    ) as { userId: string; role: string };

    req.user = {
      userId: payload.userId,
      role: payload.role as any,
    };

    next();
  } catch {
    return next(new UnauthorizedError('Invalid or expired token'));
  }
}

// Like authenticate but never throws — attaches req.user if token is valid,
// leaves req.user undefined if no token or invalid token.
export function optionalAuthenticate(req: Request, _res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    try {
      const payload = jwt.verify(
        token,
        process.env.JWT_SECRET as string
      ) as { userId: string; role: string };
      req.user = { userId: payload.userId, role: payload.role as any };
    } catch {
      // invalid token — proceed without user
    }
  }
  next();
}