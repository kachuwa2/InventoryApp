import client from './client';
import type { Customer, CustomerType } from './types';

export interface CustomerFilters {
  type?: CustomerType;
  search?: string;
}

export async function getCustomers(filters?: CustomerFilters): Promise<Customer[]> {
  const { data } = await client.get<{ data: Customer[] }>('/customers', { params: filters });
  return data.data;
}

export async function getCustomer(id: string): Promise<Customer> {
  const { data } = await client.get<{ data: Customer }>(`/customers/${id}`);
  return data.data;
}

export async function createCustomer(payload: {
  name: string;
  phone?: string;
  email?: string;
  address?: string;
  type?: CustomerType;
  creditLimit?: string;
}): Promise<Customer> {
  const { data } = await client.post<{ data: Customer }>('/customers', payload);
  return data.data;
}

export async function updateCustomer(
  id: string,
  payload: {
    name?: string;
    phone?: string;
    email?: string;
    address?: string;
    type?: CustomerType;
    creditLimit?: string;
  }
): Promise<Customer> {
  const { data } = await client.put<{ data: Customer }>(`/customers/${id}`, payload);
  return data.data;
}

export async function deleteCustomer(id: string): Promise<void> {
  await client.delete(`/customers/${id}`);
}
