import {
  ChevronDown,
  ChevronUp,
  ClipboardList,
  KeyRound,
  Loader2,
  Lock,
  Package,
  ShieldCheck,
  User,
  XCircle,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useState } from 'react';
import { useLocation } from 'react-router';

import apiClient from '@/api/client';
import { ENDPOINTS } from '@/api/endpoints';
import type { ApiResponse } from '@/api/types';
import CancelOrderModal from '@/components/ui/CancelOrderModal';
import { useAuthStore } from '@/store/useAuthStore';
import { useOrderStore } from '@/store/useOrderStore';
import { useToastStore } from '@/store/useToastStore';
import { ORDER_STATUS_COLOR, ORDER_STATUS_LABEL } from '@/types/order';

interface UserProfile {
  id: string;
  username: string;
  email: string;
  role: 'USER' | 'ADMIN';
  authProvider: 'local' | 'google';
  hasPassword: boolean;
  avatar: string | null;
  createdAt: string;
}

export const Component = Profile;

function Profile() {
  const user = useAuthStore((state) => state.user);
  const syncUser = useAuthStore((state) => state.syncUser);
  const addToast = useToastStore((s) => s.addToast);
  const location = useLocation();
  const locationState = location.state as { tab?: string } | null;
  const [activeTab, setActiveTab] = useState<'account' | 'orders'>(
    locationState?.tab === 'orders' ? 'orders' : 'account',
  );

  // Profile
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);

  // Change / Setup password
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState('');
  const [passwordLoading, setPasswordLoading] = useState(false);

  // Orders
  const orders = useOrderStore((s) => s.orders);
  const ordersLoading = useOrderStore((s) => s.isLoading);
  const fetchOrders = useOrderStore((s) => s.fetchOrders);
  const cancelOrderInStore = useOrderStore((s) => s.cancelOrder);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Cancel modal
  const [cancellingOrderId, setCancellingOrderId] = useState<string | null>(
    null,
  );

  useEffect(() => {
    setProfileLoading(true);
    apiClient
      .get<ApiResponse<UserProfile>>(ENDPOINTS.USERS.ME)
      .then((res) => {
        setProfile(res.data.data);
        syncUser(res.data.data);
      })
      .catch(() => {
        setProfile(null);
      })
      .finally(() => setProfileLoading(false));
  }, [syncUser]);

  useEffect(() => {
    if (activeTab !== 'orders') return;
    fetchOrders();
  }, [activeTab, fetchOrders]);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError('');
    setPasswordSuccess('');

    if (newPassword !== confirmPassword) {
      setPasswordError('Mật khẩu mới nhập lại không khớp');
      return;
    }

    setPasswordLoading(true);
    try {
      await apiClient.put(ENDPOINTS.USERS.CHANGE_PASSWORD, {
        currentPassword,
        newPassword,
      });
      setPasswordSuccess('Đổi mật khẩu thành công!');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { message?: string } } };
      setPasswordError(
        axiosErr.response?.data?.message ?? 'Thao tác thất bại, thử lại sau',
      );
    } finally {
      setPasswordLoading(false);
    }
  };

  const handleCancelOrder = async (orderId: string, reason: string) => {
    try {
      await cancelOrderInStore(orderId, reason);
      addToast('success', 'Đơn hàng đã được hủy thành công');
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { message?: string } } };
      addToast(
        'error',
        axiosErr.response?.data?.message ?? 'Không thể hủy đơn hàng',
      );
    }
  };

  const canCancel = (status: string) =>
    status === 'PENDING' || status === 'CONFIRMED';

  const initial = (user?.username ?? 'U').charAt(0).toUpperCase();
  const effectiveProfile = profile ?? user;
  const hasPassword = effectiveProfile?.hasPassword ?? true;
  const authProvider = effectiveProfile?.authProvider ?? 'local';

  return (
    <div className="mx-auto max-w-4xl px-6 py-24 lg:py-32">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8 flex items-center gap-5"
      >
        {user?.avatar ? (
          <img
            src={user.avatar}
            alt={user.username}
            className="h-16 w-16 rounded-2xl object-cover"
          />
        ) : (
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-brand text-2xl font-bold text-white">
            {initial}
          </div>
        )}
        <div>
          <h1 className="font-display text-2xl font-bold text-text-primary">
            {user?.username}
          </h1>
          <div className="mt-1 flex items-center gap-2">
            <p className="text-sm text-text-secondary">{user?.email}</p>
            {user?.role === 'ADMIN' && (
              <span className="flex items-center gap-1 rounded-full bg-purple-100 px-2 py-0.5 text-xs font-semibold text-purple-700">
                <ShieldCheck className="h-3 w-3" />
                Admin
              </span>
            )}
          </div>
        </div>
      </motion.div>

      {/* Tabs */}
      <div className="mb-6 flex gap-1 rounded-xl bg-surface-alt p-1">
        <button
          type="button"
          onClick={() => setActiveTab('account')}
          className={`flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-medium transition-all ${
            activeTab === 'account'
              ? 'bg-surface text-brand shadow-sm'
              : 'text-text-muted hover:text-text-secondary'
          }`}
        >
          <User className="h-4 w-4" />
          Tài khoản
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('orders')}
          className={`flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-medium transition-all ${
            activeTab === 'orders'
              ? 'bg-surface text-brand shadow-sm'
              : 'text-text-muted hover:text-text-secondary'
          }`}
        >
          <ClipboardList className="h-4 w-4" />
          Đơn hàng
        </button>
      </div>

      <AnimatePresence mode="wait">
        {activeTab === 'account' ? (
          <motion.div
            key="account"
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 10 }}
            transition={{ duration: 0.2 }}
            className="space-y-6"
          >
            {/* Profile info card */}
            <div className="card p-6">
              <h2 className="mb-4 flex items-center gap-2 font-display text-base font-semibold text-text-primary">
                <User className="h-4 w-4 text-brand" />
                Thông tin tài khoản
              </h2>

              {profileLoading ? (
                <div className="flex justify-center py-6">
                  <Loader2 className="h-5 w-5 animate-spin text-text-muted" />
                </div>
              ) : (
                <dl className="grid gap-3 sm:grid-cols-2">
                  {[
                    { label: 'Tên đăng nhập', value: profile?.username },
                    { label: 'Email', value: profile?.email },
                    {
                      label: 'Vai trò',
                      value:
                        profile?.role === 'ADMIN'
                          ? 'Quản trị viên'
                          : 'Khách hàng',
                    },
                    {
                      label: 'Ngày tham gia',
                      value: profile?.createdAt
                        ? new Date(profile.createdAt).toLocaleDateString(
                            'vi-VN',
                            {
                              year: 'numeric',
                              month: 'long',
                              day: 'numeric',
                            },
                          )
                        : '—',
                    },
                  ].map((item) => (
                    <div
                      key={item.label}
                      className="rounded-xl bg-surface-alt px-4 py-3"
                    >
                      <dt className="text-xs font-medium text-text-muted">
                        {item.label}
                      </dt>
                      <dd className="mt-1 text-sm font-medium text-text-primary">
                        {item.value ?? '—'}
                      </dd>
                    </div>
                  ))}
                </dl>
              )}
            </div>

            {/* Password card */}
            <div className="card p-6">
              <h2 className="mb-4 flex items-center gap-2 font-display text-base font-semibold text-text-primary">
                <KeyRound className="h-4 w-4 text-brand" />
                {hasPassword ? 'Đổi mật khẩu' : 'Phương thức đăng nhập'}
              </h2>

              {hasPassword ? (
                <form onSubmit={handleChangePassword} className="space-y-4">
                  <div className="space-y-1">
                    <label
                      htmlFor="currentPassword"
                      className="text-xs font-medium text-text-secondary"
                    >
                      Mật khẩu hiện tại
                    </label>
                    <div className="relative">
                      <Lock className="pointer-events-none absolute top-2.5 left-3 h-4 w-4 text-text-muted" />
                      <input
                        id="currentPassword"
                        type="password"
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                        required
                        className="w-full rounded-xl border border-border bg-surface-alt px-4 py-2.5 pl-9 text-sm outline-none transition-colors focus:border-brand focus:ring-1 focus:ring-brand"
                        placeholder="••••••••"
                      />
                    </div>
                  </div>

                  {[
                    {
                      id: 'newPassword',
                      label: 'Mật khẩu mới',
                      value: newPassword,
                      onChange: setNewPassword,
                    },
                    {
                      id: 'confirmPassword',
                      label: 'Nhập lại mật khẩu mới',
                      value: confirmPassword,
                      onChange: setConfirmPassword,
                    },
                  ].map((field) => (
                    <div key={field.id} className="space-y-1">
                      <label
                        htmlFor={field.id}
                        className="text-xs font-medium text-text-secondary"
                      >
                        {field.label}
                      </label>
                      <div className="relative">
                        <Lock className="pointer-events-none absolute top-2.5 left-3 h-4 w-4 text-text-muted" />
                        <input
                          id={field.id}
                          type="password"
                          value={field.value}
                          onChange={(e) => field.onChange(e.target.value)}
                          required
                          minLength={6}
                          className="w-full rounded-xl border border-border bg-surface-alt px-4 py-2.5 pl-9 text-sm outline-none transition-colors focus:border-brand focus:ring-1 focus:ring-brand"
                          placeholder="••••••••"
                        />
                      </div>
                    </div>
                  ))}

                  {passwordError && (
                    <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
                      {passwordError}
                    </p>
                  )}
                  {passwordSuccess && (
                    <p className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">
                      {passwordSuccess}
                    </p>
                  )}

                  <div className="flex justify-end">
                    <motion.button
                      type="submit"
                      disabled={passwordLoading}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      className="btn-primary flex cursor-pointer items-center gap-2 disabled:opacity-60"
                    >
                      {passwordLoading && (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      )}
                      Lưu thay đổi
                    </motion.button>
                  </div>
                </form>
              ) : (
                <div className="rounded-xl bg-surface-alt px-4 py-4 text-sm leading-6 text-text-secondary">
                  <p className="font-medium text-text-primary">
                    Tài khoản của bạn đang đăng nhập bằng{' '}
                    {authProvider === 'google'
                      ? 'Google'
                      : 'nhà cung cấp bên ngoài'}
                    .
                  </p>
                  <p className="mt-2">
                    Hiện chưa có mật khẩu cục bộ được cấu hình cho tài khoản
                    này, nên bạn không cần nhập hoặc đổi mật khẩu trong ứng
                    dụng.
                  </p>
                </div>
              )}
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="orders"
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -10 }}
            transition={{ duration: 0.2 }}
          >
            {ordersLoading ? (
              <div className="flex justify-center py-16">
                <Loader2 className="h-8 w-8 animate-spin text-text-muted" />
              </div>
            ) : orders.length === 0 ? (
              <div className="flex flex-col items-center py-20 text-center">
                <Package className="h-12 w-12 text-text-muted" />
                <h3 className="mt-4 font-display text-lg font-semibold text-text-primary">
                  Chưa có đơn hàng nào
                </h3>
                <p className="mt-2 text-sm text-text-secondary">
                  Các đơn hàng của bạn sẽ xuất hiện ở đây.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {orders.map((order) => {
                  const totalQuantity = order.items.reduce(
                    (total, item) => total + item.quantity,
                    0,
                  );

                  return (
                    <div
                      key={order.id}
                      className="overflow-hidden rounded-2xl border border-border bg-surface"
                    >
                      {/* Order header */}
                      <button
                        type="button"
                        onClick={() =>
                          setExpandedId(
                            expandedId === order.id ? null : order.id,
                          )
                        }
                        className="flex w-full cursor-pointer items-center justify-between px-5 py-4 text-left transition-colors hover:bg-surface-alt"
                      >
                        <div className="flex flex-wrap items-center gap-3">
                          <span className="font-mono text-xs font-bold text-text-muted">
                            #{order.id.slice(-8).toUpperCase()}
                          </span>
                          <span
                            className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${ORDER_STATUS_COLOR[order.status]}`}
                          >
                            {ORDER_STATUS_LABEL[order.status]}
                          </span>
                          <span className="text-sm text-text-secondary">
                            {totalQuantity} sản phẩm
                          </span>
                          <span className="text-sm text-text-secondary">
                            {new Date(order.createdAt).toLocaleDateString(
                              'vi-VN',
                            )}
                          </span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="font-display text-sm font-bold text-brand">
                            {order.total.toLocaleString('vi-VN')}₫
                          </span>
                          {expandedId === order.id ? (
                            <ChevronUp className="h-4 w-4 shrink-0 text-text-muted" />
                          ) : (
                            <ChevronDown className="h-4 w-4 shrink-0 text-text-muted" />
                          )}
                        </div>
                      </button>

                      {/* Order detail */}
                      <AnimatePresence>
                        {expandedId === order.id && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            className="overflow-hidden border-t border-border"
                          >
                            <div className="px-5 py-4">
                              {/* Delivery info */}
                              <div className="mb-4 grid gap-2 rounded-xl bg-surface-alt p-4 text-sm sm:grid-cols-2">
                                <div>
                                  <span className="text-text-muted">
                                    Người nhận:{' '}
                                  </span>
                                  <span className="font-medium text-text-primary">
                                    {order.customerName}
                                  </span>
                                </div>
                                <div>
                                  <span className="text-text-muted">
                                    Điện thoại:{' '}
                                  </span>
                                  <span className="font-medium text-text-primary">
                                    {order.phone}
                                  </span>
                                </div>
                                <div className="sm:col-span-2">
                                  <span className="text-text-muted">
                                    Địa chỉ:{' '}
                                  </span>
                                  <span className="font-medium text-text-primary">
                                    {order.address}, {order.ward},{' '}
                                    {order.district}, {order.city}
                                  </span>
                                </div>
                                <div>
                                  <span className="text-text-muted">
                                    Thanh toán:{' '}
                                  </span>
                                  <span className="font-medium text-text-primary">
                                    {order.paymentMethod}
                                  </span>
                                </div>
                                {order.paymentStatus && (
                                  <div>
                                    <span className="text-text-muted">
                                      Trạng thái TT:{' '}
                                    </span>
                                    <span className="font-medium text-text-primary">
                                      {order.paymentStatus}
                                    </span>
                                  </div>
                                )}
                              </div>

                              {/* Cancel reason info */}
                              {order.status === 'CANCELLED' &&
                                order.cancelReason && (
                                  <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm">
                                    <p className="font-medium text-red-700">
                                      Lý do hủy:{' '}
                                      <span className="font-normal text-red-600">
                                        {order.cancelReason}
                                      </span>
                                    </p>
                                    {order.cancelledBy && (
                                      <p className="mt-1 text-xs text-red-400">
                                        Hủy bởi:{' '}
                                        {order.cancelledBy === 'ADMIN'
                                          ? 'Quản trị viên'
                                          : 'Bạn'}
                                      </p>
                                    )}
                                  </div>
                                )}

                              {/* Items */}
                              <div className="space-y-3">
                                {order.items.map((item) => (
                                  <div
                                    key={item.productId}
                                    className="flex items-center gap-3"
                                  >
                                    <img
                                      src={item.productImage}
                                      alt={item.productName}
                                      className="h-12 w-12 rounded-lg object-contain bg-surface-alt p-1"
                                    />
                                    <div className="min-w-0 flex-1">
                                      <p className="truncate text-sm font-medium text-text-primary">
                                        {item.productName}
                                      </p>
                                      <p className="text-xs text-text-muted">
                                        {item.brand} · x{item.quantity}
                                      </p>
                                    </div>
                                    <span className="shrink-0 text-sm font-semibold text-text-primary">
                                      {(
                                        item.price * item.quantity
                                      ).toLocaleString('vi-VN')}
                                      ₫
                                    </span>
                                  </div>
                                ))}
                              </div>

                              {/* Total */}
                              <div className="mt-4 space-y-1 border-t border-border pt-4 text-sm">
                                <div className="flex justify-between text-text-secondary">
                                  <span>Tạm tính</span>
                                  <span>
                                    {order.subtotal.toLocaleString('vi-VN')}₫
                                  </span>
                                </div>
                                <div className="flex justify-between text-text-secondary">
                                  <span>Phí vận chuyển</span>
                                  <span>
                                    {order.shippingFee === 0
                                      ? 'Miễn phí'
                                      : `${order.shippingFee.toLocaleString('vi-VN')}₫`}
                                  </span>
                                </div>
                                {order.discount > 0 && (
                                  <div className="flex justify-between text-text-secondary">
                                    <span>Giảm giá</span>
                                    <span className="text-green-600">
                                      -{order.discount.toLocaleString('vi-VN')}₫
                                    </span>
                                  </div>
                                )}
                                <div className="flex justify-between font-bold text-text-primary">
                                  <span>Tổng cộng</span>
                                  <span className="text-brand">
                                    {order.total.toLocaleString('vi-VN')}₫
                                  </span>
                                </div>
                              </div>

                              {/* Cancel button */}
                              {canCancel(order.status) && (
                                <div className="mt-4 flex justify-end border-t border-border pt-4">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setCancellingOrderId(order.id)
                                    }
                                    className="flex cursor-pointer items-center gap-1.5 rounded-lg bg-red-50 px-4 py-2 text-sm font-semibold text-red-600 transition-colors hover:bg-red-100"
                                  >
                                    <XCircle className="h-4 w-4" />
                                    Hủy đơn hàng
                                  </button>
                                </div>
                              )}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  );
                })}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Cancel Order Modal */}
      <AnimatePresence>
        {cancellingOrderId && (
          <CancelOrderModal
            orderId={cancellingOrderId}
            onConfirm={handleCancelOrder}
            onClose={() => setCancellingOrderId(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
