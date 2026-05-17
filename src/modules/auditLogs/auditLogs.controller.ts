import { Request, Response, NextFunction } from 'express';
import { db } from '../../config/database';

export async function getAll(
  _req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const logs = await db.auditLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: 200,
      include: {
        user: { select: { id: true, name: true, email: true, role: true } },
      },
    });

    res.json({
      success: true,
      data: logs.map((l) => ({
        id:        l.id,
        action:    l.action,
        tableName: l.tableName ?? '',
        recordId:  l.recordId ?? '',
        userId:    l.userId,
        ipAddress: l.ipAddress ?? '',
        before:    l.beforeState as Record<string, unknown> | null,
        after:     l.afterState as Record<string, unknown> | null,
        createdAt: l.createdAt,
        user:      l.user,
      })),
    });
  } catch (error) {
    next(error);
  }
}
