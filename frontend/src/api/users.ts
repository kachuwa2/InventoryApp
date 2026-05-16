import client from './client';
import type { AppUser } from './types';

export async function getUsers(): Promise<AppUser[]> {
  const { data } = await client.get<{ data: AppUser[] }>('/users');
  return data.data;
}
