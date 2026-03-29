import type { OrderItem, PaymentMethod } from '@/types/order';

const STORAGE_KEY = 'nebula-pending-momo-checkout';

export interface PendingMomoCheckout {
  orderId: string;
  paymentMethod: PaymentMethod;
  createdAt: string;
  cartSignature: string;
}

export function buildCheckoutCartSignature(
  items: Array<Pick<OrderItem, 'productId' | 'quantity'>>,
) {
  return [...items]
    .map((item) => `${item.productId}:${item.quantity}`)
    .sort()
    .join('|');
}

function hasSessionStorage() {
  return typeof window !== 'undefined' && typeof window.sessionStorage !== 'undefined';
}

export function getPendingMomoCheckout(): PendingMomoCheckout | null {
  if (!hasSessionStorage()) return null;

  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as Partial<PendingMomoCheckout>;
    if (
      typeof parsed.orderId !== 'string' ||
      parsed.orderId.trim() === '' ||
      parsed.paymentMethod !== 'MOMO' ||
      typeof parsed.createdAt !== 'string' ||
      typeof parsed.cartSignature !== 'string'
    ) {
      return null;
    }

    return {
      orderId: parsed.orderId,
      paymentMethod: parsed.paymentMethod,
      createdAt: parsed.createdAt,
      cartSignature: parsed.cartSignature,
    };
  } catch {
    return null;
  }
}

export function setPendingMomoCheckout(orderId: string, cartSignature: string) {
  if (!hasSessionStorage()) return;

  window.sessionStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      orderId,
      paymentMethod: 'MOMO',
      createdAt: new Date().toISOString(),
      cartSignature,
    } satisfies PendingMomoCheckout),
  );
}

export function clearPendingMomoCheckout() {
  if (!hasSessionStorage()) return;
  window.sessionStorage.removeItem(STORAGE_KEY);
}
