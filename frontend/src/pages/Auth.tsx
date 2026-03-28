import {
  ArrowRight,
  Eye,
  EyeOff,
  Globe,
  Loader2,
  Lock,
  Mail,
  Smartphone,
  User,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { type FormEvent, useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import apiClient from '@/api/client';
import { ENDPOINTS } from '@/api/endpoints';
import type { ApiResponse } from '@/api/types';
import { type AuthPayload, useAuthStore } from '@/store/useAuthStore';
import { useCartStore } from '@/store/useCartStore';
import { useWishlistStore } from '@/store/useWishlistStore';

interface GoogleCredentialResponse {
  credential?: string;
}

interface GoogleIdConfiguration {
  client_id: string;
  callback: (response: GoogleCredentialResponse) => void;
}

interface GoogleButtonConfiguration {
  theme?: 'outline' | 'filled_blue' | 'filled_black';
  size?: 'large' | 'medium' | 'small';
  text?:
    | 'signin_with'
    | 'signup_with'
    | 'continue_with'
    | 'signin'
    | 'signup'
    | 'continue';
  shape?: 'rectangular' | 'pill' | 'circle' | 'square';
  width?: number;
  logo_alignment?: 'left' | 'center';
}

interface GoogleAccountsIdApi {
  initialize: (config: GoogleIdConfiguration) => void;
  renderButton: (
    element: HTMLElement,
    config: GoogleButtonConfiguration,
  ) => void;
}

interface GoogleAccountsApi {
  id: GoogleAccountsIdApi;
}

interface GoogleIdentityApi {
  accounts: GoogleAccountsApi;
}

declare global {
  interface Window {
    google?: GoogleIdentityApi;
  }
}

const GOOGLE_SCRIPT_ID = 'google-identity-service-script';
const GOOGLE_SCRIPT_SOURCE = 'https://accounts.google.com/gsi/client';

const loadGoogleIdentityScript = () =>
  new Promise<void>((resolve, reject) => {
    const existing = document.getElementById(
      GOOGLE_SCRIPT_ID,
    ) as HTMLScriptElement | null;

    if (window.google?.accounts?.id) {
      resolve();
      return;
    }

    if (existing) {
      existing.addEventListener('load', () => resolve(), { once: true });
      existing.addEventListener(
        'error',
        () => reject(new Error('load-error')),
        {
          once: true,
        },
      );
      return;
    }

    const script = document.createElement('script');
    script.id = GOOGLE_SCRIPT_ID;
    script.src = GOOGLE_SCRIPT_SOURCE;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('load-error'));
    document.head.appendChild(script);
  });

const isValidEmail = (email: string) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

const isValidUsername = (username: string) => {
  const usernameRegex = /^[a-zA-Z0-9_]{3,30}$/;
  return usernameRegex.test(username);
};

const getPasswordStrength = (
  password: string,
): { level: number; label: string; color: string } => {
  if (password.length === 0) return { level: 0, label: '', color: '' };
  if (password.length < 6)
    return { level: 1, label: 'Yếu', color: 'bg-red-500' };

  let strength = 0;
  if (password.length >= 6) strength++;
  if (password.length >= 8) strength++;
  if (/[A-Z]/.test(password)) strength++;
  if (/[0-9]/.test(password)) strength++;
  if (/[^A-Za-z0-9]/.test(password)) strength++;

  if (strength <= 2)
    return { level: strength, label: 'Yếu', color: 'bg-red-500' };
  if (strength <= 3)
    return { level: strength, label: 'Trung bình', color: 'bg-yellow-500' };
  if (strength <= 4)
    return { level: strength, label: 'Mạnh', color: 'bg-green-500' };
  return { level: strength, label: 'Rất mạnh', color: 'bg-green-600' };
};

export function Component() {
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [googleReady, setGoogleReady] = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [registerSuccess, setRegisterSuccess] = useState(false);
  const googleButtonContainerRef = useRef<HTMLDivElement | null>(null);
  const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID?.trim() ?? '';
  const navigate = useNavigate();
  const login = useAuthStore((s) => s.login);
  const isLoggedIn = useAuthStore((s) => s.isLoggedIn);
  const isAdmin = useAuthStore((s) => s.isAdmin);

  useEffect(() => {
    if (isLoggedIn) {
      navigate(isAdmin ? '/admin' : '/', { replace: true });
    }
  }, [isLoggedIn, isAdmin, navigate]);

  useEffect(() => {
    setError('');
  }, [isLogin]);

  const completeLogin = async (payload: AuthResponse) => {
    const { token, ...user } = payload;
    login(token, normalizeAuthUser(user));

    await Promise.allSettled([
      useWishlistStore.getState().syncSession({ skipAuthRedirect: true }),
      useCartStore.getState().fetch({ skipAuthRedirect: true }),
    ]);

    navigate(user.role === 'ADMIN' ? '/admin' : '/');
  };

  const handleGoogleCredential = useCallback(
    async (credential: string) => {
      setError('');
      setGoogleLoading(true);

    try {
      const response = await apiClient.post<ApiResponse<AuthResponse>>(
        ENDPOINTS.AUTH.GOOGLE,
        {
          credential,
        },
      );

        await completeLogin(response.data.data);
      } catch (err: unknown) {
        const axiosErr = err as {
          response?: {
            data?: { message?: string };
          };
        };
        setError(
          axiosErr.response?.data?.message ??
            'Không thể đăng nhập Google, vui lòng thử lại',
        );
      } finally {
        setGoogleLoading(false);
      }
    },
    [completeLogin],
  );

  useEffect(() => {
    let active = true;

    if (!isLogin || !googleClientId) {
      setGoogleReady(false);
      return () => {
        active = false;
      };
    }

    const initializeGoogle = async () => {
      try {
        await loadGoogleIdentityScript();

        if (!active || !googleButtonContainerRef.current || !window.google) {
          return;
        }

        window.google.accounts.id.initialize({
          client_id: googleClientId,
          callback: (response) => {
            if (!active) {
              return;
            }

            if (!response.credential) {
              setError('Không thể lấy thông tin đăng nhập từ Google');
              return;
            }

            void handleGoogleCredential(response.credential);
          },
        });

        googleButtonContainerRef.current.replaceChildren();
        window.google.accounts.id.renderButton(
          googleButtonContainerRef.current,
          {
            theme: 'outline',
            size: 'large',
            text: 'continue_with',
            shape: 'pill',
            width: 360,
            logo_alignment: 'left',
          },
        );
        setGoogleReady(true);
      } catch {
        if (active) {
          setGoogleReady(false);
          setError('Không thể tải Google Sign-In, vui lòng thử lại sau');
        }
      }
    };

    void initializeGoogle();

    return () => {
      active = false;
    };
  }, [googleClientId, handleGoogleCredential, isLogin]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');

    if (!isLogin) {
      if (!isValidUsername(username)) {
        setError(
          'Tên đăng nhập chỉ được chứa chữ cái, số và dấu gạch dưới, dài 3-30 ký tự',
        );
        return;
      }
      if (!isValidEmail(email)) {
        setError('Vui lòng nhập địa chỉ email hợp lệ');
        return;
      }
      if (!agreedToTerms) {
        setError('Vui lòng đồng ý với điều khoản sử dụng');
        return;
      }
    }

    if (!isLogin && password !== confirmPassword) {
      setError('Mật khẩu nhập lại không khớp');
      return;
    }

    if (password.length < 6) {
      setError('Mật khẩu phải có ít nhất 6 ký tự');
      return;
    }

    setLoading(true);
    try {
      const endpoint = isLogin ? ENDPOINTS.AUTH.LOGIN : ENDPOINTS.AUTH.REGISTER;
      const body = isLogin
        ? { username, password }
        : { username, email, password };
      const res = await apiClient.post<ApiResponse<AuthPayload>>(
        endpoint,
        body,
      );
      if (!isLogin) {
        setRegisterSuccess(true);
        setLoading(false);
        return;
      }

      await completeLogin(res.data.data);
    } catch (err: unknown) {
      const axiosErr = err as {
        response?: {
          data?: { message?: string; errors?: Record<string, string[]> };
        };
      };
      const serverErrors = axiosErr.response?.data?.errors;
      if (serverErrors) {
        const firstError = Object.values(serverErrors).flat()[0];
        setError(
          firstError ?? axiosErr.response?.data?.message ?? 'Đã có lỗi xảy ra',
        );
      } else {
        setError(
          axiosErr.response?.data?.message ??
            'Đã có lỗi xảy ra, vui lòng thử lại',
        );
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-[calc(100vh-80px)] items-center justify-center overflow-hidden px-4 py-12 pt-24">
      {/* Background decorations */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-24 -right-24 h-96 w-96 rounded-full bg-brand-accent/5 blur-3xl" />
        <div className="absolute -bottom-24 -left-24 h-96 w-96 rounded-full bg-brand-subtle/60 blur-3xl" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="relative z-10 w-full max-w-md"
      >
        <AnimatePresence mode="wait">
          {registerSuccess ? (
            <motion.div
              key="success"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="card overflow-hidden bg-surface p-8 text-center"
            >
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 200, damping: 15 }}
                className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100"
              >
                <svg
                  className="h-8 w-8 text-green-600"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              </motion.div>
              <h2 className="font-display text-xl font-bold text-text-primary">
                Đăng ký thành công!
              </h2>
              <p className="mt-2 text-sm text-text-muted">
                Chúc mừng bạn đã tạo tài khoản thành công. Vui lòng đăng nhập để
                tiếp tục.
              </p>
              <button
                type="button"
                onClick={() => {
                  setRegisterSuccess(false);
                  setIsLogin(true);
                  setUsername('');
                  setEmail('');
                  setPassword('');
                  setConfirmPassword('');
                }}
                className="btn-primary mt-6 w-full"
              >
                Đăng nhập ngay
              </button>
            </motion.div>
          ) : (
            <motion.div
              key="form"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="card overflow-hidden bg-surface p-8"
            >
              {/* Header */}
              <div className="mb-8 text-center">
                <motion.div
                  initial={{ scale: 0.8 }}
                  animate={{ scale: 1 }}
                  transition={{ duration: 0.3, delay: 0.1 }}
                  className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-brand/10"
                >
                  <Smartphone className="h-6 w-6 text-brand" />
                </motion.div>
                <h1 className="font-display text-2xl font-bold text-text-primary">
                  {isLogin ? 'Chào mừng trở lại' : 'Tạo tài khoản'}
                </h1>
                <p className="mt-2 text-sm text-text-muted">
                  {isLogin
                    ? 'Đăng nhập để tiếp tục mua sắm'
                    : 'Đăng ký để bắt đầu trải nghiệm'}
                </p>
              </div>

              {/* Tabs */}
              <div className="mb-8 flex rounded-lg bg-surface-alt p-1">
                <button
                  type="button"
                  onClick={() => setIsLogin(true)}
                  className={`flex-1 cursor-pointer rounded-md py-2 text-sm font-medium transition-all ${
                    isLogin
                      ? 'bg-surface text-brand shadow-sm'
                      : 'text-text-muted hover:text-text-secondary'
                  }`}
                >
                  Đăng nhập
                </button>
                <button
                  type="button"
                  onClick={() => setIsLogin(false)}
                  className={`flex-1 cursor-pointer rounded-md py-2 text-sm font-medium transition-all ${
                    !isLogin
                      ? 'bg-surface text-brand shadow-sm'
                      : 'text-text-muted hover:text-text-secondary'
                  }`}
                >
                  Đăng ký
                </button>
              </div>

              {/* Form */}
              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Username */}
                <div className="space-y-1">
                  <label
                    htmlFor="username"
                    className="text-xs font-medium text-text-secondary"
                  >
                    Tên đăng nhập
                  </label>
                  <div className="relative">
                    <User className="pointer-events-none absolute top-2.5 left-3 h-5 w-5 text-text-muted" />
                    <input
                      id="username"
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      className="w-full rounded-lg border border-border bg-surface px-10 py-2.5 text-sm outline-none transition-colors focus:border-brand focus:ring-1 focus:ring-brand"
                      placeholder="username123"
                      required
                      autoComplete="username"
                    />
                  </div>
                </div>

                {/* Email - only for register */}
                <AnimatePresence mode="popLayout">
                  {!isLogin && (
                    <motion.div
                      key="email-field"
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="space-y-1">
                        <label
                          htmlFor="email"
                          className="text-xs font-medium text-text-secondary"
                        >
                          Email
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
                            autoComplete="email"
                          />
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Password */}
                <div className="space-y-1">
                  <label
                    htmlFor="password"
                    className="text-xs font-medium text-text-secondary"
                  >
                    Mật khẩu
                  </label>
                  <div className="relative">
                    <Lock className="pointer-events-none absolute top-2.5 left-3 h-5 w-5 text-text-muted" />
                    <input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full rounded-lg border border-border bg-surface py-2.5 pr-10 pl-10 text-sm outline-none transition-colors focus:border-brand focus:ring-1 focus:ring-brand"
                      placeholder="••••••••"
                      required
                      autoComplete={
                        isLogin ? 'current-password' : 'new-password'
                      }
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute top-2.5 right-3 cursor-pointer text-text-muted transition-colors hover:text-text-secondary"
                      tabIndex={-1}
                      aria-label={
                        showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'
                      }
                    >
                      {showPassword ? (
                        <EyeOff className="h-5 w-5" />
                      ) : (
                        <Eye className="h-5 w-5" />
                      )}
                    </button>
                  </div>
                  {!isLogin && password.length > 0 && (
                    <div className="mt-2 flex items-center gap-2">
                      <div className="flex-1 h-1.5 rounded-full bg-border overflow-hidden">
                        <div
                          className={`h-full transition-all duration-300 ${getPasswordStrength(password).color}`}
                          style={{
                            width: `${Math.min((getPasswordStrength(password).level / 5) * 100, 100)}%`,
                          }}
                        />
                      </div>
                      <span className="text-xs text-text-muted">
                        {getPasswordStrength(password).label}
                      </span>
                    </div>
                  )}
                </div>

                {/* Confirm Password - only for register */}
                <AnimatePresence mode="popLayout">
                  {!isLogin && (
                    <motion.div
                      key="confirm-password-field"
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="space-y-4 overflow-hidden"
                    >
                      <div className="space-y-1">
                        <label
                          htmlFor="confirmPassword"
                          className="text-xs font-medium text-text-secondary"
                        >
                          Nhập lại mật khẩu
                        </label>
                        <div className="relative">
                          <Lock className="pointer-events-none absolute top-2.5 left-3 h-5 w-5 text-text-muted" />
                          <input
                            id="confirmPassword"
                            type={showConfirmPassword ? 'text' : 'password'}
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            className="w-full rounded-lg border border-border bg-surface py-2.5 pr-10 pl-10 text-sm outline-none transition-colors focus:border-brand focus:ring-1 focus:ring-brand"
                            placeholder="••••••••"
                            required
                            autoComplete="new-password"
                          />
                          <button
                            type="button"
                            onClick={() =>
                              setShowConfirmPassword(!showConfirmPassword)
                            }
                            className="absolute top-2.5 right-3 cursor-pointer text-text-muted transition-colors hover:text-text-secondary"
                            tabIndex={-1}
                            aria-label={
                              showConfirmPassword
                                ? 'Ẩn mật khẩu'
                                : 'Hiện mật khẩu'
                            }
                          >
                            {showConfirmPassword ? (
                              <EyeOff className="h-5 w-5" />
                            ) : (
                              <Eye className="h-5 w-5" />
                            )}
                          </button>
                        </div>
                      </div>

                      {/* Terms checkbox */}
                      <label
                        htmlFor="terms"
                        className="flex items-start gap-2 text-xs text-text-secondary cursor-pointer"
                      >
                        <input
                          id="terms"
                          type="checkbox"
                          checked={agreedToTerms}
                          onChange={(e) => setAgreedToTerms(e.target.checked)}
                          className="mt-0.5 rounded border-border text-brand focus:ring-brand"
                        />
                        <span>
                          Tôi đồng ý với{' '}
                          <a
                            href="/about"
                            className="text-brand hover:underline"
                          >
                            Điều khoản sử dụng
                          </a>{' '}
                          và{' '}
                          <a
                            href="/about"
                            className="text-brand hover:underline"
                          >
                            Chính sách bảo mật
                          </a>
                        </span>
                      </label>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Remember me & Forgot password - only for login */}
                {isLogin && (
                  <div className="flex items-center justify-between">
                    <label
                      htmlFor="remember"
                      className="flex items-center gap-2 text-xs text-text-secondary"
                    >
                      <input
                        id="remember"
                        type="checkbox"
                        className="rounded border-border text-brand focus:ring-brand"
                      />
                      Ghi nhớ đăng nhập
                    </label>
                    <Link
                      to="/forgot-password"
                      className="text-xs font-medium text-brand hover:underline no-underline"
                    >
                      Quên mật khẩu?
                    </Link>
                  </div>
                )}

                {/* Error message */}
                <AnimatePresence mode="popLayout">
                  {error && (
                    <motion.p
                      key="error-msg"
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -4 }}
                      className="rounded-lg bg-red-50 px-4 py-2.5 text-sm text-red-600"
                    >
                      {error}
                    </motion.p>
                  )}
                </AnimatePresence>

                {/* Submit button */}
                <button
                  type="submit"
                  disabled={loading || googleLoading}
                  className="btn-primary flex w-full cursor-pointer items-center justify-center gap-2 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Đang xử lý...
                    </>
                  ) : (
                    <>
                      {isLogin ? 'Đăng nhập' : 'Tạo tài khoản'}
                      <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </button>

                {isLogin && (
                  <div className="space-y-3 pt-1">
                    <div className="relative">
                      <div className="absolute inset-0 flex items-center">
                        <div className="w-full border-t border-border" />
                      </div>
                      <span className="relative mx-auto block w-fit bg-surface px-2 text-xs text-text-muted">
                        Hoặc tiếp tục với Google
                      </span>
                    </div>

                    {googleClientId ? (
                      <div className="space-y-2">
                        <div
                          ref={googleButtonContainerRef}
                          className="flex min-h-10 items-center justify-center"
                        />
                        {!googleReady && (
                          <p className="text-center text-xs text-text-muted">
                            Đang khởi tạo Google Sign-In...
                          </p>
                        )}
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() =>
                          setError(
                            'Thiếu cấu hình VITE_GOOGLE_CLIENT_ID. Vui lòng cập nhật frontend/.env',
                          )
                        }
                        className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-lg border border-border bg-surface-alt px-4 py-2.5 text-sm font-medium text-text-secondary transition-colors hover:border-brand hover:text-brand"
                      >
                        <Globe className="h-4 w-4" />
                        Đăng nhập với Google
                      </button>
                    )}

                    {googleLoading && (
                      <p className="flex items-center justify-center gap-2 text-xs text-text-muted">
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        Đang xác thực Google...
                      </p>
                    )}
                  </div>
                )}
              </form>
            </motion.div>
          )}
        </AnimatePresence>

        <p className="mt-6 text-center text-xs text-text-muted">
          {isLogin ? 'Chưa có tài khoản? ' : 'Đã có tài khoản? '}
          <button
            type="button"
            onClick={() => setIsLogin(!isLogin)}
            className="cursor-pointer font-medium text-brand hover:underline"
          >
            {isLogin ? 'Đăng ký ngay' : 'Đăng nhập'}
          </button>
        </p>
      </motion.div>
    </div>
  );
}
