import client from './client';
import type { InventoryProduct, StockMovement, ValuationData } from './types';

export async function getInventory(): Promise<InventoryProduct[]> {
  const { data } = await client.get<{ data: InventoryProduct[] }>('/inventory');
  return data.data;
}

export async function getLowStock(): Promise<InventoryProduct[]> {
  const { data } = await client.get<{ data: InventoryProduct[] }>('/inventory/low-stock');
  return data.data;
}

export async function getValuation(): Promise<ValuationData> {
  const { data } = await client.get<{ data: ValuationData }>('/inventory/valuation');
  return data.data;
}

export async function getMovements(productId: string): Promise<StockMovement[]> {
  const { data } = await client.get<{ data: { movements: StockMovement[] } }>(
    `/inventory/${productId}/movements`
  );
  return data.data.movements;
}

export async function adjustStock(payload: {
  productId: string;
  quantity: number;
  type: 'adjustment_in' | 'adjustment_out';
  notes: string;
  unitCost?: string;
}): Promise<void> {
  await client.post('/inventory/adjust', payload);
}
