import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import client from '../../api/client';

interface DashboardData {
  today: { revenue: number; orderCount: number };
  thisMonth: { revenue: number; orderCount: number };
  inventory: { totalProducts: number; lowStockCount: number; pendingPurchaseOrders: number };
  recentActivity: unknown[];
}

function KpiCard({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div style={{ ...styles.card, borderTop: `4px solid ${accent ?? '#2563eb'}` }}>
      <p style={styles.cardLabel}>{label}</p>
      <p style={styles.cardValue}>{value}</p>
    </div>
  );
}

export function DashboardPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const { data, isPending, isError } = useQuery({
    queryKey: ['dashboard'],
    queryFn: () =>
      client
        .get<{ data: DashboardData }>('/reports/dashboard')
        .then((r) => r.data.data),
    refetchInterval: 30_000, // refresh every 30 s
  });

  async function handleLogout() {
    await logout();
    navigate('/login', { replace: true });
  }

  return (
    <div style={styles.page}>
      {/* Header */}
      <header style={styles.header}>
        <div>
          <h1 style={styles.heading}>Dashboard</h1>
          <p style={styles.sub}>Welcome back, {user?.name}</p>
        </div>
        <button onClick={handleLogout} style={styles.logoutBtn}>Sign out</button>
      </header>

      {/* KPI grid */}
      {isPending && <p style={styles.status}>Loading KPIs…</p>}

      {isError && (
        <p style={{ ...styles.status, color: '#dc2626' }}>
          Failed to load dashboard. Is the API server running?
        </p>
      )}

      {data && (
        <div style={styles.grid}>
          <KpiCard
            label="Today's Revenue"
            value={`Rs. ${data.today.revenue.toFixed(2)}`}
            accent="#10b981"
          />
          <KpiCard
            label="Today's Orders"
            value={String(data.today.orderCount)}
            accent="#2563eb"
          />
          <KpiCard
            label="This Month Revenue"
            value={`Rs. ${data.thisMonth.revenue.toFixed(2)}`}
            accent="#6366f1"
          />
          <KpiCard
            label="This Month Orders"
            value={String(data.thisMonth.orderCount)}
            accent="#0ea5e9"
          />
          <KpiCard
            label="Low Stock Products"
            value={String(data.inventory.lowStockCount)}
            accent={data.inventory.lowStockCount > 0 ? '#f59e0b' : '#10b981'}
          />
          <KpiCard
            label="Pending POs"
            value={String(data.inventory.pendingPurchaseOrders)}
            accent="#f59e0b"
          />
          <KpiCard
            label="Total Products"
            value={String(data.inventory.totalProducts)}
            accent="#8b5cf6"
          />
        </div>
      )}

      {/* Quick nav */}
      <nav style={styles.nav}>
        <button style={styles.navBtn} onClick={() => navigate('/pos')}>POS Terminal</button>
      </nav>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: '100vh',
    background: '#f3f4f6',
    padding: '2rem',
    fontFamily: 'system-ui, sans-serif',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: '2rem',
  },
  heading: { margin: 0, fontSize: '1.75rem', fontWeight: 700, color: '#111827' },
  sub: { margin: '0.25rem 0 0', color: '#6b7280', fontSize: '0.875rem' },
  status: { color: '#6b7280', fontSize: '0.875rem' },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
    gap: '1.25rem',
    marginBottom: '2rem',
  },
  card: {
    background: '#fff',
    borderRadius: 10,
    padding: '1.25rem 1.5rem',
    boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
  },
  cardLabel: { margin: '0 0 0.5rem', fontSize: '0.8125rem', color: '#6b7280', fontWeight: 500 },
  cardValue: { margin: 0, fontSize: '1.875rem', fontWeight: 700, color: '#111827' },
  logoutBtn: {
    padding: '0.5rem 1rem',
    background: 'transparent',
    border: '1px solid #d1d5db',
    borderRadius: 8,
    cursor: 'pointer',
    fontSize: '0.875rem',
    color: '#374151',
  },
  nav: { display: 'flex', gap: '0.75rem' },
  navBtn: {
    padding: '0.625rem 1.25rem',
    background: '#2563eb',
    color: '#fff',
    border: 'none',
    borderRadius: 8,
    cursor: 'pointer',
    fontSize: '0.875rem',
    fontWeight: 500,
  },
};
