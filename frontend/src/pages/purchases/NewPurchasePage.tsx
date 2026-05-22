import { useState, useMemo, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Trash2, ChevronLeft, Package, Search, X } from 'lucide-react';
import { useToast } from '../../contexts/ToastContext';
import { Spinner } from '../../components/ui/Spinner';
import { ErrorMessage } from '../../components/ui/ErrorMessage';
import * as purchasesApi from '../../api/purchases';
import * as suppliersApi from '../../api/suppliers';
import * as productsApi from '../../api/products';
import * as inventoryApi from '../../api/inventory';
import type { Product, InventoryProduct } from '../../api/types';
import { fmt } from '../../utils/cn';

interface LineItem {
  productId: string;
  productName: string;
  productSku: string;
  quantityOrdered: number;
  unitCost: number;
  currentStock: number;
}

export function NewPurchasePage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Form state
  const [supplierId, setSupplierId] = useState('');
  const [supplierReference, setSupplierReference] = useState('');
  const [expectedAt, setExpectedAt] = useState('');
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState<LineItem[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Product search state
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const id = setTimeout(() => setDebouncedQuery(searchQuery), 300);
    return () => clearTimeout(id);
  }, [searchQuery]);

  useEffect(() => {
    function handleOutside(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, []);

  // Queries
  const { data: suppliers = [] } = useQuery({
    queryKey: ['suppliers'],
    queryFn: suppliersApi.getSuppliers,
  });

  const { data: products = [] } = useQuery({
    queryKey: ['products', {}],
    queryFn: () => productsApi.getProducts(),
  });

  const { data: inventory = [] } = useQuery({
    queryKey: ['inventory'],
    queryFn: inventoryApi.getInventory,
    staleTime: 30000,
  });

  // Products matching search that are not already added
  const dropdownProducts = useMemo<Product[]>(() => {
    if (!debouncedQuery.trim()) return [];
    const q = debouncedQuery.toLowerCase();
    return (products as Product[]).filter(
      (p) =>
        !items.some((i) => i.productId === p.id) &&
        (p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q))
    );
  }, [debouncedQuery, products, items]);

  function getStockInfo(productId: string) {
    const inv = (inventory as InventoryProduct[]).find((i) => i.id === productId);
    return { stock: inv?.currentStock ?? 0, reorder: inv?.reorderPoint ?? 0 };
  }

  function addProduct(product: Product) {
    if (items.some((i) => i.productId === product.id)) {
      toast('warning', 'Already added');
      return;
    }
    const inv = (inventory as InventoryProduct[]).find((i) => i.id === product.id);
    const cost = Number(product.priceHistory?.[0]?.costPrice ?? '0') || 0;
    setItems((prev) => [
      ...prev,
      {
        productId: product.id,
        productName: product.name,
        productSku: product.sku,
        quantityOrdered: 1,
        unitCost: cost,
        currentStock: inv?.currentStock ?? 0,
      },
    ]);
    setSearchQuery('');
    setDebouncedQuery('');
    setShowDropdown(false);
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

  function validate() {
    const e: Record<string, string> = {};
    if (!supplierId) e.supplierId = 'Please select a supplier';
    if (items.length === 0) e.items = 'Add at least one product';
    else if (items.some((i) => i.quantityOrdered <= 0)) e.items = 'Check item quantities';
    else if (items.some((i) => i.unitCost <= 0)) e.items = 'Check item costs';
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  const totalUnits = items.reduce((s, i) => s + i.quantityOrdered, 0);
  const runningTotal = items.reduce((s, i) => s + i.quantityOrdered * i.unitCost, 0);

  const mutation = useMutation({
    mutationFn: () =>
      purchasesApi.createPurchase({
        supplierId,
        ...(supplierReference?.trim() && { supplierReference: supplierReference.trim() }),
        ...(notes?.trim() && { notes: notes.trim() }),
        ...(expectedAt && { expectedAt }),
        items: items
          .map((item) => ({
            productId: item.productId,
            quantityOrdered: item.quantityOrdered,
            unitCost: String(item.unitCost),
          }))
          .filter((item) => item.productId && item.quantityOrdered > 0 && Number(item.unitCost) > 0),
      }),
    onSuccess: (po) => {
      queryClient.invalidateQueries({ queryKey: ['purchases'] });
      toast('success', 'Purchase order created');
      navigate(`/purchases/${po.id}`);
    },
    onError: () => toast('error', 'Failed to create purchase order'),
  });

  const fieldCls =
    'w-full bg-surface2 border border-border text-text placeholder-text3 rounded-lg px-3 py-2.5 text-[13px] focus:outline-none focus:border-accent transition-colors';

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
          {/* Order Details */}
          <div className="bg-surface border border-border rounded-xl p-5">
            <h2 className="text-[14px] font-semibold text-text mb-4">Order Details</h2>
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label htmlFor="supplier" className="block text-[11px] font-medium text-text2 uppercase tracking-wide mb-1.5">
                  Supplier <span className="text-danger">*</span>
                </label>
                <select
                  id="supplier"
                  name="supplierId"
                  value={supplierId}
                  onChange={(e) => { setSupplierId(e.target.value); setErrors((err) => ({ ...err, supplierId: '' })); }}
                  className={`${fieldCls} cursor-pointer`}
                >
                  <option value="">Select supplier…</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
                <ErrorMessage message={errors.supplierId} />
              </div>

              <div>
                <label htmlFor="supplier-reference" className="block text-[11px] font-medium text-text2 uppercase tracking-wide mb-1.5">Supplier Reference</label>
                <input
                  id="supplier-reference"
                  name="supplierReference"
                  value={supplierReference}
                  onChange={(e) => setSupplierReference(e.target.value)}
                  placeholder="e.g. INV-2024-001"
                  className={fieldCls}
                />
              </div>

              <div>
                <label htmlFor="expected-at" className="block text-[11px] font-medium text-text2 uppercase tracking-wide mb-1.5">Expected Delivery</label>
                <input
                  id="expected-at"
                  name="expectedAt"
                  type="date"
                  value={expectedAt}
                  onChange={(e) => setExpectedAt(e.target.value)}
                  className={fieldCls}
                />
              </div>

              <div className="col-span-2">
                <label htmlFor="notes" className="block text-[11px] font-medium text-text2 uppercase tracking-wide mb-1.5">Notes</label>
                <textarea
                  id="notes"
                  name="notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  placeholder="Optional notes…"
                  className={`${fieldCls} resize-none`}
                />
              </div>
            </div>
          </div>

          {/* Line Items */}
          <div className="bg-surface border border-border rounded-xl p-5">
            <h2 className="text-[14px] font-semibold text-text mb-4">Line Items</h2>

            {/* Product search */}
            <div className="relative mb-4" ref={searchRef}>
              <div className="flex items-center gap-2">
                <Search className="text-text3 w-4 h-4 shrink-0 pointer-events-none" />
                <input
                  id="product-search"
                  name="productSearch"
                  type="text"
                  placeholder="Search products by name or SKU…"
                  value={searchQuery}
                  onChange={(e) => { setSearchQuery(e.target.value); setShowDropdown(true); }}
                  onFocus={() => { if (searchQuery.trim()) setShowDropdown(true); }}
                  onKeyDown={(e) => { if (e.key === 'Escape') setShowDropdown(false); }}
                  className="flex-1 min-w-0 bg-surface2 border border-border text-text placeholder-text3 rounded-lg px-3 pr-9 py-2.5 text-[13px] focus:outline-none focus:border-accent transition-colors"
                />
                {searchQuery && (
                  <button
                    onClick={() => { setSearchQuery(''); setDebouncedQuery(''); setShowDropdown(false); }}
                    className="ml-2 text-text3 hover:text-text transition-colors"
                    aria-label="Clear search"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>

              {showDropdown && searchQuery.trim() && (
                <div className="absolute top-full left-0 right-0 z-20 mt-1 bg-surface border border-border rounded-xl shadow-xl overflow-hidden max-h-64 overflow-y-auto">
                  {dropdownProducts.length === 0 ? (
                    <div className="px-4 py-3 text-[13px] text-text3">No products found</div>
                  ) : (
                    dropdownProducts.map((product) => {
                      const { stock, reorder } = getStockInfo(product.id);
                      const price = product.priceHistory?.[0];
                      const badgeCls =
                        stock === 0
                          ? 'text-danger bg-danger/10 border-danger/20'
                          : stock <= reorder
                          ? 'text-warning bg-warning/10 border-warning/20'
                          : 'text-success bg-success/10 border-success/20';
                      const badgeLabel =
                        stock === 0 ? 'Out of stock' : stock <= reorder ? `Low: ${stock}` : `${stock} in stock`;
                      return (
                        <button
                          key={product.id}
                          onClick={() => addProduct(product)}
                          className="w-full text-left px-4 py-3 hover:bg-surface2 transition-colors border-b border-border/50 last:border-0"
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-[13px] font-semibold text-text">{product.name}</span>
                            <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full border ${badgeCls}`}>
                              {badgeLabel}
                            </span>
                          </div>
                          <div className="flex items-center gap-3 mt-0.5">
                            <span className="text-[11px] font-mono text-text3">{product.sku}</span>
                            {price && (
                              <span className="text-[11px] text-text3">Cost: Rs. {fmt(price.costPrice)}</span>
                            )}
                          </div>
                        </button>
                      );
                    })
                  )}
                </div>
              )}
            </div>

            <ErrorMessage message={errors.items} />

            {items.length === 0 ? (
              <div className="border-2 border-dashed border-border rounded-xl py-10 text-center">
                <Package className="w-10 h-10 text-text3 mx-auto mb-3" />
                <p className="text-[14px] font-medium text-text2">No products added yet</p>
                <p className="text-[12px] text-text3 mt-1">Search for a product above to add it to this order</p>
              </div>
            ) : (
              <>
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border">
                      {['Product', 'Qty Ordered', 'Unit Cost (Rs.)', 'Line Total', ''].map((h) => (
                        <th key={h} className="px-3 py-2 text-left text-[11px] font-medium text-text2 uppercase tracking-wide">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item) => {
                      const qtyExceedsStock = item.currentStock > 0 && item.quantityOrdered > item.currentStock;
                      return (
                        <tr key={item.productId} className="border-b border-border/50">
                          <td className="px-3 py-3">
                            <p className="text-[13px] font-semibold text-text">{item.productName}</p>
                            <p className="text-[11px] font-mono text-text3">
                              {item.productSku}
                              {item.currentStock > 0 && (
                                <span className="ml-2">· {item.currentStock} in stock</span>
                              )}
                            </p>
                          </td>
                          <td className="px-3 py-3">
                            <input
                              id={`quantity-${item.productId}`}
                              name={`quantity-${item.productId}`}
                              aria-label={`Quantity for ${item.productName}`}
                              type="number"
                              min={1}
                              value={item.quantityOrdered}
                              onChange={(e) => updateItem(item.productId, 'quantityOrdered', e.target.value)}
                              className={`w-20 bg-surface2 border text-text rounded-lg px-2 py-1.5 text-[13px] text-center focus:outline-none transition-colors ${
                                qtyExceedsStock
                                  ? 'border-danger focus:border-danger'
                                  : 'border-border focus:border-accent'
                              }`}
                            />
                          </td>
                          <td className="px-3 py-3">
                            <input
                              id={`unitCost-${item.productId}`}
                              name={`unitCost-${item.productId}`}
                              aria-label={`Unit cost for ${item.productName}`}
                              type="number"
                              step="0.01"
                              min="0.01"
                              value={item.unitCost}
                              onChange={(e) => updateItem(item.productId, 'unitCost', e.target.value)}
                              className="w-28 bg-surface2 border border-border text-text rounded-lg px-2 py-1.5 text-[13px] focus:outline-none focus:border-accent transition-colors"
                            />
                          </td>
                          <td className="px-3 py-3">
                            <span className="text-[13px] font-mono font-semibold text-success">
                              Rs. {fmt(item.quantityOrdered * item.unitCost)}
                            </span>
                          </td>
                          <td className="px-3 py-3">
                            <button
                              onClick={() => removeItem(item.productId)}
                              className="text-text3 hover:text-danger transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>

                {/* Order summary card */}
                <div className="mt-4 bg-surface2 border border-border rounded-xl px-5 py-4 flex items-center justify-between">
                  <span className="text-[13px] text-text2">
                    <span className="font-semibold text-text">{items.length}</span>{' '}
                    product{items.length !== 1 ? 's' : ''} ·{' '}
                    <span className="font-semibold text-text">{totalUnits}</span> total units
                  </span>
                  <span className="text-[14px] font-semibold text-text2">
                    Estimated Order Value:{' '}
                    <span className="font-mono text-accent">Rs. {fmt(runningTotal)}</span>
                  </span>
                </div>
              </>
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
                <span className="text-text">{totalUnits}</span>
              </div>
              <div className="border-t border-border my-1" />
              <div className="flex justify-between text-[15px] font-semibold">
                <span className="text-text2">Total</span>
                <span className="text-text font-mono">Rs. {fmt(runningTotal)}</span>
              </div>
            </div>

            <button
              onClick={() => { if (validate()) mutation.mutate(); }}
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
