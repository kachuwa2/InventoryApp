import client from './client';
import type { Supplier } from './types';

export async function getSuppliers(): Promise<Supplier[]> {
  const { data } = await client.get<{ data: Supplier[] }>('/suppliers');
  return data.data;
}

export async function getSupplier(id: string): Promise<Supplier> {
  const { data } = await client.get<{ data: Supplier }>(`/suppliers/${id}`);
  return data.data;
}

export async function createSupplier(payload: {
  name: string;
  contactPerson?: string;
  phone?: string;
  email?: string;
  address?: string;
  creditLimit?: string;
}): Promise<Supplier> {
  const { data } = await client.post<{ data: Supplier }>('/suppliers', {
    ...payload,
    creditLimit: payload.creditLimit ? Number(payload.creditLimit) : undefined,
  });
  return data.data;
}

export async function updateSupplier(
  id: string,
  payload: {
    name?: string;
    contactPerson?: string;
    phone?: string;
    email?: string;
    address?: string;
    creditLimit?: string;
  }
): Promise<Supplier> {
  const { data } = await client.put<{ data: Supplier }>(`/suppliers/${id}`, {
    ...payload,
    creditLimit: payload.creditLimit ? Number(payload.creditLimit) : undefined,
  });
  return data.data;
}

export async function deleteSupplier(id: string): Promise<void> {
  await client.delete(`/suppliers/${id}`);
}
