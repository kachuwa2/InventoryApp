import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ShieldCheck } from 'lucide-react';
import { PageHeader } from '../../components/ui/PageHeader';
import { DataTable } from '../../components/ui/DataTable';
import type { Column } from '../../components/ui/DataTable';
import { Modal } from '../../components/ui/Modal';
import { FilterBar } from '../../components/ui/FilterBar';
import { Badge } from '../../components/ui/Badge';
import { fmtDateTime } from '../../utils/cn';
import * as auditApi from '../../api/audit';
import type { AuditLog } from '../../api/types';

type AuditVariant = 'success' | 'warning' | 'danger' | 'info' | 'accent' | 'muted' | 'default';

const ACTION_CATEGORIES: { prefix: string; variant: AuditVariant }[] = [
  { prefix: 'USER_', variant: 'info' },
  { prefix: 'PRODUCT_', variant: 'accent' },
  { prefix: 'SALE_', variant: 'success' },
  { prefix: 'PURCHASE_', variant: 'warning' },
  { prefix: 'INVENTORY_', variant: 'muted' },
];

function actionVariant(action: string): AuditVariant {
  for (const { prefix, variant } of ACTION_CATEGORIES) {
    if (action.startsWith(prefix)) return variant;
  }
  return 'default';
}

const ACTION_FILTER_OPTIONS = [
  { value: 'USER_', label: 'User' },
  { value: 'PRODUCT_', label: 'Product' },
  { value: 'SALE_', label: 'Sale' },
  { value: 'PURCHASE_', label: 'Purchase' },
  { value: 'INVENTORY_', label: 'Inventory' },
];

function JsonBlock({ data }: { data: Record<string, unknown> | null }) {
  if (!data) return <p className="text-text3 text-[12px] italic">null</p>;
  return (
    <pre className="bg-bg text-success font-mono text-[12px] rounded-xl p-4 overflow-auto max-h-48 whitespace-pre-wrap break-all">
      {JSON.stringify(data, null, 2)}
    </pre>
  );
}

export function AuditPage() {
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);

  const { data: logs = [], isLoading } = useQuery({
    queryKey: ['audit'],
    queryFn: () => auditApi.getAuditLogs(),
  });

  const displayed = logs.filter((log) => {
    const matchesAction = actionFilter ? log.action.startsWith(actionFilter) : true;
    if (!search) return matchesAction;
    const s = search.toLowerCase();
    return (
      matchesAction &&
      (log.action.toLowerCase().includes(s) ||
        (log.user?.name ?? '').toLowerCase().includes(s) ||
        log.tableName.toLowerCase().includes(s))
    );
  });

  const columns: Column<AuditLog>[] = [
    {
      key: 'action',
      header: 'Action',
      render: (row) => (
        <Badge label={row.action} variant={actionVariant(row.action)} />
      ),
    },
    {
      key: 'table',
      header: 'Table',
      render: (row) => (
        <span className="font-mono text-text2 text-[12px]">{row.tableName}</span>
      ),
    },
    {
      key: 'recordId',
      header: 'Record ID',
      render: (row) => (
        <span className="font-mono text-text3 text-[12px]">{row.recordId.slice(0, 8)}</span>
      ),
    },
    {
      key: 'user',
      header: 'User',
      render: (row) => (
        <span className="text-text text-[13px]">{row.user?.name ?? row.userId.slice(0, 8)}</span>
      ),
    },
    {
      key: 'ip',
      header: 'IP Address',
      render: (row) => (
        <span className="font-mono text-text3 text-[12px]">{row.ipAddress}</span>
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

  const hasDiff = selectedLog?.before !== null && selectedLog?.after !== null;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Audit Log" />

      <FilterBar
        search={{
          value: search,
          onChange: setSearch,
          placeholder: 'Search action, user, table…',
        }}
        filters={[
          {
            label: 'Category',
            value: actionFilter,
            onChange: setActionFilter,
            options: ACTION_FILTER_OPTIONS,
          },
        ]}
      />

      <div className="bg-surface border border-border rounded-xl overflow-hidden">
        <DataTable
          columns={columns}
          data={displayed}
          loading={isLoading}
          rowKey={(r) => r.id}
          onRowClick={(r) => setSelectedLog(r)}
          emptyTitle="No audit logs found"
          emptyMessage="Audit events will appear here as actions are performed."
          emptyIcon={<ShieldCheck className="w-10 h-10" />}
          compact
        />
      </div>

      {/* Detail modal */}
      <Modal
        isOpen={selectedLog !== null}
        onClose={() => setSelectedLog(null)}
        title="Audit Log Detail"
        size="lg"
      >
        {selectedLog && (
          <div className="flex flex-col gap-5">
            {/* Header info */}
            <div className="grid grid-cols-2 gap-4 text-[13px]">
              <div className="flex flex-col gap-2">
                <div className="flex justify-between">
                  <span className="text-text3">Action</span>
                  <Badge label={selectedLog.action} variant={actionVariant(selectedLog.action)} />
                </div>
                <div className="flex justify-between">
                  <span className="text-text3">Table</span>
                  <span className="font-mono text-text2 text-[12px]">{selectedLog.tableName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text3">Record ID</span>
                  <span className="font-mono text-text3 text-[12px]">
                    {selectedLog.recordId.slice(0, 8)}…
                  </span>
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <div className="flex justify-between">
                  <span className="text-text3">User</span>
                  <div className="flex items-center gap-2">
                    <span className="text-text text-[13px]">{selectedLog.user?.name ?? '—'}</span>
                    {selectedLog.user?.role && (
                      <Badge label={selectedLog.user.role} variant="muted" />
                    )}
                  </div>
                </div>
                <div className="flex justify-between">
                  <span className="text-text3">IP Address</span>
                  <span className="font-mono text-text2 text-[12px]">{selectedLog.ipAddress}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text3">Timestamp</span>
                  <span className="text-text2 text-[12px]">{fmtDateTime(selectedLog.createdAt)}</span>
                </div>
              </div>
            </div>

            {/* State blocks */}
            {hasDiff ? (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-text3 text-[11px] uppercase tracking-wider mb-2">Before</p>
                  <div className="rounded-xl overflow-hidden border border-danger/20 bg-danger/10 p-1">
                    <JsonBlock data={selectedLog.before} />
                  </div>
                </div>
                <div>
                  <p className="text-text3 text-[11px] uppercase tracking-wider mb-2">After</p>
                  <div className="rounded-xl overflow-hidden border border-success/20 bg-success/10 p-1">
                    <JsonBlock data={selectedLog.after} />
                  </div>
                </div>
              </div>
            ) : (
              <>
                {selectedLog.before !== null && (
                  <div>
                    <p className="text-text3 text-[11px] uppercase tracking-wider mb-2">Before State</p>
                    <JsonBlock data={selectedLog.before} />
                  </div>
                )}
                {selectedLog.after !== null && (
                  <div>
                    <p className="text-text3 text-[11px] uppercase tracking-wider mb-2">After State</p>
                    <JsonBlock data={selectedLog.after} />
                  </div>
                )}
                {selectedLog.before === null && selectedLog.after === null && (
                  <p className="text-text3 text-[13px] text-center py-4">No state data recorded</p>
                )}
              </>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
