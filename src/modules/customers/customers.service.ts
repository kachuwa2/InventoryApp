import { db } from '../../config/database';
import { NotFoundError, ConflictError } from '../../utils/errors';
import { CreateCustomerInput, UpdateCustomerInput } from './customers.schema';

export async function getAllCustomers(filters?: {
  type?: string;
  search?: string;
}) {
  return db.customer.findMany({
    where: {
      deletedAt: null,
      ...(filters?.type && { type: filters.type as any }),
      ...(filters?.search && {
        OR: [
          { name:  { contains: filters.search, mode: 'insensitive' } },
          { phone: { contains: filters.search, mode: 'insensitive' } },
          { email: { contains: filters.search, mode: 'insensitive' } },
        ],
      }),
    },
    include: {
      _count: { select: { salesOrders: true } },
    },
    orderBy: { name: 'asc' },
  });
}

export async function getCustomerById(id: string) {
  const customer = await db.customer.findFirst({
    where: { id, deletedAt: null },
    include: {
      _count: { select: { salesOrders: true } },
      salesOrders: {
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: {
          id:          true,
          type:        true,
          totalAmount: true,
          status:      true,
          createdAt:   true,
        },
      },
    },
  });

  if (!customer) throw new NotFoundError('Customer');
  return customer;
}

export async function createCustomer(
  data: CreateCustomerInput,
  userId: string,
  ip: string
) {
  // Check phone uniqueness if provided
  if (data.phone) {
    const existing = await db.customer.findFirst({
      where: { phone: data.phone, deletedAt: null },
    });
    if (existing) {
      throw new ConflictError(
        'A customer with this phone number already exists'
      );
    }
  }

  return db.$transaction(async (tx) => {
    const customer = await tx.customer.create({
      data: {
        name:        data.name,
        phone:       data.phone,
        email:       data.email,
        address:     data.address,
        type:        data.type as any,
        creditLimit: data.creditLimit,
      },
    });

    await tx.auditLog.create({
      data: {
        userId,
        action:     'CUSTOMER_CREATED',
        tableName:  'customers',
        recordId:   customer.id,
        afterState: { name: customer.name, type: customer.type },
        ipAddress:  ip,
      },
    });

    return customer;
  });
}

export async function updateCustomer(
  id: string,
  data: UpdateCustomerInput,
  userId: string,
  ip: string
) {
  const existing = await db.customer.findFirst({
    where: { id, deletedAt: null },
  });
  if (!existing) throw new NotFoundError('Customer');

  return db.$transaction(async (tx) => {
    const updated = await tx.customer.update({
      where: { id },
      data: {
        name:        data.name,
        phone:       data.phone,
        email:       data.email,
        address:     data.address,
        type:        data.type as any,
        creditLimit: data.creditLimit,
      },
    });

    await tx.auditLog.create({
      data: {
        userId,
        action:      'CUSTOMER_UPDATED',
        tableName:   'customers',
        recordId:    id,
        beforeState: { name: existing.name, type: existing.type },
        afterState:  { name: updated.name,  type: updated.type  },
        ipAddress:   ip,
      },
    });

    return updated;
  });
}

export async function deleteCustomer(
  id: string,
  userId: string,
  ip: string
) {
  const existing = await db.customer.findFirst({
    where: { id, deletedAt: null },
    include: { _count: { select: { salesOrders: true } } },
  });
  if (!existing) throw new NotFoundError('Customer');

  // Cannot delete a customer with sales history —
  // those invoices must remain traceable
  if (existing._count.salesOrders > 0) {
    throw new ConflictError(
      `Cannot delete — this customer has ${existing._count.salesOrders} order(s) on record`
    );
  }

  return db.$transaction(async (tx) => {
    await tx.customer.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    await tx.auditLog.create({
      data: {
        userId,
        action:      'CUSTOMER_DELETED',
        tableName:   'customers',
        recordId:    id,
        beforeState: { name: existing.name },
        ipAddress:   ip,
      },
    });
  }).then(() => ({ message: 'Customer deleted successfully' }));
}