import { Request, Response, NextFunction } from 'express';
import { db } from '../config/database';
import { ForbiddenError } from '../utils/errors';

export async function requireAdminOrFirstUser(
  req: Request,
  _res: Response,
  next: NextFunction
) {
  try {
    const userCount = await db.user.count({ where: { deletedAt: null } });
    if (userCount === 0) return next();              // first-time setup — allow
    if (req.user?.role === 'admin') return next();   // admin — allow
    return next(new ForbiddenError('Only admins can register new users'));
  } catch (error) {
    next(error);
  }
}
