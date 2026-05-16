import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
} from 'recharts';
import { TrendingUp, BarChart2, Clock } from 'lucide-react';
import { PageHeader } from '../../components/ui/PageHeader';
import { Spinner } from '../../components/ui/Spinner';
import { fmt, fmtDate } from '../../utils/cn';
import * as reportsApi from '../../api/reports';
import type { ProfitLossData, TopProduct, SlowMovingProduct } from '../../api/types';

type ReportsTab = 'pl' | 'top' | 'slow';

const TABS: { key: ReportsTab; label: string; icon: typeof TrendingUp }[] = [
  { key: 'pl', label: 'P&L', icon: TrendingUp },
  { key: 'top', label: 'Top Products', icon: BarChart2 },
  { key: 'slow', label: 'Slow Moving', icon: Clock },
];

const TOP_LIMITS = [5, 10, 20] as const;
type TopLimit = (typeof TOP_LIMITS)[number];

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function firstOfMonthIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}

function marginColor(pct: number): string {
  if (pct >= 30) return 'text-success';
  if (pct >= 15) return 'text-warning';
  return 'text-danger';
}

function marginBg(pct: number): string {
  if (pct >= 30) return 'bg-success/10';
  if (pct >= 15) return 'bg-warning/10';
  return 'bg-danger/10';
}

// ── Stat card ────────────────────────────────────────────────────────────────
interface StatCardProps {
  label: string;
  value: string;
  variant: 'success' | 'danger' | 'info';
}
function StatCard({ label, value, variant }: StatCardProps) {
  const colors: Record<typeof variant, string> = {
    success: 'text-success',
    danger: 'text-danger',
    info: 'text-info',
  };
  return (
    <div className="bg-surface border border-border rounded-xl p-4 flex-1">
      <p className="text-text3 text-[11px] uppercase tracking-wider mb-1">{label}</p>
      <p className={`text-[22px] font-bold ${colors[variant]}`}>{value}</p>
    </div>
  );
}

