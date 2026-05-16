import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  PieChart, Pie, Cell, Legend,
} from 'recharts';
import { TrendingUp, ShoppingCart, Package, AlertTriangle } from 'lucide-react';
import { StatCard } from '../../components/ui/StatCard';
import { PageHeader } from '../../components/ui/PageHeader';
import { Badge } from '../../components/ui/Badge';
import { Spinner } from '../../components/ui/Spinner';
import { fmt, timeAgo } from '../../utils/cn';
import * as reportsApi from '../../api/reports';
import * as inventoryApi from '../../api/inventory';
import * as salesApi from '../../api/sales';
import type { Sale, InventoryProduct, AuditLog } from '../../api/types';

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

interface ChartPoint {
  day: string;
  revenue: number;
}

function buildChartData(sales: Sale[]): ChartPoint[] {
  const now = new Date();
  const points: ChartPoint[] = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(now);
    d.setDate(d.getDate() - (6 - i));
    return { day: DAY_LABELS[d.getDay()], revenue: 0, _isoDate: d.toISOString().slice(0, 10) } as ChartPoint & { _isoDate: string };
  });

  for (const sale of sales) {
    const saleDate = sale.createdAt.slice(0, 10);
    const idx = (points as (ChartPoint & { _isoDate: string })[]).findIndex((p) => p._isoDate === saleDate);
    if (idx !== -1) {
      points[idx].revenue += Number(sale.totalAmount);
    }
  }

  return points.map(({ day, revenue }) => ({ day, revenue }));
}

function actionLabel(log: AuditLog): string {
  const table = log.tableName.replace(/_/g, ' ');
  return `${log.action} on ${table}`;
}

function activityVariant(action: string): 'success' | 'info' | 'warning' | 'danger' | 'muted' {
  switch (action.toLowerCase()) {
    case 'create': return 'success';
    case 'update': return 'info';
    case 'delete': return 'danger';
    case 'login': return 'accent' as 'info';
    default: return 'muted';
  }
}

