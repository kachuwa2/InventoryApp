import { useState, useEffect } from 'react';
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Package, Tag, Truck, Warehouse, ShoppingCart,
  Users, BarChart2, ClipboardList, LogOut, BookOpen, FileText,
  Bell, Activity, PieChart,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { ToastContainer } from '../components/ui/Toast';
import { Badge, statusVariant } from '../components/ui/Badge';
import { Spinner } from '../components/ui/Spinner';
import type { UserRole } from '../api/types';

// ─── Nav structure ────────────────────────────────────────────────────────────

interface NavItem {
  to: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  roles: UserRole[];
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

const ALL: UserRole[]      = ['admin', 'manager', 'cashier', 'warehouse', 'viewer'];
const ADMIN_MGR: UserRole[] = ['admin', 'manager'];
const POS_ROLES: UserRole[] = ['admin', 'manager', 'cashier'];

const navGroups: NavGroup[] = [
  {
    label: 'Overview',
    items: [
      { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard', roles: ADMIN_MGR },
    ],
  },
  {
    label: 'Catalog',
    items: [
      { to: '/products',   icon: Package,       label: 'Products',    roles: ALL },
      { to: '/categories', icon: Tag,            label: 'Categories',  roles: ADMIN_MGR },
      { to: '/suppliers',  icon: Truck,          label: 'Suppliers',   roles: ADMIN_MGR },
    ],
  },
  {
    label: 'Operations',
    items: [
      { to: '/inventory',  icon: Warehouse,      label: 'Inventory',         roles: ALL },
      { to: '/purchases',  icon: ClipboardList,  label: 'Purchase Orders',   roles: ALL },
    ],
  },
  {
    label: 'Sales',
    items: [
      { to: '/pos',   icon: ShoppingCart, label: 'POS Checkout',  roles: POS_ROLES },
      { to: '/sales', icon: FileText,     label: 'Sales History', roles: ALL },
    ],
  },
  {
    label: 'Customers',
    items: [
      { to: '/customers', icon: BookOpen, label: 'Customers', roles: ALL },
    ],
  },
  {
    label: 'Reports',
    items: [
      { to: '/reports',              icon: BarChart2,  label: 'Analytics',    roles: ADMIN_MGR },
      { to: '/reports/sales-audit', icon: PieChart,   label: 'Sales Audit',  roles: ADMIN_MGR },
      { to: '/audit',               icon: Activity,   label: 'Audit Log',    roles: ['admin'] },
    ],
  },
  {
    label: 'Admin',
    items: [
      { to: '/users', icon: Users, label: 'User Management', roles: ['admin'] },
    ],
  },
];

// ─── Breadcrumb ───────────────────────────────────────────────────────────────

type Crumb = { label: string; muted?: boolean };

function getBreadcrumbs(path: string): Crumb[] {
  if (path === '/dashboard')        return [{ label: 'Dashboard' }];
  if (path === '/products')         return [{ label: 'Products' }];
  if (path === '/categories')       return [{ label: 'Catalog', muted: true }, { label: 'Categories' }];
  if (path === '/suppliers')        return [{ label: 'Catalog', muted: true }, { label: 'Suppliers' }];
  if (path === '/inventory')        return [{ label: 'Operations', muted: true }, { label: 'Inventory' }];
  if (path === '/purchases')        return [{ label: 'Operations', muted: true }, { label: 'Purchase Orders' }];
  if (path === '/purchases/new')    return [{ label: 'Operations', muted: true }, { label: 'Purchase Orders', muted: true }, { label: 'New Order' }];
  if (path.startsWith('/purchases/')) return [{ label: 'Operations', muted: true }, { label: 'Purchase Orders', muted: true }, { label: 'Detail' }];
  if (path === '/pos')              return [{ label: 'Sales', muted: true }, { label: 'POS Checkout' }];
  if (path === '/sales')            return [{ label: 'Sales', muted: true }, { label: 'History' }];
  if (path === '/customers')        return [{ label: 'Customers' }];
  if (path === '/reports')                return [{ label: 'Reports', muted: true }, { label: 'Analytics' }];
  if (path === '/reports/sales-audit')   return [{ label: 'Reports', muted: true }, { label: 'Sales Audit' }];
  if (path === '/audit')                 return [{ label: 'Reports', muted: true }, { label: 'Audit Log' }];
  if (path === '/users')            return [{ label: 'Admin', muted: true }, { label: 'User Management' }];
  return [];
}

function Breadcrumb() {
  const { pathname } = useLocation();
  const crumbs = getBreadcrumbs(pathname);
  if (crumbs.length === 0) return null;
  return (
    <div className="flex items-center gap-1.5 text-[13px]">
      {crumbs.map((crumb, i) => (
        <span key={i} className="flex items-center gap-1.5">
          {i > 0 && <span className="text-text3">/</span>}
          <span
            style={{
              color: i === crumbs.length - 1 ? 'var(--text)' : 'var(--text2)',
              fontWeight: i === crumbs.length - 1 ? 500 : 400,
            }}
          >
            {crumb.label}
          </span>
        </span>
      ))}
    </div>
  );
}

// ─── Clock ────────────────────────────────────────────────────────────────────

function ClockWidget() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  return (
    <span className="text-[12px] text-text3 font-mono tabular-nums">
      {now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
    </span>
  );
}

// ─── AppLayout ────────────────────────────────────────────────────────────────

export function AppLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [isLoggingOut, setIsLoggingOut]       = useState(false);

  async function handleLogout() {
    setIsLoggingOut(true);
    try {
      await logout();
      navigate('/login', { replace: true });
    } catch {
      navigate('/login', { replace: true });
    } finally {
      setIsLoggingOut(false);
      setShowLogoutModal(false);
    }
  }

  const role = user?.role ?? 'viewer';
  const initials = user?.name?.[0]?.toUpperCase() ?? '?';

  return (
    <div className="flex h-screen bg-bg overflow-hidden">

      {/* ── Sidebar ───────────────────────────────────────── */}
      <aside
        className="shrink-0 bg-surface border-r border-border flex flex-col h-full overflow-hidden"
        style={{ width: 240 }}
      >
        {/* Logo */}
        <div className="px-5 py-5 border-b border-border shrink-0">
          <div className="flex items-center gap-2.5">
            <div
              className="w-2 h-2 rounded-full shrink-0"
              style={{ background: 'var(--accent)' }}
            />
            <span className="text-[18px] font-bold text-text tracking-tight">StockFlow</span>
          </div>
          <p className="text-[11px] text-text3 mt-0.5 pl-4.5">Kitchen Utensils</p>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-3">
          {navGroups.map((group) => {
            const visible = group.items.filter((item) => item.roles.includes(role));
            if (visible.length === 0) return null;
            return (
              <div key={group.label} className="mb-2">
                <p className="text-[10px] font-semibold text-text3 uppercase tracking-widest px-5 py-2">
                  {group.label}
                </p>
                {visible.map((item) => {
                  const Icon = item.icon;
                  return (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      className={({ isActive }) =>
                        `flex items-center gap-3 mx-2.5 px-3 py-2.5 rounded-lg text-[14px] transition-all mb-0.5 ${
                          isActive
                            ? 'font-medium text-accent'
                            : 'text-text2 hover:bg-surface2 hover:text-text'
                        }`
                      }
                      style={({ isActive }) =>
                        isActive
                          ? {
                              background: 'var(--accent-glow)',
                              border: '1px solid rgba(124,110,248,0.2)',
                            }
                          : { border: '1px solid transparent' }
                      }
                    >
                      {({ isActive }) => (
                        <>
                          <Icon
                            className={`w-4.5 h-4.5 shrink-0 ${isActive ? 'text-accent' : 'text-text3'}`}
                          />
                          <span className="flex-1 truncate">{item.label}</span>
                        </>
                      )}
                    </NavLink>
                  );
                })}
              </div>
            );
          })}
        </nav>

        {/* User section */}
        <div className="border-t border-border px-5 py-4 shrink-0">
          {/* Avatar + name */}
          <div className="flex items-center gap-3 mb-3">
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center text-[15px] font-semibold text-accent shrink-0"
              style={{
                background: 'var(--accent-glow)',
                border: '1px solid rgba(124,110,248,0.3)',
              }}
            >
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[14px] font-medium text-text truncate">{user?.name}</p>
              <Badge label={role} variant={statusVariant(role)} />
            </div>
          </div>

          {/* Logout button */}
          <button
            onClick={() => setShowLogoutModal(true)}
            className="w-full flex items-center gap-2 px-3.5 py-2.5 rounded-lg text-[13px] text-text2 border border-border transition-all hover:bg-(--red-bg) hover:border-(--red-border) hover:text-danger"
          >
            <LogOut className="w-4 h-4 shrink-0" />
            Sign out
          </button>
        </div>
      </aside>

      {/* ── Main content ──────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">

        {/* Top bar */}
        <header className="h-15 shrink-0 bg-surface border-b border-border flex items-center justify-between px-6">
          <Breadcrumb />

          <div className="flex items-center gap-4">
            <button className="text-text3 hover:text-text2 transition-colors p-1" title="Notifications">
              <Bell className="w-4 h-4" />
            </button>
            <div className="w-px h-6 bg-border" />
            <ClockWidget />
          </div>
        </header>

        {/* Page content — key on pathname triggers fadeIn on route change */}
        <main key={location.pathname} className="flex-1 overflow-y-auto p-6 page-enter">
          <Outlet />
        </main>
      </div>

      <ToastContainer />

      {/* Logout confirm modal */}
      {showLogoutModal && (
        <div
          className="fixed inset-0 bg-black/70 backdrop-blur-xs z-50 flex items-center justify-center p-6"
          onClick={() => { if (!isLoggingOut) setShowLogoutModal(false); }}
        >
          <div
            className="bg-surface border border-border2 rounded-xl p-0 max-w-sm w-full page-enter"
            style={{ boxShadow: '0 8px 32px rgba(0,0,0,0.6)' }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-5 border-b border-border">
              <h3 className="text-[16px] font-semibold text-text">Sign out?</h3>
            </div>
            {/* Body */}
            <div className="px-6 py-5">
              <p className="text-[14px] text-text2">
                Are you sure you want to sign out? You'll need to log in again to continue.
              </p>
            </div>
            {/* Footer */}
            <div className="px-6 py-4 border-t border-border flex justify-end gap-2.5">
              <button
                onClick={() => setShowLogoutModal(false)}
                disabled={isLoggingOut}
                className="px-4 py-2 bg-surface2 border border-border text-text rounded-lg text-[13px] font-medium hover:bg-border2 transition-colors disabled:opacity-50"
              >
                Stay
              </button>
              <button
                onClick={handleLogout}
                disabled={isLoggingOut}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-[13px] font-medium transition-colors disabled:opacity-50"
                style={{ background: 'var(--red-bg)', border: '1px solid var(--red-border)', color: 'var(--red)' }}
              >
                {isLoggingOut ? (
                  <><Spinner size="sm" /> Signing out…</>
                ) : (
                  <><LogOut className="w-3.5 h-3.5" /> Sign out</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
