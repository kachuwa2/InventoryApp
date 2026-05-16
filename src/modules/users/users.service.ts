import { db } from '../../config/database';

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
