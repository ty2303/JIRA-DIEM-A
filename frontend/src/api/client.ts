import axios from 'axios';
import { useAuthStore } from '@/store/useAuthStore';

const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor
apiClient.interceptors.request.use(
  (config) => {
    const token = useAuthStore.getState().token;
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error),
);

// Response interceptor
let isRefreshingRole = false;

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    // Handle global errors (401, 403, 500, etc.)
    if (error.response?.status === 401) {
      useAuthStore.getState().logout();
      window.location.href = '/login';
    }

    // Handle 403: role may have been changed by another admin
    if (error.response?.status === 403 && !isRefreshingRole) {
      const { token, user } = useAuthStore.getState();
      if (token && user) {
        isRefreshingRole = true;
        try {
          const res = await apiClient.get('/users/me');
          const freshRole = res.data?.data?.role;
          if (freshRole && freshRole !== user.role) {
            useAuthStore.getState().syncRole(freshRole);
            if (
              freshRole === 'USER' &&
              window.location.pathname.startsWith('/admin')
            ) {
              window.location.href = '/';
            } else if (
              freshRole === 'ADMIN' &&
              !window.location.pathname.startsWith('/admin')
            ) {
              window.location.href = '/admin';
            }
          }
        } catch {
          // If /users/me also fails, the user session is invalid
        } finally {
          isRefreshingRole = false;
        }
      }
    }

    return Promise.reject(error);
  },
);

export default apiClient;
