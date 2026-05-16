import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ChevronLeft, Check, X, Truck } from 'lucide-react';
import { useToast } from '../../contexts/ToastContext';
import { Badge, statusVariant } from '../../components/ui/Badge';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { Modal } from '../../components/ui/Modal';
import { Spinner } from '../../components/ui/Spinner';
import * as purchasesApi from '../../api/purchases';
import { fmt, fmtDate, fmtDateTime } from '../../utils/cn';
import type { PurchaseItem } from '../../api/types';

export function PurchaseDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [showApprove, setShowApprove] = useState(false);
  const [showCancel, setShowCancel] = useState(false);
  const [showReceive, setShowReceive] = useState(false);
  const [receiveNotes, setReceiveNotes] = useState('');
  const [receivedQtys, setReceivedQtys] = useState<Record<string, number>>({});

  const { data: po, isLoading } = useQuery({
    queryKey: ['purchases', id],
    queryFn: () => purchasesApi.getPurchase(id!),
    enabled: Boolean(id),
  });

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ['purchases'] });
    queryClient.invalidateQueries({ queryKey: ['inventory'] });
  }

  const approveMutation = useMutation({
    mutationFn: () => purchasesApi.approvePurchase(id!),
    onSuccess: () => { invalidate(); toast('success', 'Purchase order approved'); setShowApprove(false); },
    onError: () => toast('error', 'Failed to approve PO'),
  });

  const cancelMutation = useMutation({
    mutationFn: () => purchasesApi.cancelPurchase(id!),
    onSuccess: () => { invalidate(); toast('success', 'Purchase order cancelled'); setShowCancel(false); },
    onError: () => toast('error', 'Failed to cancel PO'),
  });

  const receiveMutation = useMutation({
    mutationFn: () =>
      purchasesApi.receivePurchase(id!, {
        items: Object.entries(receivedQtys).map(([itemId, qty]) => ({ itemId, quantityReceived: qty })),
        notes: receiveNotes || undefined,
      }),
    onSuccess: () => {
      invalidate();
      toast('success', 'Stock received successfully');
      setShowReceive(false);
    },
    onError: () => toast('error', 'Failed to receive stock'),
  });

  function openReceive() {
    const qtys: Record<string, number> = {};
    po?.items?.forEach((item) => { qtys[item.id] = item.quantityOrdered; });
    setReceivedQtys(qtys);
    setReceiveNotes('');
    setShowReceive(true);
  }

  if (isLoading) {
    return <div className="flex justify-center py-12"><Spinner size="lg" /></div>;
  }

  if (!po) {
    return (
      <div className="text-center py-12 text-text2">
        Purchase order not found.
      </div>
    );
  }

  const totalValue = po.items?.reduce(
    (sum, item) => sum + item.quantityOrdered * parseFloat(item.unitCost),
    0
  ) ?? 0;

  const statusSteps = [
    { key: 'created', label: 'Created', date: po.createdAt, by: po.createdBy?.name, done: true },
    { key: 'approved', label: 'Approved', date: po.approvedAt, by: po.approvedBy?.name, done: Boolean(po.approvedAt) },
    { key: 'received', label: 'Received', date: po.receivedAt, by: undefined, done: Boolean(po.receivedAt) },
  ];

  return (
    <div className="max-w-4xl">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/purchases')} className="p-2 rounded-lg hover:bg-surface2 text-text2 transition-colors">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-[20px] font-semibold text-text font-mono">{po.orderNumber}</h1>
              <Badge label={po.status} variant={statusVariant(po.status)} dot />
            </div>
            <p className="text-text2 text-[13px] mt-0.5">
              {po.supplier?.name} · Created {fmtDate(po.createdAt)}
              {po.supplierReference && ` · Ref: ${po.supplierReference}`}
            </p>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex gap-2">
          {po.status === 'draft' && (
            <>
              <button onClick={() => setShowApprove(true)} className="flex items-center gap-1.5 px-3 py-2 bg-info/15 hover:bg-info/25 text-info rounded-lg text-[13px] font-medium transition-colors">
                <Check className="w-4 h-4" /> Approve
              </button>
              <button onClick={() => setShowCancel(true)} className="flex items-center gap-1.5 px-3 py-2 bg-danger/15 hover:bg-danger/25 text-danger rounded-lg text-[13px] font-medium transition-colors">
                <X className="w-4 h-4" /> Cancel
              </button>
            </>
          )}
          {po.status === 'approved' && (
            <>
              <button onClick={openReceive} className="flex items-center gap-1.5 px-3 py-2 bg-success/15 hover:bg-success/25 text-success rounded-lg text-[13px] font-medium transition-colors">
                <Truck className="w-4 h-4" /> Receive Stock
              </button>
              <button onClick={() => setShowCancel(true)} className="flex items-center gap-1.5 px-3 py-2 bg-danger/15 hover:bg-danger/25 text-danger rounded-lg text-[13px] font-medium transition-colors">
                <X className="w-4 h-4" /> Cancel
              </button>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-5">
        {/* Main content */}
        <div className="col-span-2 flex flex-col gap-5">
          {/* Status timeline */}
          <div className="bg-surface border border-border rounded-xl p-5">
            <h2 className="text-[14px] font-semibold text-text mb-4">Timeline</h2>
            <div className="flex items-center gap-0">
              {statusSteps.map((step, i) => (
                <div key={step.key} className="flex items-center flex-1">
                  <div className="flex flex-col items-center">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${step.done ? 'bg-success/15 text-success' : 'bg-surface2 text-text3'}`}>
                      {step.done ? <Check className="w-4 h-4" /> : <span className="text-[12px]">{i + 1}</span>}
                    </div>
                    <p className="text-[11px] font-medium mt-1.5 text-center">{step.done ? <span className="text-text">{step.label}</span> : <span className="text-text3">{step.label}</span>}</p>
                    {step.done && step.date && (
                      <p className="text-[10px] text-text3 text-center">{fmtDate(step.date)}</p>
                    )}
                    {step.by && <p className="text-[10px] text-text3 text-center">{step.by}</p>}
                  </div>
                  {i < statusSteps.length - 1 && (
                    <div className={`flex-1 h-px mx-2 mb-5 ${statusSteps[i + 1].done ? 'bg-success' : 'bg-border'}`} />
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Line items */}
          <div className="bg-surface border border-border rounded-xl p-5">
            <h2 className="text-[14px] font-semibold text-text mb-4">Line Items</h2>
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  {['Product', 'Ordered', 'Received', 'Unit Cost', 'Line Total'].map((h) => (
                    <th key={h} className="px-3 py-2 text-left text-[11px] font-medium text-text2 uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {po.items?.map((item: PurchaseItem) => {
                  const shortShip = item.quantityReceived !== null && item.quantityReceived < item.quantityOrdered;
                  return (
                    <tr key={item.id} className="border-b border-border/50">
                      <td className="px-3 py-3">
                        <p className="text-[13px] font-medium text-text">{item.product?.name}</p>
                        <p className="text-[11px] font-mono text-text3">{item.product?.sku}</p>
                      </td>
                      <td className="px-3 py-3 text-[13px] text-text">{item.quantityOrdered}</td>
                      <td className="px-3 py-3 text-[13px]">
                        {item.quantityReceived === null ? (
                          <span className="text-text3">—</span>
                        ) : (
                          <span className={shortShip ? 'text-warning' : 'text-success'}>{item.quantityReceived}</span>
                        )}
                      </td>
                      <td className="px-3 py-3 text-[13px] font-mono text-text">KSh {fmt(item.unitCost)}</td>
                      <td className="px-3 py-3 text-[13px] font-mono text-text">KSh {fmt(item.quantityOrdered * parseFloat(item.unitCost))}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Sidebar */}
        <div className="flex flex-col gap-4">
          <div className="bg-surface border border-border rounded-xl p-5">
            <h2 className="text-[14px] font-semibold text-text mb-3">Order Info</h2>
            <dl className="flex flex-col gap-2.5">
              {[
                { label: 'Supplier', value: po.supplier?.name },
                { label: 'Supplier Ref', value: po.supplierReference ?? '—' },
                { label: 'Expected', value: po.expectedAt ? fmtDate(po.expectedAt) : '—' },
                { label: 'Items', value: po.items?.length ?? 0 },
              ].map(({ label, value }) => (
                <div key={label}>
                  <dt className="text-[11px] text-text3 uppercase tracking-wide">{label}</dt>
                  <dd className="text-[13px] text-text mt-0.5">{value}</dd>
                </div>
              ))}
              {po.notes && (
                <div>
                  <dt className="text-[11px] text-text3 uppercase tracking-wide">Notes</dt>
                  <dd className="text-[13px] text-text2 mt-0.5">{po.notes}</dd>
                </div>
              )}
            </dl>

            <div className="border-t border-border mt-4 pt-4">
              <div className="flex justify-between items-center">
                <span className="text-text2 text-[13px]">Total Value</span>
                <span className="text-text font-semibold font-mono text-[15px]">KSh {fmt(totalValue)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Dialogs */}
      <ConfirmDialog
        isOpen={showApprove} onClose={() => setShowApprove(false)}
        onConfirm={() => approveMutation.mutate()} loading={approveMutation.isPending}
        title="Approve Purchase Order" message={`Approve ${po.orderNumber}? This cannot be undone.`}
        confirmLabel="Approve" danger={false}
      />
      <ConfirmDialog
        isOpen={showCancel} onClose={() => setShowCancel(false)}
        onConfirm={() => cancelMutation.mutate()} loading={cancelMutation.isPending}
        title="Cancel Purchase Order" message={`Cancel ${po.orderNumber}? This cannot be undone.`}
        confirmLabel="Cancel PO"
      />

      {/* Receive Stock Modal */}
      <Modal
        isOpen={showReceive} onClose={() => setShowReceive(false)}
        title={`Receive Stock — ${po.orderNumber}`} size="lg"
        footer={
          <div className="flex justify-end gap-3">
            <button onClick={() => setShowReceive(false)} className="px-4 py-2 bg-surface2 border border-border text-text rounded-lg text-[13px] font-medium hover:bg-border transition-colors">Cancel</button>
            <button onClick={() => receiveMutation.mutate()} disabled={receiveMutation.isPending} className="flex items-center gap-2 px-4 py-2 bg-success/90 hover:bg-success text-white rounded-lg text-[13px] font-medium transition-colors disabled:opacity-60">
              {receiveMutation.isPending && <Spinner size="sm" />}
              <Truck className="w-4 h-4" /> Confirm Receipt
            </button>
          </div>
        }
      >
        <div className="flex flex-col gap-4">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                {['Product', 'Ordered', 'Received Qty'].map((h) => (
                  <th key={h} className="px-3 py-2 text-left text-[11px] font-medium text-text2 uppercase">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {po.items?.map((item: PurchaseItem) => (
                <tr key={item.id} className="border-b border-border/50">
                  <td className="px-3 py-3">
                    <p className="text-[13px] font-medium text-text">{item.product?.name}</p>
                    <p className="text-[11px] font-mono text-text3">{item.product?.sku}</p>
                  </td>
                  <td className="px-3 py-3 text-[13px] text-text2">{item.quantityOrdered}</td>
                  <td className="px-3 py-3">
                    <input
                      type="number" min={0} max={item.quantityOrdered}
                      value={receivedQtys[item.id] ?? item.quantityOrdered}
                      onChange={(e) => setReceivedQtys((p) => ({ ...p, [item.id]: parseInt(e.target.value) || 0 }))}
                      className="w-24 bg-surface2 border border-border text-text rounded-lg px-2 py-1.5 text-[13px] text-center focus:outline-none focus:border-accent"
                    />
                    {(receivedQtys[item.id] ?? item.quantityOrdered) < item.quantityOrdered && (
                      <span className="text-warning text-[11px] ml-2">Short ship</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div>
            <label className="block text-[11px] font-medium text-text2 uppercase tracking-wide mb-1.5">Receipt Notes (optional)</label>
            <textarea
              value={receiveNotes} onChange={(e) => setReceiveNotes(e.target.value)}
              rows={2} placeholder="e.g. 3 units arrived damaged…"
              className="w-full bg-surface2 border border-border text-text placeholder-text3 rounded-lg px-3 py-2.5 text-[13px] focus:outline-none focus:border-accent transition-colors resize-none"
            />
          </div>
        </div>
      </Modal>

      {/* Created at footer */}
      <div className="mt-4 text-[12px] text-text3">
        Created {fmtDateTime(po.createdAt)} by {po.createdBy?.name ?? 'Unknown'}
      </div>
    </div>
  );
}
