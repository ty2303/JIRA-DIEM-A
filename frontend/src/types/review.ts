export type ReviewSentiment = 'positive' | 'negative' | 'neutral';

/**
 * 11 supported aspect categories for phone product reviews.
 */
export type ReviewAspect =
  | 'Battery'
  | 'Camera'
  | 'Performance'
  | 'Display'
  | 'Design'
  | 'Packaging'
  | 'Price'
  | 'Shop_Service'
  | 'Shipping'
  | 'General'
  | 'Others';

/** Vietnamese labels for each aspect. */
export const ASPECT_LABELS: Record<ReviewAspect, string> = {
  Battery: 'Pin',
  Camera: 'Camera',
  Performance: 'Hiệu năng',
  Display: 'Màn hình',
  Design: 'Thiết kế',
  Packaging: 'Đóng gói',
  Price: 'Giá',
  Shop_Service: 'Dịch vụ',
  Shipping: 'Vận chuyển',
  General: 'Tổng quan',
  Others: 'Khác',
};

/** Sentiment scores breakdown for a single aspect. */
export interface AspectScores {
  positive: number;
  negative: number;
  neutral: number;
}

/** AI sentiment result for a single detected aspect. */
export interface AspectResult {
  aspect: string;
  sentiment: ReviewSentiment;
  confidence: number;
  scores: AspectScores;
}

/** Full AI analysis result with per-aspect sentiments. */
export interface ReviewAnalysisResult {
  aspects: AspectResult[];
  overallSentiment: ReviewSentiment;
  overallConfidence: number;
  /** ISO date string of when the analysis was performed */
  analyzedAt: string;
}

export interface ReviewAspectSummaryRow {
  aspect: string;
  mentionCount: number;
  sentimentCounts: AspectScores;
  avgConfidence: number;
  avgScores: AspectScores;
}

export interface ProductReviewAnalysisSummary {
  productId: string;
  totalReviews: number;
  totalAnalyzed: number;
  sentimentDistribution: AspectScores;
  aspectSummary: ReviewAspectSummaryRow[];
}

export type ReviewAnalysisStatus = 'none' | 'pending' | 'completed' | 'failed';

export interface Review {
  id: string;
  productId: string;
  userId: string;
  username: string;
  rating: number;
  comment: string;
  images?: string[];
  /** Lifecycle state of AI analysis: none → pending → completed | failed */
  analysisStatus: ReviewAnalysisStatus;
  /** Null until AI analysis has been performed */
  analysisResult: ReviewAnalysisResult | null;
  createdAt: string;
  updatedAt?: string;
}

export interface CreateReviewPayload {
  productId: string;
  rating: number;
  comment: string;
  images?: string[];
}

export type UpdateReviewPayload = CreateReviewPayload;

export interface DeleteReviewResponse {
  id: string;
  productId: string;
}
