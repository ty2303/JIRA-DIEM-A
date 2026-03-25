import { useEffect, useRef } from 'react';
import { Client } from '@stomp/stompjs';
import { useAuthStore } from '@/store/useAuthStore';
import { useToastStore } from '@/store/useToastStore';

/**
 * Listens for real-time role changes via WebSocket.
 * When the current user's role is changed by an admin,
 * updates the auth store and redirects accordingly.
 */
export function useRoleWebSocket() {
  const { token, user, syncRole } = useAuthStore();
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
        // Subscribe to role changes for the current user
        client.subscribe(`/user/queue/role-change`, (message) => {
          const data = JSON.parse(message.body);
          const newRole = data.newRole as 'USER' | 'ADMIN';

          if (newRole !== user.role) {
            syncRole(newRole);

            // Show toast notification
            const msg =
              newRole === 'USER'
                ? 'Quyền của bạn đã bị hạ xuống USER. Đang chuyển hướng...'
                : 'Bạn đã được nâng lên ADMIN. Đang chuyển hướng...';
            useToastStore
              .getState()
              .addToast(newRole === 'USER' ? 'warning' : 'info', msg);

            // Redirect after short delay so user sees the toast
            setTimeout(() => {
              if (newRole === 'USER') {
                window.location.href = '/';
              } else {
                window.location.href = '/admin';
              }
            }, 1500);
          }
        });
      },
    });

    client.activate();
    clientRef.current = client;

    return () => {
      client.deactivate();
      clientRef.current = null;
    };
  }, [syncRole, token, user]); // only reconnect when token or user changes
}
