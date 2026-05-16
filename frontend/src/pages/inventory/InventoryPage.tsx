import { useState } from 'react';
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
} from 'lucide-react';
import { PageHeader } from '../../components/ui/PageHeader';
import { DataTable } from '../../components/ui/DataTable';
import type { Column } from '../../components/ui/DataTable';
import { Modal } from '../../components/ui/Modal';
import { Badge } from '../../components/ui/Badge';
import { EmptyState } from '../../components/ui/EmptyState';
import { ErrorMessage } from '../../components/ui/ErrorMessage';
import { Spinner } from '../../components/ui/Spinner';
import { fmt, fmtDateTime } from '../../utils/cn';
import { useToast } from '../../contexts/ToastContext';
import * as inventoryApi from '../../api/inventory';
import type { InventoryProduct, StockMovement, MovementType } from '../../api/types';

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
// Stock table columns (shared between Stock Levels and Low Stock tabs)
// ---------------------------------------------------------------------------
function buildStockColumns(
  onAdjust: (p: InventoryProduct) => void,
  showPo: boolean,
  navigate: ReturnType<typeof useNavigate>
): Column<InventoryProduct>[] {
  return [
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
    {
      key: 'value',
      header: 'Stock Value',
      render: (row) => <span className="text-[13px] text-text">Rs. {fmt(row.stockValue)}</span>,
    },
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
        <div className="flex gap-2 justify-end">
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
            className="px-2.5 py-1.5 rounded-lg bg-accent/10 border border-accent/30 text-accent text-[12px] font-medium hover:bg-accent/20 transition-colors"
          >
            Adjust
          </button>
        </div>
      ),
    },
  ];
}

// ---------------------------------------------------------------------------
// InventoryPage
// ---------------------------------------------------------------------------
export function InventoryPage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<TabId>('stock');
  const [adjustingProduct, setAdjustingProduct] = useState<InventoryProduct | null>(null);

  // Movement Log filters
  const [productIdFilter, setProductIdFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // Queries
  const { data: inventory = [], isLoading: loadingInventory } = useQuery({
    queryKey: ['inventory'],
    queryFn: inventoryApi.getInventory,
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

  const stockColumns = buildStockColumns(setAdjustingProduct, false, navigate);
  const lowStockColumns = buildStockColumns(setAdjustingProduct, true, navigate);

  // Filtered movements
  const filteredMovements = movements.filter((m) => {
    if (typeFilter && m.type !== typeFilter) return false;
    if (dateFrom && m.createdAt < dateFrom) return false;
    if (dateTo && m.createdAt > `${dateTo}T23:59:59`) return false;
    return true;
  });

  // Total stock value
  const totalStockValue = inventory.reduce(
    (sum, p) => sum + parseFloat(p.stockValue),
    0
  );

  // Valuation chart data
  const chartData = (valuation?.byCategory ?? []).map((c) => ({
    name: c.categoryName.length > 14 ? `${c.categoryName.slice(0, 12)}…` : c.categoryName,
    value: parseFloat(c.totalValue),
  }));

  // Valuation product table: products sorted by stockValue desc
  const valuationProducts = [...inventory]
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
    {
      key: 'cost',
      header: 'Cost Price',
      render: (row) => {
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
      render: (row) => (
        <span className="text-[13px] font-medium text-text">Rs. {fmt(row.stockValue)}</span>
      ),
    },
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
    {
      key: 'unitCost',
      header: 'Unit Cost',
      render: (row) => (
        <span className="text-[13px] text-text2">
          {row.unitCost ? `Rs. ${fmt(row.unitCost)}` : '—'}
        </span>
      ),
    },
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

  return (
    <div className="p-6">
      <PageHeader
        title="Inventory"
        subtitle={`Total stock value: Rs. ${fmt(totalStockValue)}`}
      />

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
            data={inventory}
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
            data={lowStock}
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
            {/* Product picker */}
            <div className="flex flex-col gap-1">
              <label className="text-[11px] text-text2 font-medium uppercase tracking-wide">Product</label>
              <select
                value={productIdFilter}
                onChange={(e) => setProductIdFilter(e.target.value)}
                className={`${inputClass} min-w-50`}
              >
                <option value="">Select a product…</option>
                {inventory.map((p) => (
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
    </div>
  );
}
