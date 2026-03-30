import {
  AlertCircle,
  Check,
  ClipboardList,
  Clock3,
  CreditCard,
  Loader2,
  MapPin,
  RefreshCw,
  Receipt,
  ShoppingBag,
  XCircle,
} from 'lucide-react';
import { motion } from 'motion/react';
import { useEffect, useRef, useState } from 'react';
import { Link, Navigate, useLocation, useSearchParams } from 'react-router';

import {
  buildCheckoutCartSignature,
  clearPendingMomoCheckout,
  getPendingMomoCheckout,
} from '@/lib/pendingMomoCheckout';
import { useCartStore } from '@/store/useCartStore';
import { useOrderStore } from '@/store/useOrderStore';
import {
  ORDER_STATUS_COLOR,
  ORDER_STATUS_LABEL,
  PAYMENT_METHOD_LABEL,
  PAYMENT_STATUS_COLOR,
  PAYMENT_STATUS_LABEL,
  type PaymentMethod,
} from '@/types/order';

export const Component = CheckoutSuccess;

type CheckoutSuccessState = {
  fromCheckout?: boolean;
  orderId?: string;
} | null;

type CheckoutPageState = 'success' | 'pending' | 'failure' | 'cancelled';

function formatCurrency(value: number) {
  return `${value.toLocaleString('vi-VN')}₫`;
}

function getPaymentMethodLabel(paymentMethod?: string) {
  if (paymentMethod === 'COD' || paymentMethod === 'MOMO') {
    return PAYMENT_METHOD_LABEL[paymentMethod];
  }

  return paymentMethod ?? 'Chưa xác định';
}

function getPaymentStatusLabel(paymentStatus?: string, paymentMethod?: string) {
  if (paymentMethod === 'COD' && paymentStatus === 'UNPAID') {
    return 'Thanh toán khi nhận hàng';
  }

  return paymentStatus
    ? PAYMENT_STATUS_LABEL[paymentStatus as keyof typeof PAYMENT_STATUS_LABEL] ??
        paymentStatus
    : 'Chưa cập nhật';
}

