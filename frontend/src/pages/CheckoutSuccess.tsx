import {
  Check,
  ClipboardList,
  CreditCard,
  Loader2,
  MapPin,
  Receipt,
  ShoppingBag,
} from 'lucide-react';
import { motion } from 'motion/react';
import { useEffect, useState } from 'react';
import { Link, Navigate, useLocation, useSearchParams } from 'react-router';

import { useOrderStore } from '@/store/useOrderStore';
import { ORDER_STATUS_LABEL } from '@/types/order';

export const Component = CheckoutSuccess;

type CheckoutSuccessState = {
  fromCheckout?: boolean;
  orderId?: string;
} | null;

function formatCurrency(value: number) {
  return `${value.toLocaleString('vi-VN')}₫`;
}

function getPaymentMethodLabel(paymentMethod?: string) {
  if (paymentMethod === 'COD') return 'Thanh toán khi nhận hàng';
  return paymentMethod ?? 'Chưa xác định';
}

function getPaymentStatusLabel(paymentStatus?: string, paymentMethod?: string) {
  if (paymentMethod === 'COD' && paymentStatus === 'UNPAID') {
    return 'Thanh toán khi nhận hàng';
  }

  switch (paymentStatus) {
    case 'PAID':
      return 'Đã thanh toán';
    case 'UNPAID':
      return 'Chưa thanh toán';
    default:
      return paymentStatus ?? 'Chưa cập nhật';
  }
}

