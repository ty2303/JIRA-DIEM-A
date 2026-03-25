export const FREE_SHIPPING_THRESHOLD = 500000;
export const DEFAULT_SHIPPING_FEE = 30000;

function toSafeMoney(value?: number | null): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    return 0;
  }

  return Math.round(value);
}

export function calculateOrderPricing(
  subtotal: number,
  discount?: number | null,
) {
  const safeSubtotal =
    typeof subtotal === 'number' && Number.isFinite(subtotal) && subtotal > 0
      ? Math.round(subtotal)
      : 0;
  const shippingFee =
    safeSubtotal >= FREE_SHIPPING_THRESHOLD ? 0 : DEFAULT_SHIPPING_FEE;
  const safeDiscount = Math.min(
    toSafeMoney(discount),
    safeSubtotal + shippingFee,
  );

  return {
    subtotal: safeSubtotal,
    shippingFee,
    discount: safeDiscount,
    total: Math.max(0, safeSubtotal + shippingFee - safeDiscount),
  };
}
