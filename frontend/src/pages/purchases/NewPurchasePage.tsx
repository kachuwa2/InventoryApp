import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, ChevronLeft } from 'lucide-react';
import { useToast } from '../../contexts/ToastContext';
import { Spinner } from '../../components/ui/Spinner';
import { ErrorMessage } from '../../components/ui/ErrorMessage';
import * as purchasesApi from '../../api/purchases';
import * as suppliersApi from '../../api/suppliers';
import * as productsApi from '../../api/products';
import type { Product } from '../../api/types';
import { fmt } from '../../utils/cn';

interface LineItem {
  productId: string;
  productName: string;
  productSku: string;
  quantityOrdered: number;
  unitCost: number;
}

export function NewPurchasePage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [supplierId, setSupplierId] = useState('');
  const [supplierReference, setSupplierReference] = useState('');
  const [expectedAt, setExpectedAt] = useState('');
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState<LineItem[]>([]);
  const [productPickerId, setProductPickerId] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const { data: suppliers = [] } = useQuery({
    queryKey: ['suppliers'],
    queryFn: suppliersApi.getSuppliers,
  });

  const { data: products = [] } = useQuery({
    queryKey: ['products', {}],
    queryFn: () => productsApi.getProducts(),
  });

  const mutation = useMutation({
    mutationFn: (draft: boolean) =>
      purchasesApi.createPurchase({
        supplierId,
        supplierReference: supplierReference || undefined,
        notes: notes || undefined,
        expectedAt: expectedAt || undefined,
        items: items.map((i) => ({
          productId: i.productId,
          quantityOrdered: Number(i.quantityOrdered),
          unitCost: Number(i.unitCost),
        })),
      }).then((po) => ({ po, draft })),
    onSuccess: ({ po }) => {
      queryClient.invalidateQueries({ queryKey: ['purchases'] });
      toast('success', 'Purchase order created');
      navigate(`/purchases/${po.id}`);
    },
    onError: () => toast('error', 'Failed to create purchase order'),
  });

  function validate() {
    const e: Record<string, string> = {};
    if (!supplierId) e.supplierId = 'Supplier is required';
    if (items.length === 0) e.items = 'At least one product required';
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function addProduct() {
    if (!productPickerId) return;
    if (items.some((i) => i.productId === productPickerId)) {
      setProductPickerId('');
      return;
    }
    const p = products.find((prod: Product) => prod.id === productPickerId);
    if (!p) return;
    const cost = parseFloat(p.priceHistory?.[0]?.costPrice ?? '0') || 0;
    setItems((prev) => [
      ...prev,
      { productId: p.id, productName: p.name, productSku: p.sku, quantityOrdered: 1, unitCost: cost },
    ]);
    setProductPickerId('');
    setErrors((e) => ({ ...e, items: '' }));
  }

  function removeItem(productId: string) {
    setItems((prev) => prev.filter((i) => i.productId !== productId));
  }

  function updateItem(productId: string, field: 'quantityOrdered' | 'unitCost', value: string) {
    setItems((prev) =>
      prev.map((i) => {
        if (i.productId !== productId) return i;
        if (field === 'quantityOrdered') return { ...i, quantityOrdered: Math.max(1, parseInt(value) || 1) };
        return { ...i, unitCost: parseFloat(value) || 0 };
      })
    );
  }

  const runningTotal = items.reduce(
    (sum, i) => sum + i.quantityOrdered * i.unitCost,
    0
  );

  const availableProducts = products.filter(
    (p: Product) => !items.some((i) => i.productId === p.id)
  );

  return (
    <div className="max-w-4xl">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => navigate('/purchases')}
          className="p-2 rounded-lg hover:bg-surface2 text-text2 transition-colors"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-[20px] font-semibold text-text">New Purchase Order</h1>
          <p className="text-text2 text-[13px]">Create a draft purchase order</p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-5">
        {/* Main form */}
        <div className="col-span-2 flex flex-col gap-5">
          {/* PO Header */}
          <div className="bg-surface border border-border rounded-xl p-5">
            <h2 className="text-[14px] font-semibold text-text mb-4">Order Details</h2>
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="block text-[11px] font-medium text-text2 uppercase tracking-wide mb-1.5">
                  Supplier <span className="text-danger">*</span>
                </label>
                <select
                  value={supplierId}
                  onChange={(e) => { setSupplierId(e.target.value); setErrors((err) => ({ ...err, supplierId: '' })); }}
                  className="w-full bg-surface2 border border-border text-text rounded-lg px-3 py-2.5 text-[13px] focus:outline-none focus:border-accent transition-colors cursor-pointer"
                >
                  <option value="">Select supplier…</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
                <ErrorMessage message={errors.supplierId} />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-text2 uppercase tracking-wide mb-1.5">Supplier Reference</label>
                <input
                  value={supplierReference}
                  onChange={(e) => setSupplierReference(e.target.value)}
                  placeholder="e.g. INV-2024-001"
                  className="w-full bg-surface2 border border-border text-text placeholder-text3 rounded-lg px-3 py-2.5 text-[13px] focus:outline-none focus:border-accent transition-colors"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-text2 uppercase tracking-wide mb-1.5">Expected Delivery</label>
                <input
                  type="date"
                  value={expectedAt}
                  onChange={(e) => setExpectedAt(e.target.value)}
                  className="w-full bg-surface2 border border-border text-text rounded-lg px-3 py-2.5 text-[13px] focus:outline-none focus:border-accent transition-colors"
                />
              </div>

              <div className="col-span-2">
                <label className="block text-[11px] font-medium text-text2 uppercase tracking-wide mb-1.5">Notes</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  placeholder="Optional notes…"
                  className="w-full bg-surface2 border border-border text-text placeholder-text3 rounded-lg px-3 py-2.5 text-[13px] focus:outline-none focus:border-accent transition-colors resize-none"
                />
              </div>
            </div>
          </div>

          {/* Line items */}
          <div className="bg-surface border border-border rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-[14px] font-semibold text-text">Line Items</h2>
              <div className="flex items-center gap-2">
                <select
                  value={productPickerId}
                  onChange={(e) => setProductPickerId(e.target.value)}
                  className="bg-surface2 border border-border text-text rounded-lg px-3 py-2 text-[13px] focus:outline-none focus:border-accent transition-colors cursor-pointer"
                >
                  <option value="">Add product…</option>
                  {availableProducts.map((p: Product) => (
                    <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>
                  ))}
                </select>
                <button
                  onClick={addProduct}
                  disabled={!productPickerId}
                  className="p-2 bg-accent hover:bg-accent/90 text-white rounded-lg transition-colors disabled:opacity-50"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            </div>
            <ErrorMessage message={errors.items} />

            {items.length === 0 ? (
              <div className="py-8 text-center text-text3 text-[13px]">
                No items added yet. Select a product above to add it.
              </div>
            ) : (
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    {['Product', 'SKU', 'Qty', 'Unit Cost (Rs.)', 'Line Total', ''].map((h) => (
                      <th key={h} className="px-3 py-2 text-left text-[11px] font-medium text-text2 uppercase tracking-wide">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr key={item.productId} className="border-b border-border/50">
                      <td className="px-3 py-3 text-[13px] text-text font-medium">{item.productName}</td>
                      <td className="px-3 py-3 text-[12px] font-mono text-text2">{item.productSku}</td>
                      <td className="px-3 py-3">
                        <input
                          type="number"
                          min={1}
                          value={item.quantityOrdered}
                          onChange={(e) => updateItem(item.productId, 'quantityOrdered', e.target.value)}
                          className="w-20 bg-surface2 border border-border text-text rounded-lg px-2 py-1.5 text-[13px] text-center focus:outline-none focus:border-accent transition-colors"
                        />
                      </td>
                      <td className="px-3 py-3">
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={item.unitCost}
                          onChange={(e) => updateItem(item.productId, 'unitCost', e.target.value)}
                          className="w-28 bg-surface2 border border-border text-text rounded-lg px-2 py-1.5 text-[13px] focus:outline-none focus:border-accent transition-colors"
                        />
                      </td>
                      <td className="px-3 py-3 text-[13px] font-mono text-text">
                        {fmt(item.quantityOrdered * item.unitCost)}
                      </td>
                      <td className="px-3 py-3">
                        <button onClick={() => removeItem(item.productId)} className="text-text3 hover:text-danger transition-colors">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Summary sidebar */}
        <div className="flex flex-col gap-4">
          <div className="bg-surface border border-border rounded-xl p-5 sticky top-0">
            <h2 className="text-[14px] font-semibold text-text mb-4">Summary</h2>
            <div className="flex flex-col gap-2 mb-5">
              <div className="flex justify-between text-[13px]">
                <span className="text-text2">Items</span>
                <span className="text-text">{items.length}</span>
              </div>
              <div className="flex justify-between text-[13px]">
                <span className="text-text2">Total Units</span>
                <span className="text-text">{items.reduce((s, i) => s + i.quantityOrdered, 0)}</span>
              </div>
              <div className="border-t border-border my-1" />
              <div className="flex justify-between text-[15px] font-semibold">
                <span className="text-text2">Total</span>
                <span className="text-text font-mono">Rs. {fmt(runningTotal)}</span>
              </div>
            </div>

            <button
              onClick={() => { if (validate()) mutation.mutate(true); }}
              disabled={mutation.isPending}
              className="flex items-center justify-center gap-2 w-full py-2.5 bg-accent hover:bg-accent/90 text-white rounded-lg text-[13px] font-semibold transition-colors disabled:opacity-60 mb-2"
            >
              {mutation.isPending && <Spinner size="sm" />}
              Save as Draft
            </button>
            <button
              onClick={() => navigate('/purchases')}
              className="w-full py-2 text-text2 hover:text-text text-[13px] transition-colors"
            >
              Discard
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
