import client from './client';
import type { PurchaseOrder, PurchaseStatus } from './types';

export interface PurchaseFilters {
  status?: PurchaseStatus;
  supplierId?: string;
}

export async function getPurchases(filters?: PurchaseFilters): Promise<PurchaseOrder[]> {
  const { data } = await client.get<{ data: PurchaseOrder[] }>('/purchases', { params: filters });
  return data.data;
}

export async function getPurchase(id: string): Promise<PurchaseOrder> {
  const { data } = await client.get<{ data: PurchaseOrder }>(`/purchases/${id}`);
  return data.data;
}

export async function createPurchase(payload: {
  supplierId: string;
  supplierReference?: string;
  notes?: string;
  expectedAt?: string;
  items: Array<{ productId: string; quantityOrdered: number; unitCost: string }>;
}): Promise<PurchaseOrder> {
  const { data } = await client.post<{ data: PurchaseOrder }>('/purchases', payload);
  return data.data;
}

export async function updatePurchase(
  id: string,
  payload: {
    supplierId?: string;
    supplierReference?: string;
    notes?: string;
    expectedAt?: string;
    items?: Array<{ productId: string; quantityOrdered: number; unitCost: string }>;
  }
): Promise<PurchaseOrder> {
  const { data } = await client.put<{ data: PurchaseOrder }>(`/purchases/${id}`, payload);
  return data.data;
}

export async function approvePurchase(id: string): Promise<PurchaseOrder> {
  const { data } = await client.post<{ data: PurchaseOrder }>(`/purchases/${id}/approve`);
  return data.data;
}

export async function receivePurchase(
  id: string,
  payload: {
    items: Array<{ itemId: string; quantityReceived: number }>;
    notes?: string;
  }
): Promise<PurchaseOrder> {
  const { data } = await client.post<{ data: PurchaseOrder }>(`/purchases/${id}/receive`, payload);
  return data.data;
}

export async function cancelPurchase(id: string): Promise<PurchaseOrder> {
  const { data } = await client.post<{ data: PurchaseOrder }>(`/purchases/${id}/cancel`);
  return data.data;
}
