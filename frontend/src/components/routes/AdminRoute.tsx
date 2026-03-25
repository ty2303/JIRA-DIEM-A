import { Navigate, Outlet } from 'react-router';
import { useAuthStore } from '@/store/useAuthStore';

export default function AdminRoute() {
  const { isLoggedIn, isAdmin } = useAuthStore();
  if (!isLoggedIn) return <Navigate to="/login" replace />;
  if (!isAdmin) return <Navigate to="/" replace />;
  return <Outlet />;
}
