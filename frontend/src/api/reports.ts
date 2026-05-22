import client from './client';
import type { DashboardData, ProfitLossData, TopProduct, SlowMovingProduct, SalesAuditReport } from './types';

export async function getDashboard(): Promise<DashboardData> {
  const { data } = await client.get<{ data: DashboardData }>('/reports/dashboard');
  return data.data;
}

export async function getProfitLoss(from: string, to: string): Promise<ProfitLossData> {
  const { data } = await client.get<{ data: ProfitLossData }>('/reports/profit-loss', {
    params: { from, to },
  });
  return data.data;
}

export async function getTopProducts(limit?: number): Promise<TopProduct[]> {
  const { data } = await client.get<{ data: TopProduct[] }>('/reports/top-products', {
    params: { limit },
  });
  return data.data;
}

export async function getSlowMoving(days?: number): Promise<SlowMovingProduct[]> {
  const { data } = await client.get<{ data: SlowMovingProduct[] }>('/reports/slow-moving', {
    params: { days },
  });
  return data.data;
}

export async function getSalesAuditReport(
  from: string,
  to: string,
  type?: string
): Promise<SalesAuditReport> {
  const { data } = await client.get<{ data: SalesAuditReport }>('/reports/sales-audit', {
    params: { from, to, ...(type && { type }) },
  });
  return data.data;
}
