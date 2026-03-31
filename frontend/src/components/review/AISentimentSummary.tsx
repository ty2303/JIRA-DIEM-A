import { Bot, Brain, ScanSearch } from 'lucide-react';

import {
  ASPECT_LABELS,
  type ProductReviewAnalysisSummary,
  type ReviewAspect,
  type ReviewAspectSummaryRow,
} from '@/types/review';

interface AISentimentSummaryProps {
  summary: ProductReviewAnalysisSummary | null;
}

const distributionItems = [
  {
    key: 'positive',
    label: 'Tich cuc',
    accentClass: 'text-emerald-700',
    trackClass: 'bg-emerald-100',
    fillClass: 'bg-emerald-500',
  },
  {
    key: 'neutral',
    label: 'Trung lap',
    accentClass: 'text-amber-700',
    trackClass: 'bg-amber-100',
    fillClass: 'bg-amber-400',
  },
  {
    key: 'negative',
    label: 'Tieu cuc',
    accentClass: 'text-rose-700',
    trackClass: 'bg-rose-100',
    fillClass: 'bg-rose-500',
  },
] as const satisfies ReadonlyArray<{
  key: keyof ProductReviewAnalysisSummary['sentimentDistribution'];
  label: string;
  accentClass: string;
  trackClass: string;
  fillClass: string;
}>;

function getAspectLabel(aspect: string): string {
  return ASPECT_LABELS[aspect as ReviewAspect] ?? aspect;
}

function getDistributionPercent(
  value: number,
  total: number,
): number {
  if (total <= 0) {
    return 0;
  }

  return Math.round((value / total) * 100);
}

function getDominantSentiment(row: ReviewAspectSummaryRow): {
  label: string;
  toneClass: string;
} {
  const entries = [
    {
      key: 'positive',
      count: row.sentimentCounts.positive,
      label: 'Tích cực',
      toneClass: 'text-emerald-700',
    },
    {
      key: 'neutral',
      count: row.sentimentCounts.neutral,
      label: 'Trung lập',
      toneClass: 'text-amber-700',
    },
    {
      key: 'negative',
      count: row.sentimentCounts.negative,
      label: 'Tiêu cực',
      toneClass: 'text-rose-700',
    },
  ] as const;

  return entries.reduce((current, candidate) => {
    if (candidate.count > current.count) {
      return candidate;
    }

    return current;
  });
}

export function AISentimentSummary({ summary }: AISentimentSummaryProps) {
  if (!summary || summary.totalAnalyzed === 0) {
    return null;
  }

  const totalSentimentCount =
    summary.sentimentDistribution.positive +
    summary.sentimentDistribution.neutral +
    summary.sentimentDistribution.negative;

  const topAspects = [...summary.aspectSummary]
    .sort((left, right) => right.mentionCount - left.mentionCount)
    .slice(0, 5);

  return (
    <section className="rounded-[1.75rem] border border-brand/10 bg-gradient-to-br from-brand-subtle via-surface to-surface-alt p-6 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-brand/10 bg-surface/80 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-brand-accent">
            <Bot className="h-3.5 w-3.5" />
            Tin hieu AI
          </div>
          <h3 className="mt-3 font-display text-2xl font-bold text-brand">
            Tổng quan cảm xúc AI
          </h3>
          <p className="mt-2 text-sm leading-6 text-text-secondary">
            AI đã phân tích <span className="font-semibold text-text-primary">{summary.totalAnalyzed} / {summary.totalReviews}</span> đánh giá để tóm tắt xu hướng cảm xúc nổi bật.
          </p>
        </div>

        <div className="min-w-[11rem] rounded-2xl border border-brand/10 bg-surface/85 px-4 py-3">
          <div className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-text-muted">
            <ScanSearch className="h-3.5 w-3.5 text-brand-accent" />
            Do phu du lieu
          </div>
          <p className="mt-2 font-display text-3xl font-bold text-brand">
            {summary.totalAnalyzed}
            <span className="ml-1 text-base font-medium text-text-muted">
              / {summary.totalReviews}
            </span>
          </p>
          <p className="mt-1 text-xs text-text-secondary">
            lượng đánh giá đã được AI đọc và gom nhóm
          </p>
        </div>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-3">
        {distributionItems.map((item) => {
          const value = summary.sentimentDistribution[item.key];
          const percent = getDistributionPercent(value, totalSentimentCount);

          return (
            <div
              key={item.key}
              className="rounded-2xl border border-border bg-surface/90 px-4 py-3"
            >
              <div className="flex items-center justify-between gap-3">
                <span className={`text-sm font-semibold ${item.accentClass}`}>
                  {item.label}
                </span>
                <span className="font-display text-xl font-bold text-text-primary">
                  {percent}%
                </span>
              </div>
              <div className={`mt-3 h-2 overflow-hidden rounded-full ${item.trackClass}`}>
                <div
                  className={`h-full rounded-full ${item.fillClass}`}
                  style={{ width: `${percent}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-5 rounded-[1.5rem] border border-border bg-surface/90 p-4">
        <div className="flex items-center gap-2 text-sm font-semibold text-text-primary">
          <Brain className="h-4 w-4 text-brand-accent" />
          5 chủ đề được nhắc đến nhiều nhất
        </div>

        <div className="mt-4 space-y-3">
          {topAspects.map((aspect) => {
            const dominantSentiment = getDominantSentiment(aspect);

            return (
              <div
                key={aspect.aspect}
                className="flex items-center justify-between gap-4 rounded-2xl border border-border bg-surface-alt/80 px-4 py-3"
              >
                <div>
                  <p className="text-sm font-semibold text-text-primary">
                    {getAspectLabel(aspect.aspect)}
                  </p>
                  <p className="mt-1 text-xs text-text-secondary">
                    {aspect.mentionCount} lượt nhắc -{' '}
                    <span className={dominantSentiment.toneClass}>
                      {dominantSentiment.label}
                    </span>
                  </p>
                </div>

                <div className="text-right text-xs text-text-muted">
                  <p>Do tin cay</p>
                  <p className="mt-1 font-semibold text-text-primary">
                    {Math.round(aspect.avgConfidence * 100)}%
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

export default AISentimentSummary;
