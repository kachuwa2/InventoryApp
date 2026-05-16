import client from './client';
import type { Product } from './types';

export interface ProductFilters {
  search?: string;
  categoryId?: string;
  supplierId?: string;
}

export async function getProducts(filters?: ProductFilters): Promise<Product[]> {
  const { data } = await client.get<{ data: Product[] }>('/products', { params: filters });
  return data.data;
}

export async function getProduct(id: string): Promise<Product> {
  const { data } = await client.get<{ data: Product }>(`/products/${id}`);
  return data.data;
}

export async function getProductByBarcode(code: string): Promise<Product> {
  const { data } = await client.get<{ data: Product }>(`/products/barcode/${encodeURIComponent(code)}`);
  return data.data;
}

export async function createProduct(payload: {
  name: string;
  sku: string;
  barcode?: string;
  description?: string;
  unit?: string;
  reorderPoint?: number;
  categoryId: string;
  supplierId: string;
  costPrice: string;
  retailPrice: string;
  wholesalePrice: string;
  priceNote?: string;
}): Promise<Product> {
  const { data } = await client.post<{ data: Product }>('/products', payload);
  return data.data;
}

export async function updateProduct(
  id: string,
  payload: {
    name?: string;
    description?: string;
    unit?: string;
    reorderPoint?: number;
    categoryId?: string;
    supplierId?: string;
  }
): Promise<Product> {
  const { data } = await client.put<{ data: Product }>(`/products/${id}`, payload);
  return data.data;
}

export async function updateProductPrice(
  id: string,
  payload: {
    costPrice: string;
    retailPrice: string;
    wholesalePrice: string;
    note?: string;
  }
): Promise<Product> {
  const { data } = await client.put<{ data: Product }>(`/products/${id}/price`, payload);
  return data.data;
}

export async function deleteProduct(id: string): Promise<void> {
  await client.delete(`/products/${id}`);
}