function parseResultCode(value: string | null) {
  if (value == null) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizePaymentMethod(
  value: string | null | undefined,
): PaymentMethod | undefined {
  return value === 'COD' || value === 'MOMO' ? value : undefined;
}

function normalizeMessage(value: string | null) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function normalizeText(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function isCancelledMessage(message?: string) {
  if (!message) return false;

  const normalized = normalizeText(message);

  return (
    normalized.includes('huy') ||
    normalized.includes('cancel') ||
    normalized.includes('da dong') ||
    normalized.includes('dong giao dich')
  );
}

function getCheckoutPageState(
  orderStatus?: string,
  paymentMethod?: string,
  paymentStatus?: string,
  resultCode?: number | null,
  message?: string,
): CheckoutPageState {
  if (orderStatus === 'CANCELLED') {
    return 'cancelled';
  }

  if (paymentMethod === 'MOMO') {
    if (paymentStatus === 'PAID') return 'success';
    if (paymentStatus === 'FAILED' || paymentStatus === 'REFUNDED')
      return isCancelledMessage(message) || resultCode === 1006
        ? 'cancelled'
        : 'failure';

    if (paymentStatus === 'PENDING') {
      return 'pending';
    }

    if (isCancelledMessage(message) || resultCode === 1006) {
      return 'cancelled';
    }

    if (resultCode === 0 || resultCode === 1000 || resultCode === 7000 || resultCode === 7002) {
      return 'pending';
    }

    if (resultCode != null) {
      return 'failure';
    }

    return 'pending';
  }

  return 'success';
}

function getFallbackOrderStatusLabel(pageState: CheckoutPageState) {
  if (pageState === 'cancelled') return ORDER_STATUS_LABEL.CANCELLED;
  if (pageState === 'pending') return ORDER_STATUS_LABEL.PENDING;
  return 'Đã tiếp nhận';
}

function getFallbackOrderStatusColor(pageState: CheckoutPageState) {
  if (pageState === 'cancelled') return ORDER_STATUS_COLOR.CANCELLED;
  if (pageState === 'pending') return ORDER_STATUS_COLOR.PENDING;
  return 'bg-green-50 text-green-700';
}

function getFallbackPaymentStatusLabel(
  pageState: CheckoutPageState,
  paymentMethod?: string,
) {
  if (paymentMethod === 'COD') {
    return 'Thanh toán khi nhận hàng';
  }

  if (pageState === 'success') return 'Đã thanh toán';
  if (pageState === 'pending') return 'Đang xử lý';
  if (pageState === 'cancelled') return 'Đã hủy';
  return 'Thanh toán thất bại';
}

function getFallbackPaymentStatusColor(pageState: CheckoutPageState) {
  if (pageState === 'pending') return PAYMENT_STATUS_COLOR.PENDING;
  if (pageState === 'cancelled') return 'bg-slate-100 text-slate-700';
  if (pageState === 'failure') return PAYMENT_STATUS_COLOR.FAILED;
  return PAYMENT_STATUS_COLOR.PAID;
}

function CheckoutSuccess() {
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const cartItems = useCartStore((store) => store.items);
  const clearCart = useCartStore((store) => store.clear);
  const fetchOrderById = useOrderStore((store) => store.fetchOrderById);
  const currentOrder = useOrderStore((store) => store.currentOrder);
  const isLoading = useOrderStore((store) => store.isLoading);
  const [attemptedOrderId, setAttemptedOrderId] = useState('');
  const cartClearedRef = useRef(false);
  const pendingCheckout = getPendingMomoCheckout();
  const queryMessage = normalizeMessage(searchParams.get('message'));
  const queryPaymentMethod = normalizePaymentMethod(
    searchParams.get('paymentMethod'),
  );

  const state = location.state as CheckoutSuccessState;
  const orderId =
    state?.orderId ??
    searchParams.get('orderId') ??
    pendingCheckout?.orderId ??
    '';
  const fromCheckout = Boolean(state?.fromCheckout || orderId);
  const resultCode = parseResultCode(searchParams.get('resultCode'));
  const order = currentOrder?.id === orderId ? currentOrder : null;
  const effectivePaymentMethod =
    order?.paymentMethod ?? pendingCheckout?.paymentMethod ?? queryPaymentMethod;
  const currentCartSignature = buildCheckoutCartSignature(
    cartItems.map(({ product, quantity }) => ({
      productId: product.id,
      quantity,
    })),
  );

  useEffect(() => {
    if (!orderId) {
      return;
    }

    let cancelled = false;

    fetchOrderById(orderId).finally(() => {
      if (!cancelled) {
        setAttemptedOrderId(orderId);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [fetchOrderById, orderId]);

  useEffect(() => {
    if (!order) {
      return;
    }

    if (order.paymentMethod !== 'MOMO') {
      clearPendingMomoCheckout();
      return;
    }

    if (order.paymentStatus === 'PAID') {
      clearPendingMomoCheckout();

      if (
        !cartClearedRef.current &&
        (!pendingCheckout ||
          pendingCheckout.cartSignature === currentCartSignature)
      ) {
        cartClearedRef.current = true;
        void clearCart();
      }

      return;
    }

    if (
      order.paymentStatus === 'FAILED' ||
      order.paymentStatus === 'REFUNDED' ||
      order.status === 'CANCELLED'
    ) {
      clearPendingMomoCheckout();
    }
  }, [clearCart, currentCartSignature, order, pendingCheckout]);

  if (!fromCheckout && !orderId) {
    return <Navigate to="/products" replace />;
  }

  const pageState = getCheckoutPageState(
    order?.status,
    effectivePaymentMethod,
    order?.paymentStatus,
    resultCode,
    queryMessage,
  );
  const shortOrderId = orderId ? orderId.slice(-8).toUpperCase() : 'N/A';
  const totalQuantity =
    order?.items.reduce((sum, item) => sum + item.quantity, 0) ?? 0;
  const orderLoadFailed =
    Boolean(orderId) && attemptedOrderId === orderId && !isLoading && !order;
  const canRetryPayment =
    effectivePaymentMethod === 'MOMO' &&
    (pageState === 'failure' || pageState === 'cancelled');

  const shippingAddress = order
    ? [order.address, order.ward, order.district, order.city]
        .filter(Boolean)
        .join(', ')
    : '';

  const heroIcon =
    pageState === 'success' ? (
      <Check className="h-10 w-10 text-green-600" strokeWidth={3} />
    ) : pageState === 'cancelled' ? (
      <XCircle className="h-10 w-10 text-slate-600" strokeWidth={2.6} />
    ) : pageState === 'failure' ? (
      <AlertCircle className="h-10 w-10 text-red-500" strokeWidth={2.6} />
    ) : (
      <Clock3 className="h-10 w-10 text-amber-500" strokeWidth={2.6} />
    );

  const heroRingClass =
    pageState === 'success'
      ? 'bg-green-100 ring-green-50'
      : pageState === 'cancelled'
        ? 'bg-slate-100 ring-slate-50'
      : pageState === 'failure'
        ? 'bg-red-100 ring-red-50'
        : 'bg-amber-100 ring-amber-50';

  const heroTitle =
    pageState === 'success'
      ? effectivePaymentMethod === 'MOMO'
        ? 'Thanh toán thành công!'
        : 'Đặt hàng thành công!'
      : pageState === 'cancelled'
        ? 'Giao dịch đã bị hủy'
      : pageState === 'failure'
        ? 'Thanh toán chưa hoàn tất'
        : 'Đang chờ xác nhận thanh toán';

  const heroDescription =
    pageState === 'success'
      ? effectivePaymentMethod === 'MOMO'
        ? `Đơn hàng #${shortOrderId} đã được thanh toán qua MoMo và đang chờ cửa hàng xử lý.`
        : `Đơn hàng #${shortOrderId} đã được ghi nhận. Bạn sẽ thanh toán khi nhận hàng.`
      : pageState === 'cancelled'
        ? `Đơn hàng #${shortOrderId} hiện ở trạng thái đã hủy. Nếu đây là giao dịch MoMo, giỏ hàng của bạn vẫn được giữ lại để thử lại khi cần.`
      : pageState === 'failure'
        ? `Đơn hàng #${shortOrderId} chưa thanh toán thành công qua MoMo. Giỏ hàng vẫn được giữ lại để bạn có thể thử lại.`
        : `Đơn hàng #${shortOrderId} đã được tạo và đang chờ MoMo hoặc hệ thống xác nhận kết quả thanh toán.`;

  const helperMessage =
    pageState === 'success'
      ? 'Chúng tôi sẽ xác nhận đơn, chuẩn bị hàng và cập nhật trạng thái sớm nhất cho bạn.'
      : pageState === 'cancelled'
        ? 'Nếu bạn hủy giao dịch trên MoMo hoặc đơn hàng đã bị hủy, bạn vẫn có thể xem lại lịch sử đơn hàng và bắt đầu lại khi sẵn sàng.'
      : pageState === 'failure'
        ? 'Nếu bạn đóng tab hoặc quay lại giữa chừng, bạn vẫn có thể theo dõi trạng thái đơn hàng rồi thanh toán lại khi cần.'
        : 'Nếu bạn vừa quay lại từ MoMo, hệ thống có thể cần thêm ít phút để đồng bộ. Chúng tôi chỉ làm trống giỏ hàng sau khi thanh toán được xác nhận.';

  const defaultSystemMessage =
    pageState === 'success'
      ? effectivePaymentMethod === 'MOMO'
        ? 'MoMo đã ghi nhận giao dịch thành công. Cửa hàng sẽ tiếp tục xử lý đơn hàng của bạn.'
        : 'Đơn hàng COD đã được tạo thành công và đang chờ xác nhận.'
      : pageState === 'cancelled'
        ? 'Giao dịch đã bị hủy hoặc đơn hàng đã được đánh dấu hủy. Bạn có thể xem lại chi tiết đơn hàng hoặc thử thanh toán lại.'
      : pageState === 'failure'
        ? 'MoMo chưa xác nhận thanh toán thành công cho đơn hàng này.'
        : 'Hệ thống đã nhận đơn hàng nhưng vẫn đang chờ kết quả thanh toán cuối cùng.';

  const systemMessage =
    order?.status === 'CANCELLED' && order.cancelReason
      ? `Đơn hàng đã được hủy: ${order.cancelReason}`
      : queryMessage ?? defaultSystemMessage;

  const secondaryMessage =
    queryMessage && queryMessage !== systemMessage ? queryMessage : undefined;

  const orderStatusLabel = order
    ? ORDER_STATUS_LABEL[order.status]
    : getFallbackOrderStatusLabel(pageState);
  const orderStatusColor = order
    ? ORDER_STATUS_COLOR[order.status]
    : getFallbackOrderStatusColor(pageState);
  const paymentStatusLabel = order
    ? getPaymentStatusLabel(order.paymentStatus, order.paymentMethod)
    : getFallbackPaymentStatusLabel(pageState, effectivePaymentMethod);
  const paymentStatusColor = order
    ? PAYMENT_STATUS_COLOR[order.paymentStatus]
    : getFallbackPaymentStatusColor(pageState);

  const handleReloadOrderDetails = () => {
    if (!orderId || isLoading) return;

    setAttemptedOrderId('');
    void fetchOrderById(orderId).finally(() => {
      setAttemptedOrderId(orderId);
    });
  };

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
              className={`flex h-20 w-20 items-center justify-center rounded-full ring-8 ${heroRingClass}`}
            >
              {heroIcon}
            </motion.div>
          </div>

          <div className="text-center lg:text-left">
            <h1 className="font-display text-3xl font-bold text-text-primary lg:text-4xl">
              {heroTitle}
            </h1>
            <p className="mt-4 text-base leading-7 text-text-secondary">
              {heroDescription}
            </p>
            <p className="mt-2 text-sm leading-6 text-text-muted">
              {helperMessage}
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
              <div className="mt-2">
                <span
                  className={`inline-flex rounded-full px-2.5 py-1 text-sm font-semibold ${orderStatusColor}`}
                >
                  {orderStatusLabel}
                </span>
              </div>
            </div>
            <div className="rounded-2xl bg-surface-alt p-4">
              <p className="text-xs font-medium uppercase tracking-[0.2em] text-text-muted">
                Phương thức thanh toán
              </p>
              <p className="mt-2 text-sm font-semibold text-text-primary">
                {getPaymentMethodLabel(effectivePaymentMethod)}
              </p>
            </div>
            <div className="rounded-2xl bg-surface-alt p-4">
              <p className="text-xs font-medium uppercase tracking-[0.2em] text-text-muted">
                Trạng thái thanh toán
              </p>
              <div className="mt-2">
                <span
                  className={`inline-flex rounded-full px-2.5 py-1 text-sm font-semibold ${paymentStatusColor}`}
                >
                  {paymentStatusLabel}
                </span>
              </div>
            </div>
          </div>

          {isLoading && !order && (
            <div className="mt-6 flex items-center gap-2 rounded-2xl border border-border bg-surface-alt px-4 py-3 text-sm text-text-muted">
              <Loader2 className="h-4 w-4 animate-spin" />
              Đang tải chi tiết đơn hàng...
            </div>
          )}

          <div
            className={`mt-6 rounded-2xl border px-4 py-4 text-sm ${
              pageState === 'success'
                ? 'border-green-200 bg-green-50 text-green-700'
                : pageState === 'cancelled'
                  ? 'border-slate-200 bg-slate-50 text-slate-700'
                  : pageState === 'failure'
                    ? 'border-red-200 bg-red-50 text-red-600'
                    : 'border-amber-200 bg-amber-50 text-amber-700'
            }`}
          >
            <p className="text-xs font-semibold uppercase tracking-[0.18em]">
              Thông báo hệ thống
            </p>
            <p className="mt-2 text-sm font-medium leading-6">{systemMessage}</p>
            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs opacity-90">
              {effectivePaymentMethod && (
                <span>
                  Phương thức: {getPaymentMethodLabel(effectivePaymentMethod)}
                </span>
              )}
              {resultCode != null && <span>Mã kết quả: {resultCode}</span>}
            </div>
            {secondaryMessage && (
              <p className="mt-2 text-xs leading-5 opacity-90">
                Phản hồi cổng thanh toán: {secondaryMessage}
              </p>
            )}
          </div>

          {orderLoadFailed && (
            <div className="mt-6 rounded-2xl border border-border bg-surface-alt px-4 py-4 text-sm text-text-secondary">
              <div className="flex items-start gap-3">
                <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-brand" />
                <div className="flex-1">
                  <p className="font-semibold text-text-primary">
                    Chưa tải được chi tiết đơn hàng
                  </p>
                  <p className="mt-1 leading-6">
                    Trang vẫn giữ lại trạng thái giao dịch hiện tại cho đơn hàng
                    #{shortOrderId}. Bạn có thể thử tải lại dữ liệu hoặc mở mục
                    đơn hàng để kiểm tra sau.
                  </p>
                  <button
                    type="button"
                    onClick={handleReloadOrderDetails}
                    disabled={isLoading}
                    className="btn-outline mt-4 inline-flex items-center gap-2 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <RefreshCw className="h-4 w-4" />
                    )}
                    Tải lại chi tiết đơn hàng
                  </button>
                </div>
              </div>
            </div>
          )}

          <div className="mt-10 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <Link
              to="/profile"
              state={{ tab: 'orders', expandedOrderId: orderId }}
              className="btn-primary flex items-center justify-center gap-2 no-underline"
            >
              <ClipboardList className="h-4 w-4" />
              Xem chi tiết đơn hàng
            </Link>
            {canRetryPayment && (
              <Link
                to="/cart"
                className="btn-outline flex items-center justify-center gap-2 no-underline"
              >
                <CreditCard className="h-4 w-4" />
                Thử lại thanh toán
              </Link>
            )}
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
            Chi tiết đơn hàng
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
                      <div className="mt-2">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${PAYMENT_STATUS_COLOR[order.paymentStatus]}`}
                        >
                          {getPaymentStatusLabel(
                            order.paymentStatus,
                            order.paymentMethod,
                          )}
                        </span>
                      </div>
                      {order.paidAt && (
                        <p className="mt-1 text-xs text-text-muted">
                          Xác nhận lúc{' '}
                          {new Date(order.paidAt).toLocaleString('vi-VN')}
                        </p>
                      )}
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

                {order.status === 'CANCELLED' && order.cancelReason && (
                  <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                    <span className="font-medium text-slate-900">
                      Lý do hủy:
                    </span>{' '}
                    {order.cancelReason}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="mt-6 space-y-4">
              <div className="rounded-2xl bg-surface-alt p-5 text-sm leading-6 text-text-secondary">
                {isLoading
                  ? 'Thông tin đơn hàng sẽ xuất hiện tại đây ngay sau khi hệ thống tải xong dữ liệu.'
                  : 'Chúng tôi chưa lấy được đầy đủ chi tiết đơn hàng, nhưng bạn vẫn có thể xem trạng thái thanh toán và các hành động phù hợp ở khung bên trái.'}
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-2xl border border-border bg-surface-alt p-4">
                  <p className="text-xs font-medium uppercase tracking-[0.16em] text-text-muted">
                    Mã đơn hàng
                  </p>
                  <p className="mt-2 font-mono text-base font-bold text-text-primary">
                    #{shortOrderId}
                  </p>
                </div>
                <div className="rounded-2xl border border-border bg-surface-alt p-4">
                  <p className="text-xs font-medium uppercase tracking-[0.16em] text-text-muted">
                    Phương thức thanh toán
                  </p>
                  <p className="mt-2 text-sm font-semibold text-text-primary">
                    {getPaymentMethodLabel(effectivePaymentMethod)}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </section>
  );
}
