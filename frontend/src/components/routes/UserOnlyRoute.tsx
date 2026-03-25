import { Navigate, Outlet } from 'react-router';
import { useAuthStore } from '@/store/useAuthStore';

/**
 * Chặn admin truy cập vào các trang dành cho user thông thường.
 * Admin sẽ bị redirect về /admin.
 */
export default function UserOnlyRoute() {
  const isAdmin = useAuthStore((s) => s.isAdmin);
  if (isAdmin) return <Navigate to="/admin" replace />;
  return <Outlet />;
}
