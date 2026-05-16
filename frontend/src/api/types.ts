// Shared TypeScript interfaces matching backend response shapes

export type UserRole = 'admin' | 'manager' | 'cashier' | 'warehouse' | 'viewer';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
}

export interface LoginResponse {
  accessToken: string;
  user: AuthUser;
}

// Categories
export interface Category {
  id: string;
  name: string;
  description: string | null;
  parentId: string | null;
  parent?: Category | null;
  children?: Category[];
  _count?: { products: number };
}

// Suppliers
export interface Supplier {
  id: string;
  name: string;
  contactPerson: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  creditLimit: string | null;
  createdAt: string;
  _count?: { products: number };
  products?: Product[];
}

// Products
export interface PriceHistory {
  id: string;
  costPrice: string;
  retailPrice: string;
  wholesalePrice: string;
  note: string | null;
  effectiveFrom: string;
  changedBy?: AuthUser;
}

export interface Product {
  id: string;
  name: string;
  sku: string;
  barcode: string | null;
  description: string | null;
  unit: string | null;
  reorderPoint: number;
  categoryId: string;
  supplierId: string;
  deletedAt: string | null;
  category?: Category;
  supplier?: Supplier;
  priceHistory?: PriceHistory[];
  currentStock?: number;
  stockValue?: string;
  isLowStock?: boolean;
  isOutOfStock?: boolean;
}

// Inventory
export type MovementType =
  | 'purchase'
  | 'sale'
  | 'adjustment_in'
  | 'adjustment_out'
  | 'return_in'
  | 'return_out';

export interface StockMovement {
  id: string;
  productId: string;
  type: MovementType;
  quantity: number;
  unitCost: string | null;
  reference: string | null;
  notes: string | null;
  createdAt: string;
  performedBy?: AuthUser;
  product?: { id: string; name: string; sku: string };
}

export interface InventoryProduct {
  id: string;
  name: string;
  sku: string;
  unit: string | null;
  reorderPoint: number;
  currentStock: number;
  stockValue: string;
  isLowStock: boolean;
  isOutOfStock: boolean;
  category?: Category;
  supplier?: Supplier;
  priceHistory?: PriceHistory[];
}

export interface ValuationCategory {
  categoryId: string;
  categoryName: string;
  totalValue: string;
  productCount: number;
}

export interface ValuationData {
  totalValue: string;
  productCount: number;
  byCategory: ValuationCategory[];
}

// Purchase Orders
export type PurchaseStatus = 'draft' | 'approved' | 'received' | 'cancelled';

export interface PurchaseItem {
  id: string;
  productId: string;
  quantityOrdered: number;
  quantityReceived: number | null;
  unitCost: string;
  product?: { id: string; name: string; sku: string };
}

export interface PurchaseOrder {
  id: string;
  orderNumber: string;
  supplierId: string;
  supplierReference: string | null;
  status: PurchaseStatus;
  notes: string | null;
  expectedAt: string | null;
  approvedAt: string | null;
  receivedAt: string | null;
  cancelledAt: string | null;
  createdAt: string;
  supplier?: Supplier;
  items?: PurchaseItem[];
  createdBy?: AuthUser;
  approvedBy?: AuthUser;
}

// Sales
export type SaleType = 'retail' | 'wholesale';

export interface SaleItem {
  id: string;
  productId: string;
  quantity: number;
  unitPrice: string;
  discountPct: string;
  lineTotal: string;
  product?: { id: string; name: string; sku: string };
}

export interface Sale {
  id: string;
  invoiceNumber: string;
  customerId: string | null;
  type: SaleType;
  discount: string;
  totalAmount: string;
  notes: string | null;
  createdAt: string;
  customer?: Customer;
  items?: SaleItem[];
  createdBy?: AuthUser;
}

export interface DailySummary {
  date: string;
  revenue: string;
  orderCount: number;
  retailCount: number;
  wholesaleCount: number;
}

// Customers
export type CustomerType = 'retail' | 'wholesale';

export interface Customer {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  type: CustomerType;
  creditLimit: string;
  createdAt: string;
  _count?: { sales: number };
  sales?: Sale[];
}

// Reports
export interface DashboardData {
  today: {
    revenue: string;
    orderCount: number;
    retailCount: number;
    wholesaleCount: number;
  };
  thisMonth: {
    revenue: string;
    orderCount: number;
  };
  inventory: {
    totalProducts: number;
    lowStockCount: number;
    pendingPurchaseOrders: number;
    totalValue?: string;
  };
  recentActivity: AuditLog[];
}

export interface ProfitLossSummary {
  revenue: string;
  cogs: string;
  grossProfit: string;
  marginPct: string;
}

export interface ProfitLossProduct {
  productId: string;
  productName: string;
  unitsSold: number;
  revenue: string;
  cogs: string;
  profit: string;
  marginPct: string;
}

export interface ProfitLossData {
  period: { from: string; to: string };
  summary: ProfitLossSummary;
  byProduct: ProfitLossProduct[];
}

export interface TopProduct {
  productId: string;
  productName: string;
  unitsSold: number;
  revenue: string;
  avgPrice: string;
  orderCount: number;
}

export interface SlowMovingProduct {
  productId: string;
  productName: string;
  categoryName: string;
  currentStock: number;
  stockValue: string;
  lastSoldAt: string | null;
  daysSinceLastSale: number | null;
}

// Audit
export interface AuditLog {
  id: string;
  action: string;
  tableName: string;
  recordId: string;
  userId: string;
  ipAddress: string;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  createdAt: string;
  user?: AuthUser;
}

// Users (admin management)
export interface AppUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  createdAt: string;
  deletedAt: string | null;
}
