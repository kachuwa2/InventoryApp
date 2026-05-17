import client from './client';
import type { AppUser, UserRole } from './types';

export async function getUsers(): Promise<AppUser[]> {
  const { data } = await client.get<{ data: AppUser[] }>('/users');
  return data.data;
}

export async function updateUser(
  id: string,
  payload: { role?: UserRole; isActive?: boolean }
): Promise<AppUser> {
  const { data } = await client.put<{ data: AppUser }>(`/users/${id}`, payload);
  return data.data;
}

export async function deactivateUser(id: string): Promise<AppUser> {
  const { data } = await client.patch<{ data: AppUser }>(`/users/${id}/deactivate`);
  return data.data;
}
