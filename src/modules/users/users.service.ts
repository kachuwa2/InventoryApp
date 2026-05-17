import { db } from '../../config/database';
import { UserRole } from '../../generated/prisma';
import { ForbiddenError, NotFoundError } from '../../utils/errors';

export async function getAllUsers() {
  return db.user.findMany({
    where: { deletedAt: null },
    select: {
      id:        true,
      name:      true,
      email:     true,
      role:      true,
      isActive:  true,
      createdAt: true,
    },
    orderBy: { createdAt: 'desc' },
  });
}

export async function updateUser(
  id: string,
  data: { role?: UserRole; isActive?: boolean },
  adminId: string,
  ip: string
) {
  if (id === adminId && data.isActive === false) {
    throw new ForbiddenError('You cannot deactivate your own account');
  }

  const user = await db.user.findFirst({ where: { id, deletedAt: null } });
  if (!user) throw new NotFoundError('User');

  return db.$transaction(async (tx) => {
    const updated = await tx.user.update({
      where: { id },
      data: {
        ...(data.role     !== undefined && { role: data.role }),
        ...(data.isActive !== undefined && { isActive: data.isActive }),
      },
      select: { id: true, name: true, email: true, role: true, isActive: true, createdAt: true },
    });

    await tx.auditLog.create({
      data: {
        action:      'USER_UPDATED',
        tableName:   'users',
        recordId:    id,
        userId:      adminId,
        ipAddress:   ip,
        beforeState: { role: user.role, isActive: user.isActive },
        afterState:  { role: updated.role, isActive: updated.isActive },
      },
    });

    return updated;
  });
}
