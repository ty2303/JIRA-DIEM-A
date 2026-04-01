import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import apiClient from '@/api/client';
import { ENDPOINTS } from '@/api/endpoints';
import type { ApiResponse } from '@/api/types';
import { useAuthStore } from '@/store/useAuthStore';
import { useToastStore } from '@/store/useToastStore';
import type { Product } from '@/types/product';

export const MAX_QUANTITY = 99;
const GUEST_CART_KEY = 'guest';

export interface CartItem {
  product: Product;
  quantity: number;
}

interface CartPersistedBuckets {
  [ownerKey: string]: CartItem[];
}

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
  itemsByOwner: CartPersistedBuckets;
  isLoading: boolean;
  currentOwnerKey: string;
  error: string | null;
  addItem: (product: Product) => Promise<boolean>;
  removeItem: (productId: string) => Promise<void>;
  updateQuantity: (productId: string, quantity: number) => Promise<void>;
  clear: () => Promise<void>;
  clearLocal: () => void;
  fetch: (options?: { skipAuthRedirect?: boolean }) => Promise<void>;
  syncSession: (options?: { skipAuthRedirect?: boolean }) => Promise<void>;
  reset: (options?: { preserveGuest?: boolean }) => void;
  totalItems: () => number;
  totalPrice: () => number;
}

const getOwnerKey = () =>
  useAuthStore.getState().user?.id?.trim() || GUEST_CART_KEY;

const isCartItemArray = (value: unknown): value is CartItem[] =>
  Array.isArray(value) &&
  value.every(
    (entry) =>
      entry &&
      typeof entry === 'object' &&
      'product' in entry &&
      'quantity' in entry &&
      entry.product &&
      typeof entry.quantity === 'number',
  );

const sanitizeOwnerKey = (value: unknown) =>
  typeof value === 'string' && value.trim().length > 0
    ? value.trim()
    : GUEST_CART_KEY;

const sanitizeItemsByOwner = (value: unknown): CartPersistedBuckets => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }

  return Object.entries(value).reduce<CartPersistedBuckets>(
    (accumulator, [ownerKey, items]) => {
      if (isCartItemArray(items)) {
        accumulator[ownerKey] = items;
      }

      return accumulator;
    },
    {},
  );
};

function serverToLocal(server: ServerCart): CartItem[] {
  return server.items.map((item) => ({
    product: item.product,
    quantity: item.quantity,
  }));
}

function getMaxAllowedQuantity(product: Product) {
  return Math.min(MAX_QUANTITY, Math.max(product.stock, 0));
}

