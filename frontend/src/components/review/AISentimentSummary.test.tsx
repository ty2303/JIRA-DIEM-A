// @vitest-environment jsdom

import { render, screen } from '@testing-library/react';
import type { ComponentType } from 'react';
import { describe, expect, test } from 'vitest';

import * as AISentimentSummaryModule from '@/components/review/AISentimentSummary';
import {
  ASPECT_LABELS,
  type ProductReviewAnalysisSummary,
} from '@/types/review';

const AISentimentSummary =
  (AISentimentSummaryModule as {
    default?: ComponentType<{ summary: ProductReviewAnalysisSummary | null }>;
    AISentimentSummary?: ComponentType<{
      summary: ProductReviewAnalysisSummary | null;
    }>;
  }).default ??
  (AISentimentSummaryModule as {
    AISentimentSummary: ComponentType<{
      summary: ProductReviewAnalysisSummary | null;
    }>;
  }).AISentimentSummary;

function createSummary(
  overrides: Partial<ProductReviewAnalysisSummary> = {},
): ProductReviewAnalysisSummary {
  return {
    productId: 'product-1',
    totalReviews: 10,
    totalAnalyzed: 8,
    sentimentDistribution: {
      positive: 60,
      neutral: 25,
      negative: 15,
    },
    aspectSummary: [
      {
        aspect: 'Battery',
        mentionCount: 12,
        sentimentCounts: { positive: 7, neutral: 3, negative: 2 },
        avgConfidence: 0.82,
        avgScores: { positive: 0.7, neutral: 0.2, negative: 0.1 },
      },
      {
        aspect: 'Performance',
        mentionCount: 9,
        sentimentCounts: { positive: 5, neutral: 2, negative: 2 },
        avgConfidence: 0.76,
        avgScores: { positive: 0.6, neutral: 0.25, negative: 0.15 },
      },
    ],
    ...overrides,
  };
}

describe('AISentimentSummary', () => {
  test('renders nothing when summary is null', () => {
    const { container } = render(<AISentimentSummary summary={null} />);

    expect(container).toBeEmptyDOMElement();
  });

  test('renders nothing when totalAnalyzed is 0', () => {
    const summary = createSummary({ totalAnalyzed: 0 });

    const { container } = render(<AISentimentSummary summary={summary} />);

    expect(container).toBeEmptyDOMElement();
  });

  test('renders heading and analyzed ratio text', () => {
    const summary = createSummary({ totalReviews: 10, totalAnalyzed: 8 });

    render(<AISentimentSummary summary={summary} />);

    expect(
      screen.getByRole('heading', { name: /tổng quan cảm xúc ai/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/8\s*\/\s*10/)).toBeInTheDocument();
  });

  test('renders positive, neutral, and negative distribution labels with percentages', () => {
    const summary = createSummary({
      sentimentDistribution: {
        positive: 6,
        neutral: 2,
        negative: 1,
      },
    });

    render(<AISentimentSummary summary={summary} />);

    expect(screen.getByText(/tich cuc/i)).toBeInTheDocument();
    expect(screen.getByText(/trung lap/i)).toBeInTheDocument();
    expect(screen.getByText(/tieu cuc/i)).toBeInTheDocument();
    expect(screen.getByText('67%')).toBeInTheDocument();
    expect(screen.getByText('22%')).toBeInTheDocument();
    expect(screen.getByText('11%')).toBeInTheDocument();
  });

  test('renders Vietnamese aspect labels from ASPECT_LABELS', () => {
    const summary = createSummary({
      aspectSummary: [
        {
          aspect: 'Battery',
          mentionCount: 4,
          sentimentCounts: { positive: 3, neutral: 1, negative: 0 },
          avgConfidence: 0.8,
          avgScores: { positive: 0.8, neutral: 0.15, negative: 0.05 },
        },
        {
          aspect: 'Shop_Service',
          mentionCount: 2,
          sentimentCounts: { positive: 1, neutral: 1, negative: 0 },
          avgConfidence: 0.72,
          avgScores: { positive: 0.55, neutral: 0.35, negative: 0.1 },
        },
      ],
    });

    render(<AISentimentSummary summary={summary} />);

    expect(screen.getByText(ASPECT_LABELS.Battery)).toBeInTheDocument();
    expect(screen.getByText(ASPECT_LABELS.Shop_Service)).toBeInTheDocument();
  });

  test('renders only top 5 aspect insights by mention count', () => {
    const summary = createSummary({
      aspectSummary: [
        {
          aspect: 'Others',
          mentionCount: 1,
          sentimentCounts: { positive: 1, neutral: 0, negative: 0 },
          avgConfidence: 0.71,
          avgScores: { positive: 0.8, neutral: 0.1, negative: 0.1 },
        },
        {
          aspect: 'Battery',
          mentionCount: 10,
          sentimentCounts: { positive: 7, neutral: 2, negative: 1 },
          avgConfidence: 0.86,
          avgScores: { positive: 0.7, neutral: 0.2, negative: 0.1 },
        },
        {
          aspect: 'Camera',
          mentionCount: 9,
          sentimentCounts: { positive: 5, neutral: 2, negative: 2 },
          avgConfidence: 0.81,
          avgScores: { positive: 0.6, neutral: 0.25, negative: 0.15 },
        },
        {
          aspect: 'Performance',
          mentionCount: 8,
          sentimentCounts: { positive: 5, neutral: 2, negative: 1 },
          avgConfidence: 0.83,
          avgScores: { positive: 0.63, neutral: 0.24, negative: 0.13 },
        },
        {
          aspect: 'Display',
          mentionCount: 7,
          sentimentCounts: { positive: 4, neutral: 2, negative: 1 },
          avgConfidence: 0.79,
          avgScores: { positive: 0.58, neutral: 0.27, negative: 0.15 },
        },
        {
          aspect: 'Design',
          mentionCount: 6,
          sentimentCounts: { positive: 3, neutral: 2, negative: 1 },
          avgConfidence: 0.75,
          avgScores: { positive: 0.54, neutral: 0.31, negative: 0.15 },
        },
      ],
    });

    render(<AISentimentSummary summary={summary} />);

    expect(screen.getByText(ASPECT_LABELS.Battery)).toBeInTheDocument();
    expect(screen.getByText(ASPECT_LABELS.Camera)).toBeInTheDocument();
    expect(screen.getByText(ASPECT_LABELS.Performance)).toBeInTheDocument();
    expect(screen.getByText(ASPECT_LABELS.Display)).toBeInTheDocument();
    expect(screen.getByText(ASPECT_LABELS.Design)).toBeInTheDocument();
    expect(screen.queryByText(ASPECT_LABELS.Others)).not.toBeInTheDocument();
  });
});
