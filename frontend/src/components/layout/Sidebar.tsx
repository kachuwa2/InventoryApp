import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Package, Tag, Truck, Warehouse, ShoppingCart,
  Users, BarChart2, ClipboardList, LogOut, BookOpen, FileText,
  Activity, PieChart, ChevronLeft, ChevronRight, Menu, X,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { Badge, statusVariant } from '../ui/Badge';
import type { UserRole } from '../../api/types';

interface NavItem {
  to: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  label: string;
  roles: UserRole[];
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

const ALL: UserRole[]       = ['admin', 'manager', 'cashier', 'warehouse', 'viewer'];
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
      { to: '/products',   icon: Package,      label: 'Products',   roles: ALL },
      { to: '/categories', icon: Tag,           label: 'Categories', roles: ADMIN_MGR },
      { to: '/suppliers',  icon: Truck,         label: 'Suppliers',  roles: ADMIN_MGR },
    ],
  },
  {
    label: 'Operations',
    items: [
      { to: '/inventory', icon: Warehouse,     label: 'Inventory',        roles: ALL },
      { to: '/purchases', icon: ClipboardList, label: 'Purchase Orders',  roles: ALL },
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
      { to: '/reports',             icon: BarChart2, label: 'Analytics',   roles: ADMIN_MGR },
      { to: '/reports/sales-audit', icon: PieChart,  label: 'Sales Audit', roles: ADMIN_MGR },
      { to: '/audit',               icon: Activity,  label: 'Audit Log',   roles: ['admin'] },
    ],
  },
  {
    label: 'Admin',
    items: [
      { to: '/users', icon: Users, label: 'User Management', roles: ['admin'] },
    ],
  },
];

interface NavItemProps {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  label: string;
  path: string;
  isCollapsed: boolean;
  onClick?: () => void;
}

function NavItemComp({ icon: Icon, label, path, isCollapsed, onClick }: NavItemProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const isActive = location.pathname === path || location.pathname.startsWith(path + '/');

  return (
    <div style={{ position: 'relative', margin: '1px 8px' }}>
      <div
        onClick={() => { navigate(path); onClick?.(); }}
        className="nav-item"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: isCollapsed ? '10px 0' : '9px 12px',
          justifyContent: isCollapsed ? 'center' : 'flex-start',
          borderRadius: 8,
          cursor: 'pointer',
          transition: 'all 150ms',
          background: isActive ? 'var(--accent-glow)' : 'transparent',
          border: isActive ? '1px solid rgba(124,110,248,0.2)' : '1px solid transparent',
          color: isActive ? 'var(--accent)' : 'var(--text2)',
        }}
        onMouseEnter={e => {
          if (!isActive) {
            (e.currentTarget as HTMLDivElement).style.background = 'var(--surface2)';
            (e.currentTarget as HTMLDivElement).style.color = 'var(--text)';
          }
        }}
        onMouseLeave={e => {
          if (!isActive) {
            (e.currentTarget as HTMLDivElement).style.background = 'transparent';
            (e.currentTarget as HTMLDivElement).style.color = 'var(--text2)';
          }
        }}
      >
        <span style={{ flexShrink: 0, color: isActive ? 'var(--accent)' : 'var(--text3)' }}>
          <Icon size={16} />
        </span>
        {!isCollapsed && (
          <span style={{
            fontSize: 14,
            fontWeight: isActive ? 500 : 400,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            color: isActive ? 'var(--accent)' : 'var(--text2)',
          }}>
            {label}
          </span>
        )}
      </div>

      {isCollapsed && (
        <div
          className="nav-tooltip"
          style={{
            position: 'absolute',
            left: '100%',
            top: '50%',
            transform: 'translateY(-50%)',
            marginLeft: 12,
            background: 'var(--surface2)',
            border: '1px solid var(--border)',
            borderRadius: 6,
            padding: '6px 12px',
            fontSize: 13,
            fontWeight: 500,
            color: 'var(--text)',
            whiteSpace: 'nowrap',
            pointerEvents: 'none',
            opacity: 0,
            transition: 'opacity 150ms',
            zIndex: 100,
            boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
          }}
        >
          {label}
          <div style={{
            position: 'absolute',
            left: -4,
            top: '50%',
            transform: 'translateY(-50%) rotate(45deg)',
            width: 7,
            height: 7,
            background: 'var(--surface2)',
            border: '1px solid var(--border)',
            borderRight: 'none',
            borderTop: 'none',
          }} />
        </div>
      )}
    </div>
  );
}

