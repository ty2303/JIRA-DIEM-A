import { Navigate, Outlet } from 'react-router';
import { useAuthStore } from '@/store/useAuthStore';

export default function PrivateRoute() {
  const isLoggedIn = useAuthStore((s) => s.isLoggedIn);
  return isLoggedIn ? <Outlet /> : <Navigate to="/login" replace />;
}
