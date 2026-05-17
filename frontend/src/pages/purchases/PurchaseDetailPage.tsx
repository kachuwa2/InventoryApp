import { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ChevronLeft, Check, X, Truck, Edit2, Plus, Trash2 } from 'lucide-react';
import { useToast } from '../../contexts/ToastContext';
import { Badge, statusVariant } from '../../components/ui/Badge';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { Modal } from '../../components/ui/Modal';
import { Spinner } from '../../components/ui/Spinner';
import * as purchasesApi from '../../api/purchases';
import * as productsApi from '../../api/products';
import { fmt, fmtDate, fmtDateTime } from '../../utils/cn';
import type { PurchaseItem, Product } from '../../api/types';

interface EditItem {
  productId: string;
  productName: string;
  sku: string;
  quantityOrdered: number;
  unitCost: number;
}

const inputCls =
  'bg-surface2 border border-border text-text rounded-lg px-2 py-1.5 text-[13px] focus:outline-none focus:border-accent transition-colors';

export function PurchaseDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // existing modals
  const [showApprove,  setShowApprove]  = useState(false);
  const [showCancel,   setShowCancel]   = useState(false);
  const [showReceive,  setShowReceive]  = useState(false);
  const [receiveNotes, setReceiveNotes] = useState('');
  const [receivedQtys, setReceivedQtys] = useState<Record<string, number>>({});

  // edit modal
  const [showEdit,          setShowEdit]          = useState(false);
  const [editRef,           setEditRef]           = useState('');
  const [editNotes,         setEditNotes]         = useState('');
  const [editExpectedAt,    setEditExpectedAt]    = useState('');
  const [editItems,         setEditItems]         = useState<EditItem[]>([]);
  const [editError,         setEditError]         = useState('');
  const [showProductPicker, setShowProductPicker] = useState(false);
  const [pickerSearch,      setPickerSearch]      = useState('');

  const { data: po, isLoading } = useQuery({
    queryKey: ['purchases', id],
    queryFn:  () => purchasesApi.getPurchase(id!),
    enabled:  Boolean(id),
  });

  const { data: allProducts = [] } = useQuery<Product[]>({
    queryKey: ['products'],
    queryFn:  () => productsApi.getProducts(),
    enabled:  showProductPicker,
  });

  const filteredProducts = useMemo(() => {
    const q = pickerSearch.toLowerCase();
    return allProducts.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q)
    );
  }, [allProducts, pickerSearch]);

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

  const editMutation = useMutation({
    mutationFn: (payload: Parameters<typeof purchasesApi.updatePurchase>[1]) =>
      purchasesApi.updatePurchase(id!, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchases'] });
      queryClient.invalidateQueries({ queryKey: ['purchases', id] });
      setShowEdit(false);
      toast('success', 'Purchase order updated successfully');
    },
    onError: (err: unknown) => {
      const axiosErr = err as { response?: { status?: number; data?: { message?: string } } };
      if (axiosErr.response?.status === 409) {
        toast('error', 'This order has already been approved and can no longer be edited.');
        queryClient.invalidateQueries({ queryKey: ['purchases', id] });
        setShowEdit(false);
      } else {
        toast('error', axiosErr.response?.data?.message ?? 'Failed to update purchase order');
      }
    },
  });

  function openReceive() {
    const qtys: Record<string, number> = {};
    po?.items?.forEach((item) => { qtys[item.id] = item.quantityOrdered; });
    setReceivedQtys(qtys);
    setReceiveNotes('');
    setShowReceive(true);
  }

  function openEdit() {
    setEditRef(po?.supplierReference ?? '');
    setEditNotes(po?.notes ?? '');
    setEditExpectedAt(po?.expectedAt ? po.expectedAt.split('T')[0] : '');
    setEditItems(
      po?.items?.map((item) => ({
        productId:       item.productId,
        productName:     item.product?.name ?? '',
        sku:             item.product?.sku  ?? '',
        quantityOrdered: item.quantityOrdered,
        unitCost:        parseFloat(item.unitCost),
      })) ?? []
    );
    setEditError('');
    setShowEdit(true);
  }

  function handleEditSubmit() {
    if (editItems.length === 0) {
      setEditError('At least one item is required.');
      return;
    }
    if (editItems.some((i) => i.quantityOrdered <= 0 || i.unitCost <= 0)) {
      setEditError('All items must have quantity > 0 and unit cost > 0.');
      return;
    }
    setEditError('');

    editMutation.mutate({
      ...(editRef        && { supplierReference: editRef }),
      ...(editNotes      && { notes: editNotes }),
      ...(editExpectedAt && { expectedAt: new Date(editExpectedAt).toISOString() }),
      items: editItems
        .filter((i) => i.productId && i.quantityOrdered > 0 && i.unitCost > 0)
        .map((i) => ({
          productId:       i.productId,
          quantityOrdered: Number(i.quantityOrdered),
          unitCost:        String(Number(i.unitCost)),
        })),
    });
  }

  function addProductToEdit(product: Product) {
    if (editItems.some((i) => i.productId === product.id)) {
      setShowProductPicker(false);
      return;
    }
    setEditItems((prev) => [
      ...prev,
      {
        productId:       product.id,
        productName:     product.name,
        sku:             product.sku,
        quantityOrdered: 1,
        unitCost:        0,
      },
    ]);
    setPickerSearch('');
    setShowProductPicker(false);
  }

  function removeEditItem(productId: string) {
    setEditItems((prev) => prev.filter((i) => i.productId !== productId));
  }

  function updateEditItem(productId: string, field: 'quantityOrdered' | 'unitCost', value: number) {
    setEditItems((prev) =>
      prev.map((i) => i.productId === productId ? { ...i, [field]: value } : i)
    );
  }

  const editRunningTotal = editItems.reduce(
    (sum, i) => sum + i.quantityOrdered * i.unitCost, 0
  );

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
    { key: 'created',  label: 'Created',  date: po.createdAt,  by: po.createdBy?.name,  done: true },
    { key: 'approved', label: 'Approved', date: po.approvedAt, by: po.approvedBy?.name, done: Boolean(po.approvedAt) },
    { key: 'received', label: 'Received', date: po.receivedAt, by: undefined,           done: Boolean(po.receivedAt) },
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
              <button onClick={openEdit} className="flex items-center gap-1.5 px-3 py-2 bg-surface2 hover:bg-border border border-border text-text rounded-lg text-[13px] font-medium transition-colors">
                <Edit2 className="w-4 h-4" /> Edit
              </button>
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
                      <td className="px-3 py-3 text-[13px] font-mono text-text">Rs. {fmt(item.unitCost)}</td>
                      <td className="px-3 py-3 text-[13px] font-mono text-text">Rs. {fmt(item.quantityOrdered * parseFloat(item.unitCost))}</td>
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
                { label: 'Supplier',     value: po.supplier?.name },
                { label: 'Supplier Ref', value: po.supplierReference ?? '—' },
                { label: 'Expected',     value: po.expectedAt ? fmtDate(po.expectedAt) : '—' },
                { label: 'Items',        value: po.items?.length ?? 0 },
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
                <span className="text-text font-semibold font-mono text-[15px]">Rs. {fmt(totalValue)}</span>
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

      {/* Edit Purchase Order Modal */}
      <Modal
        isOpen={showEdit} onClose={() => setShowEdit(false)}
        title={`Edit Purchase Order — ${po.orderNumber}`} size="lg"
        footer={
          <div className="flex justify-end gap-3">
            <button
              onClick={() => setShowEdit(false)}
              className="px-4 py-2 bg-surface2 border border-border text-text rounded-lg text-[13px] font-medium hover:bg-border transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleEditSubmit}
              disabled={editMutation.isPending}
              className="flex items-center gap-2 px-4 py-2 bg-accent hover:bg-accent/90 text-white rounded-lg text-[13px] font-medium transition-colors disabled:opacity-50"
            >
              {editMutation.isPending && <Spinner size="sm" />}
              Save Changes
            </button>
          </div>
        }
      >
        <div className="flex flex-col gap-5">
          {/* Meta fields */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[11px] font-medium text-text2 uppercase tracking-wide mb-1.5">
                Supplier Reference
              </label>
              <input
                value={editRef}
                onChange={(e) => setEditRef(e.target.value)}
                placeholder="e.g. INV-2024-001"
                className={`w-full ${inputCls}`}
              />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-text2 uppercase tracking-wide mb-1.5">
                Expected Delivery Date
              </label>
              <input
                type="date"
                value={editExpectedAt}
                onChange={(e) => setEditExpectedAt(e.target.value)}
                className={`w-full ${inputCls}`}
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-medium text-text2 uppercase tracking-wide mb-1.5">
              Notes
            </label>
            <textarea
              value={editNotes}
              onChange={(e) => setEditNotes(e.target.value)}
              rows={2}
              placeholder="Optional notes…"
              className={`w-full ${inputCls} resize-none`}
            />
          </div>

          {/* Line items */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-[11px] font-medium text-text2 uppercase tracking-wide">
                Line Items
              </label>
              <button
                type="button"
                onClick={() => { setPickerSearch(''); setShowProductPicker(true); }}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-accent/10 hover:bg-accent/20 text-accent rounded-lg text-[12px] font-medium transition-colors"
              >
                <Plus className="w-3.5 h-3.5" /> Add Product
              </button>
            </div>

            <div className="border border-border rounded-lg overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border bg-surface2">
                    {['Product', 'Qty Ordered', 'Unit Cost (Rs.)', 'Line Total', ''].map((h) => (
                      <th key={h} className="px-3 py-2 text-left text-[11px] font-medium text-text2 uppercase tracking-wide">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {editItems.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-3 py-6 text-center text-text3 text-[13px]">
                        No items — click "Add Product" to add line items.
                      </td>
                    </tr>
                  ) : (
                    editItems.map((item) => (
                      <tr key={item.productId} className="border-b border-border/50 last:border-0">
                        <td className="px-3 py-2.5">
                          <p className="text-[13px] font-medium text-text">{item.productName}</p>
                          <p className="text-[11px] font-mono text-text3">{item.sku}</p>
                        </td>
                        <td className="px-3 py-2.5">
                          <input
                            type="number"
                            min={1}
                            value={item.quantityOrdered}
                            onChange={(e) =>
                              updateEditItem(item.productId, 'quantityOrdered', parseInt(e.target.value) || 0)
                            }
                            className={`w-20 text-center ${inputCls}`}
                          />
                        </td>
                        <td className="px-3 py-2.5">
                          <input
                            type="number"
                            min={0}
                            step={0.01}
                            value={item.unitCost}
                            onChange={(e) =>
                              updateEditItem(item.productId, 'unitCost', parseFloat(e.target.value) || 0)
                            }
                            className={`w-28 text-right ${inputCls}`}
                          />
                        </td>
                        <td className="px-3 py-2.5 text-[13px] font-mono text-text">
                          Rs. {fmt(item.quantityOrdered * item.unitCost)}
                        </td>
                        <td className="px-3 py-2.5">
                          <button
                            type="button"
                            onClick={() => removeEditItem(item.productId)}
                            className="p-1.5 text-text3 hover:text-danger hover:bg-danger/10 rounded-lg transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
                {editItems.length > 0 && (
                  <tfoot>
                    <tr className="border-t border-border bg-surface2">
                      <td colSpan={3} className="px-3 py-2.5 text-[12px] font-medium text-text2 text-right">Total</td>
                      <td className="px-3 py-2.5 text-[14px] font-semibold font-mono text-text">
                        Rs. {fmt(editRunningTotal)}
                      </td>
                      <td />
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>

            {editError && (
              <p className="text-danger text-[12px] mt-2">{editError}</p>
            )}
          </div>
        </div>
      </Modal>

      {/* Product Picker Modal */}
      <Modal
        isOpen={showProductPicker} onClose={() => setShowProductPicker(false)}
        title="Add Product" size="md"
        footer={
          <div className="flex justify-end">
            <button
              onClick={() => setShowProductPicker(false)}
              className="px-4 py-2 bg-surface2 border border-border text-text rounded-lg text-[13px] font-medium hover:bg-border transition-colors"
            >
              Close
            </button>
          </div>
        }
      >
        <div className="flex flex-col gap-3">
          <input
            value={pickerSearch}
            onChange={(e) => setPickerSearch(e.target.value)}
            placeholder="Search by name or SKU…"
            className={`w-full ${inputCls}`}
            autoFocus
          />
          <div className="max-h-72 overflow-y-auto border border-border rounded-lg divide-y divide-border">
            {filteredProducts.length === 0 ? (
              <p className="px-4 py-6 text-center text-text3 text-[13px]">No products found.</p>
            ) : (
              filteredProducts.slice(0, 50).map((p) => {
                const alreadyAdded = editItems.some((i) => i.productId === p.id);
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => addProductToEdit(p)}
                    disabled={alreadyAdded}
                    className="w-full flex items-center justify-between px-4 py-3 hover:bg-surface2 transition-colors disabled:opacity-40 disabled:cursor-not-allowed text-left"
                  >
                    <div>
                      <p className="text-[13px] font-medium text-text">{p.name}</p>
                      <p className="text-[11px] font-mono text-text3">{p.sku}</p>
                    </div>
                    {alreadyAdded ? (
                      <span className="text-[11px] text-text3">Added</span>
                    ) : (
                      <Plus className="w-4 h-4 text-accent" />
                    )}
                  </button>
                );
              })
            )}
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
