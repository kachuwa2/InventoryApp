import { Request, Response, NextFunction } from 'express';
import { UserRole } from '../generated/prisma';
import { ForbiddenError, UnauthorizedError } from '../utils/errors';

// Returns a middleware that only allows specific roles through.
// Usage: authorize(['admin', 'manager'])
export function authorize(allowedRoles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(new UnauthorizedError());
    }

    if (!allowedRoles.includes(req.user.role)) {
      return next(new ForbiddenError(
        `Requires one of these roles: ${allowedRoles.join(', ')}`
      ));
    }

    next();
  };
}