interface SidebarProps {
  onLogout: () => void;
  isMobileOpen: boolean;
  setIsMobileOpen: (open: boolean) => void;
  isCollapsed: boolean;
  setIsCollapsed: (c: boolean) => void;
}

export function Sidebar({ onLogout, isMobileOpen, setIsMobileOpen, isCollapsed, setIsCollapsed }: SidebarProps) {
  const { user } = useAuth();
  const role = user?.role ?? 'viewer';
  const initials = user?.name?.[0]?.toUpperCase() ?? '?';

  const toggleCollapsed = () => {
    setIsCollapsed(!isCollapsed);
    localStorage.setItem('sidebar-collapsed', String(!isCollapsed));
  };

  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth <= 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  const sidebarWidth = isMobile ? 280 : isCollapsed ? 64 : 240;

  return (
    <>
      {/* Mobile backdrop */}
      {isMobileOpen && (
        <div
          onClick={() => setIsMobileOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.6)',
            backdropFilter: 'blur(2px)',
            zIndex: 39,
          }}
        />
      )}

      {/* Hamburger button — mobile only */}
      <button
        onClick={() => setIsMobileOpen(true)}
        className="hamburger-btn icon-btn"
        style={{
          position: 'fixed',
          top: 14,
          left: 12,
          zIndex: 50,
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 8,
          width: 40,
          height: 40,
          cursor: 'pointer',
          color: 'var(--text)',
        }}
        aria-label="Open menu"
      >
        <Menu size={20} />
      </button>

      {/* Sidebar panel */}
      <aside
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          height: '100vh',
          zIndex: 40,
          background: 'var(--surface)',
          borderRight: '1px solid var(--border)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          width: sidebarWidth,
          transition: isMobile
            ? 'transform 250ms cubic-bezier(0.4, 0, 0.2, 1)'
            : 'width 250ms cubic-bezier(0.4, 0, 0.2, 1)',
          transform: isMobile
            ? isMobileOpen ? 'translateX(0)' : 'translateX(-100%)'
            : 'translateX(0)',
        }}
      >
        {/* Collapse toggle — desktop only */}
        {!isMobile && (
          <button
            onClick={toggleCollapsed}
            style={{
              position: 'absolute',
              top: 20,
              right: -12,
              width: 24,
              height: 24,
              borderRadius: '50%',
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              zIndex: 10,
              transition: 'all 150ms',
              color: 'var(--text2)',
            }}
            aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {isCollapsed ? <ChevronRight size={12} /> : <ChevronLeft size={12} />}
          </button>
        )}

        {/* Mobile close button */}
        {isMobile && (
          <button
            onClick={() => setIsMobileOpen(false)}
            style={{
              position: 'absolute',
              top: 16,
              right: 16,
              width: 32,
              height: 32,
              borderRadius: 8,
              background: 'var(--surface2)',
              border: '1px solid var(--border)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              color: 'var(--text2)',
            }}
            aria-label="Close menu"
          >
            <X size={16} />
          </button>
        )}

        {/* Logo section */}
        {isCollapsed && !isMobile ? (
          <div style={{ padding: '20px 0 16px', display: 'flex', justifyContent: 'center', borderBottom: '1px solid var(--border)' }}>
            <div style={{
              width: 32, height: 32, borderRadius: 8,
              background: 'var(--accent)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Package size={18} color="white" />
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '20px 16px 16px', borderBottom: '1px solid var(--border)' }}>
            <div style={{
              width: 32, height: 32, borderRadius: 8,
              background: 'var(--accent)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
            }}>
              <Package size={18} color="white" />
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 16, color: 'var(--text)' }}>StockFlow</div>
              <div style={{ fontSize: 10, color: 'var(--text3)' }}>Kitchen Utensils</div>
            </div>
          </div>
        )}

        {/* Navigation */}
        <nav style={{ flex: 1, overflowY: 'auto', paddingTop: 8, paddingBottom: 8 }}>
          {navGroups.map((group) => {
            const visible = group.items.filter((item) => item.roles.includes(role));
            if (visible.length === 0) return null;
            return (
              <div key={group.label} style={{ marginBottom: 4 }}>
                {/* Group label */}
                <div style={{
                  opacity: isCollapsed && !isMobile ? 0 : 1,
                  maxHeight: isCollapsed && !isMobile ? 0 : 32,
                  overflow: 'hidden',
                  transition: 'all 200ms',
                  padding: isCollapsed && !isMobile ? '0' : '8px 16px 4px',
                  fontSize: 10,
                  fontWeight: 600,
                  color: 'var(--text3)',
                  letterSpacing: '0.1em',
                  textTransform: 'uppercase',
                }}>
                  {group.label}
                </div>
                {visible.map((item) => (
                  <NavItemComp
                    key={item.to}
                    icon={item.icon}
                    label={item.label}
                    path={item.to}
                    isCollapsed={isCollapsed && !isMobile}
                    onClick={isMobile ? () => setIsMobileOpen(false) : undefined}
                  />
                ))}
              </div>
            );
          })}
        </nav>

        {/* User section */}
        <div style={{ borderTop: '1px solid var(--border)', padding: isCollapsed && !isMobile ? '12px 0' : '12px 16px', flexShrink: 0 }}>
          {isCollapsed && !isMobile ? (
            /* Collapsed: avatar only with tooltip */
            <div style={{ position: 'relative', display: 'flex', justifyContent: 'center' }}>
              <div
                style={{
                  width: 36, height: 36, borderRadius: '50%',
                  background: 'var(--accent-glow)',
                  border: '1px solid rgba(124,110,248,0.3)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 14, fontWeight: 600, color: 'var(--accent)',
                  cursor: 'default',
                }}
              >
                {initials}
              </div>
              <div
                className="nav-tooltip"
                style={{
                  position: 'absolute',
                  left: '100%',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  marginLeft: 12,
                  background: 'var(--surface2)',
                  border: '1px solid var(--border)',
                  borderRadius: 6,
                  padding: '8px 12px',
                  fontSize: 13,
                  color: 'var(--text)',
                  whiteSpace: 'nowrap',
                  pointerEvents: 'none',
                  opacity: 0,
                  transition: 'opacity 150ms',
                  zIndex: 100,
                  boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
                }}
              >
                <div style={{ fontWeight: 500 }}>{user?.name}</div>
                <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>{role}</div>
              </div>
            </div>
          ) : (
            /* Expanded: full user card */
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                <div style={{
                  width: 36, height: 36, borderRadius: '50%',
                  background: 'var(--accent-glow)',
                  border: '1px solid rgba(124,110,248,0.3)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 14, fontWeight: 600, color: 'var(--accent)',
                  flexShrink: 0,
                }}>
                  {initials}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {user?.name}
                  </div>
                  <Badge label={role} variant={statusVariant(role)} />
                </div>
              </div>
              <button
                onClick={onLogout}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '8px 12px',
                  borderRadius: 8,
                  fontSize: 13,
                  color: 'var(--text2)',
                  background: 'transparent',
                  border: '1px solid var(--border)',
                  cursor: 'pointer',
                  transition: 'all 150ms',
                }}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLButtonElement).style.background = 'var(--red-bg)';
                  (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--red-border)';
                  (e.currentTarget as HTMLButtonElement).style.color = 'var(--red)';
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
                  (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--border)';
                  (e.currentTarget as HTMLButtonElement).style.color = 'var(--text2)';
                }}
              >
                <LogOut size={14} />
                Sign out
              </button>
            </>
          )}
        </div>
      </aside>
    </>
  );
}