function getStockExceededMessage(product: Product) {
  if (product.stock <= 0) {
    return 'Sản phẩm đã hết hàng';
  }

  return `Chỉ còn ${product.stock} sản phẩm`;
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      itemsByOwner: {},
      isLoading: false,
      currentOwnerKey: GUEST_CART_KEY,
      error: null,

      addItem: async (product) => {
        const { isLoggedIn } = useAuthStore.getState();
        const addToast = useToastStore.getState().addToast;
        const prevItems = get().items;
        const ownerKey = get().currentOwnerKey;
        const existing = prevItems.find((item) => item.product.id === product.id);
        const maxAllowedQuantity = getMaxAllowedQuantity(product);

        if (maxAllowedQuantity <= 0) {
          addToast('error', getStockExceededMessage(product));
          return false;
        }

        if ((existing?.quantity ?? 0) >= maxAllowedQuantity) {
          addToast('error', getStockExceededMessage(product));
          return false;
        }

        const nextItems = existing
          ? prevItems.map((item) =>
              item.product.id === product.id
                ? {
                    ...item,
                    quantity: Math.min(item.quantity + 1, maxAllowedQuantity),
                  }
                : item,
            )
          : [...prevItems, { product, quantity: 1 }];

        set((state) => ({
          error: null,
          items: nextItems,
          itemsByOwner: {
            ...state.itemsByOwner,
            [ownerKey]: nextItems,
          },
        }));

        if (!isLoggedIn) {
          addToast('success', `Đã thêm ${product.name} vào giỏ hàng`);
          return true;
        }

        try {
          const res = await apiClient.post<ApiResponse<ServerCart>>(
            ENDPOINTS.CART.ITEMS,
            {
              productId: product.id,
              quantity: 1,
            },
          );
          const serverItems = serverToLocal(res.data.data);
          set((state) => ({
            items: serverItems,
            error: null,
            itemsByOwner: {
              ...state.itemsByOwner,
              [ownerKey]: serverItems,
            },
          }));
          addToast('success', `Đã thêm ${product.name} vào giỏ hàng`);
          return true;
        } catch (err: unknown) {
          const axiosErr = err as {
            response?: { data?: { message?: string } };
          };
          const message =
            axiosErr.response?.data?.message ?? 'Không thể thêm vào giỏ hàng';

          set((state) => ({
            items: prevItems,
            error: message,
            itemsByOwner: {
              ...state.itemsByOwner,
              [ownerKey]: prevItems,
            },
          }));
          addToast('error', message);
          return false;
        }
      },

      removeItem: async (productId) => {
        const { isLoggedIn } = useAuthStore.getState();
        const addToast = useToastStore.getState().addToast;
        const prevItems = get().items;
        const ownerKey = get().currentOwnerKey;
        const removedItem = prevItems.find((item) => item.product.id === productId);

        set((state) => ({
          error: null,
          items: prevItems.filter((item) => item.product.id !== productId),
          itemsByOwner: {
            ...state.itemsByOwner,
            [ownerKey]: prevItems.filter((item) => item.product.id !== productId),
          },
        }));

        if (!removedItem) {
          return;
        }

        if (!isLoggedIn) {
          addToast('success', `Đã xóa ${removedItem.product.name} khỏi giỏ hàng`);
          return;
        }

        try {
          const res = await apiClient.delete<ApiResponse<ServerCart>>(
            ENDPOINTS.CART.ITEM(productId),
          );
          const serverItems = serverToLocal(res.data.data);
          set((state) => ({
            items: serverItems,
            error: null,
            itemsByOwner: {
              ...state.itemsByOwner,
              [ownerKey]: serverItems,
            },
          }));
          addToast('success', `Đã xóa ${removedItem.product.name} khỏi giỏ hàng`);
        } catch (err: unknown) {
          const axiosErr = err as {
            response?: { data?: { message?: string } };
          };
          const message =
            axiosErr.response?.data?.message ??
            'Không thể xóa sản phẩm khỏi giỏ hàng';

          set((state) => ({
            items: prevItems,
            error: message,
            itemsByOwner: {
              ...state.itemsByOwner,
              [ownerKey]: prevItems,
            },
          }));
          addToast('error', message);
        }
      },

      updateQuantity: async (productId, quantity) => {
        if (quantity <= 0) {
          await get().removeItem(productId);
          return;
        }

        const { isLoggedIn } = useAuthStore.getState();
        const addToast = useToastStore.getState().addToast;
        const prevItems = get().items;
        const ownerKey = get().currentOwnerKey;
        const targetItem = prevItems.find((item) => item.product.id === productId);

        if (!targetItem) {
          return;
        }

        const maxAllowedQuantity = isLoggedIn
          ? MAX_QUANTITY
          : getMaxAllowedQuantity(targetItem.product);

        if (maxAllowedQuantity <= 0) {
          await get().removeItem(productId);
          return;
        }

        const clamped = Math.min(quantity, maxAllowedQuantity);

        if (!isLoggedIn && clamped !== quantity) {
          addToast('error', getStockExceededMessage(targetItem.product));
        }

        const nextItems = prevItems.map((item) =>
          item.product.id === productId ? { ...item, quantity: clamped } : item,
        );

        set((state) => ({
          error: null,
          items: nextItems,
          itemsByOwner: {
            ...state.itemsByOwner,
            [ownerKey]: nextItems,
          },
        }));

        if (!isLoggedIn) {
          return;
        }

        try {
          const res = await apiClient.patch<ApiResponse<ServerCart>>(
            ENDPOINTS.CART.ITEM(productId),
            { quantity: clamped },
          );
          const serverItems = serverToLocal(res.data.data);
          set((state) => ({
            items: serverItems,
            error: null,
            itemsByOwner: {
              ...state.itemsByOwner,
              [ownerKey]: serverItems,
            },
          }));
        } catch (err: unknown) {
          const axiosErr = err as {
            response?: { data?: { message?: string } };
          };
          const message =
            axiosErr.response?.data?.message ?? 'Không thể cập nhật giỏ hàng';

          set((state) => ({
            items: prevItems,
            error: message,
            itemsByOwner: {
              ...state.itemsByOwner,
              [ownerKey]: prevItems,
            },
          }));
          addToast('error', message);
        }
      },

      clear: async () => {
        const { isLoggedIn } = useAuthStore.getState();
        const prevItems = get().items;
        const ownerKey = get().currentOwnerKey;

        set((state) => ({
          items: [],
          error: null,
          itemsByOwner: {
            ...state.itemsByOwner,
            [ownerKey]: [],
          },
        }));

        if (!isLoggedIn) {
          return;
        }

        try {
          await apiClient.delete(ENDPOINTS.CART.BASE);
        } catch {
          set((state) => ({
            items: prevItems,
            error: 'Không thể xóa giỏ hàng lúc này.',
            itemsByOwner: {
              ...state.itemsByOwner,
              [ownerKey]: prevItems,
            },
          }));
        }
      },

      clearLocal: () => {
        const ownerKey = get().currentOwnerKey;
        set((state) => ({
          items: [],
          error: null,
          itemsByOwner: {
            ...state.itemsByOwner,
            [ownerKey]: [],
          },
        }));
      },

      fetch: async (options) => {
        const { isLoggedIn } = useAuthStore.getState();
        const ownerKey = getOwnerKey();

        if (!isLoggedIn) {
          set((state) => ({
            currentOwnerKey: GUEST_CART_KEY,
            items: state.itemsByOwner[GUEST_CART_KEY] ?? [],
            isLoading: false,
            error: null,
          }));
          return;
        }

        set({ isLoading: true, error: null });

        try {
          const res = await apiClient.get<ApiResponse<ServerCart>>(
            ENDPOINTS.CART.BASE,
            {
              skipAuthRedirect: options?.skipAuthRedirect,
            },
          );
          const serverItems = serverToLocal(res.data.data);

          set((state) => ({
            currentOwnerKey: ownerKey,
            items: serverItems,
            error: null,
            itemsByOwner: {
              ...state.itemsByOwner,
              [ownerKey]: serverItems,
            },
          }));
        } catch {
          set({ error: 'Không thể tải giỏ hàng từ hệ thống.' });
        } finally {
          set({ isLoading: false });
        }
      },

      syncSession: async (options) => {
        if (get().isLoading) {
          return;
        }

        const { isLoggedIn } = useAuthStore.getState();
        const nextOwnerKey = getOwnerKey();
        const prevOwnerKey = get().currentOwnerKey;
        const prevGuestItems = get().itemsByOwner[GUEST_CART_KEY] ?? [];
        const nextItems = get().itemsByOwner[nextOwnerKey] ?? [];

        if (prevOwnerKey !== nextOwnerKey) {
          set({
            currentOwnerKey: nextOwnerKey,
            items: nextItems,
            error: null,
          });
        }

        if (!isLoggedIn || nextOwnerKey === GUEST_CART_KEY) {
          return;
        }

        const shouldMergeGuestItems =
          prevOwnerKey === GUEST_CART_KEY && prevGuestItems.length > 0;

        if (!shouldMergeGuestItems) {
          await get().fetch(options);
          return;
        }

        set({ isLoading: true, error: null });

        const failedGuestItems: CartItem[] = [];
        const mergedGuestItems: CartItem[] = [];

        try {
          for (const guestItem of prevGuestItems) {
            try {
              await apiClient.post<ApiResponse<ServerCart>>(
                ENDPOINTS.CART.ITEMS,
                {
                  productId: guestItem.product.id,
                  quantity: guestItem.quantity,
                },
                {
                  skipAuthRedirect: options?.skipAuthRedirect,
                },
              );
              mergedGuestItems.push(guestItem);
            } catch {
              failedGuestItems.push(guestItem);
            }
          }

          const res = await apiClient.get<ApiResponse<ServerCart>>(
            ENDPOINTS.CART.BASE,
            {
              skipAuthRedirect: options?.skipAuthRedirect,
            },
          );
          const serverItems = serverToLocal(res.data.data);

          set((state) => {
            const nextBuckets = { ...state.itemsByOwner };

            if (failedGuestItems.length > 0) {
              nextBuckets[GUEST_CART_KEY] = failedGuestItems;
            } else {
              delete nextBuckets[GUEST_CART_KEY];
            }

            nextBuckets[nextOwnerKey] = serverItems;

            return {
              currentOwnerKey: nextOwnerKey,
              items: serverItems,
              isLoading: false,
              error:
                failedGuestItems.length > 0
                  ? 'Một số sản phẩm khách vãng lai không thể đồng bộ vào giỏ hàng.'
                  : null,
              itemsByOwner: nextBuckets,
            };
          });
        } catch {
          set((state) => {
            const nextBuckets = { ...state.itemsByOwner };

            if (failedGuestItems.length > 0) {
              nextBuckets[GUEST_CART_KEY] = failedGuestItems;
            } else {
              delete nextBuckets[GUEST_CART_KEY];
            }

            return {
              currentOwnerKey: nextOwnerKey,
              items: state.itemsByOwner[nextOwnerKey] ?? state.items,
              isLoading: false,
              error:
                mergedGuestItems.length > 0
                  ? 'Đã đồng bộ một phần giỏ hàng, vui lòng tải lại để nhận trạng thái mới nhất.'
                  : 'Không thể tải giỏ hàng từ hệ thống.',
              itemsByOwner: nextBuckets,
            };
          });
        }
      },

      reset: (options) =>
        set((state) => {
          const guestItems = options?.preserveGuest
            ? (state.itemsByOwner[GUEST_CART_KEY] ?? [])
            : [];
          const nextItemsByOwner: CartPersistedBuckets = guestItems.length
            ? { [GUEST_CART_KEY]: guestItems }
            : {};

          return {
            items: guestItems,
            itemsByOwner: nextItemsByOwner,
            isLoading: false,
            currentOwnerKey: GUEST_CART_KEY,
            error: null,
          };
        }),

      totalItems: () => get().items.reduce((sum, item) => sum + item.quantity, 0),

      totalPrice: () =>
        get().items.reduce(
          (sum, item) => sum + item.product.price * item.quantity,
          0,
        ),
    }),
    {
      name: 'nebula-cart',
      version: 3,
      partialize: (state) => ({
        itemsByOwner: state.itemsByOwner,
        currentOwnerKey: state.currentOwnerKey,
      }),
      merge: (persistedState, currentState) => {
        const persisted = (persistedState as Partial<CartState>) ?? {};
        const itemsByOwner = sanitizeItemsByOwner(persisted.itemsByOwner);
        const currentOwnerKey = sanitizeOwnerKey(
          persisted.currentOwnerKey ?? currentState.currentOwnerKey,
        );
        const items = itemsByOwner[currentOwnerKey];

        return {
          ...currentState,
          itemsByOwner,
          currentOwnerKey,
          items: isCartItemArray(items) ? items : [],
        };
      },
    },
  ),
);
