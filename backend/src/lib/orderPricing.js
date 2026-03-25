export const FREE_SHIPPING_THRESHOLD = 500000;
export const DEFAULT_SHIPPING_FEE = 30000;

function toSafeMoney(value) {
	const amount = Number(value);
	if (!Number.isFinite(amount) || amount <= 0) {
		return 0;
	}
	return Math.round(amount);
}

export function calculateOrderPricing(items, options = {}) {
	const subtotal = Array.isArray(items)
		? items.reduce((sum, item) => {
				const price = Number(item?.price) || 0;
				const quantity = Number(item?.quantity) || 0;
				return sum + price * quantity;
			}, 0)
		: 0;
	const shippingFee =
		subtotal >= FREE_SHIPPING_THRESHOLD ? 0 : DEFAULT_SHIPPING_FEE;
	const requestedDiscount = toSafeMoney(
		options.discount ?? options.discountAmount,
	);
	const discount = Math.min(requestedDiscount, subtotal + shippingFee);
	const total = Math.max(0, subtotal + shippingFee - discount);

	return {
		subtotal,
		shippingFee,
		discount,
		total,
	};
}
