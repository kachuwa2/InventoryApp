import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { ShoppingBag, Plus, Eye, Clock } from 'lucide-react';
import { PageHeader } from '../../components/ui/PageHeader';
import { DataTable } from '../../components/ui/DataTable';
import type { Column } from '../../components/ui/DataTable';
import { Badge } from '../../components/ui/Badge';
import { Spinner } from '../../components/ui/Spinner';
import { fmt, fmtDate } from '../../utils/cn';
import { useAuth } from '../../context/AuthContext';
import * as purchasesApi from '../../api/purchases';
import type { PurchaseOrder, PurchaseStatus } from '../../api/types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
type TabId = 'all' | PurchaseStatus;

interface TabDef {
  id: TabId;
  label: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const TABS: TabDef[] = [
  { id: 'all', label: 'All' },
  { id: 'draft', label: 'Draft' },
  { id: 'approved', label: 'Approved' },
  { id: 'received', label: 'Received' },
  { id: 'cancelled', label: 'Cancelled' },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function poTotalValue(po: PurchaseOrder): number {
  return (
    po.items?.reduce(
      (sum, item) => sum + item.quantityOrdered * parseFloat(item.unitCost),
      0
    ) ?? 0
  );
}

function isOverdue(po: PurchaseOrder): boolean {
  return (
    po.status === 'approved' &&
    po.expectedAt !== null &&
    new Date(po.expectedAt) < new Date()
  );
}

function statusVariant(status: PurchaseStatus): 'warning' | 'info' | 'success' | 'danger' | 'muted' {
  switch (status) {
    case 'draft': return 'warning';
    case 'approved': return 'info';
    case 'received': return 'success';
    case 'cancelled': return 'danger';
  }
}

function statusLabel(status: PurchaseStatus): string {
  switch (status) {
    case 'draft': return 'Draft';
    case 'approved': return 'Approved';
    case 'received': return 'Received';
    case 'cancelled': return 'Cancelled';
  }
}

// ---------------------------------------------------------------------------
// Tab button
// ---------------------------------------------------------------------------
interface TabButtonProps {
  tab: TabDef;
  count: number;
  active: boolean;
  onClick: (id: TabId) => void;
}

function TabButton({ tab, count, active, onClick }: TabButtonProps) {
  return (
    <button
      onClick={() => onClick(tab.id)}
      className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-[13px] font-medium transition-colors whitespace-nowrap ${
        active
          ? 'bg-accent text-white'
          : 'bg-surface2 text-text2 border border-border hover:text-text'
      }`}
    >
      {tab.label}
      {count > 0 && (
        <span
          className={`text-[11px] font-semibold px-1.5 py-0.5 rounded-full ${
            active
              ? 'bg-white/20 text-white'
              : 'bg-surface text-text2 border border-border'
          }`}
        >
          {count}
        </span>
      )}
    </button>
  );
}

// ---------------------------------------------------------------------------
// PurchasesPage
// ---------------------------------------------------------------------------
export function PurchasesPage() {
  const navigate = useNavigate();
  const { isRole } = useAuth();
  const [activeTab, setActiveTab] = useState<TabId>('all');

  // Query — always fetch all; filter client-side for counts, server-side by status
  const { data: allOrders = [], isLoading } = useQuery({
    queryKey: ['purchases', { status: 'all' }],
    queryFn: () => purchasesApi.getPurchases({}),
  });

  const { data: tabOrders = [], isLoading: tabLoading } = useQuery({
    queryKey: ['purchases', { status: activeTab }],
    queryFn: () =>
      activeTab === 'all'
        ? purchasesApi.getPurchases({})
        : purchasesApi.getPurchases({ status: activeTab as PurchaseStatus }),
  });

  // Per-tab counts from all orders
  function countForTab(id: TabId): number {
    if (id === 'all') return allOrders.length;
    return allOrders.filter((o) => o.status === id).length;
  }

  // Columns
  const columns: Column<PurchaseOrder>[] = [
    {
      key: 'orderNumber',
      header: 'PO Number',
      render: (row) => (
        <span className="font-mono text-[13px] text-accent font-semibold">
          {row.orderNumber}
        </span>
      ),
    },
    {
      key: 'supplier',
      header: 'Supplier',
      render: (row) => (
        <span className="text-[13px] text-text">{row.supplier?.name ?? '—'}</span>
      ),
    },
    {
      key: 'items',
      header: 'Items',
      render: (row) => (
        <span className="text-[13px] text-text2">{row.items?.length ?? 0}</span>
      ),
    },
    {
      key: 'totalValue',
      header: 'Total Value',
      render: (row) => (
        <span className="text-[13px] font-medium text-text">
          KSh {fmt(poTotalValue(row))}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => (
        <Badge
          label={statusLabel(row.status)}
          variant={statusVariant(row.status)}
          dot
        />
      ),
    },
    {
      key: 'createdBy',
      header: 'Created By',
      render: (row) => (
        <span className="text-[13px] text-text2">{row.createdBy?.name ?? '—'}</span>
      ),
    },
    {
      key: 'expectedAt',
      header: 'Expected',
      render: (row) => {
        if (!row.expectedAt) return <span className="text-[13px] text-text3">—</span>;
        const overdue = isOverdue(row);
        return (
          <span
            className={`flex items-center gap-1 text-[13px] ${
              overdue ? 'text-warning font-medium' : 'text-text2'
            }`}
          >
            {overdue && <Clock className="w-3.5 h-3.5 shrink-0" />}
            {fmtDate(row.expectedAt)}
          </span>
        );
      },
    },
    {
      key: 'actions',
      header: '',
      className: 'text-right',
      render: (row) => (
        <button
          onClick={(e) => { e.stopPropagation(); navigate(`/purchases/${row.id}`); }}
          className="p-1.5 rounded-lg text-text3 hover:text-accent hover:bg-accent/10 transition-colors"
          title="View purchase order"
        >
          <Eye className="w-4 h-4" />
        </button>
      ),
    },
  ];

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Spinner />
      </div>
    );
  }

  const canCreatePO = isRole('admin', 'manager');

  return (
    <div className="p-6">
      <PageHeader
        title="Purchase Orders"
        count={tabOrders.length}
        actions={
          canCreatePO ? (
            <button
              onClick={() => navigate('/purchases/new')}
              className="flex items-center gap-2 px-4 py-2 bg-accent hover:bg-accent/90 text-white rounded-lg text-[13px] font-medium transition-colors"
            >
              <Plus className="w-4 h-4" />
              New PO
            </button>
          ) : undefined
        }
      />

      {/* Tabs */}
      <div className="flex gap-2 mb-5 flex-wrap">
        {TABS.map((tab) => (
          <TabButton
            key={tab.id}
            tab={tab}
            count={countForTab(tab.id)}
            active={activeTab === tab.id}
            onClick={setActiveTab}
          />
        ))}
      </div>

      {/* Table */}
      <div className="bg-surface border border-border rounded-xl overflow-hidden">
        <DataTable
          columns={columns}
          data={tabOrders}
          loading={tabLoading}
          rowKey={(r) => r.id}
          onRowClick={(row) => navigate(`/purchases/${row.id}`)}
          emptyTitle="No purchase orders"
          emptyMessage={
            activeTab === 'all'
              ? 'Create your first purchase order to get started.'
              : `No ${activeTab} purchase orders found.`
          }
          emptyIcon={<ShoppingBag className="w-8 h-8" />}
        />
      </div>
    </div>
  );
}
