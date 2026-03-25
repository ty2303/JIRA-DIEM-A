import { ArrowLeft, CheckCircle2, KeyRound, Loader2 } from 'lucide-react';
import { motion } from 'motion/react';
import { type FormEvent, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import apiClient from '@/api/client';
import { ENDPOINTS } from '@/api/endpoints';

export function Component() {
  const [searchParams] = useSearchParams();
  const token = useMemo(
    () => searchParams.get('token')?.trim() ?? '',
    [searchParams],
  );
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');

    if (!token) {
      setError('Liên kết đặt lại mật khẩu không hợp lệ hoặc đã hết hạn.');
      return;
    }

    if (password.length < 6) {
      setError('Mật khẩu mới phải có ít nhất 6 ký tự.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Mật khẩu nhập lại không khớp.');
      return;
    }

    setLoading(true);
    try {
      await apiClient.post(ENDPOINTS.AUTH.RESET_PASSWORD, {
        token,
        newPassword: password,
      });
      setSuccess(true);
      setPassword('');
      setConfirmPassword('');
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { message?: string } } };
      setError(
        axiosErr.response?.data?.message ??
          'Không thể đặt lại mật khẩu, vui lòng thử lại.',
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-[calc(100vh-80px)] items-center justify-center px-4 py-12 pt-24">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-md"
      >
        <div className="card overflow-hidden bg-surface p-8">
          <div className="mb-8 text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-brand/10">
              <KeyRound className="h-6 w-6 text-brand" />
            </div>
            <h1 className="font-display text-2xl font-bold text-text-primary">
              Đặt lại mật khẩu
            </h1>
            <p className="mt-2 text-sm text-text-muted">
              Tạo mật khẩu mới cho tài khoản LOCAL của bạn.
            </p>
          </div>

          {success ? (
            <div className="space-y-4 text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-50">
                <CheckCircle2 className="h-8 w-8 text-green-500" />
              </div>
              <p className="text-sm text-text-secondary">
                Mật khẩu đã được cập nhật thành công. Bạn có thể đăng nhập lại
                ngay bây giờ.
              </p>
              <Link
                to="/login"
                className="btn-primary mt-4 inline-flex items-center gap-2 no-underline"
              >
                <ArrowLeft className="h-4 w-4" /> Về trang đăng nhập
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {!token && (
                <p className="rounded-lg bg-amber-50 px-4 py-2.5 text-sm text-amber-700">
                  Không tìm thấy token trong liên kết reset password.
                </p>
              )}

              <div className="space-y-1">
                <label
                  htmlFor="password"
                  className="text-xs font-medium text-text-secondary"
                >
                  Mật khẩu mới
                </label>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-lg border border-border bg-surface px-4 py-2.5 text-sm outline-none transition-colors focus:border-brand focus:ring-1 focus:ring-brand"
                  placeholder="••••••••"
                  minLength={6}
                  required
                />
              </div>

              <div className="space-y-1">
                <label
                  htmlFor="confirmPassword"
                  className="text-xs font-medium text-text-secondary"
                >
                  Nhập lại mật khẩu mới
                </label>
                <input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full rounded-lg border border-border bg-surface px-4 py-2.5 text-sm outline-none transition-colors focus:border-brand focus:ring-1 focus:ring-brand"
                  placeholder="••••••••"
                  minLength={6}
                  required
                />
              </div>

              {error && (
                <p className="rounded-lg bg-red-50 px-4 py-2.5 text-sm text-red-600">
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={loading || !token}
                className="btn-primary flex w-full cursor-pointer items-center justify-center gap-2 disabled:opacity-60"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {loading ? 'Đang cập nhật...' : 'Cập nhật mật khẩu'}
              </button>

              <div className="text-center">
                <Link
                  to="/login"
                  className="inline-flex items-center gap-1 text-xs font-medium text-brand hover:underline no-underline"
                >
                  <ArrowLeft className="h-3 w-3" /> Quay lại đăng nhập
                </Link>
              </div>
            </form>
          )}
        </div>
      </motion.div>
    </div>
  );
}
