import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Package, Tag, Truck, Warehouse, ShoppingCart,
  Users, BarChart2, ClipboardList, LogOut, ChevronRight,
  BookOpen, FileText,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { ToastContainer } from '../components/ui/Toast';
import { Badge, statusVariant } from '../components/ui/Badge';
import type { UserRole } from '../api/types';

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

const ALL: UserRole[] = ['admin', 'manager', 'cashier', 'warehouse', 'viewer'];
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
      { to: '/products', icon: Package, label: 'Products', roles: ALL },
      { to: '/categories', icon: Tag, label: 'Categories', roles: ADMIN_MGR },
      { to: '/suppliers', icon: Truck, label: 'Suppliers', roles: ADMIN_MGR },
    ],
  },
  {
    label: 'Operations',
    items: [
      { to: '/inventory', icon: Warehouse, label: 'Inventory', roles: ALL },
      { to: '/purchases', icon: ClipboardList, label: 'Purchase Orders', roles: ALL },
    ],
  },
  {
    label: 'Sales',
    items: [
      { to: '/pos', icon: ShoppingCart, label: 'POS Checkout', roles: POS_ROLES },
      { to: '/sales', icon: FileText, label: 'Sales History', roles: ALL },
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
      { to: '/reports', icon: BarChart2, label: 'Analytics', roles: ADMIN_MGR },
      { to: '/audit', icon: ClipboardList, label: 'Audit Log', roles: ['admin'] },
    ],
  },
  {
    label: 'Admin',
    items: [
      { to: '/users', icon: Users, label: 'User Management', roles: ['admin'] },
    ],
  },
];

export function AppLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  async function handleLogout() {
    await logout();
    navigate('/login', { replace: true });
  }

  const role = user?.role ?? 'viewer';

  return (
    <div className="flex h-screen bg-bg overflow-hidden">
      {/* Sidebar */}
      <aside className="w-55 shrink-0 bg-surface border-r border-border flex flex-col h-full">
        {/* Logo */}
        <div className="px-4 py-5 border-b border-border">
          <div className="text-[16px] font-bold text-text tracking-tight">StockFlow</div>
          <div className="text-[11px] text-text3 mt-0.5">Kitchen Utensils</div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-3 px-2">
          {navGroups.map((group) => {
            const visible = group.items.filter((item) => item.roles.includes(role));
            if (visible.length === 0) return null;
            return (
              <div key={group.label} className="mb-4">
                <p className="text-[10px] font-semibold text-text3 uppercase tracking-widest px-2 mb-1.5">
                  {group.label}
                </p>
                {visible.map((item) => {
                  const Icon = item.icon;
                  return (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      className={({ isActive }) =>
                        `flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[13px] font-medium transition-colors mb-0.5 group ${
                          isActive
                            ? 'bg-accent/15 text-accent'
                            : 'text-text2 hover:bg-surface2 hover:text-text'
                        }`
                      }
                    >
                      <Icon className="w-4 h-4 shrink-0" />
                      <span className="flex-1 truncate">{item.label}</span>
                      <ChevronRight className="w-3 h-3 opacity-0 group-hover:opacity-50 transition-opacity" />
                    </NavLink>
                  );
                })}
              </div>
            );
          })}
        </nav>

        {/* User footer */}
        <div className="border-t border-border p-3">
          <div className="flex items-center gap-2.5 px-2 py-2 rounded-lg hover:bg-surface2 transition-colors">
            <div className="w-7 h-7 rounded-full bg-accent/20 flex items-center justify-center text-accent text-[12px] font-bold shrink-0">
              {user?.name?.[0]?.toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-medium text-text truncate">{user?.name}</p>
              <Badge label={role} variant={statusVariant(role)} />
            </div>
            <button
              onClick={handleLogout}
              className="text-text3 hover:text-danger transition-colors p-1"
              title="Sign out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        {/* Top bar */}
        <header className="h-14 shrink-0 bg-surface border-b border-border flex items-center px-6">
          <div className="flex-1" />
          <div className="flex items-center gap-3 text-[13px] text-text2">
            <span>{user?.name}</span>
            <span className="text-border">·</span>
            <Badge label={role} variant={statusVariant(role)} />
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>

      <ToastContainer />
    </div>
  );
}
