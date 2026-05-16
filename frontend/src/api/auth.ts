import client from './client';
import type { AuthUser, LoginResponse } from './types';

export async function login(email: string, password: string): Promise<LoginResponse> {
  const { data } = await client.post<{ data: LoginResponse }>('/auth/login', { email, password });
  return data.data;
}

export async function register(payload: {
  name: string;
  email: string;
  password: string;
  role?: string;
}): Promise<LoginResponse> {
  const { data } = await client.post<{ data: LoginResponse }>('/auth/register', payload);
  return data.data;
}

export async function getMe(): Promise<AuthUser> {
  const { data } = await client.get<{ data: AuthUser }>('/auth/me');
  return data.data;
}

export async function refresh(): Promise<LoginResponse> {
  const { data } = await client.post<{ data: LoginResponse }>('/auth/refresh');
  return data.data;
}

export async function logout(): Promise<void> {
  await client.post('/auth/logout');
}
