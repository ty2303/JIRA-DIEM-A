import { create } from 'zustand';

import apiClient from '@/api/client';
import { ENDPOINTS } from '@/api/endpoints';
import type { ApiResponse } from '@/api/types';
import type { Order } from '@/types/order';

interface OrderState {
  orders: Order[];
  currentOrder: Order | null;
  isLoading: boolean;
  fetchOrders: () => Promise<void>;
  fetchOrderById: (orderId: string) => Promise<Order | null>;
  addOrder: (order: Order) => void;
  cancelOrder: (orderId: string, reason: string) => Promise<void>;
}

export const useOrderStore = create<OrderState>((set, get) => ({
  orders: [],
  currentOrder: null,
  isLoading: false,

  fetchOrders: async () => {
    set({ isLoading: true });
    try {
      const res = await apiClient.get<ApiResponse<Order[]>>(
        ENDPOINTS.ORDERS.MY,
      );
      set({ orders: res.data.data });
    } catch {
      set({ orders: [] });
    } finally {
      set({ isLoading: false });
    }
  },

  fetchOrderById: async (orderId) => {
    const existing = get().orders.find((order) => order.id === orderId);
    if (existing) {
      set({ currentOrder: existing });
      return existing;
    }

    set({ isLoading: true });
    try {
      const res = await apiClient.get<ApiResponse<Order>>(
        ENDPOINTS.ORDERS.BY_ID(orderId),
      );
      const order = res.data.data;
      set({
        currentOrder: order,
        orders: [order, ...get().orders.filter((item) => item.id !== order.id)],
      });
      return order;
    } catch {
      set({ currentOrder: null });
      return null;
    } finally {
      set({ isLoading: false });
    }
  },

  addOrder: (order) => {
    set({
      currentOrder: order,
      orders: [order, ...get().orders.filter((item) => item.id !== order.id)],
    });
  },

  cancelOrder: async (orderId, reason) => {
    await apiClient.patch(
      ENDPOINTS.ORDERS.CANCEL(orderId),
      {},
      {
        params: { reason },
      },
    );
    const currentOrder = get().currentOrder;
    set({
      currentOrder:
        currentOrder && currentOrder.id === orderId
          ? {
              ...currentOrder,
              status: 'CANCELLED' as const,
              paymentStatus: 'FAILED',
              cancelReason: reason,
              cancelledBy: 'USER',
            }
          : currentOrder,
      orders: get().orders.map((o) =>
        o.id === orderId
          ? {
              ...o,
              status: 'CANCELLED' as const,
              paymentStatus: 'FAILED',
              cancelReason: reason,
              cancelledBy: 'USER',
            }
          : o,
      ),
    });
  },
}));
