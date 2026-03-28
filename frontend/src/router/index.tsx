import { createBrowserRouter } from 'react-router';
import App from '@/App';
import AdminRoute from '@/components/routes/AdminRoute';
import PrivateRoute from '@/components/routes/PrivateRoute';
import UserOnlyRoute from '@/components/routes/UserOnlyRoute';

export const router = createBrowserRouter([
  {
    path: '/',
    Component: App,
    children: [
      // Trang mở cho mọi người (kể cả admin)
      {
        path: 'login',
        lazy: () => import('@/pages/Auth'),
      },
      {
        path: 'forgot-password',
        lazy: () => import('@/pages/ForgotPassword'),
      },
      {
        path: 'reset-password',
        lazy: () => import('@/pages/ResetPassword'),
      },
      {
        path: 'about',
        lazy: () => import('@/pages/About'),
      },
      // Trang chỉ dành cho USER (admin bị redirect về /admin)
      {
        Component: UserOnlyRoute,
        children: [
          {
            index: true,
            lazy: () => import('@/pages/Home'),
          },
          {
            path: 'products',
            lazy: () => import('@/pages/Products'),
          },
          {
            path: 'products/:id',
            lazy: () => import('@/pages/ProductDetail'),
          },
          {
            path: 'wishlist',
            lazy: () => import('@/pages/Wishlist'),
          },
          {
            path: 'cart',
            lazy: () => import('@/pages/Cart'),
          },
          {
            Component: PrivateRoute,
            children: [
              {
                path: 'checkout',
                lazy: () => import('@/pages/Checkout'),
              },
              {
                path: 'checkout/success',
                lazy: () => import('@/pages/CheckoutSuccess'),
              },
              {
                path: 'profile',
                children: [
                  {
                    index: true,
                    lazy: () => import('@/pages/Profile'),
                  },
                ],
              },
            ],
          },
        ],
      },
    ],
  },
  {
    path: '/admin',
    Component: AdminRoute,
    children: [
      {
        index: true,
        lazy: () => import('@/pages/admin/Dashboard'),
      },
    ],
  },
]);
