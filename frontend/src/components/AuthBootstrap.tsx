import { useEffect } from 'react';
import apiClient from '@/api/client';
import { ENDPOINTS } from '@/api/endpoints';
import type { ApiResponse } from '@/api/types';
import { useAuthStore, type AuthUser } from '@/store/useAuthStore';
import { useCartStore } from '@/store/useCartStore';
import { useWishlistStore } from '@/store/useWishlistStore';

export default function AuthBootstrap() {
  const token = useAuthStore((s) => s.token);
  const userId = useAuthStore((s) => s.user?.id ?? null);
  const syncUser = useAuthStore((s) => s.syncUser);
  const syncCartSession = useCartStore((s) => s.syncSession);
  const syncWishlistSession = useWishlistStore((s) => s.syncSession);

  useEffect(() => {
    void syncWishlistSession();
    void syncCartSession();
  }, [syncCartSession, syncWishlistSession, token, userId]);

  useEffect(() => {
    if (!token) return;

    let cancelled = false;

    void apiClient
      .get<ApiResponse<AuthUser>>(ENDPOINTS.USERS.ME)
      .then((res) => {
        if (cancelled || !res.data?.data) return;
        syncUser(res.data.data);
      })
      .catch(() => {
        // Global interceptor handles invalid sessions.
      });

    return () => {
      cancelled = true;
    };
  }, [syncUser, token]);

  return null;
}
