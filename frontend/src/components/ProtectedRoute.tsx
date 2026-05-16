import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Spinner } from './ui/Spinner';
import type { UserRole } from '../api/types';

interface ProtectedRouteProps {
  roles?: UserRole[];
}

export function ProtectedRoute({ roles }: ProtectedRouteProps) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;

  if (roles && !roles.includes(user.role)) {
    const fallback =
      user.role === 'cashier' ? '/pos'
      : user.role === 'warehouse' ? '/inventory'
      : user.role === 'viewer' ? '/products'
      : '/dashboard';
    return <Navigate to={fallback} replace />;
  }

  return <Outlet />;
}
