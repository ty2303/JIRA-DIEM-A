import { ArrowLeft, Loader2, Mail } from 'lucide-react';
import { motion } from 'motion/react';
import { type FormEvent, useState } from 'react';
import { Link } from 'react-router';
import apiClient from '@/api/client';
import { ENDPOINTS } from '@/api/endpoints';

export function Component() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await apiClient.post(ENDPOINTS.AUTH.FORGOT_PASSWORD, { email });
      setSent(true);
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { message?: string } } };
      setError(
        axiosErr.response?.data?.message ??
          'Đã có lỗi xảy ra, vui lòng thử lại',
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
              <Mail className="h-6 w-6 text-brand" />
            </div>
            <h1 className="font-display text-2xl font-bold text-text-primary">
              Quên mật khẩu
            </h1>
            <p className="mt-2 text-sm text-text-muted">
              Nhập email để nhận link đặt lại mật khẩu
            </p>
          </div>

          {sent ? (
            <div className="space-y-4 text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-50">
                <Mail className="h-8 w-8 text-green-500" />
              </div>
              <p className="text-sm text-text-secondary">
                Chúng tôi đã gửi email đến <strong>{email}</strong>.
                <br />
                Vui lòng kiểm tra hộp thư (và thư rác) để đặt lại mật khẩu.
              </p>
              <p className="text-xs text-text-muted">
                Link có hiệu lực trong 15 phút.
              </p>
              <Link
                to="/login"
                className="btn-primary mt-4 inline-flex items-center gap-2 no-underline"
              >
                <ArrowLeft className="h-4 w-4" /> Quay lại đăng nhập
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1">
                <label
                  htmlFor="email"
                  className="text-xs font-medium text-text-secondary"
                >
                  Địa chỉ email
                </label>
                <div className="relative">
                  <Mail className="pointer-events-none absolute top-2.5 left-3 h-5 w-5 text-text-muted" />
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full rounded-lg border border-border bg-surface px-10 py-2.5 text-sm outline-none transition-colors focus:border-brand focus:ring-1 focus:ring-brand"
                    placeholder="email@example.com"
                    required
                  />
                </div>
              </div>

              {error && (
                <p className="rounded-lg bg-red-50 px-4 py-2.5 text-sm text-red-600">
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="btn-primary flex w-full cursor-pointer items-center justify-center gap-2 disabled:opacity-60"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {loading ? 'Đang gửi...' : 'Gửi email đặt lại mật khẩu'}
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
