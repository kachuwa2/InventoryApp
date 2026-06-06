import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Plus, Edit2, X, Package, Tag, ChevronRight,
} from 'lucide-react';
import Barcoder from 'react-barcode';
import { PageHeader } from '../../components/ui/PageHeader';
import { FilterBar } from '../../components/ui/FilterBar';
import { DataTable } from '../../components/ui/DataTable';
import type { Column } from '../../components/ui/DataTable';
import { Modal } from '../../components/ui/Modal';
import { Badge } from '../../components/ui/Badge';
import { Spinner } from '../../components/ui/Spinner';
import { fmt } from '../../utils/cn';
import { useToast } from '../../contexts/ToastContext';
import { useAuth } from '../../context/AuthContext';
import * as productsApi from '../../api/products';
import * as categoriesApi from '../../api/categories';
import * as suppliersApi from '../../api/suppliers';
import * as inventoryApi from '../../api/inventory';
import type { Product, Category, Supplier, PriceHistory, InventoryProduct } from '../../api/types';

// ─── Schemas ────────────────────────────────────────────────────────────────

const addProductSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  sku: z.string().min(1, 'SKU is required'),
  barcode: z.string().optional(),
  description: z.string().optional(),
  unit: z.enum(['piece', 'kg', 'litre', 'box', 'set']).optional(),
  reorderPoint: z.number().int().min(0),
  categoryId: z.string().min(1, 'Category is required'),
  supplierId: z.string().min(1, 'Supplier is required'),
  costPrice: z.string().min(1, 'Cost price is required'),
  retailPrice: z.string().min(1, 'Retail price is required'),
  wholesalePrice: z.string().min(1, 'Wholesale price is required'),
  priceNote: z.string().optional(),
}).refine(
  (d) => Number(d.retailPrice) > Number(d.costPrice),
  { message: 'Retail price must be greater than cost price', path: ['retailPrice'] }
).refine(
  (d) => Number(d.wholesalePrice) > Number(d.costPrice),
  { message: 'Wholesale price must be greater than cost price', path: ['wholesalePrice'] }
).refine(
  (d) => Number(d.wholesalePrice) <= Number(d.retailPrice),
  { message: 'Wholesale price must not exceed retail price', path: ['wholesalePrice'] }
);

const editProductSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  description: z.string().optional(),
  unit: z.enum(['piece', 'kg', 'litre', 'box', 'set']).optional(),
  reorderPoint: z.number().int().min(0),
  categoryId: z.string().min(1, 'Category is required'),
  supplierId: z.string().min(1, 'Supplier is required'),
});

type AddProductForm = z.infer<typeof addProductSchema>;
type EditProductForm = z.infer<typeof editProductSchema>;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getLatestPrice(p: Product): PriceHistory | null {
  if (!p.priceHistory || p.priceHistory.length === 0) return null;
  return p.priceHistory[0];
}

function calcMargin(costPrice: string, retailPrice: string): number {
  const cost = Number(costPrice);
  const retail = Number(retailPrice);
  if (cost === 0) return 0;
  return ((retail - cost) / cost) * 100;
}

function marginColor(pct: number): string {
  if (pct >= 30) return 'text-success';
  if (pct >= 15) return 'text-warning';
  return 'text-danger';
}

function stockColor(p: Product): string {
  if (p.isOutOfStock) return 'text-danger';
  if (p.isLowStock) return 'text-warning';
  return 'text-success';
}

// ─── Sub-components ──────────────────────────────────────────────────────────

interface FieldProps {
  label: string;
  error?: string;
  children: React.ReactNode;
}
function Field({ label, error, children }: FieldProps) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-[12px] font-medium text-text2">{label}</label>
      {children}
      {error && <p className="text-[11px] text-danger">{error}</p>}
    </div>
  );
}

const inputCls =
  'bg-surface2 border border-border text-text rounded-lg px-3 py-2 text-[13px] focus:outline-none focus:border-accent transition-colors placeholder-text3';

