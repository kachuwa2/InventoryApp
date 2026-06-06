import { useState, useEffect } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { Bell } from 'lucide-react'
import { ToastContainer } from '../components/ui/Toast'
import { Sidebar } from '../components/layout/Sidebar'
import { useSidebar } from '../contexts/SidebarContext'

type Crumb = { label: string }

function getBreadcrumbs(path: string): Crumb[] {
  if (path === '/dashboard')           return [{ label: 'Dashboard' }]
  if (path === '/products')            return [{ label: 'Products' }]
  if (path === '/categories')          return [{ label: 'Categories' }]
  if (path === '/suppliers')           return [{ label: 'Suppliers' }]
  if (path === '/inventory')           return [{ label: 'Inventory' }]
  if (path === '/purchases')           return [{ label: 'Purchase Orders' }]
  if (path === '/purchases/new')       return [{ label: 'New Purchase Order' }]
  if (path.startsWith('/purchases/'))  return [{ label: 'Purchase Detail' }]
  if (path === '/pos')                 return [{ label: 'POS Checkout' }]
  if (path === '/sales')               return [{ label: 'Sales History' }]
  if (path === '/customers')           return [{ label: 'Customers' }]
  if (path === '/reports')             return [{ label: 'Analytics' }]
  if (path === '/reports/sales-audit') return [{ label: 'Sales Audit' }]
  if (path === '/audit')               return [{ label: 'Audit Log' }]
  if (path === '/users')               return [{ label: 'User Management' }]
  return []
}

function Breadcrumb() {
  const { pathname } = useLocation()
  const crumbs = getBreadcrumbs(pathname)
  if (crumbs.length === 0) return null
  return (
    <div className="topbar-breadcrumb flex items-center" style={{ gap: 6, fontSize: 13 }}>
      {crumbs.map((crumb, i) => (
        <span key={i} style={{ color: 'var(--text)', fontWeight: 500 }}>
          {crumb.label}
        </span>
      ))}
    </div>
  )
}

function PageTitleMobile() {
  const { pathname } = useLocation()
  const crumbs = getBreadcrumbs(pathname)
  const title = crumbs[crumbs.length - 1]?.label ?? ''
  return (
    <div className="topbar-title-mobile" style={{ flex: 1, textAlign: 'center' }}>
      {title}
    </div>
  )
}

function ClockWidget() {
  const [now, setNow] = useState(new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])
  return (
    <span className="topbar-time" style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--text3)' }}>
      {now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
    </span>
  )
}

export function AppLayout() {
  const { isCollapsed } = useSidebar()
  const location = useLocation()

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg)' }}>
      <Sidebar />

      <div
        className="main-content"
        style={{
          flex:          1,
          marginLeft:    isCollapsed ? 64 : 240,
          transition:    'margin-left 250ms cubic-bezier(0.4,0,0.2,1)',
          display:       'flex',
          flexDirection: 'column',
          minWidth:      0,
        }}
      >
        {/* Topbar */}
        <header
          className="topbar"
          style={{
            height:       60,
            flexShrink:   0,
            background:   'var(--surface)',
            borderBottom: '1px solid var(--border)',
            display:      'flex',
            alignItems:   'center',
            justifyContent: 'space-between',
            padding:      '0 24px',
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
          style={{ flex: 1, overflowY: 'auto', padding: 24 }}
        >
          <Outlet />
        </main>
      </div>

      <ToastContainer />
    </div>
  )
}
