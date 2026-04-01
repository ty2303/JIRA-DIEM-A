import { AlertCircle, CheckCircle, Loader2 } from 'lucide-react';
import { motion } from 'motion/react';
import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import apiClient from '@/api/client';
import { ENDPOINTS } from '@/api/endpoints';
import type { ApiResponse } from '@/api/types';
import {
  type AuthPayload,
  normalizeAuthUser,
  useAuthStore,
} from '@/store/useAuthStore';
import { useCartStore } from '@/store/useCartStore';
import { useWishlistStore } from '@/store/useWishlistStore';

type PageState = 'loading' | 'success' | 'error';

const ERROR_MESSAGES: Record<string, string> = {
  access_denied: 'Bạn đã từ chối cấp quyền đăng nhập cho ứng dụng.',
  invalid_request: 'Yêu cầu đăng nhập không hợp lệ.',
  server_error: 'Máy chủ Google gặp sự cố, vui lòng thử lại.',
};

function resolveGoogleError(errorCode: string): string {
  return (
    ERROR_MESSAGES[errorCode] ?? 'Đăng nhập Google thất bại, vui lòng thử lại.'
  );
}

export function Component() {
  const [pageState, setPageState] = useState<PageState>('loading');
  const [errorMessage, setErrorMessage] = useState('');
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const login = useAuthStore((s) => s.login);
  const isLoggedIn = useAuthStore((s) => s.isLoggedIn);
  const isAdmin = useAuthStore((s) => s.isAdmin);
  const hasRun = useRef(false);

  // Nếu đã đăng nhập rồi thì redirect luôn
  useEffect(() => {
    if (isLoggedIn) {
      navigate(isAdmin ? '/admin' : '/', { replace: true });
    }
  }, [isLoggedIn, isAdmin, navigate]);

  useEffect(() => {
    // Chỉ chạy một lần (React StrictMode mount 2 lần trong dev)
    if (hasRun.current) return;
    hasRun.current = true;

    const handleCallback = async () => {
      // Kiểm tra lỗi Google trả về (ví dụ: access_denied)
      const googleError = searchParams.get('error');
      if (googleError) {
        setErrorMessage(resolveGoogleError(googleError));
        setPageState('error');
        return;
      }

      const code = searchParams.get('code');
      const state = searchParams.get('state');

      if (!code || !state) {
        setErrorMessage(
          'Thiếu thông tin xác thực từ Google. Vui lòng thử lại.',
        );
        setPageState('error');
        return;
      }

      try {
        const res = await apiClient.get<ApiResponse<AuthPayload>>(
          ENDPOINTS.AUTH.GOOGLE_CALLBACK,
          { params: { code, state } },
        );

        const { token, ...user } = res.data.data;
        login(token, normalizeAuthUser(user));

        await Promise.allSettled([
          useWishlistStore.getState().syncSession({ skipAuthRedirect: true }),
          useCartStore.getState().syncSession({ skipAuthRedirect: true }),
        ]);

        setPageState('success');

        setTimeout(() => {
          navigate(user.role === 'ADMIN' ? '/admin' : '/', { replace: true });
        }, 1200);
      } catch (err: unknown) {
        const axiosErr = err as {
          response?: { data?: { message?: string } };
        };
        setErrorMessage(
          axiosErr.response?.data?.message ??
            'Không thể hoàn tất đăng nhập Google, vui lòng thử lại.',
        );
        setPageState('error');
      }
    };

    void handleCallback();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="relative flex min-h-[calc(100vh-80px)] items-center justify-center overflow-hidden px-4 py-12">
      {/* Background decorations */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-24 -right-24 h-96 w-96 rounded-full bg-brand-accent/5 blur-3xl" />
        <div className="absolute -bottom-24 -left-24 h-96 w-96 rounded-full bg-brand-subtle/60 blur-3xl" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="relative z-10 w-full max-w-sm"
      >
        <div className="card overflow-hidden bg-surface p-8 text-center">
          {pageState === 'loading' && (
            <motion.div
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="space-y-4"
            >
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-brand/10">
                <Loader2 className="h-8 w-8 animate-spin text-brand" />
              </div>
              <div>
                <h2 className="font-display text-xl font-bold text-text-primary">
                  Đang xử lý đăng nhập
                </h2>
                <p className="mt-2 text-sm text-text-muted">
                  Vui lòng chờ trong giây lát...
                </p>
              </div>
            </motion.div>
          )}

          {pageState === 'success' && (
            <motion.div
              key="success"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="space-y-4"
            >
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 200, damping: 15 }}
                className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-100"
              >
                <CheckCircle className="h-8 w-8 text-green-600" />
              </motion.div>
              <div>
                <h2 className="font-display text-xl font-bold text-text-primary">
                  Đăng nhập thành công!
                </h2>
                <p className="mt-2 text-sm text-text-muted">
                  Đang chuyển hướng...
                </p>
              </div>
            </motion.div>
          )}

          {pageState === 'error' && (
            <motion.div
              key="error"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="space-y-4"
            >
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
                <AlertCircle className="h-8 w-8 text-red-500" />
              </div>
              <div>
                <h2 className="font-display text-xl font-bold text-text-primary">
                  Đăng nhập thất bại
                </h2>
                <p className="mt-2 text-sm text-red-600">{errorMessage}</p>
              </div>
              <button
                type="button"
                onClick={() => navigate('/login', { replace: true })}
                className="btn-primary w-full"
              >
                Quay lại trang đăng nhập
              </button>
            </motion.div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
