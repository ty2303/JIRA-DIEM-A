import { Pencil, Star } from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';

import apiClient from '@/api/client';
import { ENDPOINTS } from '@/api/endpoints';
import { useAuthStore } from '@/store/useAuthStore';
import type { Review } from '@/types/review';
import { getAverageRating } from '@/utils/rating';

import ProductReviewCard from './ProductReviewCard';
import ProductReviewForm from './ProductReviewForm';
import ReviewLoginCTA from './ReviewLoginCTA';
import ReviewStarRating from './ReviewStarRating';

/* ---------- props ---------- */
interface ProductReviewSectionProps {
  productId: string;
  reviews: Review[];
  averageRating: number;
  onReviewsChange: (reviews: Review[], newAverage: number) => void;
}

export default function ProductReviewSection({
  productId,
  reviews,
  averageRating,
  onReviewsChange,
}: ProductReviewSectionProps) {
  const isLoggedIn = useAuthStore((s) => s.isLoggedIn);
  const isAdmin = useAuthStore((s) => s.isAdmin);
  const user = useAuthStore((s) => s.user);

  const [editingReview, setEditingReview] = useState<Review | null>(null);
  const [deleteError, setDeleteError] = useState('');

  /* --- derived --- */
  const myReview = useMemo(
    () => reviews.find((r) => r.userId === user?.id) ?? null,
    [reviews, user?.id],
  );
  const isEditing = editingReview !== null;
  const showForm = isLoggedIn && !isAdmin && (!myReview || isEditing);

  const reviewDistribution = useMemo(
    () =>
      [5, 4, 3, 2, 1].map((rating) => {
        const count = reviews.filter((r) => r.rating === rating).length;
        const percent = reviews.length > 0 ? (count / reviews.length) * 100 : 0;
        return { rating, count, percent };
      }),
    [reviews],
  );

  /* --- handlers --- */
  const handleEdit = useCallback((review: Review) => {
    setEditingReview(review);
    setDeleteError('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const handleCancelEdit = useCallback(() => {
    setEditingReview(null);
  }, []);

  const handleSubmitted = useCallback(
    (savedReview: Review) => {
      const nextReviews = editingReview
        ? reviews.map((r) => (r.id === savedReview.id ? savedReview : r))
        : [savedReview, ...reviews];
      const nextAverage = getAverageRating(nextReviews);
      onReviewsChange(nextReviews, nextAverage);
      setEditingReview(null);
    },
    [editingReview, reviews, onReviewsChange],
  );

  const handleDelete = useCallback(
    async (reviewId: string) => {
      const confirmed = window.confirm(
        'Bạn có chắc muốn xóa đánh giá này? Hành động này không thể hoàn tác.',
      );
      if (!confirmed) return;

      setDeleteError('');
      try {
        await apiClient.delete(ENDPOINTS.REVIEWS.BY_ID(reviewId));
        const nextReviews = reviews.filter((r) => r.id !== reviewId);
        const nextAverage = getAverageRating(nextReviews);
        onReviewsChange(nextReviews, nextAverage);
        if (editingReview?.id === reviewId) {
          setEditingReview(null);
        }
      } catch (error: unknown) {
        const axiosError = error as {
          response?: { data?: { message?: string } };
        };
        setDeleteError(
          axiosError.response?.data?.message ??
            'Không thể xóa đánh giá vào lúc này.',
        );
      }
    },
    [reviews, editingReview, onReviewsChange],
  );

  return (
    <section className="mt-20 grid gap-8 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
      {/* ===== LEFT: Summary ===== */}
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
              <ReviewStarRating
                value={Math.round(averageRating)}
                readOnly
                size="h-4 w-4"
              />
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

      {/* ===== RIGHT: Form + List ===== */}
      <div>
        <div className="mb-6 flex items-center justify-between gap-4">
          <h2 className="font-display text-2xl font-bold text-brand">
            Đánh giá sản phẩm
          </h2>
          <span className="text-sm text-text-secondary">
            {reviews.length} đánh giá
          </span>
        </div>

        {/* --- form (create or edit) --- */}
        {showForm && (
          <ProductReviewForm
            key={editingReview?.id ?? 'create'}
            productId={productId}
            editingReview={editingReview}
            onCancel={isEditing ? handleCancelEdit : undefined}
            onSubmitted={handleSubmitted}
          />
        )}

        {/* --- login CTA --- */}
        {!isLoggedIn && (
          <ReviewLoginCTA redirectTo={`/products/${productId}`} />
        )}

        {/* --- existing review notice (1 user = 1 review) --- */}
        {myReview && !isEditing && isLoggedIn && !isAdmin && (
          <div className="mb-8 rounded-[1.75rem] border border-emerald-200 bg-emerald-50/70 px-5 py-4 text-sm text-emerald-700">
            Bạn đã gửi đánh giá cho sản phẩm này. Bạn có thể chỉnh sửa trực tiếp
            hoặc xóa đánh giá hiện tại.
            <div className="mt-3">
              <button
                type="button"
                onClick={() => handleEdit(myReview)}
                className="inline-flex items-center gap-2 rounded-xl border border-emerald-300 bg-white px-3 py-2 text-sm font-medium text-emerald-700 transition-colors hover:bg-emerald-50"
              >
                <Pencil className="h-4 w-4" />
                Chỉnh sửa đánh giá
              </button>
            </div>
          </div>
        )}

        {/* --- delete error --- */}
        {deleteError && (
          <div className="mb-4 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-600">
            {deleteError}
          </div>
        )}

        {/* --- review list --- */}
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
              <ProductReviewCard
                key={review.id}
                review={review}
                isOwner={review.userId === user?.id}
                onEdit={handleEdit}
                onDelete={handleDelete}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