// ── P&L Tab ───────────────────────────────────────────────────────────────────
function PLTab() {
  const [fromDate, setFromDate] = useState(firstOfMonthIso());
  const [toDate, setToDate] = useState(todayIso());
  const [applied, setApplied] = useState<{ from: string; to: string } | null>(null);

  const { data, isLoading } = useQuery<ProfitLossData>({
    queryKey: ['reports', 'profit-loss', applied],
    queryFn: () => reportsApi.getProfitLoss(applied!.from, applied!.to),
    enabled: applied !== null,
  });

  const chartData = (data?.byProduct ?? [])
    .sort((a, b) => Number(b.revenue) - Number(a.revenue))
    .slice(0, 8)
    .map((p) => ({
      name: p.productName.length > 12 ? p.productName.slice(0, 12) + '…' : p.productName,
      revenue: Number(p.revenue),
      cogs: Number(p.cogs),
    }));

  return (
    <div className="flex flex-col gap-6">
      {/* Date range picker */}
      <div className="flex items-end gap-3 flex-wrap">
        <div>
          <label className="block text-text3 text-[11px] uppercase tracking-wider mb-1.5">From</label>
          <input
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            className="bg-surface2 border border-border rounded-lg px-3 py-2 text-[13px] text-text focus:outline-none focus:border-accent transition-colors"
          />
        </div>
        <div>
          <label className="block text-text3 text-[11px] uppercase tracking-wider mb-1.5">To</label>
          <input
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            className="bg-surface2 border border-border rounded-lg px-3 py-2 text-[13px] text-text focus:outline-none focus:border-accent transition-colors"
          />
        </div>
        <button
          onClick={() => setApplied({ from: fromDate, to: toDate })}
          className="px-5 py-2 bg-accent text-white rounded-lg text-[13px] font-medium hover:bg-accent/90 transition-colors"
        >
          Apply
        </button>
      </div>

      {applied === null ? (
        <div className="py-16 text-center text-text3 text-[13px]">
          Select a date range and click Apply to view P&L
        </div>
      ) : isLoading ? (
        <div className="flex justify-center py-12"><Spinner /></div>
      ) : data ? (
        <>
          {/* Summary cards */}
          <div className="flex gap-4 flex-wrap">
            <StatCard label="Revenue" value={`KSh ${fmt(data.summary.revenue)}`} variant="success" />
            <StatCard label="COGS" value={`KSh ${fmt(data.summary.cogs)}`} variant="danger" />
            <StatCard label="Gross Profit" value={`KSh ${fmt(data.summary.grossProfit)}`} variant="success" />
            <StatCard
              label="Margin %"
              value={`${Number(data.summary.marginPct).toFixed(1)}%`}
              variant={Number(data.summary.marginPct) >= 15 ? 'success' : 'danger'}
            />
          </div>

          {/* Bar chart */}
          {chartData.length > 0 && (
            <div className="bg-surface border border-border rounded-xl p-5">
              <p className="text-text2 text-[13px] font-medium mb-4">Revenue vs COGS (top 8 products)</p>
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={chartData} barGap={4}>
                  <XAxis
                    dataKey="name"
                    tick={{ fill: '#9499B5', fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fill: '#9499B5', fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v: number) => `${(v / 1000).toFixed(0)}k`}
                  />
                  <Tooltip
                    contentStyle={{ background: '#13151C', border: '1px solid #252836', borderRadius: 8, fontSize: 12 }}
                    labelStyle={{ color: '#E8E9F0' }}
                    formatter={(value) => [`KSh ${fmt(value as number)}`, '']}
                  />
                  <Bar dataKey="revenue" name="Revenue" fill="#2DD4A0" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="cogs" name="COGS" fill="#F56B6B" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Product breakdown table */}
          <div className="bg-surface border border-border rounded-xl overflow-hidden">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-border">
                  {['Product', 'Units Sold', 'Revenue', 'COGS', 'Profit', 'Margin %'].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-[11px] font-medium text-text2 uppercase tracking-wider">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.byProduct.map((p) => {
                  const pct = Number(p.marginPct);
                  return (
                    <tr key={p.productId} className="border-b border-border/50">
                      <td className="px-4 py-3 text-text text-[13px] font-medium">{p.productName}</td>
                      <td className="px-4 py-3 text-text2 text-[13px]">{p.unitsSold}</td>
                      <td className="px-4 py-3 text-success text-[13px]">KSh {fmt(p.revenue)}</td>
                      <td className="px-4 py-3 text-danger text-[13px]">KSh {fmt(p.cogs)}</td>
                      <td className="px-4 py-3 text-text text-[13px]">KSh {fmt(p.profit)}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-medium ${marginBg(pct)} ${marginColor(pct)}`}>
                          {pct.toFixed(1)}%
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      ) : null}
    </div>
  );
}

// ── Top Products Tab ──────────────────────────────────────────────────────────
function TopProductsTab() {
  const [limit, setLimit] = useState<TopLimit>(10);

  const { data = [], isLoading } = useQuery<TopProduct[]>({
    queryKey: ['reports', 'top-products', limit],
    queryFn: () => reportsApi.getTopProducts(limit),
  });

  const maxRevenue = Math.max(...data.map((p) => Number(p.revenue)), 1);

  return (
    <div className="flex flex-col gap-6">
      {/* Limit tabs */}
      <div className="flex gap-1 bg-surface2 rounded-lg p-1 w-fit">
        {TOP_LIMITS.map((l) => (
          <button
            key={l}
            onClick={() => setLimit(l)}
            className={`px-4 py-1.5 text-[13px] font-medium rounded-md transition-colors ${
              limit === l ? 'bg-surface text-text shadow-sm' : 'text-text2 hover:text-text'
            }`}
          >
            {l}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><Spinner /></div>
      ) : (
        <>
          {/* Horizontal bar chart */}
          <div className="bg-surface border border-border rounded-xl p-5">
            <p className="text-text2 text-[13px] font-medium mb-4">Revenue by Product</p>
            <div className="flex flex-col gap-2">
              {data.map((p, i) => {
                const width = (Number(p.revenue) / maxRevenue) * 100;
                const colors = ['#7C6EF8', '#2DD4A0', '#4DA8F5', '#F5A742', '#F56B6B'];
                const color = colors[i % colors.length];
                return (
                  <div key={p.productId} className="flex items-center gap-3">
                    <p className="text-text2 text-[12px] w-36 truncate shrink-0 text-right">
                      {p.productName}
                    </p>
                    <div className="flex-1 bg-surface2 rounded-full h-5 overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500 flex items-center pl-2"
                        style={{ width: `${width}%`, backgroundColor: color, minWidth: 8 }}
                      />
                    </div>
                    <span className="text-text text-[12px] font-medium w-24 shrink-0">
                      KSh {fmt(p.revenue)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Table */}
          <div className="bg-surface border border-border rounded-xl overflow-hidden">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-border">
                  {['#', 'Product', 'Units Sold', 'Revenue', 'Avg Price', 'Orders'].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-[11px] font-medium text-text2 uppercase tracking-wider">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.map((p, i) => (
                  <tr key={p.productId} className="border-b border-border/50">
                    <td className="px-4 py-3 text-text3 text-[13px]">{i + 1}</td>
                    <td className="px-4 py-3 text-text text-[13px] font-medium">{p.productName}</td>
                    <td className="px-4 py-3 text-text2 text-[13px]">{p.unitsSold}</td>
                    <td className="px-4 py-3 text-success text-[13px] font-semibold">
                      KSh {fmt(p.revenue)}
                    </td>
                    <td className="px-4 py-3 text-text2 text-[13px]">KSh {fmt(p.avgPrice)}</td>
                    <td className="px-4 py-3 text-text2 text-[13px]">{p.orderCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

// ── Slow Moving Tab ───────────────────────────────────────────────────────────
function SlowMovingTab() {
  const [days, setDays] = useState(30);

  const { data = [], isLoading } = useQuery<SlowMovingProduct[]>({
    queryKey: ['reports', 'slow-moving', days],
    queryFn: () => reportsApi.getSlowMoving(days),
  });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-end gap-3">
        <div>
          <label className="block text-text3 text-[11px] uppercase tracking-wider mb-1.5">
            Products not sold in last N days
          </label>
          <input
            type="number"
            min="1"
            value={days}
            onChange={(e) => setDays(Number(e.target.value) || 30)}
            className="bg-surface2 border border-border rounded-lg px-3 py-2 text-[13px] text-text w-28 focus:outline-none focus:border-accent transition-colors"
          />
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><Spinner /></div>
      ) : (
        <div className="bg-surface border border-border rounded-xl overflow-hidden">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-border">
                {['Product', 'Category', 'Current Stock', 'Stock Value (KSh)', 'Last Sold', 'Days Since Sold'].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-[11px] font-medium text-text2 uppercase tracking-wider">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-text3 text-[13px]">
                    No slow-moving products found for the selected period.
                  </td>
                </tr>
              ) : (
                data.map((p) => {
                  const neverSold = p.daysSinceLastSale === null;
                  const overThreshold = !neverSold && p.daysSinceLastSale! > days;
                  const rowBg = neverSold
                    ? 'bg-danger/5'
                    : overThreshold
                    ? 'bg-warning/5'
                    : '';
                  return (
                    <tr key={p.productId} className={`border-b border-border/50 ${rowBg}`}>
                      <td className="px-4 py-3 text-text text-[13px] font-medium">{p.productName}</td>
                      <td className="px-4 py-3 text-text2 text-[13px]">{p.categoryName}</td>
                      <td className="px-4 py-3 text-text2 text-[13px]">{p.currentStock}</td>
                      <td className="px-4 py-3 text-text text-[13px]">KSh {fmt(p.stockValue)}</td>
                      <td className="px-4 py-3 text-text2 text-[13px]">
                        {p.lastSoldAt ? fmtDate(p.lastSoldAt) : <span className="text-danger text-[12px]">Never</span>}
                      </td>
                      <td className="px-4 py-3 text-[13px]">
                        {p.daysSinceLastSale !== null ? (
                          <span className={p.daysSinceLastSale > days ? 'text-warning font-medium' : 'text-text2'}>
                            {p.daysSinceLastSale}d
                          </span>
                        ) : (
                          <span className="text-danger font-medium">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export function ReportsPage() {
  const [activeTab, setActiveTab] = useState<ReportsTab>('pl');

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Reports" />

      {/* Tab bar */}
      <div className="flex gap-1 bg-surface2 rounded-lg p-1 w-fit">
        {TABS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`flex items-center gap-2 px-4 py-1.5 text-[13px] font-medium rounded-md transition-colors ${
              activeTab === key ? 'bg-surface text-text shadow-sm' : 'text-text2 hover:text-text'
            }`}
          >
            <Icon className="w-3.5 h-3.5" />
            {label}
          </button>
        ))}
      </div>

      {activeTab === 'pl' && <PLTab />}
      {activeTab === 'top' && <TopProductsTab />}
      {activeTab === 'slow' && <SlowMovingTab />}
    </div>
  );
}
