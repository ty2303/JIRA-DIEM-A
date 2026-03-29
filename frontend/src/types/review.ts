export type ReviewSentiment = 'positive' | 'negative' | 'neutral';

export interface ReviewAnalysisResult {
  sentiment: ReviewSentiment;
  /** Confidence score for the sentiment prediction (0–1) */
  sentimentScore: number;
  /** Overall quality score of the review content (0–1) */
  qualityScore: number;
  /** Detected issue flags, e.g. "spam", "low_quality", "inappropriate" */
  flags: string[];
  /** Short AI-generated summary of the review */
  summary: string;
  /** ISO date string of when the analysis was performed */
  analyzedAt: string;
}

export interface Review {
  id: string;
  productId: string;
  userId: string;
  username: string;
  rating: number;
  comment: string;
  images?: string[];
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
