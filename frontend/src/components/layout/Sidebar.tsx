import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import {
  LayoutDashboard, Package, Tag, Truck,
  Warehouse, ClipboardList, ShoppingCart,
  Receipt, Users, BarChart2, Shield,
  UserCog, LogOut, ChevronRight, ChevronLeft,
  Box,
} from 'lucide-react'
import { useSidebar } from '../../contexts/SidebarContext'
import { useAuth } from '../../context/AuthContext'

interface NavItem {
  path:  string
  label: string
  icon:  React.ReactNode
  roles: string[]
}

interface NavGroup {
  label: string
  items: NavItem[]
}

const NAV_GROUPS: NavGroup[] = [
  {
    label: 'Overview',
    items: [
      { path: '/dashboard', label: 'Dashboard', icon: <LayoutDashboard size={18} />, roles: ['admin', 'manager'] },
    ],
  },
  {
    label: 'Catalog',
    items: [
      { path: '/products',   label: 'Products',   icon: <Package size={18} />, roles: ['admin', 'manager', 'cashier', 'warehouse', 'viewer'] },
      { path: '/categories', label: 'Categories', icon: <Tag size={18} />,     roles: ['admin', 'manager'] },
      { path: '/suppliers',  label: 'Suppliers',  icon: <Truck size={18} />,   roles: ['admin', 'manager'] },
    ],
  },
  {
    label: 'Operations',
    items: [
      { path: '/inventory', label: 'Inventory',  icon: <Warehouse size={18} />,     roles: ['admin', 'manager', 'warehouse'] },
      { path: '/purchases', label: 'Purchases',  icon: <ClipboardList size={18} />, roles: ['admin', 'manager', 'warehouse'] },
    ],
  },
  {
    label: 'Sales',
    items: [
      { path: '/pos',   label: 'POS Checkout',  icon: <ShoppingCart size={18} />, roles: ['admin', 'manager', 'cashier'] },
      { path: '/sales', label: 'Sales History', icon: <Receipt size={18} />,      roles: ['admin', 'manager', 'cashier', 'warehouse', 'viewer'] },
    ],
  },
  {
    label: 'Customers',
    items: [
      { path: '/customers', label: 'Customers', icon: <Users size={18} />, roles: ['admin', 'manager', 'cashier', 'warehouse', 'viewer'] },
    ],
  },
  {
    label: 'Reports',
    items: [
      { path: '/reports',             label: 'Analytics',   icon: <BarChart2 size={18} />, roles: ['admin', 'manager'] },
      { path: '/reports/sales-audit', label: 'Sales Audit', icon: <Receipt size={18} />,   roles: ['admin', 'manager'] },
      { path: '/audit',               label: 'Audit Log',   icon: <Shield size={18} />,    roles: ['admin'] },
    ],
  },
  {
    label: 'Admin',
    items: [
      { path: '/users', label: 'User Management', icon: <UserCog size={18} />, roles: ['admin'] },
    ],
  },
]

function Tooltip({ label }: { label: string }) {
  return (
    <div
      style={{
        position:      'absolute',
        left:          'calc(100% + 12px)',
        top:           '50%',
        transform:     'translateY(-50%)',
        background:    'var(--surface3)',
        border:        '1px solid var(--border)',
        borderRadius:  6,
        padding:       '6px 12px',
        fontSize:      13,
        fontWeight:    500,
        color:         'var(--text)',
        whiteSpace:    'nowrap',
        pointerEvents: 'none',
        zIndex:        9999,
        boxShadow:     '0 4px 16px rgba(0,0,0,0.4)',
      }}
    >
      <div
        style={{
          position:    'absolute',
          left:        -5,
          top:         '50%',
          transform:   'translateY(-50%) rotate(45deg)',
          width:       8,
          height:      8,
          background:  'var(--surface3)',
          borderLeft:  '1px solid var(--border)',
          borderBottom:'1px solid var(--border)',
        }}
      />
      {label}
    </div>
  )
}

