import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import apiClient from '@/api/client';
import { ENDPOINTS } from '@/api/endpoints';
import { useAuthStore } from '@/store/useAuthStore';
import type { ApiResponse } from '@/api/types';
import type { Product } from '@/types/product';

const GUEST_WISHLIST_KEY = 'guest';

const isProductArray = (value: unknown): value is Product[] =>
  Array.isArray(value);

const sanitizeItemsByOwner = (value: unknown): WishlistPersistedBuckets => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }

  return Object.entries(value).reduce<WishlistPersistedBuckets>(
    (accumulator, [ownerKey, items]) => {
      if (isProductArray(items)) {
        accumulator[ownerKey] = items;
      }

      return accumulator;
    },
    {},
  );
};

const sanitizeOwnerKey = (value: unknown) =>
  typeof value === 'string' && value.trim().length > 0
    ? value.trim()
    : GUEST_WISHLIST_KEY;

interface WishlistPersistedBuckets {
  [ownerKey: string]: Product[];
}

interface WishlistState {
  items: Product[];
  itemsByOwner: WishlistPersistedBuckets;
  isLoading: boolean;
  currentOwnerKey: string;
  error: string | null;
  toggle: (product: Product) => Promise<void>;
  has: (id: string) => boolean;
  fetch: (options?: { skipAuthRedirect?: boolean }) => Promise<void>;
  clear: () => Promise<void>;
  clearLocal: () => void;
  syncSession: (options?: { skipAuthRedirect?: boolean }) => Promise<void>;
  reset: (options?: { preserveGuest?: boolean }) => void;
}

const getOwnerKey = () =>
  useAuthStore.getState().user?.id?.trim() || GUEST_WISHLIST_KEY;

export const useWishlistStore = create<WishlistState>()(
  persist(
    (set, get) => ({
      items: [],
      itemsByOwner: {},
      isLoading: false,
      currentOwnerKey: GUEST_WISHLIST_KEY,
      error: null,

      toggle: async (product) => {
        const { isLoggedIn } = useAuthStore.getState();
        const prevItems = get().items;
        const ownerKey = get().currentOwnerKey;
        const exists = prevItems.some((p) => p.id === product.id);
        const nextItems = exists
          ? prevItems.filter((p) => p.id !== product.id)
          : [...prevItems, product];

        // Optimistic update
        set((state) => ({
          error: null,
          items: nextItems,
          itemsByOwner: {
            ...state.itemsByOwner,
            [ownerKey]: nextItems,
          },
        }));

        if (!isLoggedIn) return;

        try {
          const res = await apiClient.post<ApiResponse<Product[]>>(
            ENDPOINTS.WISHLIST.TOGGLE(product.id),
          );
          set((state) => ({
            items: res.data.data,
            error: null,
            itemsByOwner: {
              ...state.itemsByOwner,
              [ownerKey]: res.data.data,
            },
          }));
        } catch {
          // Revert on error
          set((state) => ({
            items: prevItems,
            error: 'Khong the cap nhat wishlist luc nay.',
            itemsByOwner: {
              ...state.itemsByOwner,
              [ownerKey]: prevItems,
            },
          }));
        }
      },

      has: (id) => get().items.some((p) => p.id === id),

      fetch: async (options) => {
        const { isLoggedIn } = useAuthStore.getState();
        const ownerKey = getOwnerKey();

        if (!isLoggedIn) {
          set((state) => ({
            currentOwnerKey: GUEST_WISHLIST_KEY,
            items: state.itemsByOwner[GUEST_WISHLIST_KEY] ?? [],
            isLoading: false,
            error: null,
          }));
          return;
        }

        set({ isLoading: true, error: null });
        try {
          const res = await apiClient.get<ApiResponse<Product[]>>(
            ENDPOINTS.WISHLIST.BASE,
            {
              skipAuthRedirect: options?.skipAuthRedirect,
            },
          );
          set((state) => ({
            currentOwnerKey: ownerKey,
            items: res.data.data,
            error: null,
            itemsByOwner: {
              ...state.itemsByOwner,
              [ownerKey]: res.data.data,
            },
          }));
        } catch {
          set({ error: 'Khong the tai wishlist tu he thong.' });
        } finally {
          set({ isLoading: false });
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
        if (!isLoggedIn) return;
        try {
          await apiClient.delete(ENDPOINTS.WISHLIST.BASE);
        } catch {
          set((state) => ({
            items: prevItems,
            error: 'Khong the xoa wishlist luc nay.',
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

      syncSession: async (options) => {
        const { isLoggedIn } = useAuthStore.getState();
        const nextOwnerKey = getOwnerKey();
        const prevOwnerKey = get().currentOwnerKey;
        const prevGuestItems = get().itemsByOwner[GUEST_WISHLIST_KEY] ?? [];
        const nextItems = get().itemsByOwner[nextOwnerKey] ?? [];

        if (prevOwnerKey !== nextOwnerKey) {
          set({
            currentOwnerKey: nextOwnerKey,
            items: nextItems,
            error: null,
          });
        }

        if (!isLoggedIn || nextOwnerKey === GUEST_WISHLIST_KEY) {
          return;
        }

        const shouldMergeGuestItems =
          prevOwnerKey === GUEST_WISHLIST_KEY && prevGuestItems.length > 0;

        if (shouldMergeGuestItems) {
          set({ isLoading: true, error: null });
          try {
            const res = await apiClient.post<ApiResponse<Product[]>>(
              ENDPOINTS.WISHLIST.SYNC,
              {
                productIds: prevGuestItems.map((item) => item.id),
              },
              {
                skipAuthRedirect: options?.skipAuthRedirect,
              },
            );
            set((state) => {
              const restBuckets = { ...state.itemsByOwner };
              delete restBuckets[GUEST_WISHLIST_KEY];

              return {
                currentOwnerKey: nextOwnerKey,
                items: res.data.data,
                isLoading: false,
                error: null,
                itemsByOwner: {
                  ...restBuckets,
                  [nextOwnerKey]: res.data.data,
                },
              };
            });
          } catch {
            set({
              isLoading: false,
              error: 'Khong the tai wishlist tu he thong.',
            });
          }
          return;
        }

        await get().fetch(options);
      },

      reset: (options) =>
        set((state) => {
          const guestItems = options?.preserveGuest
            ? state.itemsByOwner[GUEST_WISHLIST_KEY] ?? []
            : [];
          const nextItemsByOwner: WishlistPersistedBuckets = guestItems.length
            ? { [GUEST_WISHLIST_KEY]: guestItems }
            : {};

          return {
            items: guestItems,
            itemsByOwner: nextItemsByOwner,
            isLoading: false,
            currentOwnerKey: GUEST_WISHLIST_KEY,
            error: null,
          };
        }),
    }),
    {
      name: 'nebula-wishlist',
      version: 2,
      partialize: (state) => ({
        itemsByOwner: state.itemsByOwner,
        currentOwnerKey: state.currentOwnerKey,
      }),
      merge: (persistedState, currentState) => {
        const persisted = (persistedState as Partial<WishlistState>) ?? {};
        const itemsByOwner = sanitizeItemsByOwner(persisted.itemsByOwner);
        const currentOwnerKey = sanitizeOwnerKey(
          persisted.currentOwnerKey ?? currentState.currentOwnerKey,
        );
        const items = itemsByOwner[currentOwnerKey];

        return {
          ...currentState,
          itemsByOwner,
          currentOwnerKey,
          items: isProductArray(items) ? items : [],
        };
      },
    },
  ),
);
