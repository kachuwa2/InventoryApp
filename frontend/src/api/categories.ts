import client from './client';
import type { Category } from './types';

export async function getCategories(): Promise<Category[]> {
  const { data } = await client.get<{ data: Category[] }>('/categories');
  return data.data;
}

export async function getCategory(id: string): Promise<Category> {
  const { data } = await client.get<{ data: Category }>(`/categories/${id}`);
  return data.data;
}

export async function createCategory(payload: {
  name: string;
  description?: string;
  parentId?: string | null;
}): Promise<Category> {
  const { data } = await client.post<{ data: Category }>('/categories', payload);
  return data.data;
}

export async function updateCategory(
  id: string,
  payload: { name?: string; description?: string; parentId?: string | null }
): Promise<Category> {
  const { data } = await client.put<{ data: Category }>(`/categories/${id}`, payload);
  return data.data;
}

export async function deleteCategory(id: string): Promise<void> {
  await client.delete(`/categories/${id}`);
}
