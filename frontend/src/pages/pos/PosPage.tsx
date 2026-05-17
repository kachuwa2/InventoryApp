import { useEffect, useRef, useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Barcode, X, Minus, Plus, Printer, ShoppingCart, User, ChevronRight, CheckCircle,
} from 'lucide-react';
import { useToast } from '../../contexts/ToastContext';
import { Modal } from '../../components/ui/Modal';
import { Badge } from '../../components/ui/Badge';
import { Spinner } from '../../components/ui/Spinner';
import { SearchInput } from '../../components/ui/SearchInput';
import { fmt } from '../../utils/cn';
import * as productsApi from '../../api/products';
import * as customersApi from '../../api/customers';
import * as salesApi from '../../api/sales';
import type { Product, Customer, Sale, SaleType, CustomerType } from '../../api/types';

interface CartItem {
  productId: string;
  name: string;
  sku: string;
  quantity: number;
  unitPrice: number;
  discountPct: number;
}

type CustomerPickerTab = 'all' | 'retail' | 'wholesale';

function lineTotal(item: CartItem): number {
  return item.unitPrice * item.quantity * (1 - item.discountPct / 100);
}

function getUnitPrice(product: Product, type: SaleType): number {
  const latest = product.priceHistory?.[0];
  if (!latest) return 0;
  return Number(type === 'retail' ? latest.retailPrice : latest.wholesalePrice);
}

