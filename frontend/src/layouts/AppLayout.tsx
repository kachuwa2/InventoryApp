import { useState, useEffect } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { Bell, Box, LogOut, ChevronDown } from 'lucide-react'
import { ToastContainer } from '../components/ui/Toast'
import { Sidebar } from '../components/layout/Sidebar'
import { useSidebar } from '../contexts/SidebarContext'
import { useAuth } from '../context/AuthContext'

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
  const { user, logout }        = useAuth()
  const navigate                = useNavigate()
  const location                = useLocation()

  const [showProfileMenu, setShowProfileMenu] = useState(false)
  const [showLogoutModal, setShowLogoutModal] = useState(false)
  const [isLoggingOut,   setIsLoggingOut]     = useState(false)

  const handleLogout = async () => {
    setIsLoggingOut(true)
    try {
      await logout()
      navigate('/login')
    } finally {
      setIsLoggingOut(false)
      setShowLogoutModal(false)
    }
  }

  const initials = user?.name
    ?.split(' ')
    .map((n: string) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2) || '?'

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
            height:         60,
            flexShrink:     0,
            background:     'var(--surface)',
            borderBottom:   '1px solid var(--border)',
            display:        'flex',
            alignItems:     'center',
            justifyContent: 'space-between',
            padding:        '0 16px 0 12px',
            gap:            12,
          }}
        >
          {/* Left: hamburger + StockFlow logo */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexShrink: 0 }}>
            {/* Hamburger — far left */}
            
            {/* Logo next to hamburger */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div
                style={{
                  width:          30,
                  height:         30,
                  borderRadius:   7,
                  background:     'var(--accent)',
                  display:        'flex',
                  alignItems:     'center',
                  justifyContent: 'center',
                }}
              >
                <Box size={17} color="white" />
              </div>
              <span
                className="logo-text"
                style={{ fontWeight: 700, fontSize: 16, color: 'var(--text)', whiteSpace: 'nowrap' }}
              >
                StockFlow
              </span>
            </div>
          </div>

          {/* Center: breadcrumb (desktop) / page title (mobile) */}
          <Breadcrumb />
          <PageTitleMobile />

          {/* Right: clock + bell + profile dropdown */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
            <ClockWidget />
            <button
              style={{
                color:      'var(--text3)',
                padding:    6,
                background: 'none',
                border:     'none',
                cursor:     'pointer',
                display:    'flex',
                alignItems: 'center',
              }}
              title="Notifications"
            >
              <Bell size={16} />
            </button>
            <div style={{ width: 1, height: 24, background: 'var(--border)', flexShrink: 0 }} />

            {/* Profile button + dropdown */}
            <div style={{ position: 'relative' }}>
              <button
                onClick={() => setShowProfileMenu(p => !p)}
                style={{
                  display:      'flex',
                  alignItems:   'center',
                  gap:          8,
                  background:   'transparent',
                  border:       '1px solid transparent',
                  borderRadius: 8,
                  padding:      '4px 8px 4px 4px',
                  cursor:       'pointer',
                  transition:   'all 150ms',
                }}
                onMouseEnter={e => {
                  const el = e.currentTarget
                  el.style.background  = 'var(--surface2)'
                  el.style.borderColor = 'var(--border)'
                }}
                onMouseLeave={e => {
                  const el = e.currentTarget
                  el.style.background  = 'transparent'
                  el.style.borderColor = 'transparent'
                }}
              >
                {/* Avatar */}
                <div
                  style={{
                    width:          32,
                    height:         32,
                    borderRadius:   '50%',
                    background:     'var(--accent-glow)',
                    border:         '1px solid rgba(124,110,248,0.3)',
                    display:        'flex',
                    alignItems:     'center',
                    justifyContent: 'center',
                    fontSize:       13,
                    fontWeight:     600,
                    color:          'var(--accent)',
                    flexShrink:     0,
                  }}
                >
                  {initials}
                </div>

                {/* Name + role — hidden on mobile via CSS */}
                <div className="topbar-user-info" style={{ textAlign: 'left' }}>
                  <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)', lineHeight: 1.3, whiteSpace: 'nowrap' }}>
                    {user?.name}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--accent)', fontWeight: 500, textTransform: 'capitalize' }}>
                    {user?.role}
                  </div>
                </div>

                <ChevronDown
                  size={14}
                  style={{
                    color:      'var(--text3)',
                    transition: 'transform 150ms',
                    transform:  showProfileMenu ? 'rotate(180deg)' : 'rotate(0deg)',
                    flexShrink: 0,
                  }}
                />
              </button>

              {/* Dropdown menu */}
              {showProfileMenu && (
                <>
                  <div
                    style={{ position: 'fixed', inset: 0, zIndex: 200 }}
                    onClick={() => setShowProfileMenu(false)}
                  />
                  <div
                    style={{
                      position:     'absolute',
                      top:          'calc(100% + 8px)',
                      right:        0,
                      minWidth:     200,
                      background:   'var(--surface)',
                      border:       '1px solid var(--border2)',
                      borderRadius: 10,
                      boxShadow:    '0 8px 24px rgba(0,0,0,0.4)',
                      zIndex:       201,
                      overflow:     'hidden',
                    }}
                  >
                    <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)' }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{user?.name}</div>
                      <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>{user?.email}</div>
                    </div>
                    <button
                      onClick={() => { setShowProfileMenu(false); setShowLogoutModal(true) }}
                      style={{
                        width:      '100%',
                        padding:    '10px 16px',
                        background: 'transparent',
                        border:     'none',
                        display:    'flex',
                        alignItems: 'center',
                        gap:        8,
                        color:      'var(--text2)',
                        fontSize:   13,
                        cursor:     'pointer',
                        fontFamily: 'inherit',
                        textAlign:  'left',
                      }}
                      onMouseEnter={e => {
                        const el = e.currentTarget
                        el.style.background = 'var(--red-bg)'
                        el.style.color      = 'var(--red)'
                      }}
                      onMouseLeave={e => {
                        const el = e.currentTarget
                        el.style.background = 'transparent'
                        el.style.color      = 'var(--text2)'
                      }}
                    >
                      <LogOut size={14} />
                      Log out
                    </button>
                  </div>
                </>
              )}
            </div>
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

      {/* Logout confirmation modal */}
      {showLogoutModal && (
        <div
          onClick={() => setShowLogoutModal(false)}
          style={{
            position:       'fixed',
            inset:          0,
            background:     'rgba(0,0,0,0.7)',
            backdropFilter: 'blur(4px)',
            zIndex:         9999,
            display:        'flex',
            alignItems:     'center',
            justifyContent: 'center',
            padding:        24,
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background:   'var(--surface)',
              border:       '1px solid var(--border2)',
              borderRadius: 12,
              padding:      24,
              width:        '100%',
              maxWidth:     380,
              boxShadow:    '0 8px 32px rgba(0,0,0,0.6)',
            }}
          >
            <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text)', marginBottom: 8 }}>
              Log out?
            </div>
            <div style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.6, marginBottom: 24 }}>
              Are you sure you want to log out?
              You will need to log in again to continue.
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button
                onClick={() => setShowLogoutModal(false)}
                disabled={isLoggingOut}
                style={{
                  padding:      '9px 20px',
                  background:   'var(--surface2)',
                  border:       '1px solid var(--border)',
                  borderRadius: 8,
                  color:        'var(--text)',
                  fontSize:     13,
                  fontWeight:   500,
                  cursor:       'pointer',
                  fontFamily:   'inherit',
                }}
              >
                No, stay
              </button>
              <button
                onClick={handleLogout}
                disabled={isLoggingOut}
                style={{
                  padding:      '9px 20px',
                  background:   'var(--red-bg)',
                  border:       '1px solid var(--red-border)',
                  borderRadius: 8,
                  color:        'var(--red)',
                  fontSize:     13,
                  fontWeight:   500,
                  cursor:       isLoggingOut ? 'not-allowed' : 'pointer',
                  opacity:      isLoggingOut ? 0.6 : 1,
                  fontFamily:   'inherit',
                  display:      'flex',
                  alignItems:   'center',
                  gap:          6,
                }}
              >
                {isLoggingOut ? 'Logging out…' : 'Yes, log out'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
