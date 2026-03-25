import {
  Heart,
  LogOut,
  Menu,
  Search,
  ShieldCheck,
  ShoppingCart,
  Smartphone,
  User,
  X,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router';
import { useAuthStore } from '@/store/useAuthStore';
import { useCartStore } from '@/store/useCartStore';
import { useWishlistStore } from '@/store/useWishlistStore';

const navLinks = [
  { label: 'Trang chủ', href: '/' },
  { label: 'Sản phẩm', href: '/products' },
  { label: 'Về chúng tôi', href: '/about' },
];

function ProductSearchForm({
  initialQuery,
  onSubmit,
  mobile = false,
}: {
  initialQuery: string;
  onSubmit: (query: string) => void;
  mobile?: boolean;
}) {
  const [query, setQuery] = useState(initialQuery);

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit(query);
      }}
      className={
        mobile
          ? 'rounded-2xl border border-border bg-surface-alt p-3'
          : 'hidden items-center gap-2 rounded-full border border-border bg-surface-alt px-3 py-2 lg:flex'
      }
      role="search"
    >
      <div className="flex items-center gap-2">
        <Search className="h-4 w-4 text-text-muted" />
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={
            mobile
              ? 'Tìm sản phẩm bạn cần...'
              : 'Tìm iPhone, Samsung, camera...'
          }
          className={
            mobile
              ? 'min-w-0 flex-1 bg-transparent text-sm text-text-primary outline-none placeholder:text-text-muted'
              : 'w-56 bg-transparent text-sm text-text-primary outline-none placeholder:text-text-muted'
          }
          aria-label="Tìm kiếm sản phẩm"
        />
        {query && (
          <button
            type="button"
            onClick={() => setQuery('')}
            className="cursor-pointer rounded-full p-1 text-text-muted transition-colors hover:bg-surface hover:text-brand"
            aria-label="Xóa từ khóa tìm kiếm"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      <button
        type="submit"
        className={
          mobile
            ? 'mt-3 w-full rounded-xl bg-brand px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-brand-accent'
            : 'cursor-pointer rounded-full bg-brand px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-brand-accent'
        }
      >
        {mobile ? 'Tìm sản phẩm' : 'Tìm'}
      </button>
    </form>
  );
}

