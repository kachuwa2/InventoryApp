import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import * as XLSX from 'xlsx';
import { Download, Printer, BarChart2 } from 'lucide-react';
import { PageHeader } from '../../components/ui/PageHeader';
import { Badge } from '../../components/ui/Badge';
import { Spinner } from '../../components/ui/Spinner';
import { EmptyState } from '../../components/ui/EmptyState';
import { fmt, fmtDateTime } from '../../utils/cn';
import * as reportsApi from '../../api/reports';
import type { SalesAuditSale } from '../../api/types';

function today(): string {
  return new Date().toISOString().split('T')[0];
}

function monthStart(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}

type TabType = 'all' | 'retail' | 'wholesale';

export function SalesAuditPage() {
  const [from, setFrom] = useState(monthStart());
  const [to, setTo]     = useState(today());
  const [tab, setTab]   = useState<TabType>('all');

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['reports', 'sales-audit', from, to],
    queryFn:  () => reportsApi.getSalesAuditReport(from, to),
    enabled:  !!from && !!to,
  });

  const displayed: SalesAuditSale[] =
    tab === 'all'
      ? (data?.sales ?? [])
      : (data?.sales ?? []).filter((s) => s.type === tab);

  function exportExcel() {
    if (!data) return;
    const wb = XLSX.utils.book_new();

    // Sheet 1 — Summary
    const summaryRows = [
      ['Sales Audit Report', '', `${data.period.from} to ${data.period.to}`],
      [],
      ['Metric', 'Value'],
      ['Total Orders',       data.summary.totalOrders],
      ['Total Revenue',      data.summary.totalRevenue.toFixed(2)],
      ['Retail Orders',      data.summary.retailOrders],
      ['Retail Revenue',     data.summary.retailRevenue.toFixed(2)],
      ['Wholesale Orders',   data.summary.wholesaleOrders],
      ['Wholesale Revenue',  data.summary.wholesaleRevenue.toFixed(2)],
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(summaryRows), 'Summary');

    // Helper — build flat sale rows
    const saleHeader = ['Invoice #', 'Date', 'Type', 'Customer', 'Cashier', 'Items', 'Discount %', 'Total (Rs.)'];
    const saleRows = (sales: SalesAuditSale[]) => [
      saleHeader,
      ...sales.map((s) => [
        s.invoiceNumber,
        fmtDateTime(s.createdAt),
        s.type,
        s.customerName,
        s.cashierName,
        s.itemCount,
        s.discount,
        s.totalAmount.toFixed(2),
      ]),
    ];

    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(saleRows(data.sales)),                   'All Sales');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(saleRows(data.sales.filter(s => s.type === 'retail'))),    'Retail Sales');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(saleRows(data.sales.filter(s => s.type === 'wholesale'))), 'Wholesale Sales');

    XLSX.writeFile(wb, `sales-audit-${data.period.from}-${data.period.to}.xlsx`);
  }

  const s = data?.summary;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Sales Audit" />

      {/* Filters */}
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1">
          <label className="text-[11px] text-text3 font-medium uppercase tracking-wider">From</label>
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="bg-surface border border-border rounded-lg px-3 py-2 text-[13px] text-text focus:outline-none focus:border-accent"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-[11px] text-text3 font-medium uppercase tracking-wider">To</label>
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="bg-surface border border-border rounded-lg px-3 py-2 text-[13px] text-text focus:outline-none focus:border-accent"
          />
        </div>
        <button
          onClick={() => refetch()}
          disabled={isFetching}
          className="flex items-center gap-2 px-4 py-2 bg-accent hover:bg-accent2 text-white rounded-lg text-[13px] font-medium transition-colors disabled:opacity-60"
        >
          {isFetching && <Spinner size="sm" />}
          {isFetching ? 'Loading…' : 'Apply'}
        </button>
        <div className="flex gap-2 ml-auto">
          <button
            onClick={exportExcel}
            disabled={!data || data.sales.length === 0}
            className="flex items-center gap-2 px-4 py-2 bg-surface border border-border text-text rounded-lg text-[13px] font-medium hover:bg-surface2 transition-colors disabled:opacity-40"
          >
            <Download className="w-4 h-4" />
            Export Excel
          </button>
          <button
            onClick={() => window.print()}
            disabled={!data || data.sales.length === 0}
            className="flex items-center gap-2 px-4 py-2 bg-surface border border-border text-text rounded-lg text-[13px] font-medium hover:bg-surface2 transition-colors disabled:opacity-40"
          >
            <Printer className="w-4 h-4" />
            Print
          </button>
        </div>
      </div>

      {/* Summary cards */}
      {s && (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {[
            { label: 'Total Orders',       value: s.totalOrders,                color: 'var(--accent)' },
            { label: 'Total Revenue',      value: `Rs. ${fmt(s.totalRevenue)}`, color: 'var(--green)' },
            { label: 'Retail Orders',      value: s.retailOrders,               color: 'var(--info)' },
            { label: 'Retail Revenue',     value: `Rs. ${fmt(s.retailRevenue)}`,color: 'var(--info)' },
            { label: 'Wholesale Orders',   value: s.wholesaleOrders,            color: 'var(--warning)' },
            { label: 'Wholesale Revenue',  value: `Rs. ${fmt(s.wholesaleRevenue)}`, color: 'var(--warning)' },
          ].map((c) => (
            <div key={c.label} className="bg-surface border border-border rounded-xl px-5 py-4">
              <p className="text-[11px] text-text3 uppercase tracking-wider mb-2">{c.label}</p>
              <p className="text-[22px] font-bold" style={{ color: c.color }}>{c.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Tab bar */}
      <div className="flex gap-1 bg-surface2 rounded-lg p-1 w-fit">
        {(['all', 'retail', 'wholesale'] as TabType[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-1.5 text-[13px] font-medium rounded-md capitalize transition-colors ${
              tab === t ? 'bg-surface text-text shadow-sm' : 'text-text2 hover:text-text'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Sales table */}
      <div className="receipt-printable bg-surface border border-border rounded-xl overflow-hidden">
        {isLoading ? (
          <div className="flex justify-center py-16"><Spinner /></div>
        ) : displayed.length === 0 ? (
          <EmptyState
            icon={<BarChart2 />}
            title="No sales in this period"
            message="Adjust the date range and click Apply."
          />
        ) : (
          <div className="table-scroll-wrap">
          <table className="w-full border-collapse">
            <thead className="sticky top-0 z-10">
              <tr className="bg-surface2 border-b border-border">
                {['Invoice #', 'Date & Time', 'Type', 'Customer', 'Cashier', 'Items', 'Disc %', 'Total'].map((h) => (
                  <th
                    key={h}
                    className="px-4 py-3 text-left text-[11px] font-semibold text-text3 uppercase tracking-[0.06em] whitespace-nowrap"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {displayed.map((sale) => (
                <tr key={sale.invoiceNumber} className="border-b border-border/50 hover:bg-surface2/50 transition-colors">
                  <td className="px-4 py-3">
                    <span className="font-mono text-accent text-[12px]">{sale.invoiceNumber}</span>
                  </td>
                  <td className="px-4 py-3 text-[12px] text-text3">{fmtDateTime(sale.createdAt)}</td>
                  <td className="px-4 py-3">
                    <Badge label={sale.type} variant={sale.type === 'retail' ? 'success' : 'info'} />
                  </td>
                  <td className="px-4 py-3 text-[13px] text-text">{sale.customerName}</td>
                  <td className="px-4 py-3 text-[13px] text-text2">{sale.cashierName}</td>
                  <td className="px-4 py-3 text-[13px] text-text2 text-center">{sale.itemCount}</td>
                  <td className="px-4 py-3 text-[13px] text-text2">{sale.discount.toFixed(1)}%</td>
                  <td className="px-4 py-3 text-[13px] font-semibold text-success">
                    Rs. {fmt(sale.totalAmount)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-border bg-surface2">
                <td colSpan={7} className="px-4 py-3 text-[12px] font-semibold text-text2 uppercase tracking-wider">
                  Total ({displayed.length} orders)
                </td>
                <td className="px-4 py-3 text-[14px] font-bold text-success">
                  Rs. {fmt(displayed.reduce((s, r) => s + r.totalAmount, 0))}
                </td>
              </tr>
            </tfoot>
          </table>
          </div>
        )}
      </div>
    </div>
  );
}
