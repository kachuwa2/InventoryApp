import client from './client';
import type { AuditLog } from './types';

export async function getAuditLogs(): Promise<AuditLog[]> {
  const { data } = await client.get<{ data: AuditLog[] }>('/audit-logs');
  return data.data;
}
