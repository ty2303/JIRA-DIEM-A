import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import apiClient from '@/api/client';
import { ENDPOINTS } from '@/api/endpoints';
import type { ApiResponse } from '@/api/types';
import { useAuthStore } from '@/store/useAuthStore';
import { useToastStore } from '@/store/useToastStore';
import type { Product } from '@/types/product';

export const MAX_QUANTITY = 99;

export interface CartItem {
  product: Product;
  quantity: number;
}

/** Shape returned by GET /api/cart */
interface ServerCart {
  items: Array<{
    productId: string;
    quantity: number;
    product: Product;
  }>;
  total: number;
}

interface CartState {
  items: CartItem[];
  isLoading: boolean;
  addItem: (product: Product) => Promise<void>;
  removeItem: (productId: string) => Promise<void>;
  updateQuantity: (productId: string, quantity: number) => Promise<void>;
  clear: () => Promise<void>;
  clearLocal: () => void;
  fetch: () => Promise<void>;
  totalItems: () => number;
  totalPrice: () => number;
}

/** Map server cart response to local CartItem[] format */
function serverToLocal(server: ServerCart): CartItem[] {
  return server.items.map((item) => ({
    product: item.product,
    quantity: item.quantity,
  }));
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      isLoading: false,

      addItem: async (product) => {
        const { isLoggedIn } = useAuthStore.getState();
        const addToast = useToastStore.getState().addToast;
        const prevItems = get().items;

        // Optimistic update
        const existing = prevItems.find((i) => i.product.id === product.id);
        if (existing) {
          if (existing.quantity >= MAX_QUANTITY) return;
          set({
            items: prevItems.map((i) =>
              i.product.id === product.id
                ? { ...i, quantity: Math.min(i.quantity + 1, MAX_QUANTITY) }
                : i,
            ),
          });
        } else {
          set({ items: [...prevItems, { product, quantity: 1 }] });
        }

        if (!isLoggedIn) {
          addToast('success', `Đã thêm ${product.name} vào giỏ hàng`);
          return;
        }

        try {
          const res = await apiClient.post<ApiResponse<ServerCart>>(
            ENDPOINTS.CART.ITEMS,
            {
              productId: product.id,
              quantity: 1,
            },
          );
          set({ items: serverToLocal(res.data.data) });
          addToast('success', `Đã thêm ${product.name} vào giỏ hàng`);
        } catch (err: unknown) {
          // Revert optimistic update
          set({ items: prevItems });
          const axiosErr = err as {
            response?: { data?: { message?: string } };
          };
          const message =
            axiosErr.response?.data?.message ?? 'Không thể thêm vào giỏ hàng';
          addToast('error', message);
        }
      },

      removeItem: async (productId) => {
        const { isLoggedIn } = useAuthStore.getState();
        const addToast = useToastStore.getState().addToast;
        const prevItems = get().items;
        const removedItem = prevItems.find((i) => i.product.id === productId);

        // Optimistic update
        set({ items: prevItems.filter((i) => i.product.id !== productId) });

        if (!removedItem) return;

        if (!isLoggedIn) {
          addToast(
            'success',
            `Đã xóa ${removedItem.product.name} khỏi giỏ hàng`,
          );
          return;
        }

        try {
          const res = await apiClient.delete<ApiResponse<ServerCart>>(
            ENDPOINTS.CART.ITEM(productId),
          );
          set({ items: serverToLocal(res.data.data) });
          addToast(
            'success',
            `Đã xóa ${removedItem.product.name} khỏi giỏ hàng`,
          );
        } catch (err: unknown) {
          set({ items: prevItems });

          const axiosErr = err as {
            response?: { data?: { message?: string } };
          };
          const message =
            axiosErr.response?.data?.message ??
            'Không thể xóa sản phẩm khỏi giỏ hàng';
          addToast('error', message);
        }
      },

      updateQuantity: async (productId, quantity) => {
        if (quantity <= 0) {
          get().removeItem(productId);
          return;
        }

        const { isLoggedIn } = useAuthStore.getState();
        const prevItems = get().items;
        const clamped = Math.min(quantity, MAX_QUANTITY);

        // Optimistic update
        set({
          items: prevItems.map((i) =>
            i.product.id === productId ? { ...i, quantity: clamped } : i,
          ),
        });

        if (!isLoggedIn) return;

        try {
          const res = await apiClient.patch<ApiResponse<ServerCart>>(
            ENDPOINTS.CART.ITEM(productId),
            { quantity: clamped },
          );
          set({ items: serverToLocal(res.data.data) });
        } catch (err: unknown) {
          set({ items: prevItems });
          const axiosErr = err as {
            response?: { data?: { message?: string } };
          };
          const message =
            axiosErr.response?.data?.message ?? 'Không thể cập nhật giỏ hàng';
          useToastStore.getState().addToast('error', message);
        }
      },

      clear: async () => {
        const { isLoggedIn } = useAuthStore.getState();
        const prevItems = get().items;
        set({ items: [] });

        if (!isLoggedIn) return;

        try {
          await apiClient.delete(ENDPOINTS.CART.BASE);
        } catch {
          // Revert on failure so UI matches server state
          set({ items: prevItems });
        }
      },

      clearLocal: () => set({ items: [] }),

      fetch: async () => {
        if (!useAuthStore.getState().isLoggedIn) return;
        set({ isLoading: true });
        try {
          const res = await apiClient.get<ApiResponse<ServerCart>>(
            ENDPOINTS.CART.BASE,
          );
          set({ items: serverToLocal(res.data.data) });
        } catch {
          // ignore fetch errors
        } finally {
          set({ isLoading: false });
        }
      },

      totalItems: () => get().items.reduce((sum, i) => sum + i.quantity, 0),

      totalPrice: () =>
        get().items.reduce((sum, i) => sum + i.product.price * i.quantity, 0),
    }),
    {
      name: 'nebula-cart',
      version: 2,
      partialize: (state) => ({ items: state.items }),
    },
  ),
);