export default function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const wishlistCount = useWishlistStore((s) => s.items.length);
  const cartCount = useCartStore((s) => s.totalItems());
  const cartSubtotal = useCartStore((s) => s.totalPrice());
  const { isLoggedIn, isAdmin, logout } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();
  const currentSearchQuery =
    new URLSearchParams(location.search).get('q')?.trim() ?? '';
  const searchFormKey = `${location.pathname}-${location.search}`;
  const formattedCartSubtotal = `${cartSubtotal.toLocaleString('vi-VN')}₫`;

  const handleLogout = () => {
    useCartStore.getState().clearLocal();
    logout();
    navigate('/login');
  };

  const submitProductSearch = (query: string, closeMobileMenu = false) => {
    const normalizedQuery = query.trim();

    if (closeMobileMenu) {
      setMobileOpen(false);
    }

    navigate({
      pathname: '/products',
      search: normalizedQuery
        ? `?q=${encodeURIComponent(normalizedQuery)}`
        : '',
    });
  };

  return (
    <motion.header
      initial={{ y: -100 }}
      animate={{ y: 0 }}
      transition={{ type: 'spring', stiffness: 100, damping: 20 }}
      className="fixed top-0 right-0 left-0 z-50 border-b border-border bg-surface/80 backdrop-blur-xl"
    >
      <nav className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-2.5 no-underline">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand">
            <Smartphone className="h-5 w-5 text-white" />
          </div>
          <span className="font-display text-xl font-bold tracking-tight text-brand">
            NEBULA
          </span>
        </Link>

        {/* Desktop nav */}
        <ul className="hidden items-center gap-8 md:flex">
          {navLinks.map((link) => (
            <li key={link.href}>
              <Link
                to={link.href}
                className="text-sm font-medium text-text-secondary transition-colors duration-200 hover:text-brand no-underline"
              >
                {link.label}
              </Link>
            </li>
          ))}
        </ul>

        {/* Actions */}
        <div className="flex items-center gap-3">
          {!isAdmin && (
            <ProductSearchForm
              key={`desktop-${searchFormKey}`}
              initialQuery={currentSearchQuery}
              onSubmit={(query) => submitProductSearch(query)}
            />
          )}

          {/* Wishlist */}
          <Link
            to="/wishlist"
            className="relative rounded-full p-2 text-text-secondary transition-colors hover:bg-surface-alt hover:text-brand"
            aria-label={`Yêu thích${wishlistCount > 0 ? `, ${wishlistCount} sản phẩm` : ''}`}
          >
            <Heart className="h-5 w-5" />
            <AnimatePresence>
              {wishlistCount > 0 && (
                <motion.span
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  exit={{ scale: 0 }}
                  className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-brand-accent text-[10px] font-bold text-white ring-2 ring-surface"
                >
                  {wishlistCount}
                </motion.span>
              )}
            </AnimatePresence>
          </Link>

          {/* Cart */}
          <Link
            to="/cart"
            className="relative rounded-full p-2 text-text-secondary transition-colors hover:bg-surface-alt hover:text-brand lg:flex lg:items-center lg:gap-2 lg:pl-3 lg:pr-2"
            aria-label={`Giỏ hàng${cartCount > 0 ? `, ${cartCount} sản phẩm` : ''}`}
          >
            {cartCount > 0 && (
              <span className="hidden text-sm font-semibold text-text-primary lg:inline">
                {formattedCartSubtotal}
              </span>
            )}
            <ShoppingCart className="h-5 w-5" />
            <AnimatePresence>
              {cartCount > 0 && (
                <motion.span
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  exit={{ scale: 0 }}
                  className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-brand text-[10px] font-bold text-white ring-2 ring-surface"
                >
                  {cartCount > 99 ? '99+' : cartCount}
                </motion.span>
              )}
            </AnimatePresence>
          </Link>

          {/* Profile / Login */}
          {isLoggedIn ? (
            <div className="flex items-center gap-2">
              {isAdmin && (
                <Link
                  to="/admin"
                  className="hidden items-center gap-1.5 rounded-lg bg-purple-50 px-3 py-2 text-sm font-medium text-purple-700 transition-colors hover:bg-purple-100 no-underline md:flex"
                  title="Admin Dashboard"
                >
                  <ShieldCheck className="h-4 w-4" />
                  Admin
                </Link>
              )}
              <Link
                to="/profile"
                className="rounded-full p-2 text-text-secondary transition-colors hover:bg-surface-alt hover:text-brand"
                title="Tài khoản"
              >
                <User className="h-5 w-5" />
              </Link>
              <button
                type="button"
                onClick={handleLogout}
                className="cursor-pointer rounded-full p-2 text-text-secondary transition-colors hover:bg-surface-alt hover:text-red-500"
                title="Đăng xuất"
              >
                <LogOut className="h-5 w-5" />
              </button>
            </div>
          ) : (
            <Link
              to="/login"
              className="hidden rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-accent no-underline md:block"
            >
              Đăng nhập
            </Link>
          )}

          {/* Mobile toggle */}
          <button
            type="button"
            onClick={() => setMobileOpen(!mobileOpen)}
            className="cursor-pointer rounded-lg p-2 text-text-secondary transition-colors hover:bg-surface-alt hover:text-brand md:hidden"
            aria-label={mobileOpen ? 'Đóng menu' : 'Mở menu'}
            aria-expanded={mobileOpen}
          >
            {mobileOpen ? (
              <X className="h-5 w-5" />
            ) : (
              <Menu className="h-5 w-5" />
            )}
          </button>
        </div>
      </nav>

      {/* Mobile menu */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden border-t border-border md:hidden"
          >
            <ul className="flex flex-col gap-1 px-6 py-4">
              {!isAdmin && (
                <li className="mb-3">
                  <ProductSearchForm
                    key={`mobile-${searchFormKey}`}
                    initialQuery={currentSearchQuery}
                    onSubmit={(query) => submitProductSearch(query, true)}
                    mobile
                  />
                </li>
              )}

              {navLinks.map((link) => (
                <li key={link.href}>
                  <Link
                    to={link.href}
                    onClick={() => setMobileOpen(false)}
                    className="block rounded-lg px-4 py-2.5 text-sm font-medium text-text-secondary transition-colors hover:bg-surface-alt hover:text-brand no-underline"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
              {isLoggedIn ? (
                <>
                  {isAdmin && (
                    <li>
                      <Link
                        to="/admin"
                        onClick={() => setMobileOpen(false)}
                        className="block rounded-lg px-4 py-2.5 text-sm font-medium text-purple-700 transition-colors hover:bg-surface-alt no-underline"
                      >
                        Admin Dashboard
                      </Link>
                    </li>
                  )}
                  <li>
                    <button
                      type="button"
                      onClick={() => {
                        setMobileOpen(false);
                        handleLogout();
                      }}
                      className="block w-full rounded-lg px-4 py-2.5 text-left text-sm font-medium text-red-500 transition-colors hover:bg-surface-alt"
                    >
                      Đăng xuất
                    </button>
                  </li>
                </>
              ) : (
                <li>
                  <Link
                    to="/login"
                    onClick={() => setMobileOpen(false)}
                    className="block rounded-lg px-4 py-2.5 text-sm font-medium text-brand transition-colors hover:bg-surface-alt no-underline"
                  >
                    Đăng nhập
                  </Link>
                </li>
              )}
            </ul>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.header>
  );
}
