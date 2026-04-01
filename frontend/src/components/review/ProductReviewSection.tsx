import { Bot, Loader2, Pencil, Sparkles, Star } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import apiClient from '@/api/client';
import { ENDPOINTS } from '@/api/endpoints';
import { useAuthStore } from '@/store/useAuthStore';
import type { ApiResponse } from '@/api/types';
import type { ProductReviewAnalysisSummary, Review } from '@/types/review';
import { getAverageRating } from '@/utils/rating';

import AISentimentSummary from './AISentimentSummary';
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
  const [analysisSummary, setAnalysisSummary] =
    useState<ProductReviewAnalysisSummary | null>(null);
  const [analysisSummaryStatus, setAnalysisSummaryStatus] = useState<
    'idle' | 'loading' | 'success' | 'error'
  >('idle');

  /* --- poll for pending analysis results --- */
  const hasPending = useMemo(
    () => reviews.some((r) => r.analysisStatus === 'pending'),
    [reviews],
  );
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!hasPending) {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
      return;
    }

    pollRef.current = setInterval(async () => {
      try {
        const { data } = await apiClient.get(ENDPOINTS.REVIEWS.BASE, {
          params: { productId },
        });
        const freshReviews: Review[] = data?.data ?? data ?? [];
        const stillPending = freshReviews.some(
          (r) => r.analysisStatus === 'pending',
        );
        // Only update if analysis status actually changed
        const statusChanged = freshReviews.some((fresh) => {
          const old = reviews.find((r) => r.id === fresh.id);
          return old && old.analysisStatus !== fresh.analysisStatus;
        });
        if (statusChanged || !stillPending) {
          const nextAverage = getAverageRating(freshReviews);
          onReviewsChange(freshReviews, nextAverage);
        }
      } catch {
        // Silently ignore poll errors
      }
    }, 3000);

    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [hasPending, productId, reviews, onReviewsChange]);

  /* --- derived --- */
  const myReview = useMemo(
    () => reviews.find((r) => r.userId === user?.id) ?? null,
    [reviews, user?.id],
  );
  const reviewAnalysisSignature = useMemo(
    () =>
      reviews
        .map((review) =>
          [
            review.id,
            review.analysisStatus,
            review.updatedAt ?? review.createdAt,
            review.comment,
          ].join(':'),
        )
        .join('|'),
    [reviews],
  );
  const isEditing = editingReview !== null;
  const showForm = isLoggedIn && !isAdmin && (!myReview || isEditing);
  const pendingAnalysisCount = useMemo(
    () => reviews.filter((review) => review.analysisStatus === 'pending').length,
    [reviews],
  );
  const hasPendingAnalysis = pendingAnalysisCount > 0;
  const hasCompletedAnalysis = useMemo(
    () => reviews.some((review) => review.analysisStatus === 'completed'),
    [reviews],
  );

  const reviewDistribution = useMemo(
    () =>
      [5, 4, 3, 2, 1].map((rating) => {
        const count = reviews.filter((r) => r.rating === rating).length;
        const percent = reviews.length > 0 ? (count / reviews.length) * 100 : 0;
        return { rating, count, percent };
      }),
    [reviews],
  );

  useEffect(() => {
    let isCancelled = false;
    let retryTimeout: ReturnType<typeof setTimeout> | null = null;

    const fetchAnalysisSummary = async (attempt = 0) => {
      if (reviews.length === 0) {
        setAnalysisSummary(null);
        setAnalysisSummaryStatus('idle');
        return;
      }

      if (attempt === 0) {
        setAnalysisSummary(null);
      }

      setAnalysisSummaryStatus('loading');

      try {
        const response = await apiClient.get<
          ApiResponse<ProductReviewAnalysisSummary>
        >(ENDPOINTS.REVIEWS.ANALYSIS_SUMMARY(productId));

        if (isCancelled) {
          return;
        }

        const nextSummary = response.data.data;
        setAnalysisSummary(nextSummary);

        const shouldRetryForLaggingSummary =
          nextSummary.totalAnalyzed === 0 && hasCompletedAnalysis && attempt < 2;

        if (shouldRetryForLaggingSummary) {
          retryTimeout = setTimeout(() => {
            void fetchAnalysisSummary(attempt + 1);
          }, 1500);
          return;
        }

        setAnalysisSummaryStatus('success');
      } catch {
        if (isCancelled) {
          return;
        }

        setAnalysisSummary(null);
        setAnalysisSummaryStatus('error');
      }
    };

    void fetchAnalysisSummary();

    return () => {
      isCancelled = true;
      if (retryTimeout) {
        clearTimeout(retryTimeout);
      }
    };
  }, [productId, reviewAnalysisSignature, reviews.length, hasCompletedAnalysis]);

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

  const showAiLoadingCard =
    !analysisSummary?.totalAnalyzed &&
    reviews.length > 0 &&
    analysisSummaryStatus === 'loading' &&
    (hasPendingAnalysis || hasCompletedAnalysis);

  const renderAiSummaryCard = () => {
    if (analysisSummary && analysisSummary.totalAnalyzed > 0) {
      return <AISentimentSummary summary={analysisSummary} />;
    }

    if (showAiLoadingCard) {
      return (
        <div className="rounded-[1.75rem] border border-brand/10 bg-gradient-to-br from-brand-subtle via-surface to-surface-alt p-6 shadow-sm">
          <div className="inline-flex items-center gap-2 rounded-full border border-brand/10 bg-surface/80 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-brand-accent">
            <Bot className="h-3.5 w-3.5" />
            AI review signal
          </div>
          <div className="mt-4 flex items-start gap-3 rounded-2xl border border-border bg-surface/85 px-4 py-4">
            <Loader2 className="mt-0.5 h-4 w-4 shrink-0 animate-spin text-brand-accent" />
            <div>
              <h3 className="font-display text-xl font-bold text-brand">
                Tổng quan cảm xúc AI
              </h3>
              <p className="mt-2 text-sm leading-6 text-text-secondary">
                AI đang tổng hợp tín hiệu từ các đánh giá gần nhất. Thẻ này sẽ tự
                cập nhật ngay khi có đủ dữ liệu phân tích.
              </p>
            </div>
          </div>
        </div>
      );
    }

    if (reviews.length === 0) {
      return (
        <div className="rounded-[1.75rem] border border-border bg-surface p-6">
          <div className="flex items-start gap-3">
            <Bot className="mt-0.5 h-5 w-5 shrink-0 text-text-muted" />
            <div>
              <h3 className="font-display text-xl font-bold text-brand">
                Tổng quan cảm xúc AI
              </h3>
              <p className="mt-2 text-sm leading-6 text-text-secondary">
                Chưa có dữ liệu để AI tổng hợp. Thẻ này sẽ xuất hiện sau khi sản
                phẩm có đánh giá và hệ thống hoàn tất phân tích nội dung.
              </p>
            </div>
          </div>
        </div>
      );
    }

    if (hasPendingAnalysis) {
      return (
        <div className="rounded-[1.75rem] border border-border bg-surface p-6">
          <div className="flex items-start gap-3">
            <Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-brand-accent" />
            <div>
              <h3 className="font-display text-xl font-bold text-brand">
                Tổng quan cảm xúc AI
              </h3>
              <p className="mt-2 text-sm leading-6 text-text-secondary">
                {pendingAnalysisCount} đánh giá đang chờ AI xử lý. Thẻ tổng hợp
                sẽ hiển thị ngay khi hệ thống hoàn tất những phân tích đầu tiên.
              </p>
            </div>
          </div>
        </div>
      );
    }

    if (analysisSummaryStatus === 'error') {
      return (
        <div className="rounded-[1.75rem] border border-border bg-surface p-6">
          <div className="flex items-start gap-3">
            <Bot className="mt-0.5 h-5 w-5 shrink-0 text-text-muted" />
            <div>
              <h3 className="font-display text-xl font-bold text-brand">
                Tổng quan cảm xúc AI
              </h3>
              <p className="mt-2 text-sm leading-6 text-text-secondary">
                Chưa thể tải dữ liệu tổng hợp AI vào lúc này. Phần đánh giá sao
                vẫn hiển thị bình thường và thẻ AI sẽ xuất hiện khi tải lại được
                dữ liệu phân tích.
              </p>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="rounded-[1.75rem] border border-border bg-surface p-6">
        <div className="flex items-start gap-3">
          <Bot className="mt-0.5 h-5 w-5 shrink-0 text-text-muted" />
          <div>
            <h3 className="font-display text-xl font-bold text-brand">
              Tổng quan cảm xúc AI
            </h3>
            <p className="mt-2 text-sm leading-6 text-text-secondary">
              Hệ thống chưa có đủ dữ liệu phân tích để tạo bản tổng hợp cảm xúc
              cho sản phẩm này.
            </p>
          </div>
        </div>
      </div>
    );
  };

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

        {renderAiSummaryCard()}
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
