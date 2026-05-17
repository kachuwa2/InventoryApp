import client from './client';
import type { Sale, DailySummary, SaleType } from './types';

export interface SaleFilters {
  customerId?: string;
  type?: SaleType;
}

export async function getSales(filters?: SaleFilters): Promise<Sale[]> {
  const { data } = await client.get<{ data: Sale[] }>('/sales', { params: filters });
  return data.data;
}

export async function getSale(id: string): Promise<Sale> {
  const { data } = await client.get<{ data: Sale }>(`/sales/${id}`);
  return data.data;
}

export async function getDailySummary(): Promise<DailySummary> {
  const { data } = await client.get<{ data: DailySummary }>('/sales/daily-summary');
  return data.data;
}

export async function createSale(payload: {
  customerId?: string;
  type?: SaleType;
  discount?: number;
  notes?: string;
  items: Array<{ productId: string; quantity: number; discountPct?: number }>;
}): Promise<Sale> {
  const { data } = await client.post<{ data: Sale }>('/sales', payload);
  return data.data;
}
