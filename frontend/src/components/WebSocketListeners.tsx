import { useOrderWebSocket } from '@/hooks/useOrderWebSocket';
import { useRoleWebSocket } from '@/hooks/useRoleWebSocket';

export default function WebSocketListeners() {
  useRoleWebSocket();
  useOrderWebSocket();
  return null;
}
