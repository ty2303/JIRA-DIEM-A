/**
 * API endpoint constants.
 * Organize by domain/feature for easy discovery.
 */
export const ENDPOINTS = {
  ADMIN: {
    DASHBOARD_METRICS: '/admin/dashboard-metrics',
  },
  AUTH: {
    LOGIN: '/auth/login',
    GOOGLE: '/auth/google',
    GOOGLE_REDIRECT: '/auth/google/redirect',
    GOOGLE_CALLBACK: '/auth/google/callback',
    REGISTER: '/auth/register',
    FORGOT_PASSWORD: '/auth/forgot-password',
    RESET_PASSWORD: '/auth/reset-password',
  },
  PRODUCTS: {
    BASE: '/products',
    BY_ID: (id: string) => `/products/${id}`,
    BATCH: '/products/batch',
  },
  CATEGORIES: {
    BASE: '/categories',
    BY_ID: (id: string) => `/categories/${id}`,
  },
  ORDERS: {
    BASE: '/orders',
    MY: '/orders/my',
    BY_ID: (id: string) => `/orders/${id}`,
    STATUS: (id: string) => `/orders/${id}/status`,
    CANCEL: (id: string) => `/orders/${id}/cancel`,
  },
  WISHLIST: {
    BASE: '/wishlist',
    SYNC: '/wishlist/sync',
    TOGGLE: (productId: string) => `/wishlist/${productId}`,
  },
  CART: {
    BASE: '/cart',
    ITEMS: '/cart/items',
    ITEM: (productId: string) => `/cart/items/${productId}`,
  },
  REVIEWS: {
    BASE: '/reviews',
    BY_ID: (id: string) => `/reviews/${id}`,
    UPDATE: (id: string) => `/reviews/${id}`,
    UPLOAD_IMAGE: '/reviews/upload-image',
  },
  UPLOAD: {
    IMAGE: '/upload/image',
  },
  USERS: {
    ME: '/users/me',
    CHANGE_PASSWORD: '/users/me/password',
    LINK_GOOGLE: '/users/me/google',
    UNLINK_GOOGLE: '/users/me/google',
    ROLE: (id: string) => `/users/${id}/role`,
  },
} as const;
