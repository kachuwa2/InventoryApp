import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { X, Printer, Receipt } from 'lucide-react';
import { PageHeader } from '../../components/ui/PageHeader';
import { DataTable } from '../../components/ui/DataTable';
import type { Column } from '../../components/ui/DataTable';
import { Badge } from '../../components/ui/Badge';
import { Spinner } from '../../components/ui/Spinner';
import { fmt, fmtDateTime } from '../../utils/cn';
import * as salesApi from '../../api/sales';
import type { Sale, SaleType } from '../../api/types';

type SalesTab = 'all' | 'retail' | 'wholesale' | 'today';

const TABS: { key: SalesTab; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'retail', label: 'Retail' },
  { key: 'wholesale', label: 'Wholesale' },
  { key: 'today', label: 'Today' },
];

function isToday(iso: string): boolean {
  return new Date(iso).toDateString() === new Date().toDateString();
}

export function SalesPage() {
  const [activeTab, setActiveTab] = useState<SalesTab>('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const typeFilter: SaleType | undefined =
    activeTab === 'retail' ? 'retail' : activeTab === 'wholesale' ? 'wholesale' : undefined;

  const { data: sales = [], isLoading } = useQuery({
    queryKey: ['sales', { type: typeFilter }],
    queryFn: () => salesApi.getSales({ type: typeFilter }),
  });

  const { data: detail, isLoading: detailLoading } = useQuery({
    queryKey: ['sales', selectedId],
    queryFn: () => salesApi.getSale(selectedId!),
    enabled: selectedId !== null,
  });

  const displayed =
    activeTab === 'today' ? sales.filter((s) => isToday(s.createdAt)) : sales;

  const columns: Column<Sale>[] = [
    {
      key: 'invoice',
      header: 'Invoice #',
      render: (row) => (
        <span className="font-mono text-accent text-[12px]">{row.invoiceNumber}</span>
      ),
    },
    {
      key: 'customer',
      header: 'Customer',
      render: (row) => (
        <span className="text-text text-[13px]">
          {row.customer?.name ?? <span className="text-text3">Walk-in</span>}
        </span>
      ),
    },
    {
      key: 'type',
      header: 'Type',
      render: (row) => (
        <Badge label={row.type} variant={row.type === 'retail' ? 'success' : 'info'} />
      ),
    },
    {
      key: 'items',
      header: 'Items',
      render: (row) => (
        <span className="text-text2 text-[13px]">
          {row.items?.length ?? '—'}
        </span>
      ),
    },
    {
      key: 'discount',
      header: 'Disc %',
      render: (row) => (
        <span className="text-text2 text-[13px]">{Number(row.discount).toFixed(1)}%</span>
      ),
    },
    {
      key: 'total',
      header: 'Total (Rs.)',
      render: (row) => (
        <span className="text-success font-semibold text-[13px]">
          {fmt(row.totalAmount)}
        </span>
      ),
    },
    {
      key: 'cashier',
      header: 'Cashier',
      render: (row) => (
        <span className="text-text2 text-[13px]">{row.createdBy?.name ?? '—'}</span>
      ),
    },
    {
      key: 'date',
      header: 'Date & Time',
      render: (row) => (
        <span className="text-text3 text-[12px]">{fmtDateTime(row.createdAt)}</span>
      ),
    },
  ];

  return (
    <div className="flex flex-col h-full relative">
      <PageHeader title="Sales" count={displayed.length} />

      {/* Tab bar */}
      <div className="flex gap-1 bg-surface2 rounded-lg p-1 mb-5 w-fit">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            className={`px-4 py-1.5 text-[13px] font-medium rounded-md transition-colors ${
              activeTab === t.key
                ? 'bg-surface text-text shadow-sm'
                : 'text-text2 hover:text-text'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="bg-surface border border-border rounded-xl overflow-hidden">
        <DataTable
          columns={columns}
          data={displayed}
          loading={isLoading}
          rowKey={(r) => r.id}
          onRowClick={(r) => setSelectedId(r.id)}
          emptyTitle="No sales found"
          emptyMessage="Sales will appear here once transactions are processed."
          emptyIcon={<Receipt className="w-10 h-10" />}
        />
      </div>

      {/* Right slide-out panel */}
      {selectedId !== null && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-30 bg-black/40"
            onClick={() => setSelectedId(null)}
          />
          {/* Panel */}
          <div className="fixed top-0 right-0 h-full w-100 bg-surface border-l border-border z-40 flex flex-col shadow-2xl">
            {/* Panel header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
              <div className="flex items-center gap-2">
                <Receipt className="w-4 h-4 text-accent" />
                <span className="text-text font-semibold text-[15px]">
                  {detail?.invoiceNumber ?? 'Loading…'}
                </span>
              </div>
              <button
                onClick={() => setSelectedId(null)}
                className="text-text3 hover:text-text transition-colors p-1 rounded-lg hover:bg-surface2"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {detailLoading ? (
              <div className="flex-1 flex items-center justify-center">
                <Spinner />
              </div>
            ) : detail ? (
              <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-5">
                {/* Invoice header */}
                <div className="bg-surface2 rounded-xl p-4 flex flex-col gap-2 text-[13px]">
                  <div className="flex justify-between">
                    <span className="text-text3">Date</span>
                    <span className="text-text">{fmtDateTime(detail.createdAt)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-text3">Cashier</span>
                    <span className="text-text">{detail.createdBy?.name ?? '—'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-text3">Customer</span>
                    <span className="text-text">{detail.customer?.name ?? 'Walk-in'}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-text3">Type</span>
                    <Badge label={detail.type} variant={detail.type === 'retail' ? 'success' : 'info'} />
                  </div>
                </div>

                {/* Line items */}
                <div>
                  <p className="text-text3 text-[11px] uppercase tracking-wider mb-3">Items</p>
                  <div className="bg-surface2 rounded-xl overflow-hidden">
                    <table className="w-full border-collapse text-[12px]">
                      <thead>
                        <tr className="border-b border-border">
                          <th className="px-3 py-2 text-left text-text3 font-medium">Product</th>
                          <th className="px-3 py-2 text-right text-text3 font-medium">Price</th>
                          <th className="px-3 py-2 text-center text-text3 font-medium">Qty</th>
                          <th className="px-3 py-2 text-center text-text3 font-medium">Disc%</th>
                          <th className="px-3 py-2 text-right text-text3 font-medium">Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(detail.items ?? []).map((item) => (
                          <tr key={item.id} className="border-b border-border/40">
                            <td className="px-3 py-2.5 text-text">
                              {item.product?.name ?? item.productId.slice(0, 8)}
                            </td>
                            <td className="px-3 py-2.5 text-right text-text2">
                              {fmt(item.unitPrice)}
                            </td>
                            <td className="px-3 py-2.5 text-center text-text2">{item.quantity}</td>
                            <td className="px-3 py-2.5 text-center text-text2">
                              {Number(item.discountPct).toFixed(1)}%
                            </td>
                            <td className="px-3 py-2.5 text-right text-text font-medium">
                              {fmt(item.lineTotal)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Summary */}
                <div className="flex flex-col gap-2 text-[13px]">
                  <div className="flex justify-between">
                    <span className="text-text2">Subtotal</span>
                    <span className="text-text">
                      Rs. {fmt(
                        (detail.items ?? []).reduce((s, i) => s + Number(i.lineTotal), 0)
                      )}
                    </span>
                  </div>
                  {Number(detail.discount) > 0 && (
                    <div className="flex justify-between">
                      <span className="text-text2">Order Discount ({detail.discount}%)</span>
                      <span className="text-danger">
                        -Rs. {fmt(
                          (detail.items ?? []).reduce((s, i) => s + Number(i.lineTotal), 0) *
                            (Number(detail.discount) / 100)
                        )}
                      </span>
                    </div>
                  )}
                  <div className="border-t border-border pt-2 flex justify-between font-semibold">
                    <span className="text-text">Total</span>
                    <span className="text-success text-[16px]">Rs. {fmt(detail.totalAmount)}</span>
                  </div>
                </div>
              </div>
            ) : null}

            {/* Print button */}
            <div className="px-5 py-4 border-t border-border shrink-0">
              <button
                onClick={() => window.print()}
                className="w-full py-2.5 bg-surface2 border border-border text-text rounded-xl text-[13px] font-medium flex items-center justify-center gap-2 hover:bg-border transition-colors"
              >
                <Printer className="w-4 h-4" />
                Print Receipt
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
