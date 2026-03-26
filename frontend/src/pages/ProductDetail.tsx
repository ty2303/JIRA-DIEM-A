import {
  AlertCircle,
  ArrowLeft,
  Camera,
  Check,
  Heart,
  Loader2,
  Package,
  Pencil,
  RotateCcw,
  Send,
  Shield,
  ShoppingCart,
  Star,
  Tag,
  Trash2,
  Truck,
  X,
} from 'lucide-react';
import { motion } from 'motion/react';
import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';

import apiClient from '@/api/client';
import { ENDPOINTS } from '@/api/endpoints';
import type { ApiResponse, PaginatedResponse } from '@/api/types';
import ProductCard from '@/components/ui/ProductCard';
import { useAuthStore } from '@/store/useAuthStore';
import { useCartStore } from '@/store/useCartStore';
import { useWishlistStore } from '@/store/useWishlistStore';
import type { Product } from '@/types/product';
import type { CreateReviewPayload, Review } from '@/types/review';

function getAverageRating(items: Review[]) {
  if (items.length === 0) return 0;
  const total = items.reduce((sum, review) => sum + review.rating, 0);
  return Number((total / items.length).toFixed(1));
}

function fileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Khong the doc tep anh.'));
    reader.readAsDataURL(file);
  });
}

export function Component() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [product, setProduct] = useState<Product | null>(null);
  const [related, setRelated] = useState<Product[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [detailError, setDetailError] = useState('');

  const toggleWishlist = useWishlistStore((state) => state.toggle);
  const isWishlisted = useWishlistStore((state) =>
    state.has(product?.id ?? ''),
  );
  const addToCart = useCartStore((state) => state.addItem);
  const { isLoggedIn, isAdmin, user } = useAuthStore();

  const [reviewRating, setReviewRating] = useState(5);
  const [reviewHover, setReviewHover] = useState(0);
  const [reviewComment, setReviewComment] = useState('');
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const [reviewError, setReviewError] = useState('');
  const [reviewImages, setReviewImages] = useState<string[]>([]);
  const [uploadingReviewImage, setUploadingReviewImage] = useState(false);
  const [editingReviewId, setEditingReviewId] = useState<string | null>(null);

  const myReview = reviews.find((review) => review.userId === user?.id);
  const isEditingReview = editingReviewId !== null;

  useEffect(() => {
    if (!id) return;

    let ignore = false;

    const fetchProductDetail = async () => {
      setLoading(true);
      setDetailError('');

      try {
        const [productRes, reviewsRes] = await Promise.all([
          apiClient.get<ApiResponse<Product>>(ENDPOINTS.PRODUCTS.BY_ID(id)),
          apiClient.get<ApiResponse<Review[]>>(ENDPOINTS.REVIEWS.BASE, {
            params: { productId: id },
          }),
        ]);

        if (ignore) return;

        const nextProduct = productRes.data.data;
        const nextReviews = reviewsRes.data.data;

        setProduct(nextProduct);
        setReviews(nextReviews);

        const relatedRes = await apiClient.get<
          ApiResponse<PaginatedResponse<Product>>
        >(ENDPOINTS.PRODUCTS.BASE, {
          params: {
            size: 8,
            categoryId: nextProduct.categoryId,
          },
        });

        if (ignore) return;

        setRelated(
          relatedRes.data.data.content
            .filter((item) => item.id !== nextProduct.id)
            .slice(0, 4),
        );
      } catch (error: unknown) {
        if (ignore) return;

        const axiosError = error as { response?: { status?: number } };
        setProduct(null);
        setReviews([]);
        setRelated([]);
        setDetailError(
          axiosError.response?.status === 404 ? 'not-found' : 'load-failed',
        );
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    };

    void fetchProductDetail();

    return () => {
      ignore = true;
    };
  }, [id]);

  const averageRating = useMemo(
    () =>
      reviews.length > 0 ? getAverageRating(reviews) : (product?.rating ?? 0),
    [product?.rating, reviews],
  );

  const reviewDistribution = useMemo(
    () =>
      [5, 4, 3, 2, 1].map((rating) => {
        const count = reviews.filter(
          (review) => review.rating === rating,
        ).length;
        const percent = reviews.length > 0 ? (count / reviews.length) * 100 : 0;

        return { rating, count, percent };
      }),
    [reviews],
  );

  const specificationList = useMemo(
    () =>
      product?.specs
        ?.split(',')
        .map((item) => item.trim())
        .filter(Boolean) ?? [],
    [product?.specs],
  );

  const productFacts = useMemo(() => {
    if (!product) return [];

    return [
      { label: 'Danh mục', value: product.categoryName || 'Đang cập nhật' },
      { label: 'Thương hiệu', value: product.brand },
      { label: 'Mã sản phẩm', value: product.id },
      {
        label: 'Cập nhật',
        value: new Date(
          product.updatedAt ?? product.createdAt ?? Date.now(),
        ).toLocaleDateString('vi-VN'),
      },
    ];
  }, [product]);

  const shoppingPolicies = [
    {
      icon: Shield,
      label: 'Bảo hành chính hãng',
      detail: 'Hỗ trợ bảo hành theo chính sách của nhà bán.',
    },
    {
      icon: Truck,
      label: 'Giao hàng toàn quốc',
      detail: 'Ưu tiên đơn có sẵn hàng tại kho.',
    },
    {
      icon: RotateCcw,
      label: 'Hỗ trợ đổi trả',
      detail: 'Đối soát tình trạng sản phẩm ngay khi nhận hàng.',
    },
  ];

  const resetReviewForm = () => {
    setReviewComment('');
    setReviewRating(5);
    setReviewImages([]);
    setReviewHover(0);
    setReviewError('');
    setEditingReviewId(null);
  };

  const handleEditReview = (review: Review) => {
    setEditingReviewId(review.id);
    setReviewRating(review.rating);
    setReviewComment(review.comment);
    setReviewImages(review.images ?? []);
    setReviewHover(0);
    setReviewError('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleReviewImageUpload = async (file: File) => {
    setReviewError('');
    setUploadingReviewImage(true);

    try {
      const imageData = await fileToDataUrl(file);

      const response = await apiClient.post<ApiResponse<string>>(
        ENDPOINTS.REVIEWS.UPLOAD_IMAGE,
        { imageData, folder: 'reviews' },
      );

      setReviewImages((current) => [...current, response.data.data]);
    } catch (error: unknown) {
      const axiosError = error as {
        response?: { data?: { message?: string } };
      };
      setReviewError(
        axiosError.response?.data?.message ?? 'Không thể upload ảnh đánh giá.',
      );
    } finally {
      setUploadingReviewImage(false);
    }
  };

  const handleSubmitReview = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!id) return;

    if (!isLoggedIn) {
      setReviewError('Vui lòng đăng nhập để gửi đánh giá.');
      return;
    }

    setReviewError('');
    setReviewSubmitting(true);

    try {
      const payload: CreateReviewPayload = {
        productId: id,
        rating: reviewRating,
        comment: reviewComment.trim(),
        images: reviewImages.length > 0 ? reviewImages : undefined,
      };

      const response = isEditingReview
        ? await apiClient.put<ApiResponse<Review>>(
            ENDPOINTS.REVIEWS.UPDATE(editingReviewId),
            payload,
          )
        : await apiClient.post<ApiResponse<Review>>(
            ENDPOINTS.REVIEWS.BASE,
            payload,
          );

      const savedReview = response.data.data;
      const nextReviews = isEditingReview
        ? reviews.map((review) =>
            review.id === savedReview.id ? savedReview : review,
          )
        : [savedReview, ...reviews];
      const nextAverage = getAverageRating(nextReviews);

      setReviews(nextReviews);
      setProduct((current) =>
        current
          ? {
              ...current,
              rating: nextAverage,
            }
          : current,
      );
      resetReviewForm();
    } catch (error: unknown) {
      const axiosError = error as {
        response?: { data?: { message?: string } };
      };
      setReviewError(
        axiosError.response?.data?.message ??
          'Không thể gửi đánh giá, vui lòng thử lại sau.',
      );
    } finally {
      setReviewSubmitting(false);
    }
  };

  const handleDeleteReview = async (reviewId: string) => {
    try {
      await apiClient.delete(ENDPOINTS.REVIEWS.BY_ID(reviewId));

      const nextReviews = reviews.filter((review) => review.id !== reviewId);
      const nextAverage = getAverageRating(nextReviews);

      setReviews(nextReviews);
      setProduct((current) =>
        current
          ? {
              ...current,
              rating: nextAverage,
            }
          : current,
      );
      if (editingReviewId === reviewId) {
        resetReviewForm();
      }
    } catch (error: unknown) {
      const axiosError = error as {
        response?: { data?: { message?: string } };
      };
      setReviewError(
        axiosError.response?.data?.message ??
          'Không thể xóa đánh giá vào lúc này.',
      );
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface pt-24">
        <div className="flex items-center gap-3 text-text-secondary">
          <Loader2 className="h-5 w-5 animate-spin" />
          Đang tải chi tiết sản phẩm...
        </div>
      </div>
    );
  }

  if (detailError === 'not-found') {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-surface px-6 pt-24 text-center">
        <Package className="h-14 w-14 text-text-muted" />
        <h1 className="mt-5 font-display text-3xl font-bold text-brand">
          Sản phẩm không tồn tại
        </h1>
        <p className="mt-3 max-w-lg text-sm leading-6 text-text-secondary">
          Liên kết bạn mở không còn hợp lệ hoặc sản phẩm đã bị gỡ khỏi hệ thống.
        </p>
        <Link
          to="/products"
          className="btn-primary mt-6 inline-flex items-center gap-2 no-underline"
        >
          <ArrowLeft className="h-4 w-4" />
          Quay lại danh sách sản phẩm
        </Link>
      </div>
    );
  }

  if (detailError || !product) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface px-6 pt-24">
        <div className="max-w-xl rounded-[2rem] border border-red-200 bg-red-50/80 p-8 text-center">
          <AlertCircle className="mx-auto h-12 w-12 text-red-500" />
          <h1 className="mt-4 font-display text-2xl font-bold text-brand">
            Không thể tải chi tiết sản phẩm
          </h1>
          <p className="mt-3 text-sm leading-6 text-text-secondary">
            Dữ liệu sản phẩm hoặc đánh giá hiện không phản hồi từ hệ thống.
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="btn-primary mt-6 inline-flex items-center gap-2"
          >
            <RotateCcw className="h-4 w-4" />
            Tải lại trang
          </button>
        </div>
      </div>
    );
  }

  const discount = product.originalPrice
    ? Math.round((1 - product.price / product.originalPrice) * 100)
    : null;

  return (
    <div className="min-h-screen bg-surface pt-24 pb-16">
      <div className="mx-auto max-w-7xl px-6">
        <motion.nav
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="mb-8 flex flex-wrap items-center gap-2 text-sm text-text-muted"
        >
          <Link
            to="/"
            className="text-text-muted transition-colors hover:text-brand no-underline"
          >
            Trang chủ
          </Link>
          <span>/</span>
          <Link
            to="/products"
            className="text-text-muted transition-colors hover:text-brand no-underline"
          >
            Sản phẩm
          </Link>
          <span>/</span>
          <span className="text-text-secondary">{product.name}</span>
        </motion.nav>

        <div className="grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
          <motion.div
            initial={{ opacity: 0, x: -40 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.45 }}
            className="space-y-6"
          >
            <div className="relative aspect-[4/3] overflow-hidden rounded-[2rem] border border-border bg-surface-alt p-4 shadow-[0_24px_70px_rgba(15,23,42,0.08)] sm:p-6">
              <div className="absolute inset-x-0 top-0 h-40 bg-[radial-gradient(circle_at_top,rgba(121,90,242,0.16),transparent_60%)]" />
              <div className="absolute top-5 left-5 z-10 flex flex-wrap gap-2">
                {product.badge && (
                  <span className="rounded-full bg-brand px-4 py-1.5 text-sm font-semibold text-white">
                    {product.badge}
                  </span>
                )}
                {discount && (
                  <span className="rounded-full bg-red-500 px-3 py-1.5 text-sm font-semibold text-white">
                    -{discount}%
                  </span>
                )}
                {product.stock <= 0 && (
                  <span className="rounded-full bg-zinc-900 px-4 py-1.5 text-sm font-semibold text-white">
                    Hết hàng
                  </span>
                )}
              </div>

              <div className="relative z-10 flex h-full items-center justify-center pt-12 sm:pt-14">
                <motion.img
                  src={product.image}
                  alt={product.name}
                  className="block h-auto max-h-[180px] max-w-[88%] object-contain sm:max-h-[220px] lg:max-h-[280px]"
                  initial={{ scale: 0.95 }}
                  animate={{ scale: 1 }}
                  transition={{ duration: 0.4 }}
                  whileHover={{ scale: 1.03 }}
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              {productFacts.map((fact) => (
                <div
                  key={fact.label}
                  className="rounded-2xl border border-border bg-surface p-4"
                >
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-text-muted">
                    {fact.label}
                  </p>
                  <p className="mt-3 text-sm font-semibold text-text-primary">
                    {fact.value}
                  </p>
                </div>
              ))}
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.45, delay: 0.08 }}
          >
            <p className="text-sm font-medium uppercase tracking-[0.22em] text-brand-accent">
              {product.brand}
            </p>
            <h1 className="mt-3 font-display text-3xl font-bold tracking-tight text-brand md:text-4xl">
              {product.name}
            </h1>

            <div className="mt-4 flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-1">
                {Array.from({ length: 5 }).map((_, index) => (
                  <Star
                    key={`product-rating-${index}`}
                    className={`h-4 w-4 ${
                      index < Math.round(averageRating)
                        ? 'fill-amber-400 text-amber-400'
                        : 'fill-transparent text-text-muted'
                    }`}
                  />
                ))}
              </div>
              <span className="text-sm text-text-secondary">
                {averageRating.toFixed(1)} • {reviews.length} đánh giá
              </span>
              {product.categoryName && (
                <span className="inline-flex items-center gap-1 rounded-full bg-surface-alt px-3 py-1 text-sm text-text-secondary">
                  <Tag className="h-3.5 w-3.5" />
                  {product.categoryName}
                </span>
              )}
            </div>

            <p className="mt-5 text-sm leading-7 text-text-secondary">
              {product.specs ||
                'Thông tin chi tiết cho sản phẩm này đang được cập nhật từ hệ thống.'}
            </p>

            <div className="mt-7 flex flex-wrap items-end gap-3">
              <span className="font-display text-4xl font-bold text-brand">
                {product.price.toLocaleString('vi-VN')}₫
              </span>
              {product.originalPrice && (
                <span className="pb-1 text-lg text-text-muted line-through">
                  {product.originalPrice.toLocaleString('vi-VN')}₫
                </span>
              )}
            </div>

            <div className="mt-6 rounded-2xl border border-border bg-surface-alt p-4">
              {product.stock > 0 ? (
                <div className="flex items-center gap-2 text-sm font-medium text-emerald-700">
                  <Check className="h-4 w-4" />
                  Còn hàng ({product.stock} sản phẩm trong kho)
                </div>
              ) : (
                <div className="flex items-center gap-2 text-sm font-medium text-red-600">
                  <X className="h-4 w-4" />
                  Sản phẩm hiện đang hết hàng
                </div>
              )}
            </div>

            {!isAdmin && product.stock > 0 && (
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <motion.button
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.99 }}
                  onClick={() => addToCart(product)}
                  className="btn-primary flex flex-1 items-center justify-center gap-2 py-4"
                >
                  <ShoppingCart className="h-5 w-5" />
                  Thêm vào giỏ hàng
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.99 }}
                  onClick={() => {
                    addToCart(product);
                    navigate('/checkout');
                  }}
                  className="btn-outline px-6 py-4"
                >
                  Mua ngay
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.04 }}
                  whileTap={{ scale: 0.96 }}
                  onClick={() => void toggleWishlist(product)}
                  className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border transition-colors ${
                    isWishlisted
                      ? 'border-red-200 bg-red-50 text-red-500'
                      : 'border-border bg-surface text-text-secondary hover:border-brand-accent hover:text-brand-accent'
                  }`}
                  aria-label={
                    isWishlisted ? 'Bỏ khỏi yêu thích' : 'Thêm vào yêu thích'
                  }
                >
                  <Heart
                    className={`h-5 w-5 ${isWishlisted ? 'fill-current' : ''}`}
                  />
                </motion.button>
              </div>
            )}

            <div className="mt-8 grid gap-4 sm:grid-cols-3">
              {shoppingPolicies.map((policy) => (
                <div
                  key={policy.label}
                  className="rounded-2xl border border-border bg-surface p-4"
                >
                  <policy.icon className="h-5 w-5 text-brand-accent" />
                  <p className="mt-3 text-sm font-semibold text-text-primary">
                    {policy.label}
                  </p>
                  <p className="mt-2 text-xs leading-5 text-text-secondary">
                    {policy.detail}
                  </p>
                </div>
              ))}
            </div>

            <div className="mt-8 rounded-[1.75rem] border border-border bg-surface p-5">
              <h2 className="font-display text-lg font-semibold text-brand">
                Thông tin nổi bật từ dữ liệu sản phẩm
              </h2>
              {specificationList.length > 0 ? (
                <ul className="mt-4 space-y-3">
                  {specificationList.map((item) => (
                    <li
                      key={item}
                      className="flex items-start gap-3 text-sm text-text-secondary"
                    >
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-4 text-sm leading-6 text-text-secondary">
                  Chưa có thêm thông số chi tiết ngoài dữ liệu giá, tồn kho và
                  danh mục đang lưu trong hệ thống.
                </p>
              )}
            </div>
          </motion.div>
        </div>

        <section className="mt-20 grid gap-8 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
          <div className="space-y-6">
            <div className="rounded-[1.75rem] border border-border bg-surface p-6">
              <h2 className="font-display text-2xl font-bold text-brand">
                Tổng quan đánh giá
              </h2>
              <div className="mt-5 flex items-end gap-4">
                <span className="font-display text-5xl font-bold text-brand">
                  {averageRating.toFixed(1)}
                </span>
                <div className="pb-1">
                  <div className="flex items-center gap-1">
                    {Array.from({ length: 5 }).map((_, index) => (
                      <Star
                        key={`summary-rating-${index}`}
                        className={`h-4 w-4 ${
                          index < Math.round(averageRating)
                            ? 'fill-amber-400 text-amber-400'
                            : 'fill-transparent text-text-muted'
                        }`}
                      />
                    ))}
                  </div>
                  <p className="mt-2 text-sm text-text-secondary">
                    Dựa trên {reviews.length} đánh giá đã lưu trong hệ thống
                  </p>
                </div>
              </div>

              <div className="mt-6 space-y-3">
                {reviewDistribution.map((item) => (
                  <div key={item.rating} className="flex items-center gap-3">
                    <span className="w-10 text-sm text-text-secondary">
                      {item.rating} sao
                    </span>
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-surface-alt">
                      <div
                        className="h-full rounded-full bg-brand-accent"
                        style={{ width: `${item.percent}%` }}
                      />
                    </div>
                    <span className="w-10 text-right text-sm text-text-secondary">
                      {item.count}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div>
            <div className="mb-6 flex items-center justify-between gap-4">
              <h2 className="font-display text-2xl font-bold text-brand">
                Đánh giá sản phẩm
              </h2>
              <span className="text-sm text-text-secondary">
                {reviews.length} đánh giá
              </span>
            </div>
            {isLoggedIn && !isAdmin && (!myReview || isEditingReview) && (
              <motion.form
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                onSubmit={handleSubmitReview}
                className="mb-8 rounded-[1.75rem] border border-border bg-surface p-6"
              >
                <p className="font-medium text-text-primary">
                  {isEditingReview
                    ? 'Chỉnh sửa đánh giá của bạn'
                    : 'Đánh giá từ tài khoản của bạn'}
                </p>

                <div className="mt-4 flex items-center gap-1">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setReviewRating(star)}
                      onMouseEnter={() => setReviewHover(star)}
                      onMouseLeave={() => setReviewHover(0)}
                      className="cursor-pointer p-0.5 transition-transform hover:scale-110"
                      aria-label={`${star} sao`}
                    >
                      <Star
                        className={`h-7 w-7 ${
                          star <= (reviewHover || reviewRating)
                            ? 'fill-amber-400 text-amber-400'
                            : 'fill-transparent text-text-muted'
                        }`}
                      />
                    </button>
                  ))}
                  <span className="ml-2 text-sm text-text-secondary">
                    {reviewRating}/5
                  </span>
                </div>

                <textarea
                  value={reviewComment}
                  onChange={(event) => setReviewComment(event.target.value)}
                  placeholder="Chia sẻ trải nghiệm thực tế của bạn về sản phẩm này..."
                  rows={4}
                  maxLength={1000}
                  required
                  className="mt-4 w-full resize-none rounded-2xl border border-border bg-surface-alt px-4 py-3 text-sm text-text-primary outline-none transition-colors placeholder:text-text-muted focus:border-brand focus:ring-1 focus:ring-brand"
                />
                <div className="mt-1 flex items-center justify-between">
                  <span className="text-xs text-text-muted">
                    {reviewComment.length}/1000 ký tự
                  </span>
                </div>

                <div className="mt-4">
                  <div className="flex flex-wrap gap-2">
                    {reviewImages.map((url, index) => (
                      <div key={index} className="relative">
                        <img
                          src={url}
                          alt={`Ảnh đánh giá ${index + 1}`}
                          className="h-20 w-20 rounded-xl border border-border object-cover"
                        />
                        <button
                          type="button"
                          onClick={() =>
                            setReviewImages((current) =>
                              current.filter(
                                (_, currentIndex) => currentIndex !== index,
                              ),
                            )
                          }
                          className="absolute -right-1.5 -top-1.5 cursor-pointer rounded-full bg-red-500 p-0.5 text-white hover:bg-red-600"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ))}

                    {reviewImages.length < 5 && (
                      <label
                        className={`flex h-20 w-20 cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed transition-colors ${
                          uploadingReviewImage
                            ? 'border-brand/30 bg-brand/5'
                            : 'border-border hover:border-brand hover:bg-brand/5'
                        }`}
                      >
                        {uploadingReviewImage ? (
                          <Loader2 className="h-5 w-5 animate-spin text-brand" />
                        ) : (
                          <>
                            <Camera className="h-5 w-5 text-text-muted" />
                            <span className="text-[10px] text-text-muted">
                              Thêm ảnh
                            </span>
                          </>
                        )}
                        <input
                          type="file"
                          accept="image/jpeg,image/png,image/webp,image/gif"
                          className="hidden"
                          disabled={uploadingReviewImage}
                          onChange={async (event) => {
                            const file = event.target.files?.[0];
                            if (!file) return;

                            event.target.value = '';

                            if (file.size > 2 * 1024 * 1024) {
                              setReviewError('Ảnh đánh giá phải nhỏ hơn 2MB.');
                              return;
                            }

                            try {
                              await handleReviewImageUpload(file);
                            } catch {
                              setReviewError('Không thể đọc ảnh đã chọn.');
                            }
                          }}
                        />
                      </label>
                    )}
                  </div>
                  <p className="mt-2 text-xs text-text-muted">
                    Ảnh sẽ được lưu cùng đánh giá vào database. Tối đa 5 ảnh,
                    mỗi ảnh dưới 2MB.
                  </p>
                </div>

                {reviewError && (
                  <p className="mt-4 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-600">
                    {reviewError}
                  </p>
                )}

                <div className="mt-5 flex justify-end gap-3">
                  {isEditingReview && (
                    <button
                      type="button"
                      onClick={resetReviewForm}
                      className="btn-outline"
                    >
                      Hủy sửa
                    </button>
                  )}
                  <motion.button
                    type="submit"
                    disabled={reviewSubmitting || !reviewComment.trim()}
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.99 }}
                    className="btn-primary flex cursor-pointer items-center gap-2 disabled:opacity-60"
                  >
                    {reviewSubmitting ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                    {isEditingReview ? 'Lưu đánh giá' : 'Gửi đánh giá'}
                  </motion.button>
                </div>
              </motion.form>
            )}

            {!isLoggedIn && (
              <div className="mb-8 rounded-[1.75rem] border border-border bg-surface-alt px-6 py-5 text-center">
                <p className="text-sm text-text-secondary">
                  <Link
                    to="/login"
                    className="font-medium text-brand hover:underline"
                  >
                    Đăng nhập
                  </Link>{' '}
                  để gửi đánh giá và lưu ảnh trải nghiệm thực tế.
                </p>
              </div>
            )}

            {myReview && (
              <div className="mb-8 rounded-[1.75rem] border border-emerald-200 bg-emerald-50/70 px-5 py-4 text-sm text-emerald-700">
                Bạn đã gửi đánh giá cho sản phẩm này. Bạn có thể chỉnh sửa trực
                tiếp hoặc xóa đánh giá hiện tại.
                <div className="mt-3">
                  <button
                    type="button"
                    onClick={() => handleEditReview(myReview)}
                    className="inline-flex items-center gap-2 rounded-xl border border-emerald-300 bg-white px-3 py-2 text-sm font-medium text-emerald-700 transition-colors hover:bg-emerald-50"
                  >
                    <Pencil className="h-4 w-4" />
                    Chỉnh sửa đánh giá
                  </button>
                </div>
              </div>
            )}

            {reviews.length === 0 ? (
              <div className="rounded-[1.75rem] border border-dashed border-border-strong bg-surface p-10 text-center">
                <Star className="mx-auto h-10 w-10 text-text-muted" />
                <p className="mt-4 text-text-secondary">
                  Chưa có đánh giá nào được lưu cho sản phẩm này.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {reviews.map((review) => (
                  <motion.div
                    key={review.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="rounded-[1.75rem] border border-border bg-surface p-5"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand/10 font-semibold text-brand">
                          {review.username.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-text-primary">
                            {review.username}
                          </p>
                          <p className="text-xs text-text-muted">
                            {new Date(review.createdAt).toLocaleDateString(
                              'vi-VN',
                            )}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-0.5">
                          {[1, 2, 3, 4, 5].map((star) => (
                            <Star
                              key={`${review.id}-${star}`}
                              className={`h-3.5 w-3.5 ${
                                star <= review.rating
                                  ? 'fill-amber-400 text-amber-400'
                                  : 'fill-transparent text-text-muted'
                              }`}
                            />
                          ))}
                        </div>

                        {review.userId === user?.id && (
                          <button
                            type="button"
                            onClick={() => void handleDeleteReview(review.id)}
                            className="cursor-pointer rounded-lg p-1.5 text-text-muted transition-colors hover:bg-red-50 hover:text-red-500"
                            aria-label="Xóa đánh giá"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </div>

                    <p className="mt-3 text-sm leading-7 text-text-secondary">
                      {review.comment}
                    </p>

                    {review.images && review.images.length > 0 && (
                      <div className="mt-4 flex flex-wrap gap-2">
                        {review.images.map((image, index) => (
                          <a
                            key={`${review.id}-image-${index}`}
                            href={image}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <img
                              src={image}
                              alt={`Ảnh đánh giá ${index + 1}`}
                              className="h-20 w-20 rounded-xl border border-border object-cover transition-transform hover:scale-105"
                            />
                          </a>
                        ))}
                      </div>
                    )}
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        </section>

        {related.length > 0 && (
          <section className="mt-24">
            <div className="mb-8 flex items-end justify-between gap-4">
              <div>
                <p className="text-sm font-medium uppercase tracking-[0.2em] text-brand-accent">
                  Cùng danh mục
                </p>
                <h2 className="mt-2 font-display text-2xl font-bold text-brand">
                  Sản phẩm liên quan
                </h2>
              </div>
              <Link
                to="/products"
                className="text-sm font-medium text-text-secondary no-underline transition-colors hover:text-brand"
              >
                Xem toàn bộ
              </Link>
            </div>

            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {related.map((item, index) => (
                <ProductCard key={item.id} product={item} index={index} />
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
