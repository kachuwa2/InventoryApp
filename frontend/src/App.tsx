import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ToastProvider } from './contexts/ToastContext';
import { AppLayout } from './layouts/AppLayout';
import { ProtectedRoute } from './components/ProtectedRoute';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Spinner } from './components/ui/Spinner';
import { FullPageSpinner } from './components/ui/FullPageSpinner';
import * as authApi from './api/auth';

const LoginPage       = lazy(() => import('./pages/LoginPage').then((m) => ({ default: m.LoginPage })));
const RegisterPage    = lazy(() => import('./pages/RegisterPage').then((m) => ({ default: m.RegisterPage })));
const DashboardPage   = lazy(() => import('./pages/dashboard/DashboardPage').then((m) => ({ default: m.DashboardPage })));
const ProductsPage    = lazy(() => import('./pages/products/ProductsPage').then((m) => ({ default: m.ProductsPage })));
const CategoriesPage  = lazy(() => import('./pages/categories/CategoriesPage').then((m) => ({ default: m.CategoriesPage })));
const SuppliersPage   = lazy(() => import('./pages/suppliers/SuppliersPage').then((m) => ({ default: m.SuppliersPage })));
const InventoryPage   = lazy(() => import('./pages/inventory/InventoryPage').then((m) => ({ default: m.InventoryPage })));
const PurchasesPage   = lazy(() => import('./pages/purchases/PurchasesPage').then((m) => ({ default: m.PurchasesPage })));
const NewPurchasePage = lazy(() => import('./pages/purchases/NewPurchasePage').then((m) => ({ default: m.NewPurchasePage })));
const PurchaseDetailPage = lazy(() => import('./pages/purchases/PurchaseDetailPage').then((m) => ({ default: m.PurchaseDetailPage })));
const PosPage         = lazy(() => import('./pages/pos/PosPage').then((m) => ({ default: m.PosPage })));
const SalesPage       = lazy(() => import('./pages/sales/SalesPage').then((m) => ({ default: m.SalesPage })));
const CustomersPage   = lazy(() => import('./pages/customers/CustomersPage').then((m) => ({ default: m.CustomersPage })));
const ReportsPage     = lazy(() => import('./pages/reports/ReportsPage').then((m) => ({ default: m.ReportsPage })));
const AuditPage       = lazy(() => import('./pages/audit/AuditPage').then((m) => ({ default: m.AuditPage })));
const UsersPage       = lazy(() => import('./pages/users/UsersPage').then((m) => ({ default: m.UsersPage })));
const NotFoundPage    = lazy(() => import('./pages/NotFoundPage').then((m) => ({ default: m.NotFoundPage })));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
      refetchOnWindowFocus: true,
    },
  },
});

function PageLoader() {
  return (
    <div className="flex items-center justify-center h-40">
      <Spinner />
    </div>
  );
}

function RoleRedirect() {
  const { user, loading } = useAuth();
  if (loading) return <PageLoader />;
  if (!user) return <Navigate to="/login" replace />;
  if (user.role === 'cashier') return <Navigate to="/pos" replace />;
  if (user.role === 'warehouse') return <Navigate to="/inventory" replace />;
  if (user.role === 'viewer') return <Navigate to="/products" replace />;
  return <Navigate to="/dashboard" replace />;
}

// Allows access to /register for: (a) admin users, (b) first-time setup (no users exist).
function RegisterRoute() {
  const { user, loading } = useAuth();
  const { data: setupStatus, isLoading: statusLoading } = useQuery({
    queryKey: ['setup-status'],
    queryFn: authApi.getSetupStatus,
    staleTime: Infinity,
  });

  if (loading || statusLoading) return <FullPageSpinner />;
  if (user?.role === 'admin') return <RegisterPage />;
  if (setupStatus?.hasUsers === false) return <RegisterPage />;
  if (!user) return <Navigate to="/login" replace />;
  // logged-in non-admin — redirect to their home
  const fallback =
    user.role === 'cashier' ? '/pos'
    : user.role === 'warehouse' ? '/inventory'
    : user.role === 'viewer' ? '/products'
    : '/dashboard';
  return <Navigate to={fallback} replace />;
}

function AppWithAuth() {
  const { loading } = useAuth();
  if (loading) return <FullPageSpinner />;
  return (
    <Suspense fallback={<div className="min-h-screen bg-bg flex items-center justify-center"><Spinner size="lg" /></div>}>
      <Routes>
        {/* Public */}
        <Route path="/login"    element={<LoginPage />} />
        <Route path="/register" element={<RegisterRoute />} />

        {/* Protected — all roles */}
        <Route element={<ProtectedRoute />}>
          <Route element={<AppLayout />}>
            <Route path="/products"  element={<ProductsPage />} />
            <Route path="/inventory" element={<ErrorBoundary><InventoryPage /></ErrorBoundary>} />
            <Route path="/purchases" element={<PurchasesPage />} />
            <Route path="/purchases/:id" element={<PurchaseDetailPage />} />
            <Route path="/sales"     element={<SalesPage />} />
            <Route path="/customers" element={<CustomersPage />} />
          </Route>
        </Route>

        {/* Admin + Manager */}
        <Route element={<ProtectedRoute roles={['admin', 'manager']} />}>
          <Route element={<AppLayout />}>
            <Route path="/dashboard"     element={<DashboardPage />} />
            <Route path="/categories"    element={<CategoriesPage />} />
            <Route path="/suppliers"     element={<SuppliersPage />} />
            <Route path="/purchases/new" element={<NewPurchasePage />} />
            <Route path="/reports"       element={<ReportsPage />} />
          </Route>
        </Route>

        {/* POS roles */}
        <Route element={<ProtectedRoute roles={['admin', 'manager', 'cashier']} />}>
          <Route element={<AppLayout />}>
            <Route path="/pos" element={<PosPage />} />
          </Route>
        </Route>

        {/* Admin only */}
        <Route element={<ProtectedRoute roles={['admin']} />}>
          <Route element={<AppLayout />}>
            <Route path="/audit" element={<AuditPage />} />
            <Route path="/users" element={<UsersPage />} />
          </Route>
        </Route>

        {/* Default */}
        <Route path="/" element={<RoleRedirect />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </Suspense>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <ToastProvider>
          <AuthProvider>
            <AppWithAuth />
          </AuthProvider>
        </ToastProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
