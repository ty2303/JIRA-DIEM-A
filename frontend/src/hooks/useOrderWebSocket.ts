import { useEffect, useRef } from 'react';
import { Client } from '@stomp/stompjs';
import { useAuthStore } from '@/store/useAuthStore';
import { useToastStore } from '@/store/useToastStore';

const STATUS_LABEL: Record<string, string> = {
  PENDING: 'Chờ xác nhận',
  CONFIRMED: 'Đã xác nhận',
  SHIPPING: 'Đang giao hàng',
  DELIVERED: 'Đã giao hàng',
  CANCELLED: 'Đã hủy',
};

/**
 * Listens for real-time order status changes via WebSocket.
 * When admin updates an order belonging to this user, show a toast.
 */
export function useOrderWebSocket() {
  const { token, user } = useAuthStore();
  const clientRef = useRef<Client | null>(null);

  useEffect(() => {
    if (!token || !user) return;

    const backendUrl =
      import.meta.env.VITE_BACKEND_URL ??
      import.meta.env.VITE_API_BASE_URL?.replace(/\/api$/, '') ??
      'http://localhost:8080';
    const brokerURL = backendUrl.replace(/^http/, 'ws') + '/ws';

    const client = new Client({
      brokerURL,
      connectHeaders: {
        Authorization: `Bearer ${token}`,
      },
      reconnectDelay: 5000,
      onConnect: () => {
        client.subscribe(`/user/queue/order-status`, (message) => {
          const data = JSON.parse(message.body);
          const newStatus = data.newStatus as string;
          const orderId = (data.orderId as string) ?? '';
          const shortId = orderId.slice(-6).toUpperCase();

          const label = STATUS_LABEL[newStatus] ?? newStatus;
          const type = newStatus === 'CANCELLED' ? 'warning' : 'info';
          useToastStore
            .getState()
            .addToast(type, `Đơn hàng #${shortId}: ${label}`);
        });
      },
    });

    client.activate();
    clientRef.current = client;

    return () => {
      client.deactivate();
      clientRef.current = null;
    };
  }, [token, user]);
}