function NavItemRow({
  item,
  isCollapsed,
  isActive,
  onClick,
}: {
  item:        NavItem
  isCollapsed: boolean
  isActive:    boolean
  onClick:     () => void
}) {
  const [showTooltip, setShowTooltip] = useState(false)

  return (
    <div
      style={{ position: 'relative', margin: '1px 8px' }}
      onMouseEnter={() => isCollapsed && setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      <div
        onClick={onClick}
        style={{
          display:        'flex',
          alignItems:     'center',
          gap:            10,
          padding:        '9px 10px',
          justifyContent: isCollapsed ? 'center' : 'flex-start',
          borderRadius:   8,
          cursor:         'pointer',
          transition:     'all 150ms ease',
          background:     isActive ? 'var(--accent-glow)' : 'transparent',
          border:         '1px solid',
          borderColor:    isActive ? 'rgba(124,110,248,0.25)' : 'transparent',
          color:          isActive ? 'var(--accent)' : 'var(--text2)',
          userSelect:     'none',
          WebkitUserSelect: 'none',
        }}
        onMouseEnter={e => {
          if (!isActive) {
            const el = e.currentTarget as HTMLDivElement
            el.style.background = 'var(--surface2)'
            el.style.color = 'var(--text)'
          }
        }}
        onMouseLeave={e => {
          if (!isActive) {
            const el = e.currentTarget as HTMLDivElement
            el.style.background = 'transparent'
            el.style.color = 'var(--text2)'
          }
        }}
      >
        <span style={{
          flexShrink: 0,
          color:      isActive ? 'var(--accent)' : 'var(--text3)',
          display:    'flex',
          alignItems: 'center',
        }}>
          {item.icon}
        </span>

        {!isCollapsed && (
          <span style={{
            fontSize:     13,
            fontWeight:   isActive ? 500 : 400,
            whiteSpace:   'nowrap',
            overflow:     'hidden',
            textOverflow: 'ellipsis',
            transition:   'opacity 150ms',
          }}>
            {item.label}
          </span>
        )}
      </div>

      {isCollapsed && showTooltip && <Tooltip label={item.label} />}
    </div>
  )
}

export function Sidebar() {
  const { isCollapsed, toggle } = useSidebar()
  const { user, logout }        = useAuth()
  const navigate                = useNavigate()
  const location                = useLocation()
  const [showLogoutModal, setShowLogoutModal] = useState(false)
  const [isLoggingOut,   setIsLoggingOut]     = useState(false)

  const visibleGroups = NAV_GROUPS
    .map(group => ({
      ...group,
      items: group.items.filter(item => user?.role && item.roles.includes(user.role)),
    }))
    .filter(group => group.items.length > 0)

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
    <>
      {/* Sidebar container */}
      <aside
        style={{
          position:      'fixed',
          top:           0,
          left:          0,
          height:        '100vh',
          width:         isCollapsed ? 64 : 240,
          background:    'var(--surface)',
          borderRight:   '1px solid var(--border)',
          display:       'flex',
          flexDirection: 'column',
          overflow:      'hidden',
          transition:    'width 250ms cubic-bezier(0.4,0,0.2,1)',
          zIndex:        100,
          flexShrink:    0,
        }}
      >
        {/* Logo */}
        <div
          style={{
            padding:        isCollapsed ? '20px 0 16px' : '20px 16px 16px',
            borderBottom:   '1px solid var(--border)',
            display:        'flex',
            alignItems:     'center',
            justifyContent: isCollapsed ? 'center' : 'flex-start',
            gap:            10,
            flexShrink:     0,
          }}
        >
          <div
            style={{
              width:          32,
              height:         32,
              borderRadius:   8,
              background:     'var(--accent)',
              display:        'flex',
              alignItems:     'center',
              justifyContent: 'center',
              flexShrink:     0,
            }}
          >
            <Box size={18} color="white" />
          </div>
          {!isCollapsed && (
            <div style={{ overflow: 'hidden' }}>
              <div style={{ fontWeight: 700, fontSize: 16, color: 'var(--text)', whiteSpace: 'nowrap', letterSpacing: '-0.02em' }}>
                StockFlow
              </div>
              <div style={{ fontSize: 10, color: 'var(--text3)', whiteSpace: 'nowrap' }}>
                Kitchen Utensils
              </div>
            </div>
          )}
        </div>

        {/* Navigation */}
        <nav style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', padding: '8px 0' }}>
          {visibleGroups.map(group => (
            <div key={group.label}>
              {!isCollapsed ? (
                <div style={{
                  padding:       '10px 18px 4px',
                  fontSize:      10,
                  fontWeight:    600,
                  color:         'var(--text3)',
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  whiteSpace:    'nowrap',
                }}>
                  {group.label}
                </div>
              ) : (
                <div style={{ height: 1, background: 'var(--border)', margin: '6px 12px' }} />
              )}
              {group.items.map(item => (
                <NavItemRow
                  key={item.path}
                  item={item}
                  isCollapsed={isCollapsed}
                  isActive={
                    location.pathname === item.path ||
                    location.pathname.startsWith(item.path + '/')
                  }
                  onClick={() => navigate(item.path)}
                />
              ))}
            </div>
          ))}
        </nav>

        {/* User section */}
        <div
          style={{
            borderTop:  '1px solid var(--border)',
            padding:    isCollapsed ? '12px 0' : '12px 12px 8px',
            flexShrink: 0,
          }}
        >
          {/* User info */}
          <div
            style={{
              display:        'flex',
              alignItems:     'center',
              gap:            10,
              padding:        '6px 4px',
              justifyContent: isCollapsed ? 'center' : 'flex-start',
              marginBottom:   8,
            }}
          >
            <div
              style={{
                width:          36,
                height:         36,
                borderRadius:   '50%',
                background:     'var(--accent-glow)',
                border:         '1px solid rgba(124,110,248,0.3)',
                display:        'flex',
                alignItems:     'center',
                justifyContent: 'center',
                fontSize:       14,
                fontWeight:     600,
                color:          'var(--accent)',
                flexShrink:     0,
              }}
            >
              {initials}
            </div>
            {!isCollapsed && (
              <div style={{ overflow: 'hidden', flex: 1 }}>
                <div style={{
                  fontSize:     13,
                  fontWeight:   500,
                  color:        'var(--text)',
                  whiteSpace:   'nowrap',
                  overflow:     'hidden',
                  textOverflow: 'ellipsis',
                }}>
                  {user?.name}
                </div>
                <div style={{ fontSize: 11, color: 'var(--accent)', fontWeight: 500, textTransform: 'capitalize' }}>
                  {user?.role}
                </div>
              </div>
            )}
          </div>

          {/* Logout button — expanded */}
          {!isCollapsed && (
            <button
              onClick={() => setShowLogoutModal(true)}
              style={{
                width:       '100%',
                padding:     '8px 12px',
                background:  'transparent',
                border:      '1px solid var(--border)',
                borderRadius: 8,
                color:       'var(--text2)',
                fontSize:    13,
                display:     'flex',
                alignItems:  'center',
                gap:         8,
                cursor:      'pointer',
                transition:  'all 150ms',
                fontFamily:  'inherit',
                marginBottom: 8,
              }}
              onMouseEnter={e => {
                const el = e.currentTarget
                el.style.background  = 'var(--red-bg)'
                el.style.borderColor = 'var(--red-border)'
                el.style.color       = 'var(--red)'
              }}
              onMouseLeave={e => {
                const el = e.currentTarget
                el.style.background  = 'transparent'
                el.style.borderColor = 'var(--border)'
                el.style.color       = 'var(--text2)'
              }}
            >
              <LogOut size={15} />
              Log out
            </button>
          )}

          {/* Logout icon — collapsed */}
          {isCollapsed && (
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 8 }}>
              <button
                onClick={() => setShowLogoutModal(true)}
                title="Log out"
                style={{
                  width:          40,
                  height:         40,
                  borderRadius:   8,
                  background:     'transparent',
                  border:         '1px solid transparent',
                  display:        'flex',
                  alignItems:     'center',
                  justifyContent: 'center',
                  cursor:         'pointer',
                  color:          'var(--text3)',
                  transition:     'all 150ms',
                }}
                onMouseEnter={e => {
                  const el = e.currentTarget
                  el.style.background  = 'var(--red-bg)'
                  el.style.borderColor = 'var(--red-border)'
                  el.style.color       = 'var(--red)'
                }}
                onMouseLeave={e => {
                  const el = e.currentTarget
                  el.style.background  = 'transparent'
                  el.style.borderColor = 'transparent'
                  el.style.color       = 'var(--text3)'
                }}
              >
                <LogOut size={16} />
              </button>
            </div>
          )}

          {/* Toggle button */}
          <button
            onClick={toggle}
            title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            style={{
              width:          '100%',
              padding:        '8px 0',
              background:     'transparent',
              border:         '1px solid var(--border)',
              borderRadius:   8,
              color:          'var(--text3)',
              display:        'flex',
              alignItems:     'center',
              justifyContent: 'center',
              gap:            6,
              cursor:         'pointer',
              transition:     'all 150ms',
              fontFamily:     'inherit',
              fontSize:       12,
            }}
            onMouseEnter={e => {
              const el = e.currentTarget
              el.style.background  = 'var(--surface2)'
              el.style.borderColor = 'var(--border2)'
              el.style.color       = 'var(--text)'
            }}
            onMouseLeave={e => {
              const el = e.currentTarget
              el.style.background  = 'transparent'
              el.style.borderColor = 'var(--border)'
              el.style.color       = 'var(--text3)'
            }}
          >
            {isCollapsed
              ? <ChevronRight size={16} />
              : <><ChevronLeft size={16} /><span>Collapse</span></>
            }
          </button>
        </div>
      </aside>

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
    </>
  )
}
