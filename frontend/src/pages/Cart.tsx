import {
  ArrowLeft,
  ArrowRight,
  Minus,
  Plus,
  ShoppingCart,
  Trash2,
  X,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { Link } from 'react-router';

import {
  calculateOrderPricing,
  FREE_SHIPPING_THRESHOLD,
} from '@/lib/orderPricing';
import { MAX_QUANTITY, useCartStore } from '@/store/useCartStore';

export const Component = Cart;

function Cart() {
  const items = useCartStore((s) => s.items);
  const removeItem = useCartStore((s) => s.removeItem);
  const updateQuantity = useCartStore((s) => s.updateQuantity);
  const clear = useCartStore((s) => s.clear);
  const totalPrice = useCartStore((s) => s.totalPrice());
  const totalItems = useCartStore((s) => s.totalItems());

  const pricing = calculateOrderPricing(totalPrice);

  const handleClearAll = () => {
    if (
      window.confirm('Bạn có chắc muốn xóa tất cả sản phẩm trong giỏ hàng?')
    ) {
      clear();
    }
  };

  return (
    <section
      className="mx-auto max-w-7xl px-6 py-24 lg:py-32"
      aria-labelledby="cart-heading"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1
            id="cart-heading"
            className="font-display text-3xl font-bold text-text-primary lg:text-4xl"
          >
            Giỏ hàng
          </h1>
          <p className="mt-1 text-text-secondary">
            {totalItems > 0 ? `${totalItems} sản phẩm` : 'Chưa có sản phẩm nào'}
          </p>
        </div>

        {items.length > 0 && (
          <button
            type="button"
            onClick={handleClearAll}
            className="flex cursor-pointer items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-medium text-text-muted transition-colors hover:border-red-500 hover:text-red-500"
            aria-label="Xóa tất cả sản phẩm trong giỏ hàng"
          >
            <Trash2 className="h-4 w-4" />
            Xóa tất cả
          </button>
        )}
      </div>

      {/* Content */}
      {items.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-20 flex flex-col items-center text-center"
        >
          <div className="flex h-24 w-24 items-center justify-center rounded-full bg-surface-alt">
            <ShoppingCart className="h-10 w-10 text-text-muted" />
          </div>
          <h2 className="mt-6 font-display text-xl font-semibold text-text-primary">
            Giỏ hàng trống
          </h2>
          <p className="mt-2 max-w-md text-text-secondary">
            Hãy khám phá các sản phẩm và thêm vào giỏ hàng của bạn.
          </p>
          <Link to="/products" className="btn-primary mt-6 no-underline">
            Khám phá sản phẩm
          </Link>
        </motion.div>
      ) : (
        <div className="mt-10 grid gap-8 lg:grid-cols-3">
          {/* Item list */}
          <div
            className="space-y-4 lg:col-span-2"
            role="list"
            aria-label="Sản phẩm trong giỏ hàng"
          >
            <AnimatePresence mode="popLayout">
              {items.map(({ product, quantity }) => (
                <motion.div
                  key={product.id}
                  layout
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20, height: 0 }}
                  transition={{ duration: 0.3 }}
                  className="flex gap-4 rounded-2xl border border-border bg-surface p-4 sm:gap-6"
                  role="listitem"
                >
                  {/* Image */}
                  <Link
                    to={`/products/${product.id}`}
                    className="flex-shrink-0"
                  >
                    <div className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-xl bg-surface-alt sm:h-28 sm:w-28">
                      <img
                        src={product.image}
                        alt={product.name}
                        className="h-full w-auto object-contain p-2"
                        loading="lazy"
                      />
                    </div>
                  </Link>

                  {/* Details */}
                  <div className="flex min-w-0 flex-1 flex-col justify-between">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-xs font-medium uppercase tracking-wider text-text-muted">
                          {product.brand}
                        </p>
                        <Link
                          to={`/products/${product.id}`}
                          className="mt-0.5 block font-display text-sm font-semibold text-text-primary no-underline transition-colors hover:text-brand sm:text-base"
                        >
                          {product.name}
                        </Link>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeItem(product.id)}
                        className="flex-shrink-0 cursor-pointer rounded-lg p-1.5 text-text-muted transition-colors hover:bg-surface-alt hover:text-red-500"
                        aria-label={`Xóa ${product.name} khỏi giỏ hàng`}
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>

                    <div className="mt-3 flex items-end justify-between">
                      {/* Quantity controls */}
                      <div
                        className="flex items-center gap-1"
                        role="group"
                        aria-label={`Số lượng ${product.name}`}
                      >
                        <button
                          type="button"
                          onClick={() =>
                            updateQuantity(product.id, quantity - 1)
                          }
                          className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg border border-border text-text-secondary transition-colors hover:border-brand hover:text-brand"
                          aria-label="Giảm số lượng"
                        >
                          <Minus className="h-3.5 w-3.5" />
                        </button>
                        <span
                          className="flex h-8 w-10 items-center justify-center text-sm font-semibold text-text-primary"
                          aria-live="polite"
                          aria-atomic="true"
                        >
                          {quantity}
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            updateQuantity(product.id, quantity + 1)
                          }
                          disabled={
                            quantity >= Math.min(MAX_QUANTITY, product.stock)
                          }
                          className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg border border-border text-text-secondary transition-colors hover:border-brand hover:text-brand disabled:cursor-not-allowed disabled:opacity-50"
                          aria-label="Tăng số lượng"
                        >
                          <Plus className="h-3.5 w-3.5" />
                        </button>
                      </div>

                      {/* Price */}
                      <div className="text-right">
                        <span className="font-display text-base font-bold text-brand sm:text-lg">
                          {(product.price * quantity).toLocaleString('vi-VN')}₫
                        </span>
                        {quantity > 1 && (
                          <p className="text-xs text-text-muted">
                            {product.price.toLocaleString('vi-VN')}₫ / sản phẩm
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>

          {/* Order summary */}
          <div className="lg:col-span-1">
            <div className="sticky top-28 rounded-2xl border border-border bg-surface p-6">
              <h2 className="font-display text-lg font-bold text-text-primary">
                Tóm tắt đơn hàng
              </h2>

              <div className="mt-5 space-y-3 border-b border-border pb-5">
                <div className="flex justify-between text-sm">
                  <span className="text-text-secondary">
                    Tạm tính ({totalItems} sản phẩm)
                  </span>
                  <span className="font-medium text-text-primary">
                    {pricing.subtotal.toLocaleString('vi-VN')}₫
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-text-secondary">Phí vận chuyển</span>
                  <span className="font-medium text-text-primary">
                    {pricing.shippingFee === 0
                      ? 'Miễn phí'
                      : `${pricing.shippingFee.toLocaleString('vi-VN')}₫`}
                  </span>
                </div>
                {pricing.shippingFee > 0 && (
                  <p className="text-xs text-text-muted">
                    Miễn phí vận chuyển cho đơn hàng từ{' '}
                    {FREE_SHIPPING_THRESHOLD.toLocaleString('vi-VN')}₫
                  </p>
                )}
              </div>

              <div className="mt-5 flex items-center justify-between">
                <span className="font-display text-base font-bold text-text-primary">
                  Tổng cộng
                </span>
                <span className="font-display text-xl font-bold text-brand">
                  {pricing.total.toLocaleString('vi-VN')}₫
                </span>
              </div>

              <Link
                to="/checkout"
                className="group relative mt-6 flex w-full items-center justify-center gap-3 overflow-hidden rounded-xl bg-brand py-4 text-center font-display text-sm font-bold tracking-wide text-white no-underline shadow-lg transition-all hover:shadow-xl hover:-translate-y-0.5"
              >
                <span>Tiến hành thanh toán</span>
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </Link>

              <Link
                to="/products"
                className="group mt-3 flex w-full items-center justify-center gap-2.5 rounded-xl border border-border bg-surface-alt py-4 text-center font-display text-sm font-semibold text-text-primary no-underline transition-all duration-200 hover:bg-surface hover:text-brand active:scale-[0.98]"
              >
                <ArrowLeft className="h-5 w-5 transition-transform duration-200 group-hover:-translate-x-1" />
                <span>Tiếp tục mua sắm</span>
              </Link>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
