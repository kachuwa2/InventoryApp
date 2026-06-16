import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import {
  LayoutDashboard, Package, Tag, Truck,
  Warehouse, ClipboardList, ShoppingCart,
  Receipt, Users, BarChart2, Shield,
  UserCog,Menu
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
      { path: '/products',   label: 'Products',   icon: <Package size={18} />, roles: ['admin', 'manager', 'cashier', 'viewer'] },
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
      { path: '/sales', label: 'Sales History', icon: <Receipt size={18} />,      roles: ['admin', 'manager', 'cashier', 'viewer'] },
    ],
  },
  {
    label: 'Customers',
    items: [
      { path: '/customers', label: 'Customers', icon: <Users size={18} />, roles: ['admin', 'manager', 'cashier', 'viewer'] },
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
          position:     'absolute',
          left:         -5,
          top:          '50%',
          transform:    'translateY(-50%) rotate(45deg)',
          width:        8,
          height:       8,
          background:   'var(--surface3)',
          borderLeft:   '1px solid var(--border)',
          borderBottom: '1px solid var(--border)',
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
          display:          'flex',
          alignItems:       'center',
          gap:              10,
          padding:          '9px 10px',
          justifyContent:   isCollapsed ? 'center' : 'flex-start',
          borderRadius:     8,
          cursor:           'pointer',
          transition:       'all 150ms ease',
          background:       isActive ? 'var(--accent-glow)' : 'transparent',
          border:           '1px solid',
          borderColor:      isActive ? 'rgba(124,110,248,0.25)' : 'transparent',
          color:            isActive ? 'var(--accent)' : 'var(--text2)',
          userSelect:       'none',
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
  const { isCollapsed,toggle} = useSidebar()
  const { user }        = useAuth()
  const navigate        = useNavigate()
  const location        = useLocation()

  const visibleGroups = NAV_GROUPS
    .map(group => ({
      ...group,
      items: group.items.filter(item => user?.role && item.roles.includes(user.role)),
    }))
    .filter(group => group.items.length > 0)

  return (
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
      {/* Top spacer — aligns with topbar height */}
     <button
              onClick={toggle}
              style={{
                width:          60,
                height:         40,
                borderRadius:   8,
                background:     'transparent',
                border:         'none',
                display:        'flex',
                alignItems:     'center',
                justifyContent: 'center',
                cursor:         'pointer',
                color:          'var(--text)',
                transition:     'background 150ms',
                flexShrink:     0,
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'var(--surface2)' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
              aria-label="Toggle sidebar"
            >
              <Menu size={20} />
            </button>

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
    </aside>
  )
}
