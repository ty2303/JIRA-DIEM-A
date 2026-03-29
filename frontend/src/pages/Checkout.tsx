import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  CreditCard,
  Loader2,
  MapPin,
  Truck,
  Wallet,
} from 'lucide-react';
import { motion } from 'motion/react';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router';

import apiClient from '@/api/client';
import { ENDPOINTS } from '@/api/endpoints';
import {
  buildCheckoutCartSignature,
  clearPendingMomoCheckout,
  getPendingMomoCheckout,
  setPendingMomoCheckout,
} from '@/lib/pendingMomoCheckout';
import {
  calculateOrderPricing,
  FREE_SHIPPING_THRESHOLD,
} from '@/lib/orderPricing';
import { useAuthStore } from '@/store/useAuthStore';
import { useCartStore } from '@/store/useCartStore';
import { useOrderStore } from '@/store/useOrderStore';
import type { ApiResponse } from '@/api/types';
import type {
  CreateMomoOrderResponse,
  CreateOrderPayload,
  Order,
  PaymentMethod,
} from '@/types/order';

export const Component = Checkout;

/** Số điện thoại Việt Nam hợp lệ: 03x, 05x, 07x, 08x, 09x */
const VN_PHONE_RE = /^(0|\+84)(3[2-9]|5[2689]|7[06-9]|8[0-9]|9[0-9])[0-9]{7}$/;

const inputBase =
  'w-full rounded-xl border bg-surface-alt px-4 py-3 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-1 transition-colors';
const inputOk = `${inputBase} border-border focus:border-brand focus:ring-brand`;
const inputErr = `${inputBase} border-red-400 focus:border-red-500 focus:ring-red-400`;

type FieldKey =
  | 'email'
  | 'name'
  | 'phone'
  | 'address'
  | 'city'
  | 'district'
  | 'ward';

type FieldErrors = Partial<Record<FieldKey, string>>;

function isValidPaymentUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

function validate(fd: FormData): FieldErrors {
  const get = (k: string) => ((fd.get(k) as string) ?? '').trim();
  const errors: FieldErrors = {};

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(get('email')))
    errors.email = 'Email không hợp lệ';

  if (get('name').length < 2) errors.name = 'Vui lòng nhập họ và tên đầy đủ';

  if (!VN_PHONE_RE.test(get('phone').replace(/[\s-]/g, '')))
    errors.phone = 'Số điện thoại không đúng định dạng (VD: 0912 345 678)';

  if (!get('address')) errors.address = 'Vui lòng nhập địa chỉ';
  if (!get('city')) errors.city = 'Vui lòng nhập tỉnh / thành phố';
  if (!get('district')) errors.district = 'Vui lòng nhập quận / huyện';
  if (!get('ward')) errors.ward = 'Vui lòng nhập phường / xã';

  return errors;
}

/** Breadcrumb bước thanh toán */
const STEPS = ['Giỏ hàng', 'Thanh toán', 'Xác nhận'];

