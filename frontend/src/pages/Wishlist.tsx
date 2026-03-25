import { Heart, Loader2, Trash2 } from 'lucide-react';
import { motion } from 'motion/react';
import { useEffect } from 'react';
import { Link } from 'react-router';

import ProductCard from '@/components/ui/ProductCard';
import { useAuthStore } from '@/store/useAuthStore';
import { useWishlistStore } from '@/store/useWishlistStore';

export const Component = Wishlist;

function Wishlist() {
  const isLoggedIn = useAuthStore((s) => s.isLoggedIn);
  const items = useWishlistStore((s) => s.items);
  const clear = useWishlistStore((s) => s.clear);
  const error = useWishlistStore((s) => s.error);
  const fetch = useWishlistStore((s) => s.fetch);
  const isLoading = useWishlistStore((s) => s.isLoading);

  useEffect(() => {
    void fetch();
  }, [fetch, isLoggedIn]);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center pt-20 text-text-muted">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <section className="mx-auto max-w-7xl px-6 py-24 lg:py-32">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold text-text-primary lg:text-4xl">
            Yêu thích
          </h1>
          <p className="mt-1 text-text-secondary">
            {items.length > 0
              ? `${items.length} sản phẩm`
              : 'Chưa có sản phẩm nào'}
          </p>
        </div>

        {items.length > 0 && (
          <button
            type="button"
            onClick={() => void clear()}
            className="flex cursor-pointer items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-medium text-text-muted transition-colors hover:border-red-500 hover:text-red-500"
          >
            <Trash2 className="h-4 w-4" />
            Xóa tất cả
          </button>
        )}
      </div>

      {error && (
        <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-600">
          {error}
        </div>
      )}

      {/* Content */}
      {items.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-20 flex flex-col items-center text-center"
        >
          <div className="flex h-24 w-24 items-center justify-center rounded-full bg-surface-alt">
            <Heart className="h-10 w-10 text-text-muted" />
          </div>
          <h2 className="mt-6 font-display text-xl font-semibold text-text-primary">
            Danh sách yêu thích trống
          </h2>
          <p className="mt-2 max-w-md text-text-secondary">
            Hãy khám phá các sản phẩm và thêm vào danh sách yêu thích của bạn.
          </p>
          <Link to="/products" className="btn-primary mt-6 no-underline">
            Khám phá sản phẩm
          </Link>
        </motion.div>
      ) : (
        <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {items.map((product, i) => (
            <ProductCard key={product.id} product={product} index={i} />
          ))}
        </div>
      )}
    </section>
  );
}
