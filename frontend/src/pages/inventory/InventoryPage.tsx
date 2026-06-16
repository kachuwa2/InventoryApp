import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts';
import {
  Layers, AlertTriangle, TrendingUp, Activity,
  ArrowDownCircle, ArrowUpCircle, ShoppingCart,
  ArrowUpDown, DollarSign, Trash2,
} from 'lucide-react';
import { PageHeader } from '../../components/ui/PageHeader';
import { DataTable } from '../../components/ui/DataTable';
import type { Column } from '../../components/ui/DataTable';
import { Modal } from '../../components/ui/Modal';
import { Badge } from '../../components/ui/Badge';
import { EmptyState } from '../../components/ui/EmptyState';
import { ErrorMessage } from '../../components/ui/ErrorMessage';
import { Spinner } from '../../components/ui/Spinner';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { fmt, fmtDateTime } from '../../utils/cn';
import { useToast } from '../../contexts/ToastContext';
import * as inventoryApi from '../../api/inventory';
import * as categoriesApi from '../../api/categories';
import * as suppliersApi from '../../api/suppliers';
import * as productsApi from '../../api/products';
import { useAuth } from '../../context/AuthContext';
import { SearchInput } from '../../components/ui/SearchInput';
import type { InventoryProduct, StockMovement, MovementType, Category, Supplier } from '../../api/types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
type TabId = 'stock' | 'low-stock' | 'valuation' | 'movements';

interface AdjustFormValues {
  direction: 'in' | 'out';
  quantity: number;
  unitCost?: string;
  notes: string;
}

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------
const adjustSchema = z.object({
  direction: z.enum(['in', 'out']),
  quantity: z.number({ error: 'Quantity is required' }).int().min(1, { error: 'Minimum 1' }),
  unitCost: z.string().optional(),
  notes: z.string().min(5, { error: 'Notes must be at least 5 characters' }),
});

const priceSchema = z.object({
  costPrice: z.string().min(1, 'Required'),
  retailPrice: z.string().min(1, 'Required'),
  wholesalePrice: z.string().min(1, 'Required'),
  note: z.string().optional(),
}).refine(
  (d) => Number(d.retailPrice) > Number(d.costPrice),
  { message: 'Retail price must exceed cost', path: ['retailPrice'] }
).refine(
  (d) => Number(d.wholesalePrice) > Number(d.costPrice),
  { message: 'Wholesale price must exceed cost', path: ['wholesalePrice'] }
).refine(
  (d) => Number(d.wholesalePrice) <= Number(d.retailPrice),
  { message: 'Wholesale price must not exceed retail', path: ['wholesalePrice'] }
);

type PriceForm = z.infer<typeof priceSchema>;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const IN_TYPES: MovementType[] = ['purchase', 'adjustment_in', 'return_in'];

function movementVariant(type: MovementType): 'success' | 'danger' | 'info' | 'warning' {
  switch (type) {
    case 'purchase': return 'success';
    case 'sale': return 'danger';
    case 'adjustment_in': return 'info';
    case 'adjustment_out': return 'warning';
    case 'return_in': return 'success';
    case 'return_out': return 'warning';
  }
}

function movementLabel(type: MovementType): string {
  switch (type) {
    case 'purchase': return 'Purchase';
    case 'sale': return 'Sale';
    case 'adjustment_in': return 'Adj In';
    case 'adjustment_out': return 'Adj Out';
    case 'return_in': return 'Return In';
    case 'return_out': return 'Return Out';
  }
}

function isIn(type: MovementType): boolean {
  return IN_TYPES.includes(type);
}

// ---------------------------------------------------------------------------
// Tab button
// ---------------------------------------------------------------------------
interface TabButtonProps {
  id: TabId;
  label: string;
  icon: React.ReactNode;
  active: boolean;
  onClick: (id: TabId) => void;
}