function StepBar({ current }: { current: number }) {
  return (
    <nav className="mb-10 flex items-center gap-0">
      {STEPS.map((label, i) => (
        <div key={label} className="flex items-center">
          <div className="flex items-center gap-2">
            <span
              className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ring-2 ${
                i <= current
                  ? 'bg-brand ring-brand text-white'
                  : 'bg-surface-alt ring-border text-text-muted'
              }`}
            >
              {i + 1}
            </span>
            <span
              className={`text-sm font-medium ${
                i === current
                  ? 'text-brand'
                  : i < current
                    ? 'text-text-secondary'
                    : 'text-text-muted'
              }`}
            >
              {label}
            </span>
          </div>
          {i < STEPS.length - 1 && (
            <div
              className={`mx-3 h-px w-10 ${i < current ? 'bg-brand' : 'bg-border'}`}
            />
          )}
        </div>
      ))}
    </nav>
  );
}

/** Label + input + error message */
function Field({
  label,
  error,
  required = true,
  children,
}: {
  label: string;
  error?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-2 block text-sm font-medium text-text-primary">
        {label}
        {required && <span className="ml-0.5 text-red-500">*</span>}
      </label>
      {children}
      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
    </div>
  );
}

function Checkout() {
  const navigate = useNavigate();
  const items = useCartStore((s) => s.items);
  const totalPrice = useCartStore((s) => s.totalPrice());
  const clear = useCartStore((s) => s.clear);
  const { user } = useAuthStore();
  const addOrder = useOrderStore((s) => s.addOrder);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('COD');
  const [pendingOrderId] = useState(() => getPendingMomoCheckout()?.orderId ?? '');

  if (items.length === 0 && pendingOrderId) {
    return (
      <section className="flex min-h-[60vh] flex-col items-center justify-center px-6 text-center">
        <h2 className="font-display text-2xl font-bold text-text-primary">
          Giao dịch MoMo đang chờ xác nhận
        </h2>
        <p className="mt-2 max-w-xl text-text-secondary">
          Bạn đã khởi tạo đơn hàng MoMo trước đó. Nếu vừa đóng tab hoặc quay lại
          giữa chừng, hãy mở lại trang theo dõi đơn hàng để kiểm tra kết quả
          thanh toán.
        </p>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <Link
            to={`/checkout/success?orderId=${encodeURIComponent(pendingOrderId)}`}
            className="btn-primary no-underline"
          >
            Xem trạng thái thanh toán
          </Link>
          <Link to="/products" className="btn-outline no-underline">
            Tiếp tục mua sắm
          </Link>
        </div>
      </section>
    );
  }

  if (items.length === 0) {
    return (
      <section className="flex min-h-[60vh] flex-col items-center justify-center px-6 text-center">
        <h2 className="font-display text-2xl font-bold text-text-primary">
          Giỏ hàng trống
        </h2>
        <p className="mt-2 text-text-secondary">
          Vui lòng thêm sản phẩm trước khi thanh toán.
        </p>
        <Link to="/products" className="btn-primary mt-6 no-underline">
          Tiếp tục mua sắm
        </Link>
      </section>
    );
  }

  const pricing = calculateOrderPricing(totalPrice);

  const cls = (field: FieldKey) => (fieldErrors[field] ? inputErr : inputOk);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (loading) return;
    setError('');

    const fd = new FormData(e.currentTarget);
    const errors = validate(fd);
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }
    setFieldErrors({});
    setLoading(true);

    const get = (k: string) => ((fd.get(k) as string) ?? '').trim();

    const payload: CreateOrderPayload = {
      email: get('email'),
      customerName: get('name'),
      phone: get('phone').replace(/[\s-]/g, ''),
      address: get('address'),
      city: get('city'),
      district: get('district'),
      ward: get('ward'),
      note: get('note') || undefined,
      paymentMethod,
      items: items.map(({ product, quantity }) => ({
        productId: product.id,
        productName: product.name,
        productImage: product.image,
        brand: product.brand,
        price: product.price,
        quantity,
      })),
    };

    try {
      if (paymentMethod === 'MOMO') {
        const res = await apiClient.post<ApiResponse<CreateMomoOrderResponse>>(
          ENDPOINTS.ORDERS.MOMO_INIT,
          payload,
        );
        const { order, payment } = res.data.data;
        const paymentUrl = payment.paymentUrl ?? payment.payUrl;

        if (!paymentUrl || !isValidPaymentUrl(paymentUrl)) {
          setError('Không nhận được liên kết thanh toán MoMo hợp lệ. Vui lòng thử lại.');
          return;
        }

        addOrder(order);
        setPendingMomoCheckout(order.id, buildCheckoutCartSignature(payload.items));
        window.location.assign(paymentUrl);
        return;
      }

      const res = await apiClient.post<ApiResponse<Order>>(ENDPOINTS.ORDERS.BASE, payload);
      const order = res.data.data;
      addOrder(order);
      clearPendingMomoCheckout();
      await clear();
      navigate(`/checkout/success?orderId=${encodeURIComponent(order.id)}`, {
        state: { fromCheckout: true, orderId: order.id },
      });
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { message?: string } } };
      setError(
        axiosErr.response?.data?.message ??
          'Đặt hàng thất bại. Vui lòng thử lại.',
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="mx-auto max-w-7xl px-6 py-24 lg:py-32">
      {/* Back link & heading */}
      <div className="mb-6">
        <Link
          to="/cart"
          className="group inline-flex items-center gap-2 text-sm text-text-muted no-underline transition-colors hover:text-brand"
        >
          <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-1" />
          Quay lại giỏ hàng
        </Link>
        <h1 className="mt-4 font-display text-3xl font-bold text-text-primary lg:text-4xl">
          Thanh toán
        </h1>
      </div>

      <StepBar current={1} />

      {pendingOrderId && (
        <div className="mb-8 flex items-start gap-3 rounded-2xl border border-[#ae2070]/20 bg-[#ae2070]/5 px-4 py-4 text-sm text-text-secondary">
          <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-[#ae2070]" />
          <div>
            <p className="font-medium text-text-primary">
              Bạn đang có một giao dịch MoMo chờ hoàn tất.
            </p>
            <p className="mt-1">
              Nếu bạn vừa đóng tab hoặc quay lại giữa chừng, bạn có thể tiếp tục
              kiểm tra đơn hàng{' '}
              <Link
                to={`/checkout/success?orderId=${encodeURIComponent(pendingOrderId)}`}
                className="font-semibold text-[#ae2070] no-underline hover:underline"
              >
                tại đây
              </Link>
              .
            </p>
          </div>
        </div>
      )}

      <div className="grid gap-12 lg:grid-cols-12">
        {/* ── Left: Form ── */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="lg:col-span-7"
        >
          <form
            id="checkout-form"
            onSubmit={handleSubmit}
            noValidate
            className="space-y-8"
          >
            {/* Contact Info */}
            <section className="space-y-4">
              <h2 className="flex items-center gap-2 font-display text-xl font-semibold text-text-primary">
                <CheckCircle2 className="h-5 w-5 text-brand-accent" />
                Thông tin liên hệ
              </h2>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <Field label="Email" error={fieldErrors.email}>
                    <input
                      type="email"
                      id="email"
                      name="email"
                      defaultValue={user?.email ?? ''}
                      placeholder="nguyenvan@example.com"
                      className={cls('email')}
                    />
                  </Field>
                </div>
                <Field label="Họ và tên" error={fieldErrors.name}>
                  <input
                    type="text"
                    id="name"
                    name="name"
                    placeholder="Nguyễn Văn A"
                    className={cls('name')}
                  />
                </Field>
                <Field label="Số điện thoại" error={fieldErrors.phone}>
                  <input
                    type="tel"
                    id="phone"
                    name="phone"
                    placeholder="0912 345 678"
                    className={cls('phone')}
                  />
                </Field>
              </div>
            </section>

            {/* Shipping Address */}
            <section className="space-y-4">
              <h2 className="flex items-center gap-2 font-display text-xl font-semibold text-text-primary">
                <MapPin className="h-5 w-5 text-brand-accent" />
                Địa chỉ giao hàng
              </h2>
              <div className="space-y-4">
                <Field label="Địa chỉ" error={fieldErrors.address}>
                  <input
                    type="text"
                    id="address"
                    name="address"
                    placeholder="Số nhà, Tên đường"
                    className={cls('address')}
                  />
                </Field>
                <div className="grid gap-4 sm:grid-cols-3">
                  <Field label="Tỉnh / Thành phố" error={fieldErrors.city}>
                    <input
                      type="text"
                      id="city"
                      name="city"
                      placeholder="TP. Hồ Chí Minh"
                      className={cls('city')}
                    />
                  </Field>
                  <Field label="Quận / Huyện" error={fieldErrors.district}>
                    <input
                      type="text"
                      id="district"
                      name="district"
                      placeholder="Quận 1"
                      className={cls('district')}
                    />
                  </Field>
                  <Field label="Phường / Xã" error={fieldErrors.ward}>
                    <input
                      type="text"
                      id="ward"
                      name="ward"
                      placeholder="Phường Bến Nghé"
                      className={cls('ward')}
                    />
                  </Field>
                </div>
              </div>
            </section>

            {/* Payment Method */}
            <section className="space-y-4">
              <h2 className="flex items-center gap-2 font-display text-xl font-semibold text-text-primary">
                <CreditCard className="h-5 w-5 text-brand-accent" />
                Phương thức thanh toán
              </h2>
              <div className="grid gap-3 sm:grid-cols-2">
                {/* COD */}
                <button
                  type="button"
                  onClick={() => setPaymentMethod('COD')}
                  className={`flex flex-col gap-2 rounded-xl border p-4 text-left transition-all ${
                    paymentMethod === 'COD'
                      ? 'border-brand bg-brand-subtle ring-1 ring-brand'
                      : 'border-border bg-surface-alt hover:border-brand/50'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span
                      className={`flex h-4 w-4 items-center justify-center rounded-full border-2 ${
                        paymentMethod === 'COD'
                          ? 'border-brand bg-brand'
                          : 'border-border'
                      }`}
                    >
                      {paymentMethod === 'COD' && (
                        <span className="h-1.5 w-1.5 rounded-full bg-white" />
                      )}
                    </span>
                    <Truck className="h-5 w-5 text-brand" />
                    <span className="font-display text-sm font-semibold text-text-primary">
                      Thanh toán khi nhận hàng
                    </span>
                  </div>
                  <p className="pl-7 text-xs text-text-secondary">
                    Thanh toán bằng tiền mặt khi nhận được hàng.
                  </p>
                </button>

                {/* MoMo */}
                <button
                  type="button"
                  onClick={() => setPaymentMethod('MOMO')}
                  className={`flex flex-col gap-2 rounded-xl border p-4 text-left transition-all ${
                    paymentMethod === 'MOMO'
                      ? 'border-[#ae2070] bg-[#ae2070]/5 ring-1 ring-[#ae2070]'
                      : 'border-border bg-surface-alt hover:border-[#ae2070]/50'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span
                      className={`flex h-4 w-4 items-center justify-center rounded-full border-2 ${
                        paymentMethod === 'MOMO'
                          ? 'border-[#ae2070] bg-[#ae2070]'
                          : 'border-border'
                      }`}
                    >
                      {paymentMethod === 'MOMO' && (
                        <span className="h-1.5 w-1.5 rounded-full bg-white" />
                      )}
                    </span>
                    <Wallet className="h-5 w-5 text-[#ae2070]" />
                    <span className="font-display text-sm font-semibold text-text-primary">
                      Ví điện tử MoMo
                    </span>
                  </div>
                  <p className="pl-7 text-xs text-text-secondary">
                    Thanh toán nhanh, an toàn qua ứng dụng MoMo.
                  </p>
                </button>
              </div>

              {paymentMethod === 'MOMO' && (
                <motion.p
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="rounded-lg border border-[#ae2070]/30 bg-[#ae2070]/5 px-4 py-3 text-xs text-[#ae2070]"
                >
                  Sau khi đặt hàng, bạn sẽ được chuyển đến ví MoMo để hoàn tất
                  thanh toán.
                </motion.p>
              )}
            </section>

            {/* Note */}
            <section className="space-y-2">
              <label
                htmlFor="note"
                className="block text-sm font-medium text-text-primary"
              >
                Ghi chú đơn hàng{' '}
                <span className="text-text-muted">(tùy chọn)</span>
              </label>
              <textarea
                id="note"
                name="note"
                rows={3}
                placeholder="Ghi chú thêm về đơn hàng, ví dụ: giao vào buổi sáng..."
                className={`${inputOk} resize-none`}
              />
            </section>

            {error && (
              <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">
                {error}
              </p>
            )}
          </form>
        </motion.div>

        {/* ── Right: Order Summary ── */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
          className="lg:col-span-5"
        >
          <div className="sticky top-28 space-y-6 rounded-2xl border border-border bg-surface p-6 shadow-sm">
            <h3 className="font-display text-lg font-bold text-text-primary">
              Đơn hàng của bạn ({items.length} sản phẩm)
            </h3>

            {/* Product list */}
            <div className="max-h-72 space-y-4 overflow-y-auto pr-1">
              {items.map(({ product, quantity }) => (
                <div key={product.id} className="flex gap-4">
                  <div className="flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-lg border border-border bg-surface-alt p-1">
                    <img
                      src={product.image}
                      alt={product.name}
                      className="h-full w-auto object-contain"
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h4 className="line-clamp-1 text-sm font-medium text-text-primary">
                      {product.name}
                    </h4>
                    <p className="text-xs text-text-muted">x{quantity}</p>
                    <p className="text-sm font-semibold text-brand">
                      {(product.price * quantity).toLocaleString('vi-VN')}₫
                    </p>
                  </div>
                </div>
              ))}
            </div>

            {/* Totals */}
            <div className="space-y-3 border-t border-border pt-4">
              <div className="flex justify-between text-sm">
                <span className="text-text-secondary">Tạm tính</span>
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
              {pricing.discount > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-text-secondary">Giảm giá</span>
                  <span className="font-medium text-green-600">
                    -{pricing.discount.toLocaleString('vi-VN')}₫
                  </span>
                </div>
              )}
              <div className="flex items-center justify-between border-t border-border pt-3">
                <span className="font-display text-base font-bold text-text-primary">
                  Tổng cộng
                </span>
                <span className="font-display text-xl font-bold text-brand">
                  {pricing.total.toLocaleString('vi-VN')}₫
                </span>
              </div>
            </div>

            {/* Submit */}
            <button
              type="submit"
              form="checkout-form"
              disabled={loading}
              className={`flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl py-4 font-display text-sm font-bold text-white transition-all hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-70 ${
                paymentMethod === 'MOMO' ? 'bg-[#ae2070]' : 'bg-brand'
              }`}
            >
              {loading ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Đang xử lý...
                </>
              ) : paymentMethod === 'MOMO' ? (
                <>
                  <Wallet className="h-5 w-5" />
                  Tiếp tục với MoMo
                </>
              ) : (
                'Đặt hàng ngay'
              )}
            </button>

            <p className="text-center text-xs text-text-muted">
              Bằng việc đặt hàng, bạn đồng ý với{' '}
              <span className="underline">điều khoản dịch vụ</span> và{' '}
              <span className="underline">chính sách bảo mật</span>.
            </p>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