export function DashboardPage() {
  const navigate = useNavigate();

  const { data: dashboard, isLoading: dashLoading } = useQuery({
    queryKey: ['reports', 'dashboard'],
    queryFn: reportsApi.getDashboard,
    refetchInterval: 30_000,
  });

  const { data: valuation, isLoading: valLoading } = useQuery({
    queryKey: ['inventory', 'valuation'],
    queryFn: inventoryApi.getValuation,
  });

  const { data: lowStock, isLoading: lowLoading } = useQuery({
    queryKey: ['inventory', 'low-stock'],
    queryFn: inventoryApi.getLowStock,
  });

  const { data: salesData, isLoading: salesLoading } = useQuery({
    queryKey: ['sales', {}],
    queryFn: () => salesApi.getSales(),
  });

  const chartData = useMemo<ChartPoint[]>(() => {
    if (!salesData) return [];
    return buildChartData(salesData);
  }, [salesData]);

  const donutData = useMemo(() => {
    if (!dashboard) return [];
    const retail = dashboard.today.retailCount;
    const wholesale = dashboard.today.wholesaleCount;
    if (retail === 0 && wholesale === 0) return [];
    return [
      { name: 'Retail', value: retail },
      { name: 'Wholesale', value: wholesale },
    ];
  }, [dashboard]);

  const dominant = useMemo(() => {
    if (!dashboard) return '';
    return dashboard.today.retailCount >= dashboard.today.wholesaleCount ? 'Retail' : 'Wholesale';
  }, [dashboard]);

  const recentActivity = (dashboard?.recentActivity ?? []).slice(0, 8);

  return (
    <div className="p-6 space-y-6 min-h-screen bg-bg">
      <PageHeader
        title="Dashboard"
        subtitle="Kitchen utensils inventory overview"
      />

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard
          label="Today Revenue"
          value={dashLoading ? <Spinner size="sm" /> : `Rs. ${fmt(dashboard?.today.revenue ?? 0)}`}
          icon={<TrendingUp className="w-4 h-4" />}
          accent="#7C6EF8"
          loading={dashLoading}
        />
        <StatCard
          label="Orders Today"
          value={dashLoading ? <Spinner size="sm" /> : String(dashboard?.today.orderCount ?? 0)}
          icon={<ShoppingCart className="w-4 h-4" />}
          accent="#4DA8F5"
          loading={dashLoading}
        />
        <StatCard
          label="Stock Value"
          value={valLoading ? <Spinner size="sm" /> : `Rs. ${fmt(valuation?.totalValue ?? 0)}`}
          icon={<Package className="w-4 h-4" />}
          accent="#2DD4A0"
          loading={valLoading}
        />
        <StatCard
          label="Low Stock Items"
          value={dashLoading ? <Spinner size="sm" /> : String(dashboard?.inventory.lowStockCount ?? 0)}
          icon={<AlertTriangle className="w-4 h-4" />}
          accent="#F5A742"
          loading={dashLoading}
        />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        {/* 7-day revenue area chart */}
        <div className="xl:col-span-2 bg-surface border border-border rounded-xl p-5">
          <h3 className="text-[13px] font-semibold text-text mb-4">Revenue — Last 7 Days</h3>
          {salesLoading ? (
            <div className="flex items-center justify-center h-48"><Spinner /></div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={chartData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#7C6EF8" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#7C6EF8" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#252836" vertical={false} />
                <XAxis
                  dataKey="day"
                  tick={{ fontSize: 11, fill: '#9499B5' }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: '#9499B5' }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v: number) => `${(v / 1000).toFixed(0)}k`}
                  width={40}
                />
                <Tooltip
                  contentStyle={{ background: '#13151C', border: '1px solid #252836', borderRadius: 8, fontSize: 12 }}
                  labelStyle={{ color: '#E8E9F0' }}
                  itemStyle={{ color: '#7C6EF8' }}
                  formatter={(v) => [`Rs. ${fmt(v as number)}`, 'Revenue']}
                />
                <Area
                  type="monotone"
                  dataKey="revenue"
                  stroke="#7C6EF8"
                  strokeWidth={2}
                  fill="url(#revenueGradient)"
                  dot={false}
                  activeDot={{ r: 4, fill: '#7C6EF8', stroke: '#13151C', strokeWidth: 2 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Sales mix donut */}
        <div className="bg-surface border border-border rounded-xl p-5 flex flex-col">
          <h3 className="text-[13px] font-semibold text-text mb-4">Sales Mix — Today</h3>
          {dashLoading ? (
            <div className="flex items-center justify-center flex-1"><Spinner /></div>
          ) : donutData.length === 0 ? (
            <div className="flex flex-col items-center justify-center flex-1 gap-2">
              <ShoppingCart className="w-8 h-8 text-text3" />
              <p className="text-text3 text-[12px]">No sales today</p>
            </div>
          ) : (
            <div className="relative flex-1 flex flex-col items-center justify-center">
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie
                    data={donutData}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={80}
                    paddingAngle={3}
                    dataKey="value"
                    strokeWidth={0}
                  >
                    <Cell fill="#7C6EF8" />
                    <Cell fill="#2DD4A0" />
                  </Pie>
                  <Legend
                    iconType="circle"
                    iconSize={8}
                    formatter={(v: string) => <span style={{ color: '#9499B5', fontSize: 11 }}>{v}</span>}
                  />
                  <Tooltip
                    contentStyle={{ background: '#13151C', border: '1px solid #252836', borderRadius: 8, fontSize: 12 }}
                    itemStyle={{ color: '#E8E9F0' }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none" style={{ top: -12 }}>
                <div className="text-center">
                  <p className="text-[11px] text-text3">dominant</p>
                  <p className="text-[13px] font-semibold text-text">{dominant}</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Low stock + Recent activity */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        {/* Low stock alerts */}
        <div className="xl:col-span-2 bg-surface border border-border rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-border">
            <h3 className="text-[13px] font-semibold text-text flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-warning" />
              Low Stock Alerts
            </h3>
            {!lowLoading && lowStock && lowStock.length > 0 && (
              <span className="text-[11px] text-warning font-medium">{lowStock.length} items</span>
            )}
          </div>
          {lowLoading ? (
            <div className="flex items-center justify-center py-10"><Spinner /></div>
          ) : !lowStock || lowStock.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-10 text-text3">
              <Package className="w-8 h-8" />
              <p className="text-[13px]">All products are adequately stocked</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border/50">
                    <th className="px-4 py-2.5 text-left text-[11px] font-medium text-text2 uppercase tracking-wider">Product</th>
                    <th className="px-4 py-2.5 text-right text-[11px] font-medium text-text2 uppercase tracking-wider">Stock</th>
                    <th className="px-4 py-2.5 text-right text-[11px] font-medium text-text2 uppercase tracking-wider">Reorder At</th>
                    <th className="px-4 py-2.5 text-left text-[11px] font-medium text-text2 uppercase tracking-wider">Supplier</th>
                    <th className="px-4 py-2.5" />
                  </tr>
                </thead>
                <tbody>
                  {lowStock.map((p: InventoryProduct) => (
                    <tr key={p.id} className="border-b border-border/30 hover:bg-surface2 transition-colors">
                      <td className="px-4 py-3">
                        <p className="text-[13px] font-medium text-text">{p.name}</p>
                        <p className="text-[11px] text-text3 font-mono">{p.sku}</p>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className={`text-[13px] font-semibold ${p.isOutOfStock ? 'text-danger' : 'text-warning'}`}>
                          {p.currentStock}
                        </span>
                        {p.unit && <span className="text-[11px] text-text3 ml-1">{p.unit}</span>}
                      </td>
                      <td className="px-4 py-3 text-right text-[13px] text-text2">{p.reorderPoint}</td>
                      <td className="px-4 py-3 text-[13px] text-text2">{p.supplier?.name ?? '—'}</td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => navigate('/purchases/new')}
                          className="px-3 py-1.5 bg-accent/10 hover:bg-accent/20 text-accent text-[11px] font-medium rounded-lg transition-colors whitespace-nowrap"
                        >
                          Create PO
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Recent activity */}
        <div className="bg-surface border border-border rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-border">
            <h3 className="text-[13px] font-semibold text-text">Recent Activity</h3>
          </div>
          {dashLoading ? (
            <div className="flex items-center justify-center py-10"><Spinner /></div>
          ) : recentActivity.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-10 text-text3">
              <p className="text-[13px]">No recent activity</p>
            </div>
          ) : (
            <div className="divide-y divide-border/30">
              {recentActivity.map((log: AuditLog) => (
                <div key={log.id} className="px-5 py-3 hover:bg-surface2 transition-colors">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <Badge
                      label={log.action}
                      variant={activityVariant(log.action)}
                      dot
                    />
                    <span className="text-[11px] text-text3 shrink-0">{timeAgo(log.createdAt)}</span>
                  </div>
                  <p className="text-[12px] text-text2 leading-snug">{actionLabel(log)}</p>
                  {log.user && (
                    <p className="text-[11px] text-text3 mt-0.5">by {log.user.name}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