function TabButton({ id, label, icon, active, onClick }: TabButtonProps) {
  return (
    <button
      onClick={() => onClick(id)}
      className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-[13px] font-medium transition-colors whitespace-nowrap ${
        active
          ? 'bg-accent text-white'
          : 'bg-surface2 text-text2 hover:text-text border border-border'
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Adjust Stock Modal
// ---------------------------------------------------------------------------
interface AdjustModalProps {
  product: InventoryProduct;
  onClose: () => void;
  onSuccess: () => void;
}

function AdjustModal({ product, onClose, onSuccess }: AdjustModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const {
    register,
    handleSubmit,
    control,
    setValue,
    formState: { errors },
  } = useForm<AdjustFormValues>({
    resolver: zodResolver(adjustSchema),
    defaultValues: { direction: 'in', quantity: 1, unitCost: '', notes: '' },
  });

  const direction = useWatch({ control, name: 'direction', defaultValue: 'in' });
  const quantity  = useWatch({ control, name: 'quantity',  defaultValue: 1 });
  const notes     = useWatch({ control, name: 'notes',     defaultValue: '' });

  const adjustMutation = useMutation({
    mutationFn: (values: AdjustFormValues) =>
      inventoryApi.adjustStock({
        productId: product.id,
        quantity: values.quantity,
        type: values.direction === 'in' ? 'adjustment_in' : 'adjustment_out',
        notes: values.notes,
        unitCost: values.unitCost || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      queryClient.invalidateQueries({ queryKey: ['inventory', 'low-stock'] });
      queryClient.invalidateQueries({ queryKey: ['inventory', 'valuation'] });
      toast('success', 'Stock adjusted successfully');
      onSuccess();
    },
    onError: () => toast('error', 'Failed to adjust stock'),
  });

  const newStock =
    direction === 'in'
      ? product.currentStock + (Number(quantity) || 0)
      : product.currentStock - (Number(quantity) || 0);

  const fieldClass =
    'w-full bg-bg border border-border rounded-lg px-3 py-2 text-[13px] text-text placeholder:text-text3 focus:outline-none focus:border-accent transition-colors';
  const labelClass = 'block text-[12px] font-medium text-text2 mb-1';

  return (
    <form onSubmit={handleSubmit((v) => adjustMutation.mutate(v))} className="flex flex-col gap-4">
      {/* Product info */}
      <div className="bg-surface2 rounded-lg p-3">
        <p className="text-[13px] font-semibold text-text">{product.name}</p>
        <p className="text-[12px] text-text2 mt-0.5">SKU: {product.sku}</p>
        <p className="text-[12px] text-text2">Current stock: <span className="text-text font-medium">{product.currentStock}</span></p>
      </div>

      {/* Direction toggle */}
      <div>
        <label className={labelClass}>Direction</label>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setValue('direction', 'in')}
            className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg border text-[13px] font-medium transition-colors ${
              direction === 'in'
                ? 'border-success bg-success/10 text-success'
                : 'border-border bg-surface2 text-text2 hover:text-text'
            }`}
          >
            <ArrowDownCircle className="w-4 h-4" />
            Add Stock
          </button>
          <button
            type="button"
            onClick={() => setValue('direction', 'out')}
            className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg border text-[13px] font-medium transition-colors ${
              direction === 'out'
                ? 'border-danger bg-danger/10 text-danger'
                : 'border-border bg-surface2 text-text2 hover:text-text'
            }`}
          >
            <ArrowUpCircle className="w-4 h-4" />
            Remove Stock
          </button>
        </div>
      </div>

      {/* Quantity */}
      <div>
        <label className={labelClass}>Quantity <span className="text-danger">*</span></label>
        <input
          {...register('quantity', { valueAsNumber: true })}
          type="number"
          min={1}
          className={fieldClass}
          placeholder="1"
        />
        <ErrorMessage message={errors.quantity?.message} />
      </div>

      {/* Unit cost */}
      <div>
        <label className={labelClass}>Unit Cost (Rs., optional)</label>
        <input {...register('unitCost')} type="number" step="0.01" min={0} placeholder="0.00" className={fieldClass} />
        <ErrorMessage message={errors.unitCost?.message} />
      </div>

      {/* Notes */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <label className={labelClass.replace('mb-1', '')}>Notes <span className="text-danger">*</span></label>
          <span className="text-[11px] text-text3">{notes.length} chars</span>
        </div>
        <textarea
          {...register('notes')}
          rows={3}
          placeholder="Reason for adjustment..."
          className={`${fieldClass} resize-none`}
        />
        <ErrorMessage message={errors.notes?.message} />
      </div>

      {/* Preview */}
      <div className="bg-surface2 rounded-lg px-3 py-2 flex items-center justify-between">
        <span className="text-[12px] text-text2">Preview</span>
        <span className="text-[13px] font-medium text-text">
          {product.currentStock}{' '}
          <span className={direction === 'in' ? 'text-success' : 'text-danger'}>
            {direction === 'in' ? '+' : '−'}{Number(quantity) || 0}
          </span>{' '}
          → <span className={newStock < 0 ? 'text-danger' : 'text-text'}>{newStock}</span>
        </span>
      </div>

      {/* Footer */}
      <div className="flex gap-3 justify-end pt-1">
        <button
          type="button"
          onClick={onClose}
          disabled={adjustMutation.isPending}
          className="px-4 py-2 bg-surface2 border border-border text-text rounded-lg text-[13px] font-medium hover:bg-border transition-colors disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={adjustMutation.isPending}
          className="px-4 py-2 bg-accent hover:bg-accent/90 text-white rounded-lg text-[13px] font-medium flex items-center gap-2 transition-colors disabled:opacity-50"
        >
          {adjustMutation.isPending && <Spinner size="sm" />}
          Adjust Stock
        </button>
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Shared icon button style for inventory row actions
// ---------------------------------------------------------------------------
const iconBtnStyle: React.CSSProperties = {
  width:          32,
  height:         32,
  borderRadius:   6,
  background:     'transparent',
  border:         '1px solid var(--border)',
  display:        'flex',
  alignItems:     'center',
  justifyContent: 'center',
  cursor:         'pointer',
  color:          'var(--text2)',
  transition:     'all 150ms',
};

// ---------------------------------------------------------------------------
// Price Modal
// ---------------------------------------------------------------------------
interface PriceModalProps {
  product: InventoryProduct;
  onClose: () => void;
  onSuccess: () => void;
}

function PriceModal({ product, onClose, onSuccess }: PriceModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const ph = product.priceHistory?.[0];

  const { register, handleSubmit, formState: { errors } } = useForm<PriceForm>({
    resolver: zodResolver(priceSchema),
    defaultValues: {
      costPrice:      ph?.costPrice ?? '',
      retailPrice:    ph?.retailPrice ?? '',
      wholesalePrice: ph?.wholesalePrice ?? '',
      note:           '',
    },
  });

  const priceMut = useMutation({
    mutationFn: (values: PriceForm) =>
      productsApi.updateProductPrice(product.id, {
        costPrice:      values.costPrice,
        retailPrice:    values.retailPrice,
        wholesalePrice: values.wholesalePrice,
        note:           values.note || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      toast('success', 'Price updated successfully');
      onSuccess();
    },
    onError: () => toast('error', 'Failed to update price'),
  });

  const fieldClass =
    'w-full bg-bg border border-border rounded-lg px-3 py-2 text-[13px] text-text placeholder:text-text3 focus:outline-none focus:border-accent transition-colors';
  const labelClass = 'block text-[12px] font-medium text-text2 mb-1';

  return (
    <form onSubmit={handleSubmit((v) => priceMut.mutate(v))} className="flex flex-col gap-4">
      <div className="bg-surface2 rounded-lg p-3">
        <p className="text-[13px] font-semibold text-text">{product.name}</p>
        <p className="text-[12px] text-text2 mt-0.5">SKU: {product.sku}</p>
      </div>
      {ph && (
        <div className="bg-surface2 rounded-lg p-4 text-[12px] text-text2 space-y-1">
          <p className="font-medium text-text3 uppercase tracking-wider text-[10px] mb-2">Current Prices</p>
          <div className="flex justify-between"><span>Cost</span><span className="font-mono">Rs. {fmt(ph.costPrice)}</span></div>
          <div className="flex justify-between"><span>Retail</span><span className="font-mono">Rs. {fmt(ph.retailPrice)}</span></div>
          <div className="flex justify-between"><span>Wholesale</span><span className="font-mono">Rs. {fmt(ph.wholesalePrice)}</span></div>
        </div>
      )}
      <div>
        <label className={labelClass}>New Cost Price (Rs.) <span className="text-danger">*</span></label>
        <input {...register('costPrice')} type="number" step="0.01" min={0} className={fieldClass} />
        <ErrorMessage message={errors.costPrice?.message} />
      </div>
      <div>
        <label className={labelClass}>New Retail Price (Rs.) <span className="text-danger">*</span></label>
        <input {...register('retailPrice')} type="number" step="0.01" min={0} className={fieldClass} />
        <ErrorMessage message={errors.retailPrice?.message} />
      </div>
      <div>
        <label className={labelClass}>New Wholesale Price (Rs.) <span className="text-danger">*</span></label>
        <input {...register('wholesalePrice')} type="number" step="0.01" min={0} className={fieldClass} />
        <ErrorMessage message={errors.wholesalePrice?.message} />
      </div>
      <div>
        <label className={labelClass}>Note</label>
        <input {...register('note')} className={fieldClass} placeholder="Reason for price change" />
        <ErrorMessage message={errors.note?.message} />
      </div>
      <div className="flex gap-3 justify-end pt-1">
        <button
          type="button"
          onClick={onClose}
          disabled={priceMut.isPending}
          className="px-4 py-2 bg-surface2 border border-border text-text rounded-lg text-[13px] font-medium hover:bg-border transition-colors disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={priceMut.isPending}
          className="px-4 py-2 bg-accent hover:bg-accent/90 text-white rounded-lg text-[13px] font-medium flex items-center gap-2 transition-colors disabled:opacity-50"
        >
          {priceMut.isPending && <Spinner size="sm" />}
          Update Price
        </button>
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Stock table columns (shared between Stock Levels and Low Stock tabs)
// ---------------------------------------------------------------------------
function buildStockColumns(
  onAdjust: (p: InventoryProduct) => void,
  showPo: boolean,
  navigate: ReturnType<typeof useNavigate>,
  canManage: boolean,
  onPrice: (p: InventoryProduct) => void,
  onDelete: (p: InventoryProduct) => void,
  isWarehouse: boolean,
): Column<InventoryProduct>[] {
  const cols: Column<InventoryProduct>[] = [
    {
      key: 'product',
      header: 'Product',
      render: (row) => (
        <div>
          <p className="text-[13px] font-medium text-text">{row.name}</p>
          <p className="text-[11px] text-text3 font-mono">{row.sku}</p>
        </div>
      ),
    },
    {
      key: 'category',
      header: 'Category',
      render: (row) => (
        <span className="text-[13px] text-text2">{row.category?.name ?? '—'}</span>
      ),
    },
    {
      key: 'stock',
      header: 'Current Stock',
      render: (row) => (
        <span
          className={`text-[16px] font-semibold ${
            row.isOutOfStock
              ? 'text-danger'
              : row.isLowStock
              ? 'text-warning'
              : 'text-success'
          }`}
        >
          {row.currentStock}
          {row.unit ? ` ${row.unit}` : ''}
        </span>
      ),
    },
    {
      key: 'reorder',
      header: 'Reorder Pt.',
      render: (row) => <span className="text-[13px] text-text2">{row.reorderPoint}</span>,
    },
    ...(!isWarehouse ? [{
      key: 'value',
      header: 'Stock Value',
      render: (row: InventoryProduct) => <span className="text-[13px] text-text">Rs. {fmt(row.stockValue)}</span>,
    }] : []),
    {
      key: 'status',
      header: 'Status',
      render: (row) => (
        <Badge
          label={row.isOutOfStock ? 'Out of Stock' : row.isLowStock ? 'Low Stock' : 'In Stock'}
          variant={row.isOutOfStock ? 'danger' : row.isLowStock ? 'warning' : 'success'}
          dot
        />
      ),
    },
    {
      key: 'actions',
      header: '',
      render: (row) => (
        <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end', alignItems: 'center' }}>
          {showPo && (
            <button
              onClick={(e) => { e.stopPropagation(); navigate('/purchases/new'); }}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-info/10 border border-info/30 text-info text-[12px] font-medium hover:bg-info/20 transition-colors"
            >
              <ShoppingCart className="w-3.5 h-3.5" />
              Create PO
            </button>
          )}
          <button
            onClick={(e) => { e.stopPropagation(); onAdjust(row); }}
            title="Adjust Stock"
            style={iconBtnStyle}
          >
            <ArrowUpDown size={15} />
          </button>
          {canManage && (
            <button
              onClick={(e) => { e.stopPropagation(); onPrice(row); }}
              title="Edit Price"
              style={iconBtnStyle}
            >
              <DollarSign size={15} />
            </button>
          )}
          {canManage && (
            <button
              onClick={(e) => { e.stopPropagation(); onDelete(row); }}
              title="Delete Product"
              style={{ ...iconBtnStyle, color: 'var(--red)' }}
            >
              <Trash2 size={15} />
            </button>
          )}
        </div>
      ),
    },
  ];
  return cols;
}

// ---------------------------------------------------------------------------
// InventoryPage
// ---------------------------------------------------------------------------
export function InventoryPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const qc = useQueryClient();
  const { toast } = useToast();
  const canManage   = user?.role === 'admin' || user?.role === 'manager';
  const isWarehouse = user?.role === 'warehouse';

  const [activeTab, setActiveTab] = useState<TabId>('stock');
  const [adjustingProduct, setAdjustingProduct] = useState<InventoryProduct | null>(null);
  const [pricingProduct, setPricingProduct] = useState<InventoryProduct | null>(null);
  const [deleteProduct, setDeleteProduct] = useState<InventoryProduct | null>(null);

  // Global FilterBar state (persists across Stock / Low-Stock / Valuation tabs)
  const [search, setSearch] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [stockStatus, setStockStatus] = useState('');
  const [supplierId, setSupplierId] = useState('');
  const [sortBy, setSortBy] = useState('name');

  // Movement Log filters
  const [productIdFilter, setProductIdFilter] = useState('');
  const [movementSearch, setMovementSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const deleteMut = useMutation({
    mutationFn: (id: string) => productsApi.deleteProduct(id),
    onSuccess: () => {
      toast('success', 'Product deleted');
      setDeleteProduct(null);
      qc.invalidateQueries({ queryKey: ['inventory'] });
      qc.invalidateQueries({ queryKey: ['products'] });
    },
    onError: () => toast('error', 'Failed to delete product'),
  });

  // Queries
  const { data: inventory = [], isLoading: loadingInventory } = useQuery({
    queryKey: ['inventory'],
    queryFn: inventoryApi.getInventory,
  });

  const { data: categories = [] } = useQuery({
    queryKey: ['categories'],
    queryFn: categoriesApi.getCategories,
  });

  const { data: suppliers = [] } = useQuery({
    queryKey: ['suppliers'],
    queryFn: suppliersApi.getSuppliers,
  });

  const { data: lowStock = [], isLoading: loadingLowStock } = useQuery({
    queryKey: ['inventory', 'low-stock'],
    queryFn: inventoryApi.getLowStock,
    enabled: activeTab === 'low-stock',
  });

  const { data: valuation, isLoading: loadingValuation } = useQuery({
    queryKey: ['inventory', 'valuation'],
    queryFn: inventoryApi.getValuation,
    enabled: activeTab === 'valuation',
  });

  const { data: movements = [], isLoading: loadingMovements } = useQuery({
    queryKey: ['inventory', productIdFilter, 'movements'],
    queryFn: () => inventoryApi.getMovements(productIdFilter),
    enabled: Boolean(productIdFilter),
  });

  const stockColumns    = buildStockColumns(setAdjustingProduct, false, navigate, canManage, setPricingProduct, setDeleteProduct, isWarehouse);
  const lowStockColumns = buildStockColumns(setAdjustingProduct, true,  navigate, canManage, setPricingProduct, setDeleteProduct, isWarehouse);

  // Global filtered + sorted inventory (used by Stock Levels and Valuation tabs)
  const filteredInventory = useMemo(() => {
    let items = [...inventory];

    if (search.trim()) {
      const q = search.toLowerCase();
      items = items.filter(
        (p) => p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q)
      );
    }
    if (categoryId) items = items.filter((p) => p.category?.id === categoryId);
    if (supplierId) items = items.filter((p) => p.supplier?.id === supplierId);
    if (stockStatus === 'in_stock') {
      items = items.filter((p) => p.currentStock > p.reorderPoint);
    } else if (stockStatus === 'low_stock') {
      items = items.filter((p) => p.currentStock > 0 && p.currentStock <= p.reorderPoint);
    } else if (stockStatus === 'out_of_stock') {
      items = items.filter((p) => p.currentStock === 0);
    }

    if (sortBy === 'stock_asc') {
      items.sort((a, b) => a.currentStock - b.currentStock);
    } else if (sortBy === 'stock_desc') {
      items.sort((a, b) => b.currentStock - a.currentStock);
    } else if (sortBy === 'value_desc') {
      items.sort((a, b) => parseFloat(b.stockValue) - parseFloat(a.stockValue));
    } else {
      items.sort((a, b) => a.name.localeCompare(b.name));
    }
    return items;
  }, [inventory, search, categoryId, supplierId, stockStatus, sortBy]);

  // Low-stock tab: apply same filters (except stockStatus) to lowStock API data
  const filteredLowStock = useMemo(() => {
    let items = [...lowStock];
    if (search.trim()) {
      const q = search.toLowerCase();
      items = items.filter(
        (p) => p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q)
      );
    }
    if (categoryId) items = items.filter((p) => p.category?.id === categoryId);
    if (supplierId) items = items.filter((p) => p.supplier?.id === supplierId);
    return items;
  }, [lowStock, search, categoryId, supplierId]);

  // Movement log: filter the inventory product list by text search
  const movementInventoryOptions = useMemo(() => {
    if (!movementSearch.trim()) return inventory;
    const q = movementSearch.toLowerCase();
    return inventory.filter(
      (p) => p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q)
    );
  }, [inventory, movementSearch]);

  const hasActiveFilters = !!(search || categoryId || stockStatus || supplierId || sortBy !== 'name');

  // Filtered movements
  const filteredMovements = movements.filter((m) => {
    if (typeFilter && m.type !== typeFilter) return false;
    if (dateFrom && m.createdAt < dateFrom) return false;
    if (dateTo && m.createdAt > `${dateTo}T23:59:59`) return false;
    return true;
  });

  // Total stock value (always from full inventory, not filtered)
  const totalStockValue = inventory.reduce(
    (sum, p) => sum + parseFloat(p.stockValue),
    0
  );

  // Valuation chart data
  const chartData = (valuation?.byCategory ?? []).map((c) => ({
    name: c.categoryName.length > 14 ? `${c.categoryName.slice(0, 12)}…` : c.categoryName,
    value: parseFloat(c.totalValue),
  }));

  // Valuation product table: filtered products sorted by stockValue desc
  const valuationProducts = [...filteredInventory]
    .sort((a, b) => parseFloat(b.stockValue) - parseFloat(a.stockValue));

  const valProductCols: Column<InventoryProduct>[] = [
    {
      key: 'name',
      header: 'Product',
      render: (row) => (
        <div>
          <p className="text-[13px] font-medium text-text">{row.name}</p>
          <p className="text-[11px] text-text3 font-mono">{row.sku}</p>
        </div>
      ),
    },
    {
      key: 'qty',
      header: 'Current Qty',
      render: (row) => <span className="text-[13px] text-text">{row.currentStock}</span>,
    },
    ...(!isWarehouse ? [
      {
        key: 'cost',
        header: 'Cost Price',
        render: (row: InventoryProduct) => {
          const cost = row.priceHistory?.[0]?.costPrice;
          return (
            <span className="text-[13px] text-text">
              {cost ? `Rs. ${fmt(cost)}` : '—'}
            </span>
          );
        },
      },
      {
        key: 'totalValue',
        header: 'Total Value',
        render: (row: InventoryProduct) => (
          <span className="text-[13px] font-medium text-text">Rs. {fmt(row.stockValue)}</span>
        ),
      },
    ] as Column<InventoryProduct>[] : []),
  ];

  const movementCols: Column<StockMovement>[] = [
    {
      key: 'type',
      header: 'Type',
      render: (row) => (
        <Badge
          label={movementLabel(row.type)}
          variant={movementVariant(row.type)}
          dot
        />
      ),
    },
    {
      key: 'product',
      header: 'Product',
      render: (row) => (
        <div>
          <p className="text-[13px] text-text">{row.product?.name ?? '—'}</p>
          <p className="text-[11px] text-text3 font-mono">{row.product?.sku ?? ''}</p>
        </div>
      ),
    },
    {
      key: 'quantity',
      header: 'Qty',
      render: (row) => (
        <span className={`text-[13px] font-semibold ${isIn(row.type) ? 'text-success' : 'text-danger'}`}>
          {isIn(row.type) ? '+' : '−'}{row.quantity}
        </span>
      ),
    },
    ...(!isWarehouse ? [{
      key: 'unitCost',
      header: 'Unit Cost',
      render: (row: StockMovement) => (
        <span className="text-[13px] text-text2">
          {row.unitCost ? `Rs. ${fmt(row.unitCost)}` : '—'}
        </span>
      ),
    }] as Column<StockMovement>[] : []),
    {
      key: 'reference',
      header: 'Reference',
      render: (row) => <span className="text-[13px] text-text2 font-mono">{row.reference ?? '—'}</span>,
    },
    {
      key: 'performedBy',
      header: 'By',
      render: (row) => <span className="text-[13px] text-text2">{row.performedBy?.name ?? '—'}</span>,
    },
    {
      key: 'date',
      header: 'Date & Time',
      render: (row) => <span className="text-[12px] text-text3">{fmtDateTime(row.createdAt)}</span>,
    },
  ];

  const inputClass =
    'bg-surface2 border border-border rounded-lg px-3 py-2 text-[13px] text-text placeholder:text-text3 focus:outline-none focus:border-accent transition-colors';

  const selectCls =
    'bg-surface2 border border-border text-text rounded-lg px-3 py-2 text-[13px] focus:outline-none focus:border-accent transition-colors cursor-pointer';

  return (
    <div className="p-6">
      <PageHeader
        title="Inventory"
        subtitle={`Total stock value: Rs. ${fmt(totalStockValue)}`}
      />

      {/* Global FilterBar */}
      <div className="flex flex-wrap gap-3 mb-4 items-center">
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Search name or SKU…"
          className="w-60"
        />
        <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className={selectCls}>
          <option value="">Category: All</option>
          {(categories as Category[]).map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        <select value={stockStatus} onChange={(e) => setStockStatus(e.target.value)} className={selectCls}>
          <option value="">Status: All</option>
          <option value="in_stock">In Stock</option>
          <option value="low_stock">Low Stock</option>
          <option value="out_of_stock">Out of Stock</option>
        </select>
        <select value={supplierId} onChange={(e) => setSupplierId(e.target.value)} className={selectCls}>
          <option value="">Supplier: All</option>
          {(suppliers as Supplier[]).map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
        <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} className={selectCls}>
          <option value="name">Sort: Name</option>
          <option value="stock_asc">Stock ↑</option>
          <option value="stock_desc">Stock ↓</option>
          <option value="value_desc">Value ↓</option>
        </select>
        {hasActiveFilters && (
          <button
            onClick={() => { setSearch(''); setCategoryId(''); setStockStatus(''); setSupplierId(''); setSortBy('name'); }}
            className="px-3 py-2 text-[13px] text-text2 hover:text-danger border border-border rounded-lg hover:border-danger transition-colors"
          >
            Clear filters
          </button>
        )}
      </div>
      {hasActiveFilters && (
        <p className="text-[12px] text-text3 mb-4">
          Showing {filteredInventory.length} of {inventory.length} products
        </p>
      )}

      {/* Tabs */}
      <div className="flex gap-2 mb-6 flex-wrap">
        <TabButton
          id="stock"
          label="Stock Levels"
          icon={<Layers className="w-4 h-4" />}
          active={activeTab === 'stock'}
          onClick={setActiveTab}
        />
        <TabButton
          id="low-stock"
          label={`Low Stock${lowStock.length > 0 ? ` (${lowStock.length})` : ''}`}
          icon={<AlertTriangle className="w-4 h-4" />}
          active={activeTab === 'low-stock'}
          onClick={setActiveTab}
        />
        <TabButton
          id="valuation"
          label="Valuation"
          icon={<TrendingUp className="w-4 h-4" />}
          active={activeTab === 'valuation'}
          onClick={setActiveTab}
        />
        <TabButton
          id="movements"
          label="Movement Log"
          icon={<Activity className="w-4 h-4" />}
          active={activeTab === 'movements'}
          onClick={setActiveTab}
        />
      </div>

      {/* Tab 1: Stock Levels */}
      {activeTab === 'stock' && (
        <div className="bg-surface border border-border rounded-xl overflow-hidden">
          <DataTable
            columns={stockColumns}
            data={filteredInventory}
            loading={loadingInventory}
            rowKey={(r) => r.id}
            emptyTitle="No products found"
            emptyMessage="Add products to see stock levels here."
          />
        </div>
      )}

      {/* Tab 2: Low Stock */}
      {activeTab === 'low-stock' && (
        <div className="bg-surface border border-border rounded-xl overflow-hidden">
          <DataTable
            columns={lowStockColumns}
            data={filteredLowStock}
            loading={loadingLowStock}
            rowKey={(r) => r.id}
            emptyTitle="No low-stock products"
            emptyMessage="All products are well-stocked."
            emptyIcon={<AlertTriangle className="w-8 h-8" />}
          />
        </div>
      )}

      {/* Tab 3: Valuation */}
      {activeTab === 'valuation' && (
        isWarehouse ? (
          <EmptyState
            icon={<TrendingUp className="w-10 h-10" />}
            title="Valuation data is restricted"
            message="Financial data is not available for warehouse users."
          />
        ) :
        <div className="flex flex-col gap-5">
          {loadingValuation ? (
            <div className="flex justify-center py-12"><Spinner /></div>
          ) : valuation ? (
            <>
              {/* Summary card */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="bg-surface border border-border rounded-xl p-5">
                  <p className="text-[12px] text-text2 uppercase tracking-wide mb-1">Total Stock Value</p>
                  <p className="text-[28px] font-bold text-text">Rs. {fmt(valuation.totalValue)}</p>
                </div>
                <div className="bg-surface border border-border rounded-xl p-5">
                  <p className="text-[12px] text-text2 uppercase tracking-wide mb-1">Products Tracked</p>
                  <p className="text-[28px] font-bold text-text">{valuation.productCount}</p>
                </div>
              </div>

              {/* Bar chart */}
              {chartData.length > 0 && (
                <div className="bg-surface border border-border rounded-xl p-5">
                  <p className="text-[13px] font-semibold text-text mb-4">Value by Category</p>
                  <ResponsiveContainer width="100%" height={Math.max(200, chartData.length * 44)}>
                    <BarChart
                      data={chartData}
                      layout="vertical"
                      margin={{ top: 0, right: 20, left: 0, bottom: 0 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#252836" horizontal={false} />
                      <XAxis
                        type="number"
                        tickFormatter={(v: number) => `${(v / 1000).toFixed(0)}K`}
                        tick={{ fill: '#9499B5', fontSize: 11 }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis
                        type="category"
                        dataKey="name"
                        width={90}
                        tick={{ fill: '#9499B5', fontSize: 11 }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <Tooltip
                        formatter={(val) => [`Rs. ${fmt(val as number)}`, 'Value']}
                        contentStyle={{ background: '#13151C', border: '1px solid #252836', borderRadius: 8, fontSize: 12 }}
                        labelStyle={{ color: '#E8E9F0' }}
                        itemStyle={{ color: '#7C6EF8' }}
                      />
                      <Bar dataKey="value" fill="#7C6EF8" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}

              {/* Product table */}
              <div className="bg-surface border border-border rounded-xl overflow-hidden">
                <div className="px-5 py-3 border-b border-border">
                  <p className="text-[13px] font-semibold text-text">Products by Value</p>
                </div>
                <DataTable
                  columns={valProductCols}
                  data={valuationProducts}
                  rowKey={(r) => r.id}
                  emptyTitle="No products"
                />
              </div>
            </>
          ) : null}
        </div>
      )}

      {/* Tab 4: Movement Log */}
      {activeTab === 'movements' && (
        <div className="flex flex-col gap-4">
          {/* Filters */}
          <div className="flex flex-wrap gap-3 items-end">
            {/* Product search + picker */}
            <div className="flex flex-col gap-1">
              <label className="text-[11px] text-text2 font-medium uppercase tracking-wide">Search Product</label>
              <SearchInput
                value={movementSearch}
                onChange={(v) => { setMovementSearch(v); setProductIdFilter(''); }}
                placeholder="Filter products…"
                className="w-48"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[11px] text-text2 font-medium uppercase tracking-wide">Product</label>
              <select
                value={productIdFilter}
                onChange={(e) => setProductIdFilter(e.target.value)}
                className={`${inputClass} min-w-50`}
              >
                <option value="">Select a product…</option>
                {movementInventoryOptions.map((p) => (
                  <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>
                ))}
              </select>
            </div>

            {/* Type filter */}
            <div className="flex flex-col gap-1">
              <label className="text-[11px] text-text2 font-medium uppercase tracking-wide">Type</label>
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className={inputClass}
              >
                <option value="">All types</option>
                <option value="purchase">Purchase</option>
                <option value="sale">Sale</option>
                <option value="adjustment_in">Adjustment In</option>
                <option value="adjustment_out">Adjustment Out</option>
                <option value="return_in">Return In</option>
                <option value="return_out">Return Out</option>
              </select>
            </div>

            {/* Date range */}
            <div className="flex flex-col gap-1">
              <label className="text-[11px] text-text2 font-medium uppercase tracking-wide">From</label>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className={inputClass}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[11px] text-text2 font-medium uppercase tracking-wide">To</label>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className={inputClass}
              />
            </div>
          </div>

          {/* Table or empty state */}
          {!productIdFilter ? (
            <EmptyState
              icon={<Activity className="w-10 h-10" />}
              title="Select a product"
              message="Choose a product above to view its stock movement history."
            />
          ) : (
            <div className="bg-surface border border-border rounded-xl overflow-hidden">
              <DataTable
                columns={movementCols}
                data={filteredMovements}
                loading={loadingMovements}
                rowKey={(r) => r.id}
                emptyTitle="No movements found"
                emptyMessage="No stock movements match the current filters."
                emptyIcon={<Activity className="w-8 h-8" />}
              />
            </div>
          )}
        </div>
      )}

      {/* Adjust Stock Modal */}
      <Modal
        isOpen={adjustingProduct !== null}
        onClose={() => setAdjustingProduct(null)}
        title="Adjust Stock"
        size="md"
      >
        {adjustingProduct && (
          <AdjustModal
            product={adjustingProduct}
            onClose={() => setAdjustingProduct(null)}
            onSuccess={() => setAdjustingProduct(null)}
          />
        )}
      </Modal>

      {/* Edit Price Modal */}
      <Modal
        isOpen={pricingProduct !== null}
        onClose={() => setPricingProduct(null)}
        title={`Set Price — ${pricingProduct?.name ?? ''}`}
        size="md"
      >
        {pricingProduct && (
          <PriceModal
            product={pricingProduct}
            onClose={() => setPricingProduct(null)}
            onSuccess={() => setPricingProduct(null)}
          />
        )}
      </Modal>

      {/* Delete Product Confirm */}
      <ConfirmDialog
        isOpen={deleteProduct !== null}
        onClose={() => setDeleteProduct(null)}
        onConfirm={() => { if (deleteProduct) deleteMut.mutate(deleteProduct.id); }}
        title="Delete Product"
        message={`Are you sure you want to delete "${deleteProduct?.name ?? ''}" (${deleteProduct?.sku ?? ''})?\nThis cannot be undone.`}
        confirmLabel="Delete Product"
        loading={deleteMut.isPending}
        danger
      />
    </div>
  );
}
