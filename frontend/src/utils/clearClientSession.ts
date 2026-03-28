import { useAuthStore } from '@/store/useAuthStore';
import { useCartStore } from '@/store/useCartStore';
import { useOrderStore } from '@/store/useOrderStore';
import { useWishlistStore } from '@/store/useWishlistStore';

export function clearClientSession() {
  useOrderStore.getState().reset();
  useWishlistStore.getState().reset({ preserveGuest: true });
  useCartStore.getState().clearLocal();
  useAuthStore.getState().logout();
}