interface PanelProps {
  product: Product;
  onEdit: () => void;
  onClose: () => void;
  isCashier?: boolean;
}
function ProductPanel({ product, onEdit, onClose, isCashier }: PanelProps) {
  const price = getLatestPrice(product);
  const margin = price ? calcMargin(price.costPrice, price.retailPrice) : 0;
  const stock = product.currentStock ?? 0;
  const barFill = product.reorderPoint > 0
    ? Math.min(100, (stock / (product.reorderPoint * 2)) * 100)
    : stock > 0 ? 100 : 0;
  const barColor = product.isOutOfStock
    ? 'bg-danger'
    : product.isLowStock
    ? 'bg-warning'
    : 'bg-success';

  const { data: detail } = useQuery({
    queryKey: ['products', product.id],
    queryFn:  () => productsApi.getProduct(product.id),
  });

  const allHistory = detail?.priceHistory ?? product.priceHistory ?? [];

  return (
    <div className="fixed top-0 right-0 h-full w-85 bg-surface border-l border-border z-40 flex flex-col shadow-2xl">
      <div className="flex items-center justify-between px-5 py-4 border-b border-border">
        <h3 className="text-[14px] font-semibold text-text">Product Details</h3>
        <button
          onClick={onClose}
          className="text-text3 hover:text-text transition-colors p-1 rounded-lg hover:bg-surface2"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
        {/* Identity */}
        <div>
          <h4 className="text-[16px] font-semibold text-text leading-snug">{product.name}</h4>
          <p className="text-[12px] font-mono text-text2 mt-0.5">{product.sku}</p>
          {product.barcode ? (
            <div className="mt-3 bg-white rounded-lg p-3 inline-block">
              <Barcoder
                value={product.barcode}
                format="CODE128"
                width={1.5}
                height={50}
                fontSize={12}
                displayValue={true}
              />
            </div>
          ) : (
            <p className="text-[11px] text-text3 mt-1">No barcode assigned</p>
          )}
          {product.description && (
            <p className="text-[12px] text-text2 mt-2 leading-relaxed">{product.description}</p>
          )}
        </div>

        {/* Prices — hide from cashier */}
        {!isCashier && price && (
          <div>
            <p className="text-[11px] font-medium text-text3 uppercase tracking-wider mb-2">Prices</p>
            <div className="grid grid-cols-3 gap-2">
              {[
                { label: 'Cost', value: price.costPrice },
                { label: 'Retail', value: price.retailPrice },
                { label: 'Wholesale', value: price.wholesalePrice },
              ].map(({ label, value }) => (
                <div key={label} className="bg-surface2 rounded-lg p-3 text-center">
                  <p className="text-[10px] text-text3 uppercase tracking-wider mb-1">{label}</p>
                  <p className="text-[13px] font-semibold text-text">{fmt(value)}</p>
                </div>
              ))}
            </div>
            <div className="mt-2 flex items-center gap-1">
              <span className="text-[11px] text-text3">Margin:</span>
              <span className={`text-[12px] font-semibold ${marginColor(margin)}`}>
                {margin.toFixed(1)}%
              </span>
            </div>
          </div>
        )}

        {/* Retail price only for cashier */}
        {isCashier && price && (
          <div className="bg-surface2 rounded-lg p-4">
            <p className="text-[11px] font-medium text-text3 uppercase tracking-wider mb-2">Retail Price</p>
            <p className="text-[16px] font-semibold text-text">Rs. {fmt(price.retailPrice)}</p>
          </div>
        )}

        {/* Stock meter */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-[11px] font-medium text-text3 uppercase tracking-wider">Stock</p>
            <span className={`text-[13px] font-semibold ${stockColor(product)}`}>
              {stock} {product.unit ?? 'units'}
            </span>
          </div>
          <div className="h-2 bg-surface2 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${barColor}`}
              style={{ width: `${barFill}%` }}
            />
          </div>
          <p className="text-[11px] text-text3 mt-1">Reorder at {product.reorderPoint}</p>
        </div>

        {/* Price History */}
        {allHistory.length > 0 && (
          <div>
            <p className="text-[11px] font-medium text-text3 uppercase tracking-wider mb-2">Price History</p>
            <div className="space-y-2">
              {allHistory.map((ph, i) => (
                <div
                  key={ph.id}
                  className={`bg-surface2 rounded-lg p-3 text-[12px] ${i === 0 ? 'border border-accent/20' : ''}`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-text3 text-[10px]">
                      {new Date(ph.effectiveFrom).toLocaleDateString()}
                    </span>
                    <div className="flex items-center gap-2">
                      {ph.changedBy && (
                        <span className="text-text3 text-[10px]">{ph.changedBy.name}</span>
                      )}
                      {i === 0 && (
                        <span className="text-[10px] text-accent font-medium">Current</span>
                      )}
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-1 text-center">
                    {[
                      { label: 'Cost',    value: ph.costPrice },
                      { label: 'Retail',  value: ph.retailPrice },
                      { label: 'Whlsale', value: ph.wholesalePrice },
                    ].map(({ label, value }) => (
                      <div key={label}>
                        <p className="text-[9px] text-text3 uppercase">{label}</p>
                        <p className="text-[11px] font-medium text-text">{fmt(value)}</p>
                      </div>
                    ))}
                  </div>
                  {ph.note && (
                    <p className="text-[10px] text-text3 mt-1 italic">{ph.note}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Category & Supplier */}
        <div className="space-y-2">
          {product.category && (
            <div className="flex items-center gap-2 text-[13px]">
              <Tag className="w-3.5 h-3.5 text-text3" />
              <span className="text-text2">{product.category.name}</span>
            </div>
          )}
          {product.supplier && (
            <div className="flex items-center gap-2 text-[13px]">
              <Package className="w-3.5 h-3.5 text-text3" />
              <span className="text-text2">{product.supplier.name}</span>
            </div>
          )}
        </div>
      </div>

      {/* Edit action — hide from cashier */}
      {!isCashier && (
        <div className="px-5 py-4 border-t border-border space-y-2">
          <button
            onClick={onEdit}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-accent hover:bg-accent/90 text-white rounded-lg text-[13px] font-medium transition-colors"
          >
            <Edit2 className="w-3.5 h-3.5" /> Edit Product
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export function ProductsPage() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();
  const isCashier = user?.role === 'cashier';
  const [search, setSearch] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [stockStatus, setStockStatus] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);

  // Queries
  const { data: products = [], isLoading: prodLoading } = useQuery({
    queryKey: ['products', { search, categoryId }],
    queryFn: () => productsApi.getProducts({ search: search || undefined, categoryId: categoryId || undefined }),
  });

  const { data: inventory = [] } = useQuery({
    queryKey: ['inventory'],
    queryFn: inventoryApi.getInventory,
    staleTime: 30000,
  });

  const { data: categories = [] } = useQuery({
    queryKey: ['categories'],
    queryFn: categoriesApi.getCategories,
  });

  const { data: suppliers = [] } = useQuery({
    queryKey: ['suppliers'],
    queryFn: suppliersApi.getSuppliers,
  });

  // Merge product catalog with live stock data from inventory
  const productsWithStock = useMemo<Product[]>(() => {
    return products.map((product: Product) => {
      const inv = inventory.find((i: InventoryProduct) => i.id === product.id);
      return {
        ...product,
        currentStock: inv?.currentStock ?? 0,
        isLowStock: inv?.isLowStock ?? false,
        isOutOfStock: inv?.isOutOfStock ?? true,
        stockValue: inv?.stockValue ?? '0',
      };
    });
  }, [products, inventory]);

  // Filtered products (stock status is client-side)
  const filtered = useMemo<Product[]>(() => {
    if (!stockStatus) return productsWithStock;
    return productsWithStock.filter((p) => {
      if (stockStatus === 'out') return p.isOutOfStock;
      if (stockStatus === 'low') return p.isLowStock && !p.isOutOfStock;
      if (stockStatus === 'in') return !p.isLowStock && !p.isOutOfStock;
      return true;
    });
  }, [productsWithStock, stockStatus]);

  // Mutations
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['products'] });
    qc.invalidateQueries({ queryKey: ['inventory'] });
  };

  const createMut = useMutation({
    mutationFn: (payload: Parameters<typeof productsApi.createProduct>[0]) =>
      productsApi.createProduct(payload),
    onSuccess: () => { toast('success', 'Product created'); setShowAddModal(false); invalidate(); },
    onError: () => toast('error', 'Failed to create product'),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Parameters<typeof productsApi.updateProduct>[1] }) =>
      productsApi.updateProduct(id, payload),
    onSuccess: () => { toast('success', 'Product updated'); setShowEditModal(false); invalidate(); },
    onError: () => toast('error', 'Failed to update product'),
  });

  // Forms
  const addForm = useForm<AddProductForm>({ resolver: zodResolver(addProductSchema), defaultValues: { reorderPoint: 0 } });
  const editForm = useForm<EditProductForm>({ resolver: zodResolver(editProductSchema), defaultValues: { reorderPoint: 0 } });

  function openEdit(p: Product) {
    setSelectedProduct(p);
    editForm.reset({
      name: p.name,
      description: p.description ?? '',
      unit: (p.unit as EditProductForm['unit']) ?? undefined,
      reorderPoint: p.reorderPoint,
      categoryId: p.categoryId,
      supplierId: p.supplierId,
    });
    setShowEditModal(true);
  }

  function handleRowClick(p: Product) {
    setSelectedProduct((prev) => prev?.id === p.id ? null : p);
  }

  const categoryOptions = categories.map((c: Category) => ({ value: c.id, label: c.name }));

  // DataTable columns
  const allColumns: Column<Product>[] = [
    {
      key: 'name',
      header: 'Product',
      render: (p) => (
        <div>
          <p className="font-medium text-text text-[13px]">{p.name}</p>
          <p className="text-[11px] text-text2 font-mono">{p.sku}</p>
        </div>
      ),
    },
    {
      key: 'category',
      header: 'Category',
      render: (p) => (
        <span className="text-[13px] text-text2">{p.category?.name ?? '—'}</span>
      ),
    },
    {
      key: 'cost',
      header: 'Cost',
      render: (p) => {
        const ph = getLatestPrice(p);
        return <span className="text-[13px] text-text2">{ph ? `Rs. ${fmt(ph.costPrice)}` : '—'}</span>;
      },
    },
    {
      key: 'retail',
      header: 'Retail',
      render: (p) => {
        const ph = getLatestPrice(p);
        return <span className="text-[13px] text-text">{ph ? `Rs. ${fmt(ph.retailPrice)}` : '—'}</span>;
      },
    },
    {
      key: 'wholesale',
      header: 'Wholesale',
      render: (p) => {
        const ph = getLatestPrice(p);
        return <span className="text-[13px] text-text2">{ph ? `Rs. ${fmt(ph.wholesalePrice)}` : '—'}</span>;
      },
    },
    {
      key: 'stock',
      header: 'Stock',
      render: (p) => {
        const stock = p.currentStock ?? 0;
        const variant = p.isOutOfStock ? 'danger' : p.isLowStock ? 'warning' : 'success';
        const label = p.isOutOfStock ? 'Out' : p.isLowStock ? 'Low' : 'OK';
        return (
          <div className="flex items-center gap-2">
            <span className={`text-[13px] font-semibold ${stockColor(p)}`}>{stock}</span>
            <Badge label={label} variant={variant} />
          </div>
        );
      },
    },
    {
      key: 'margin',
      header: 'Margin%',
      render: (p) => {
        const ph = getLatestPrice(p);
        if (!ph) return <span className="text-text3">—</span>;
        const m = calcMargin(ph.costPrice, ph.retailPrice);
        return <span className={`text-[13px] font-medium ${marginColor(m)}`}>{m.toFixed(1)}%</span>;
      },
    },
    {
      key: 'actions',
      header: '',
      className: 'text-right',
      render: (p) => (
        <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={() => openEdit(p)}
            className="p-1.5 text-text3 hover:text-accent hover:bg-accent/10 rounded-lg transition-colors"
            title="Edit product"
          >
            <Edit2 className="w-3.5 h-3.5" />
          </button>
          <ChevronRight className="w-3.5 h-3.5 text-text3 ml-1" />
        </div>
      ),
    },
  ];

  const columns = isCashier
    ? allColumns.filter(col => !['cost', 'wholesale', 'margin'].includes(col.key))
    : allColumns;

  return (
    <div className={`p-6 min-h-screen bg-bg transition-all ${selectedProduct ? 'mr-85' : ''}`}>
      <PageHeader
        title="Products"
        subtitle="Browse the product catalog"
        count={filtered.length}
        actions={
          <button
            onClick={() => { addForm.reset(); setShowAddModal(true); }}
            className="flex items-center gap-2 px-4 py-2 bg-accent hover:bg-accent/90 text-white rounded-lg text-[13px] font-medium transition-colors"
          >
            <Plus className="w-4 h-4" /> Add Product
          </button>
        }
      />

      <FilterBar
        search={{
          value: search,
          onChange: setSearch,
          placeholder: 'Search by name or SKU',
          loading: prodLoading,
        }}
        filters={[
          {
            label: 'Category',
            value: categoryId,
            options: categoryOptions,
            onChange: setCategoryId,
          },
          {
            label: 'Stock',
            value: stockStatus,
            options: [
              { value: 'in', label: 'In Stock' },
              { value: 'low', label: 'Low Stock' },
              { value: 'out', label: 'Out of Stock' },
            ],
            onChange: setStockStatus,
          },
        ]}
      />

      <div className="bg-surface border border-border rounded-xl overflow-hidden">
        <DataTable<Product>
          columns={columns}
          data={filtered}
          loading={prodLoading}
          rowKey={(p) => p.id}
          onRowClick={handleRowClick}
          emptyTitle="No products found"
          emptyMessage="Try adjusting your search or filters"
          emptyIcon={<Package className="w-8 h-8" />}
        />
      </div>

      {/* Side panel */}
      {selectedProduct && (
        <ProductPanel
          product={selectedProduct}
          onEdit={() => openEdit(selectedProduct)}
          onClose={() => setSelectedProduct(null)}
          isCashier={isCashier}
        />
      )}

      {/* Add Product Modal */}
      <Modal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        title="Add Product"
        size="lg"
        footer={
          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={() => setShowAddModal(false)}
              className="px-4 py-2 bg-surface2 border border-border text-text rounded-lg text-[13px] font-medium hover:bg-border transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={addForm.handleSubmit((d) => {
                createMut.mutate({
                  name: d.name,
                  sku: d.sku,
                  barcode: d.barcode || undefined,
                  description: d.description || undefined,
                  unit: d.unit,
                  reorderPoint: d.reorderPoint,
                  categoryId: d.categoryId,
                  supplierId: d.supplierId,
                  costPrice: d.costPrice,
                  retailPrice: d.retailPrice,
                  wholesalePrice: d.wholesalePrice,
                  priceNote: d.priceNote || undefined,
                });
              })}
              disabled={createMut.isPending}
              className="flex items-center gap-2 px-4 py-2 bg-accent hover:bg-accent/90 text-white rounded-lg text-[13px] font-medium transition-colors disabled:opacity-50"
            >
              {createMut.isPending && <Spinner size="sm" />}
              Create Product
            </button>
          </div>
        }
      >
        <div className="grid grid-cols-2 gap-4">
          <Field label="Product Name *" error={addForm.formState.errors.name?.message}>
            <input {...addForm.register('name')} className={inputCls} placeholder="e.g. Chef Knife" />
          </Field>
          <Field label="SKU *" error={addForm.formState.errors.sku?.message}>
            <input
              {...addForm.register('sku')}
              className={inputCls}
              placeholder="e.g. CK-001"
              onChange={(e) => addForm.setValue('sku', e.target.value.toUpperCase())}
            />
          </Field>
          <Field label="Barcode" error={addForm.formState.errors.barcode?.message}>
            <input {...addForm.register('barcode')} className={inputCls} placeholder="Optional" />
          </Field>
          <Field label="Unit" error={addForm.formState.errors.unit?.message}>
            <select {...addForm.register('unit')} className={inputCls}>
              <option value="">Select unit</option>
              {['piece', 'kg', 'litre', 'box', 'set'].map((u) => (
                <option key={u} value={u}>{u}</option>
              ))}
            </select>
          </Field>
          <Field label="Description" error={addForm.formState.errors.description?.message}>
            <textarea {...addForm.register('description')} className={`${inputCls} resize-none`} rows={2} placeholder="Optional" />
          </Field>
          <Field label="Reorder Point" error={addForm.formState.errors.reorderPoint?.message}>
            <input {...addForm.register('reorderPoint', { valueAsNumber: true })} type="number" min={0} className={inputCls} placeholder="0" />
          </Field>
          <Field label="Category *" error={addForm.formState.errors.categoryId?.message}>
            <select {...addForm.register('categoryId')} className={inputCls}>
              <option value="">Select category</option>
              {categories.map((c: Category) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </Field>
          <Field label="Supplier *" error={addForm.formState.errors.supplierId?.message}>
            <select {...addForm.register('supplierId')} className={inputCls}>
              <option value="">Select supplier</option>
              {suppliers.map((s: Supplier) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </Field>
          <Field label="Cost Price (Rs.) *" error={addForm.formState.errors.costPrice?.message}>
            <input {...addForm.register('costPrice')} type="number" step="0.01" min={0} className={inputCls} placeholder="0.00" />
          </Field>
          <Field label="Retail Price (Rs.) *" error={addForm.formState.errors.retailPrice?.message}>
            <input {...addForm.register('retailPrice')} type="number" step="0.01" min={0} className={inputCls} placeholder="0.00" />
          </Field>
          <Field label="Wholesale Price (Rs.) *" error={addForm.formState.errors.wholesalePrice?.message}>
            <input {...addForm.register('wholesalePrice')} type="number" step="0.01" min={0} className={inputCls} placeholder="0.00" />
          </Field>
          <Field label="Price Note" error={addForm.formState.errors.priceNote?.message}>
            <input {...addForm.register('priceNote')} className={inputCls} placeholder="Optional note" />
          </Field>
        </div>
      </Modal>

      {/* Edit Product Modal */}
      <Modal
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
        title={`Edit — ${selectedProduct?.name ?? ''}`}
        size="lg"
        footer={
          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={() => setShowEditModal(false)}
              className="px-4 py-2 bg-surface2 border border-border text-text rounded-lg text-[13px] font-medium hover:bg-border transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={editForm.handleSubmit((d) => {
                if (!selectedProduct) return;
                updateMut.mutate({ id: selectedProduct.id, payload: d });
              })}
              disabled={updateMut.isPending}
              className="flex items-center gap-2 px-4 py-2 bg-accent hover:bg-accent/90 text-white rounded-lg text-[13px] font-medium transition-colors disabled:opacity-50"
            >
              {updateMut.isPending && <Spinner size="sm" />}
              Save Changes
            </button>
          </div>
        }
      >
        <div className="grid grid-cols-2 gap-4">
          <Field label="Product Name *" error={editForm.formState.errors.name?.message}>
            <input {...editForm.register('name')} className={inputCls} />
          </Field>
          <Field label="Unit" error={editForm.formState.errors.unit?.message}>
            <select {...editForm.register('unit')} className={inputCls}>
              <option value="">Select unit</option>
              {['piece', 'kg', 'litre', 'box', 'set'].map((u) => (
                <option key={u} value={u}>{u}</option>
              ))}
            </select>
          </Field>
          <Field label="Description" error={editForm.formState.errors.description?.message}>
            <textarea {...editForm.register('description')} className={`${inputCls} resize-none`} rows={2} />
          </Field>
          <Field label="Reorder Point" error={editForm.formState.errors.reorderPoint?.message}>
            <input {...editForm.register('reorderPoint', { valueAsNumber: true })} type="number" min={0} className={inputCls} />
          </Field>
          <Field label="Category *" error={editForm.formState.errors.categoryId?.message}>
            <select {...editForm.register('categoryId')} className={inputCls}>
              <option value="">Select category</option>
              {categories.map((c: Category) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </Field>
          <Field label="Supplier *" error={editForm.formState.errors.supplierId?.message}>
            <select {...editForm.register('supplierId')} className={inputCls}>
              <option value="">Select supplier</option>
              {suppliers.map((s: Supplier) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </Field>
        </div>
      </Modal>
    </div>
  );
}
