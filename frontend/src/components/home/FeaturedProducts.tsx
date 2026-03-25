import { AlertCircle, ArrowRight } from 'lucide-react';
import { motion } from 'motion/react';
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router';

import apiClient from '@/api/client';
import { ENDPOINTS } from '@/api/endpoints';
import type { ApiResponse, PaginatedResponse } from '@/api/types';
import ProductCard from '@/components/ui/ProductCard';
import type { Product } from '@/types/product';

const FEATURED_PRODUCT_LIMIT = 8;

function ProductCardSkeleton({ index }: { index: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: Math.min(index, 4) * 0.05 }}
      className="overflow-hidden rounded-2xl border border-border bg-surface"
    >
      <div className="h-64 animate-pulse bg-surface-alt" />
      <div className="space-y-3 p-5">
        <div className="h-3 w-20 animate-pulse rounded-full bg-surface-alt" />
        <div className="h-5 w-4/5 animate-pulse rounded-full bg-surface-alt" />
        <div className="h-4 w-3/5 animate-pulse rounded-full bg-surface-alt" />
        <div className="h-6 w-2/5 animate-pulse rounded-full bg-surface-alt" />
      </div>
    </motion.div>
  );
}

export default function FeaturedProducts() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let ignore = false;

    const fetchFeaturedProducts = async () => {
      setLoading(true);
      setError('');

      try {
        const response = await apiClient.get<
          ApiResponse<PaginatedResponse<Product>>
        >(ENDPOINTS.PRODUCTS.BASE, {
          params: { size: 100 },
        });

        if (ignore) {
          return;
        }

        setProducts(response.data.data.content);
      } catch {
        if (ignore) {
          return;
        }

        setError(
          'Không thể tải danh sách sản phẩm nổi bật từ hệ thống lúc này.',
        );
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    };

    void fetchFeaturedProducts();

    return () => {
      ignore = true;
    };
  }, []);

  const featuredProducts = useMemo(() => {
    return [...products]
      .sort((first, second) => {
        const secondDiscount = second.originalPrice
          ? second.originalPrice - second.price
          : 0;
        const firstDiscount = first.originalPrice
          ? first.originalPrice - first.price
          : 0;

        return (
          second.rating - first.rating ||
          second.stock - first.stock ||
          secondDiscount - firstDiscount
        );
      })
      .slice(0, FEATURED_PRODUCT_LIMIT);
  }, [products]);

  return (
    <section className="relative py-24">
      <div className="mx-auto max-w-7xl px-6">
        {/* Section header */}
        <div className="mb-12 flex items-end justify-between">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
          >
            <p className="mb-2 text-sm font-medium uppercase tracking-widest text-brand-accent">
              Nổi bật
            </p>
            <h2 className="font-display text-3xl font-bold tracking-tight text-brand md:text-4xl">
              Sản phẩm đáng chú ý
            </h2>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
          >
            <Link
              to="/products"
              className="group hidden items-center gap-1.5 text-sm font-medium text-text-secondary transition-colors hover:text-brand no-underline md:flex"
            >
              Xem tất cả
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Link>
          </motion.div>
        </div>

        {/* Product grid */}
        {error ? (
          <div className="rounded-[1.75rem] border border-red-200 bg-red-50/80 p-8 text-center">
            <AlertCircle className="mx-auto h-10 w-10 text-red-500" />
            <p className="mt-4 text-sm leading-6 text-text-secondary">
              {error}
            </p>
          </div>
        ) : loading || featuredProducts.length > 0 ? (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {loading
              ? Array.from({ length: FEATURED_PRODUCT_LIMIT }).map(
                  (_, index) => (
                    <ProductCardSkeleton
                      key={`featured-product-skeleton-${index}`}
                      index={index}
                    />
                  ),
                )
              : featuredProducts.map((product, index) => (
                  <ProductCard
                    key={product.id}
                    product={product}
                    index={index}
                  />
                ))}
          </div>
        ) : (
          <div className="rounded-[1.75rem] border border-dashed border-border-strong bg-surface p-8 text-center">
            <p className="text-sm leading-6 text-text-secondary">
              Chưa có sản phẩm nổi bật nào được đồng bộ từ backend.
            </p>
          </div>
        )}

        {/* Mobile "View all" */}
        <div className="mt-8 flex justify-center md:hidden">
          <Link
            to="/products"
            className="btn-outline inline-flex items-center gap-2 no-underline"
          >
            Xem tất cả sản phẩm
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </section>
  );
}