function CheckoutSuccess() {
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const fetchOrderById = useOrderStore((store) => store.fetchOrderById);
  const currentOrder = useOrderStore((store) => store.currentOrder);
  const isLoading = useOrderStore((store) => store.isLoading);
  const [hasAttemptedLoad, setHasAttemptedLoad] = useState(false);

  const state = location.state as CheckoutSuccessState;
  const orderId = state?.orderId ?? searchParams.get('orderId') ?? '';
  const fromCheckout = Boolean(state?.fromCheckout);

  useEffect(() => {
    if (!orderId) {
      return;
    }

    let cancelled = false;

    fetchOrderById(orderId).finally(() => {
      if (!cancelled) {
        setHasAttemptedLoad(true);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [fetchOrderById, orderId]);

  if (!fromCheckout && !orderId) {
    return <Navigate to="/products" replace />;
  }

  const order = currentOrder?.id === orderId ? currentOrder : null;
  const shortOrderId = orderId ? orderId.slice(-8).toUpperCase() : 'N/A';
  const totalQuantity =
    order?.items.reduce((sum, item) => sum + item.quantity, 0) ?? 0;

  const shippingAddress = order
    ? [order.address, order.ward, order.district, order.city]
        .filter(Boolean)
        .join(', ')
    : '';

  return (
    <section className="mx-auto flex min-h-[70vh] max-w-5xl items-center px-6 py-20 lg:py-28">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45 }}
        className="grid w-full gap-8 lg:grid-cols-[1.1fr_0.9fr]"
      >
        <div className="rounded-[2rem] border border-border bg-surface p-8 shadow-sm lg:p-10">
          <div className="mb-8 flex justify-center lg:justify-start">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{
                type: 'spring',
                stiffness: 220,
                damping: 16,
                delay: 0.1,
              }}
              className="flex h-20 w-20 items-center justify-center rounded-full bg-green-100 ring-8 ring-green-50"
            >
              <Check className="h-10 w-10 text-green-600" strokeWidth={3} />
            </motion.div>
          </div>

          <div className="text-center lg:text-left">
            <h1 className="font-display text-3xl font-bold text-text-primary lg:text-4xl">
              Đặt hàng thành công!
            </h1>
            <p className="mt-4 text-base leading-7 text-text-secondary">
              Cảm ơn bạn đã mua sắm. Đơn hàng{' '}
              <span className="font-mono font-bold text-text-primary">
                #{shortOrderId}
              </span>{' '}
              đã được ghi nhận và đang chờ xử lý.
            </p>
            <p className="mt-2 text-sm leading-6 text-text-muted">
              Chúng tôi sẽ xác nhận đơn, chuẩn bị hàng và cập nhật trạng thái
              sớm nhất cho bạn.
            </p>
          </div>

          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl bg-surface-alt p-4">
              <p className="text-xs font-medium uppercase tracking-[0.2em] text-text-muted">
                Mã đơn hàng
              </p>
              <p className="mt-2 font-mono text-lg font-bold text-text-primary">
                #{shortOrderId}
              </p>
            </div>
            <div className="rounded-2xl bg-surface-alt p-4">
              <p className="text-xs font-medium uppercase tracking-[0.2em] text-text-muted">
                Trạng thái đơn
              </p>
              <p className="mt-2 text-lg font-semibold text-text-primary">
                {order ? ORDER_STATUS_LABEL[order.status] : 'Chờ xác nhận'}
              </p>
            </div>
          </div>

          {isLoading && !order && (
            <div className="mt-6 flex items-center gap-2 rounded-2xl border border-border bg-surface-alt px-4 py-3 text-sm text-text-muted">
              <Loader2 className="h-4 w-4 animate-spin" />
              Đang tải chi tiết đơn hàng...
            </div>
          )}

          {!order && hasAttemptedLoad && !isLoading && (
            <div className="mt-6 rounded-2xl border border-border bg-surface-alt px-4 py-3 text-sm text-text-muted">
              Chi tiết đơn hàng chưa tải được đầy đủ. Bạn vẫn có thể xem lại
              trong trang đơn hàng của mình.
            </div>
          )}

          <div className="mt-10 flex flex-col gap-3 sm:flex-row">
            <Link
              to="/profile"
              state={{ tab: 'orders' }}
              className="btn-primary flex items-center justify-center gap-2 no-underline"
            >
              <ClipboardList className="h-4 w-4" />
              Xem đơn hàng
            </Link>
            <Link
              to="/products"
              className="btn-outline flex items-center justify-center gap-2 no-underline"
            >
              <ShoppingBag className="h-4 w-4" />
              Tiếp tục mua sắm
            </Link>
          </div>
        </div>

        <div className="rounded-[2rem] border border-border bg-surface p-8 shadow-sm lg:p-10">
          <h2 className="font-display text-xl font-semibold text-text-primary">
            Thông tin giao nhận
          </h2>

          {order ? (
            <div className="mt-6 space-y-6">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-2xl bg-surface-alt p-4 sm:col-span-2">
                  <div className="flex items-start gap-3">
                    <MapPin className="mt-0.5 h-5 w-5 text-brand" />
                    <div>
                      <p className="text-sm font-semibold text-text-primary">
                        {order.customerName}
                      </p>
                      <p className="mt-1 text-sm text-text-secondary">
                        {order.phone}
                      </p>
                      <p className="mt-1 text-sm leading-6 text-text-secondary">
                        {shippingAddress}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl bg-surface-alt p-4">
                  <div className="flex items-start gap-3">
                    <CreditCard className="mt-0.5 h-5 w-5 text-brand" />
                    <div>
                      <p className="text-xs font-medium uppercase tracking-[0.16em] text-text-muted">
                        Thanh toán
                      </p>
                      <p className="mt-2 text-sm font-semibold text-text-primary">
                        {getPaymentMethodLabel(order.paymentMethod)}
                      </p>
                      <p className="mt-1 text-sm text-text-secondary">
                        {getPaymentStatusLabel(
                          order.paymentStatus,
                          order.paymentMethod,
                        )}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl bg-surface-alt p-4">
                  <div className="flex items-start gap-3">
                    <Receipt className="mt-0.5 h-5 w-5 text-brand" />
                    <div>
                      <p className="text-xs font-medium uppercase tracking-[0.16em] text-text-muted">
                        Tổng thanh toán
                      </p>
                      <p className="mt-2 text-lg font-bold text-brand">
                        {formatCurrency(order.total)}
                      </p>
                      <p className="mt-1 text-sm text-text-secondary">
                        {totalQuantity} sản phẩm
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-border bg-surface-alt p-5">
                <h3 className="font-display text-base font-semibold text-text-primary">
                  Tóm tắt đơn hàng
                </h3>
                <div className="mt-4 space-y-3">
                  {order.items.map((item) => (
                    <div
                      key={`${item.productId}-${item.productName}`}
                      className="flex items-center gap-3"
                    >
                      <img
                        src={item.productImage}
                        alt={item.productName}
                        className="h-14 w-14 rounded-xl bg-surface object-contain p-1"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="line-clamp-1 text-sm font-medium text-text-primary">
                          {item.productName}
                        </p>
                        <p className="mt-1 text-xs text-text-muted">
                          {item.brand} · SL: {item.quantity}
                        </p>
                      </div>
                      <p className="text-sm font-semibold text-text-primary">
                        {formatCurrency(item.price * item.quantity)}
                      </p>
                    </div>
                  ))}
                </div>

                <div className="mt-5 space-y-2 border-t border-border pt-4 text-sm">
                  <div className="flex items-center justify-between text-text-secondary">
                    <span>Tạm tính</span>
                    <span>{formatCurrency(order.subtotal)}</span>
                  </div>
                  <div className="flex items-center justify-between text-text-secondary">
                    <span>Phí vận chuyển</span>
                    <span>
                      {order.shippingFee === 0
                        ? 'Miễn phí'
                        : formatCurrency(order.shippingFee)}
                    </span>
                  </div>
                  {order.discount > 0 && (
                    <div className="flex items-center justify-between text-green-600">
                      <span>Giảm giá</span>
                      <span>-{formatCurrency(order.discount)}</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between border-t border-border pt-3 font-semibold text-text-primary">
                    <span>Tổng cộng</span>
                    <span className="text-brand">
                      {formatCurrency(order.total)}
                    </span>
                  </div>
                </div>

                {order.note && (
                  <div className="mt-4 rounded-xl bg-surface px-4 py-3 text-sm text-text-secondary">
                    <span className="font-medium text-text-primary">
                      Ghi chú:
                    </span>{' '}
                    {order.note}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="mt-6 rounded-2xl bg-surface-alt p-5 text-sm leading-6 text-text-secondary">
              Thông tin đơn hàng sẽ được hiển thị tại đây ngay sau khi hệ thống
              tải xong dữ liệu.
            </div>
          )}
        </div>
      </motion.div>
    </section>
  );
}
