import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { getAllUsers, updateUser } from './users.service';
import { getParam, getIp } from '../../utils/request';

const updateSchema = z.object({
  role:     z.enum(['admin', 'manager', 'cashier', 'warehouse', 'viewer']).optional(),
  isActive: z.boolean().optional(),
});

export async function getAll(
  _req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const users = await getAllUsers();
    res.json({ success: true, data: users });
  } catch (error) {
    next(error);
  }
}

export async function update(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const id = getParam(req, 'id');
    const parsed = updateSchema.parse(req.body);
    const user = await updateUser(id, parsed, req.user!.userId, getIp(req));
    res.json({ success: true, data: user });
  } catch (error) {
    next(error);
  }
}

export async function deactivate(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const id = getParam(req, 'id');
    const user = await updateUser(id, { isActive: false }, req.user!.userId, getIp(req));
    res.json({ success: true, data: user });
  } catch (error) {
    next(error);
  }
}
