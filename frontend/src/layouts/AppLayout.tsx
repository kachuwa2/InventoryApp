import { useState, useEffect } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { Bell, LogOut } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { ToastContainer } from '../components/ui/Toast';
import { Spinner } from '../components/ui/Spinner';
import { Sidebar } from '../components/layout/Sidebar';

// ─── Breadcrumb ───────────────────────────────────────────────────────────────

type Crumb = { label: string };

function getBreadcrumbs(path: string): Crumb[] {
  if (path === '/dashboard')             return [{ label: 'Dashboard' }];
  if (path === '/products')              return [{ label: 'Products' }];
  if (path === '/categories')            return [{ label: 'Categories' }];
  if (path === '/suppliers')             return [{ label: 'Suppliers' }];
  if (path === '/inventory')             return [{ label: 'Inventory' }];
  if (path === '/purchases')             return [{ label: 'Purchase Orders' }];
  if (path === '/purchases/new')         return [{ label: 'New Purchase Order' }];
  if (path.startsWith('/purchases/'))    return [{ label: 'Purchase Detail' }];
  if (path === '/pos')                   return [{ label: 'POS Checkout' }];
  if (path === '/sales')                 return [{ label: 'Sales History' }];
  if (path === '/customers')             return [{ label: 'Customers' }];
  if (path === '/reports')               return [{ label: 'Analytics' }];
  if (path === '/reports/sales-audit')   return [{ label: 'Sales Audit' }];
  if (path === '/audit')                 return [{ label: 'Audit Log' }];
  if (path === '/users')                 return [{ label: 'User Management' }];
  return [];
}

function Breadcrumb() {
  const { pathname } = useLocation();
  const crumbs = getBreadcrumbs(pathname);
  if (crumbs.length === 0) return null;
  return (
    <div className="topbar-breadcrumb flex items-center gap-1.5 text-[13px]">
      {crumbs.map((crumb, i) => (
        <span key={i} style={{ color: 'var(--text)', fontWeight: 500 }}>
          {crumb.label}
        </span>
      ))}
    </div>
  );
}

function PageTitleMobile() {
  const { pathname } = useLocation();
  const crumbs = getBreadcrumbs(pathname);
  const title = crumbs[crumbs.length - 1]?.label ?? '';
  return (
    <div className="topbar-title-mobile" style={{ flex: 1, textAlign: 'center' }}>
      {title}
    </div>
  );
}

function ClockWidget() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  return (
    <span className="topbar-time text-[12px] font-mono tabular-nums" style={{ color: 'var(--text3)' }}>
      {now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
    </span>
  );
}

// ─── AppLayout ────────────────────────────────────────────────────────────────

export function AppLayout() {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [isCollapsed, setIsCollapsed] = useState<boolean>(() => {
    return localStorage.getItem('sidebar-collapsed') === 'true';
  });
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [isLoggingOut, setIsLoggingOut]       = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth <= 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  // Close mobile drawer on route change
  useEffect(() => {
    setIsMobileOpen(false);
  }, [location.pathname]);

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

  const sidebarWidth = isMobile ? 0 : isCollapsed ? 64 : 240;

  return (
    <div style={{ display: 'flex', height: '100vh', background: 'var(--bg)', overflow: 'hidden' }}>

      <Sidebar
        onLogout={() => setShowLogoutModal(true)}
        isMobileOpen={isMobileOpen}
        setIsMobileOpen={setIsMobileOpen}
        isCollapsed={isCollapsed}
        setIsCollapsed={(c) => {
          setIsCollapsed(c);
          localStorage.setItem('sidebar-collapsed', String(c));
        }}
      />

      {/* Main content */}
      <div
        className="main-content"
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          minWidth: 0,
          height: '100%',
          overflow: 'hidden',
          marginLeft: sidebarWidth,
          transition: 'margin-left 250ms cubic-bezier(0.4, 0, 0.2, 1)',
        }}
      >
        {/* Top bar */}
        <header
          className="topbar"
          style={{
            height: 56,
            flexShrink: 0,
            background: 'var(--surface)',
            borderBottom: '1px solid var(--border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingLeft: 24,
            paddingRight: 24,
          }}
        >
          <Breadcrumb />
          <PageTitleMobile />

          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <button
              style={{ color: 'var(--text3)', padding: 4, background: 'none', border: 'none', cursor: 'pointer' }}
              title="Notifications"
            >
              <Bell size={16} />
            </button>
            <div style={{ width: 1, height: 24, background: 'var(--border)' }} />
            <ClockWidget />
          </div>
        </header>

        {/* Page content */}
        <main
          key={location.pathname}
          className="page-enter"
          style={{ flex: 1, overflowY: 'auto', padding: isMobile ? '16px' : '24px' }}
        >
          <Outlet />
        </main>
      </div>

      <ToastContainer />

      {/* Logout confirm modal */}
      {showLogoutModal && (
        <div
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
            backdropFilter: 'blur(2px)', zIndex: 50,
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
          }}
          onClick={() => { if (!isLoggingOut) setShowLogoutModal(false); }}
        >
          <div
            style={{
              background: 'var(--surface)', border: '1px solid var(--border2)',
              borderRadius: 12, maxWidth: 360, width: '100%',
              boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid var(--border)' }}>
              <h3 style={{ fontSize: 16, fontWeight: 600, color: 'var(--text)' }}>Sign out?</h3>
            </div>
            <div style={{ padding: '16px 24px' }}>
              <p style={{ fontSize: 14, color: 'var(--text2)' }}>
                Are you sure you want to sign out?
              </p>
            </div>
            <div style={{ padding: '12px 24px 20px', display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button
                onClick={() => setShowLogoutModal(false)}
                disabled={isLoggingOut}
                style={{
                  padding: '8px 16px', background: 'var(--surface2)', border: '1px solid var(--border)',
                  color: 'var(--text)', borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: 'pointer',
                }}
              >
                Stay
              </button>
              <button
                onClick={handleLogout}
                disabled={isLoggingOut}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '8px 16px', background: 'var(--red-bg)',
                  border: '1px solid var(--red-border)', color: 'var(--red)',
                  borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: 'pointer',
                  opacity: isLoggingOut ? 0.5 : 1,
                }}
              >
                {isLoggingOut ? <><Spinner size="sm" /> Signing out…</> : <><LogOut size={14} /> Sign out</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