export function PosPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const barcodeRef = useRef<HTMLInputElement>(null);
  const [barcodeInput, setBarcodeInput] = useState('');
  const [barcodeError, setBarcodeError] = useState('');
  const [barcodeFlash, setBarcodeFlash] = useState(false);
  const [suggestions, setSuggestions] = useState<Product[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [saleType, setSaleType] = useState<SaleType>('retail');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [orderDiscount, setOrderDiscount] = useState('0');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);

  const [showCustomerPicker, setShowCustomerPicker] = useState(false);
  const [showPaymentConfirm, setShowPaymentConfirm] = useState(false);
  const [showReceipt, setShowReceipt] = useState(false);
  const [completedSale, setCompletedSale] = useState<Sale | null>(null);

  const [customerSearch, setCustomerSearch] = useState('');
  const [customerTab, setCustomerTab] = useState<CustomerPickerTab>('all');
  const [showInlineCreate, setShowInlineCreate] = useState(false);
  const [newCustomerName, setNewCustomerName] = useState('');
  const [newCustomerPhone, setNewCustomerPhone] = useState('');
  const [newCustomerType, setNewCustomerType] = useState<CustomerType>('retail');

  const { data: products = [] } = useQuery({
    queryKey: ['products', {}],
    queryFn: () => productsApi.getProducts(),
  });

  const { data: customers = [] } = useQuery({
    queryKey: ['customers', {}],
    queryFn: () => customersApi.getCustomers(),
  });

  const createCustomerMutation = useMutation({
    mutationFn: customersApi.createCustomer,
    onSuccess: (c) => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      setSelectedCustomer(c);
      setShowInlineCreate(false);
      setShowCustomerPicker(false);
      setNewCustomerName('');
      setNewCustomerPhone('');
      toast('success', 'Customer created');
    },
    onError: () => toast('error', 'Failed to create customer'),
  });

  const saleMutation = useMutation({
    mutationFn: (payload: Parameters<typeof salesApi.createSale>[0]) =>
      salesApi.createSale(payload),
    onSuccess: (sale) => {
      queryClient.invalidateQueries({ queryKey: ['sales'] });
      queryClient.invalidateQueries({ queryKey: ['sales', 'daily-summary'] });
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      toast('success', 'Sale completed');
      setCompletedSale(sale);
      setShowPaymentConfirm(false);
      setShowReceipt(true);
    },
    onError: () => toast('error', 'Failed to process sale. Check stock levels.'),
  });

  const refocusBarcode = useCallback(() => {
    setTimeout(() => barcodeRef.current?.focus(), 50);
  }, []);

  useEffect(() => {
    barcodeRef.current?.focus();
  }, []);

  function addToCart(product: Product) {
    const unitPrice = getUnitPrice(product, saleType);
    setCart((prev) => {
      const existing = prev.find((i) => i.productId === product.id);
      if (existing) {
        return prev.map((i) =>
          i.productId === product.id ? { ...i, quantity: i.quantity + 1 } : i
        );
      }
      return [
        ...prev,
        { productId: product.id, name: product.name, sku: product.sku, quantity: 1, unitPrice, discountPct: 0 },
      ];
    });
    setBarcodeInput('');
    setBarcodeError('');
    setSuggestions([]);
    setShowSuggestions(false);
    refocusBarcode();
  }

  function handleBarcodeKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' && barcodeInput.trim()) {
      const code = barcodeInput.trim();
      setSuggestions([]);
      setShowSuggestions(false);
      const match = products.find(
        (p) => p.barcode === code || p.sku.toLowerCase() === code.toLowerCase()
      );
      if (match) {
        addToCart(match);
      } else {
        setBarcodeFlash(true);
        setBarcodeError(`"${code}" not found`);
        setBarcodeInput('');
        setTimeout(() => setBarcodeFlash(false), 600);
        refocusBarcode();
      }
    } else if (e.key === 'Escape') {
      setSuggestions([]);
      setShowSuggestions(false);
    }
  }

  function handleBarcodeChange(val: string) {
    setBarcodeInput(val);
    setBarcodeError('');
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!val.trim()) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }
    debounceRef.current = setTimeout(() => {
      const lower = val.toLowerCase();
      const results = products
        .filter(
          (p) =>
            p.name.toLowerCase().includes(lower) ||
            p.sku.toLowerCase().includes(lower) ||
            (p.barcode ?? '').toLowerCase().includes(lower)
        )
        .slice(0, 6);
      setSuggestions(results);
      setShowSuggestions(results.length > 0);
    }, 200);
  }

  function changeQty(productId: string, delta: number) {
    setCart((prev) =>
      prev
        .map((i) => (i.productId === productId ? { ...i, quantity: i.quantity + delta } : i))
        .filter((i) => i.quantity > 0)
    );
  }

  function setItemDiscount(productId: string, val: string) {
    const pct = Math.min(100, Math.max(0, Number(val) || 0));
    setCart((prev) =>
      prev.map((i) => (i.productId === productId ? { ...i, discountPct: pct } : i))
    );
  }

  function removeItem(productId: string) {
    setCart((prev) => prev.filter((i) => i.productId !== productId));
  }

  function resetSale() {
    setCart([]);
    setOrderDiscount('0');
    setSelectedCustomer(null);
    setCompletedSale(null);
    setShowReceipt(false);
    refocusBarcode();
  }

  const subtotal = cart.reduce((sum, i) => sum + lineTotal(i), 0);
  const orderDiscountAmt = subtotal * (Number(orderDiscount) / 100);
  const total = subtotal - orderDiscountAmt;
  const itemCount = cart.reduce((s, i) => s + i.quantity, 0);

  function handleProcessPayment() {
    saleMutation.mutate({
      type: saleType,
      customerId: selectedCustomer?.id,
      discount: Number(orderDiscount) || 0,
      items: cart.map((i) => ({
        productId: i.productId,
        quantity: i.quantity,
        discountPct: i.discountPct,
      })),
    });
  }

  const filteredCustomers = customers.filter((c) => {
    const tabMatch = customerTab === 'all' || c.type === customerTab;
    if (!customerSearch) return tabMatch;
    const s = customerSearch.toLowerCase();
    return (
      tabMatch &&
      (c.name.toLowerCase().includes(s) ||
        (c.phone ?? '').includes(s) ||
        (c.email ?? '').toLowerCase().includes(s))
    );
  });

  const cartSnapshot = [...cart];

  return (
    <div className="min-h-screen bg-bg flex flex-col">
      <header className="bg-surface border-b border-border px-6 py-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <ShoppingCart className="w-5 h-5 text-accent" />
          <span className="text-text font-semibold text-[16px]">POS Terminal</span>
        </div>
        <Badge
          label={saleType === 'retail' ? 'Retail' : 'Wholesale'}
          variant={saleType === 'retail' ? 'success' : 'info'}
        />
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* LEFT */}
        <div className="flex-1 flex flex-col gap-4 p-5 overflow-y-auto">
          {/* Sale type toggle */}
          <div className="flex border border-border rounded-lg overflow-hidden w-fit">
            {(['retail', 'wholesale'] as SaleType[]).map((t) => (
              <button
                key={t}
                onClick={() => {
                  setSaleType(t);
                  setCart((prev) =>
                    prev.map((item) => {
                      const p = products.find((pr) => pr.id === item.productId);
                      return p ? { ...item, unitPrice: getUnitPrice(p, t) } : item;
                    })
                  );
                }}
                className={`px-5 py-2 text-[13px] font-medium transition-colors capitalize ${
                  saleType === t ? 'bg-accent text-white' : 'bg-surface2 text-text2 hover:text-text'
                }`}
              >
                {t}
              </button>
            ))}
          </div>

          {/* Customer picker button */}
          <button
            onClick={() => setShowCustomerPicker(true)}
            className={`flex items-center gap-3 px-4 py-3 rounded-xl border text-left transition-colors w-full ${
              selectedCustomer ? 'border-border bg-surface2' : 'border-dashed border-border hover:border-accent/50'
            }`}
          >
            <User className="w-4 h-4 text-text3 shrink-0" />
            <div className="flex-1">
              {selectedCustomer ? (
                <div className="flex items-center gap-2">
                  <span className="text-text text-[13px] font-medium">{selectedCustomer.name}</span>
                  <Badge
                    label={selectedCustomer.type}
                    variant={selectedCustomer.type === 'wholesale' ? 'info' : 'success'}
                  />
                </div>
              ) : (
                <span className="text-text3 text-[13px]">Walk-in Customer</span>
              )}
            </div>
            {selectedCustomer ? (
              <button
                onClick={(e) => { e.stopPropagation(); setSelectedCustomer(null); }}
                className="text-text3 hover:text-danger transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            ) : (
              <ChevronRight className="w-4 h-4 text-text3" />
            )}
          </button>

          {/* Barcode input */}
          <div className="relative">
            <div className="relative">
              <Barcode className="absolute left-3 top-1/2 -translate-y-1/2 text-text3 w-5 h-5" />
              <input
                ref={barcodeRef}
                type="text"
                value={barcodeInput}
                onChange={(e) => handleBarcodeChange(e.target.value)}
                onKeyDown={handleBarcodeKeyDown}
                onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
                onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
                placeholder="Scan barcode or search product — press Enter to add"
                className={`w-full bg-surface border rounded-xl pl-10 pr-4 py-3 text-[14px] text-text placeholder-text3 focus:outline-none transition-all ${
                  barcodeFlash
                    ? 'border-danger ring-1 ring-danger'
                    : 'border-border focus:border-accent'
                }`}
              />
            </div>
            {barcodeError && (
              <p className="text-danger text-[12px] mt-1.5 ml-1">{barcodeError}</p>
            )}
            {showSuggestions && suggestions.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-surface border border-border rounded-xl shadow-2xl z-30 overflow-hidden">
                {suggestions.map((p) => {
                  const price = getUnitPrice(p, saleType);
                  return (
                    <button
                      key={p.id}
                      onMouseDown={() => addToCart(p)}
                      className="w-full flex items-center justify-between px-4 py-3 hover:bg-surface2 transition-colors text-left"
                    >
                      <div>
                        <p className="text-text text-[13px] font-medium">{p.name}</p>
                        <p className="text-text3 text-[11px] font-mono">{p.sku}</p>
                      </div>
                      <span className="text-success text-[13px] font-semibold">
                        Rs. {fmt(price)}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Cart */}
          {cart.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center py-20 text-center">
              <Barcode className="w-12 h-12 text-text3 opacity-30 mb-4" />
              <p className="text-text2 text-[14px]">Scan a product to begin</p>
              <p className="text-text3 text-[12px] mt-1">
                Use a barcode scanner or type in the search field above
              </p>
            </div>
          ) : (
            <div className="bg-surface border border-border rounded-xl overflow-hidden">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b border-border">
                    <th className="px-4 py-2.5 text-left text-[11px] font-medium text-text2 uppercase tracking-wider">Product</th>
                    <th className="px-4 py-2.5 text-right text-[11px] font-medium text-text2 uppercase tracking-wider">Unit Price</th>
                    <th className="px-4 py-2.5 text-center text-[11px] font-medium text-text2 uppercase tracking-wider">Qty</th>
                    <th className="px-4 py-2.5 text-center text-[11px] font-medium text-text2 uppercase tracking-wider w-20">Disc %</th>
                    <th className="px-4 py-2.5 text-right text-[11px] font-medium text-text2 uppercase tracking-wider">Total</th>
                    <th className="px-4 py-2.5 w-8" />
                  </tr>
                </thead>
                <tbody>
                  {cart.map((item) => (
                    <tr key={item.productId} className="border-b border-border/50">
                      <td className="px-4 py-3">
                        <p className="text-text text-[13px] font-medium">{item.name}</p>
                        <p className="text-text3 text-[11px] font-mono">{item.sku}</p>
                      </td>
                      <td className="px-4 py-3 text-right text-[13px] text-text2">
                        Rs. {fmt(item.unitPrice)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => changeQty(item.productId, -1)}
                            className="w-6 h-6 rounded-md border border-border bg-surface2 flex items-center justify-center hover:border-accent/50 transition-colors"
                          >
                            <Minus className="w-3 h-3 text-text2" />
                          </button>
                          <span className="text-text text-[13px] font-medium w-8 text-center">
                            {item.quantity}
                          </span>
                          <button
                            onClick={() => changeQty(item.productId, +1)}
                            className="w-6 h-6 rounded-md border border-border bg-surface2 flex items-center justify-center hover:border-accent/50 transition-colors"
                          >
                            <Plus className="w-3 h-3 text-text2" />
                          </button>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <input
                          type="number"
                          min="0"
                          max="100"
                          value={item.discountPct}
                          onChange={(e) => setItemDiscount(item.productId, e.target.value)}
                          className="w-16 bg-surface2 border border-border rounded-lg px-2 py-1 text-[12px] text-text text-center focus:outline-none focus:border-accent"
                        />
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="text-text text-[13px] font-semibold">
                          Rs. {fmt(lineTotal(item))}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => removeItem(item.productId)}
                          className="text-text3 hover:text-danger transition-colors"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* RIGHT — 300px */}
        <div className="w-75 shrink-0 flex flex-col gap-4 p-5 border-l border-border overflow-y-auto">
          {/* Customer info card */}
          <div
            className={`rounded-xl border p-4 ${
              selectedCustomer ? 'border-border bg-surface' : 'border-dashed border-border bg-surface/50'
            }`}
          >
            <p className="text-text3 text-[11px] uppercase tracking-wider mb-2">Customer</p>
            {selectedCustomer ? (
              <>
                <p className="text-text font-semibold text-[14px]">{selectedCustomer.name}</p>
                {selectedCustomer.phone && (
                  <p className="text-text2 text-[12px] mt-0.5">{selectedCustomer.phone}</p>
                )}
                <div className="mt-2">
                  <Badge
                    label={selectedCustomer.type}
                    variant={selectedCustomer.type === 'wholesale' ? 'info' : 'success'}
                  />
                </div>
                <p className="text-text3 text-[11px] mt-2">
                  Credit limit: Rs. {fmt(selectedCustomer.creditLimit)}
                </p>
              </>
            ) : (
              <p className="text-text2 text-[13px]">Walk-in Customer</p>
            )}
          </div>

          {/* Order summary */}
          <div className="bg-surface border border-border rounded-xl p-4 flex flex-col gap-3">
            <p className="text-text3 text-[11px] uppercase tracking-wider">Order Summary</p>
            <div className="flex justify-between text-[13px]">
              <span className="text-text2">Items</span>
              <span className="text-text font-medium">{itemCount}</span>
            </div>
            <div className="flex justify-between text-[13px]">
              <span className="text-text2">Subtotal</span>
              <span className="text-text">Rs. {fmt(subtotal)}</span>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-text2 text-[13px] shrink-0">Discount %</label>
              <input
                type="number"
                min="0"
                max="100"
                value={orderDiscount}
                onChange={(e) => setOrderDiscount(e.target.value)}
                className="flex-1 bg-surface2 border border-border rounded-lg px-2 py-1 text-[12px] text-text text-center focus:outline-none focus:border-accent"
              />
            </div>
            {Number(orderDiscount) > 0 && (
              <div className="flex justify-between text-[13px]">
                <span className="text-text2">Discount</span>
                <span className="text-danger">-Rs. {fmt(orderDiscountAmt)}</span>
              </div>
            )}
            <div className="border-t border-border pt-3 flex justify-between items-baseline">
              <span className="text-text2 text-[13px]">Total</span>
              <span className="text-success text-[24px] font-bold">Rs. {fmt(total)}</span>
            </div>
          </div>

          <button
            onClick={() => setShowPaymentConfirm(true)}
            disabled={cart.length === 0}
            className="w-full py-3 bg-success hover:bg-success/90 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold text-[14px] rounded-xl transition-colors"
          >
            Process Payment
          </button>

          <button
            onClick={() => { setCart([]); setOrderDiscount('0'); }}
            disabled={cart.length === 0}
            className="w-full py-2 text-text3 hover:text-danger disabled:opacity-30 disabled:cursor-not-allowed text-[13px] transition-colors"
          >
            Void / Clear Cart
          </button>
        </div>
      </div>

      {/* Customer Picker Modal */}
      <Modal
        isOpen={showCustomerPicker}
        onClose={() => { setShowCustomerPicker(false); setShowInlineCreate(false); }}
        title="Select Customer"
        size="md"
      >
        <div className="flex flex-col gap-4">
          <SearchInput
            value={customerSearch}
            onChange={setCustomerSearch}
            placeholder="Search name, phone, email…"
          />
          <div className="flex gap-1 bg-surface2 rounded-lg p-1">
            {(['all', 'retail', 'wholesale'] as CustomerPickerTab[]).map((t) => (
              <button
                key={t}
                onClick={() => setCustomerTab(t)}
                className={`flex-1 py-1.5 text-[12px] font-medium rounded-md capitalize transition-colors ${
                  customerTab === t ? 'bg-surface text-text shadow-sm' : 'text-text2 hover:text-text'
                }`}
              >
                {t}
              </button>
            ))}
          </div>

          <button
            onClick={() => { setSelectedCustomer(null); setShowCustomerPicker(false); }}
            className="flex items-center gap-3 px-4 py-3 bg-surface2 border border-border rounded-xl hover:border-accent/50 transition-colors text-left"
          >
            <div className="w-8 h-8 rounded-full bg-surface flex items-center justify-center border border-border">
              <User className="w-4 h-4 text-text3" />
            </div>
            <div>
              <p className="text-text text-[13px] font-medium">Walk-in Customer</p>
              <p className="text-text3 text-[11px]">No account needed</p>
            </div>
          </button>

          <div className="flex flex-col gap-1 max-h-56 overflow-y-auto">
            {filteredCustomers.length === 0 ? (
              <p className="text-text3 text-[13px] text-center py-6">No customers found</p>
            ) : (
              filteredCustomers.map((c) => (
                <button
                  key={c.id}
                  onClick={() => {
                    setSelectedCustomer(c);
                    setShowCustomerPicker(false);
                    if (c.type !== saleType) setSaleType(c.type);
                  }}
                  className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-surface2 transition-colors text-left"
                >
                  <div className="w-8 h-8 rounded-full bg-accent/10 flex items-center justify-center">
                    <span className="text-accent text-[12px] font-bold">
                      {c.name.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div className="flex-1">
                    <p className="text-text text-[13px] font-medium">{c.name}</p>
                    <p className="text-text3 text-[11px]">{c.phone ?? c.email ?? ''}</p>
                  </div>
                  <Badge label={c.type} variant={c.type === 'wholesale' ? 'info' : 'success'} />
                </button>
              ))
            )}
          </div>

          {showInlineCreate ? (
            <div className="border border-border rounded-xl p-4 flex flex-col gap-3">
              <p className="text-text text-[13px] font-semibold">New Customer</p>
              <input
                type="text"
                placeholder="Name *"
                value={newCustomerName}
                onChange={(e) => setNewCustomerName(e.target.value)}
                className="bg-surface2 border border-border rounded-lg px-3 py-2 text-[13px] text-text focus:outline-none focus:border-accent"
              />
              <input
                type="text"
                placeholder="Phone"
                value={newCustomerPhone}
                onChange={(e) => setNewCustomerPhone(e.target.value)}
                className="bg-surface2 border border-border rounded-lg px-3 py-2 text-[13px] text-text focus:outline-none focus:border-accent"
              />
              <div className="flex gap-2">
                {(['retail', 'wholesale'] as CustomerType[]).map((t) => (
                  <button
                    key={t}
                    onClick={() => setNewCustomerType(t)}
                    className={`flex-1 py-1.5 rounded-lg text-[12px] font-medium capitalize border transition-colors ${
                      newCustomerType === t
                        ? 'bg-accent text-white border-accent'
                        : 'bg-surface2 text-text2 border-border'
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowInlineCreate(false)}
                  className="flex-1 py-2 bg-surface2 border border-border text-text2 rounded-lg text-[13px]"
                >
                  Cancel
                </button>
                <button
                  disabled={!newCustomerName.trim() || createCustomerMutation.isPending}
                  onClick={() =>
                    createCustomerMutation.mutate({
                      name: newCustomerName.trim(),
                      phone: newCustomerPhone || undefined,
                      type: newCustomerType,
                    })
                  }
                  className="flex-1 py-2 bg-accent text-white rounded-lg text-[13px] font-medium disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {createCustomerMutation.isPending && <Spinner size="sm" />}
                  Save
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setShowInlineCreate(true)}
              className="text-accent text-[13px] hover:underline text-center py-1"
            >
              + Add New Customer
            </button>
          )}
        </div>
      </Modal>

      {/* Payment Confirmation Modal */}
      <Modal
        isOpen={showPaymentConfirm}
        onClose={() => { if (!saleMutation.isPending) setShowPaymentConfirm(false); }}
        title="Confirm Payment"
        size="sm"
        footer={
          <div className="flex gap-3">
            <button
              onClick={() => setShowPaymentConfirm(false)}
              disabled={saleMutation.isPending}
              className="flex-1 py-2.5 bg-surface2 border border-border text-text rounded-lg text-[13px] font-medium hover:bg-border transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleProcessPayment}
              disabled={saleMutation.isPending}
              className="flex-1 py-2.5 bg-success text-white rounded-lg text-[13px] font-semibold flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {saleMutation.isPending && <Spinner size="sm" />}
              {saleMutation.isPending ? 'Processing…' : 'Confirm & Pay'}
            </button>
          </div>
        }
      >
        <div className="flex flex-col gap-4">
          <div className="bg-surface2 rounded-xl p-4 flex flex-col gap-2">
            <div className="flex justify-between text-[13px]">
              <span className="text-text2">Customer</span>
              <span className="text-text">{selectedCustomer?.name ?? 'Walk-in'}</span>
            </div>
            <div className="flex justify-between text-[13px]">
              <span className="text-text2">Type</span>
              <Badge label={saleType} variant={saleType === 'retail' ? 'success' : 'info'} />
            </div>
            <div className="flex justify-between text-[13px]">
              <span className="text-text2">Items</span>
              <span className="text-text">{itemCount}</span>
            </div>
            {Number(orderDiscount) > 0 && (
              <div className="flex justify-between text-[13px]">
                <span className="text-text2">Discount</span>
                <span className="text-danger">{orderDiscount}%</span>
              </div>
            )}
          </div>
          <div className="text-center">
            <p className="text-text3 text-[12px] mb-1">Total Amount</p>
            <p className="text-success text-[32px] font-bold">Rs. {fmt(total)}</p>
          </div>
        </div>
      </Modal>

      {/* Receipt Modal */}
      <Modal isOpen={showReceipt} onClose={resetSale} title="Payment Successful" size="sm">
        {completedSale && (
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-center py-2">
              <CheckCircle className="w-12 h-12 text-success" />
            </div>
            <div className="bg-surface2 rounded-xl p-4 flex flex-col gap-2 text-[13px]">
              <div className="flex justify-between font-mono">
                <span className="text-text2">Invoice</span>
                <span className="text-accent font-semibold">{completedSale.invoiceNumber}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text2">Customer</span>
                <span className="text-text">{completedSale.customer?.name ?? 'Walk-in'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text2">Type</span>
                <Badge
                  label={completedSale.type}
                  variant={completedSale.type === 'retail' ? 'success' : 'info'}
                />
              </div>
              <div className="border-t border-border pt-2 mt-1 space-y-1">
                {cartSnapshot.map((item) => (
                  <div key={item.productId} className="flex justify-between text-[12px]">
                    <span className="text-text2 truncate max-w-[60%]">
                      {item.name} x{item.quantity}
                    </span>
                    <span className="text-text">Rs. {fmt(lineTotal(item))}</span>
                  </div>
                ))}
              </div>
              <div className="border-t border-border pt-2 flex justify-between font-semibold">
                <span className="text-text">Total</span>
                <span className="text-success">Rs. {fmt(completedSale.totalAmount)}</span>
              </div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => window.print()}
                className="flex-1 py-2.5 bg-surface2 border border-border text-text rounded-lg text-[13px] font-medium flex items-center justify-center gap-2 hover:bg-border transition-colors"
              >
                <Printer className="w-4 h-4" />
                Print
              </button>
              <button
                onClick={resetSale}
                className="flex-1 py-2.5 bg-accent text-white rounded-lg text-[13px] font-semibold hover:bg-accent/90 transition-colors"
              >
                New Sale
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
