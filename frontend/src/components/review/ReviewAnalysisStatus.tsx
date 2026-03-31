import { AlertTriangle, CheckCircle2, Loader2, Sparkles } from 'lucide-react';

import type {
  ReviewAnalysisStatus as AnalysisStatus,
  AspectResult,
  ReviewAnalysisResult,
  ReviewSentiment,
} from '@/types/review';
import { ASPECT_LABELS, type ReviewAspect } from '@/types/review';

interface ReviewAnalysisStatusProps {
  status: AnalysisStatus;
  result: ReviewAnalysisResult | null;
}

const sentimentConfig: Record<
  ReviewSentiment,
  { label: string; color: string; bgColor: string; dotColor: string }
> = {
  positive: {
    label: 'Tích cực',
    color: 'text-emerald-700',
    bgColor: 'bg-emerald-50',
    dotColor: 'bg-emerald-500',
  },
  negative: {
    label: 'Tiêu cực',
    color: 'text-red-700',
    bgColor: 'bg-red-50',
    dotColor: 'bg-red-500',
  },
  neutral: {
    label: 'Trung lập',
    color: 'text-amber-700',
    bgColor: 'bg-amber-50',
    dotColor: 'bg-amber-500',
  },
};

function getAspectLabel(aspect: string): string {
  return ASPECT_LABELS[aspect as ReviewAspect] ?? aspect;
}

function AspectBadge({ aspect }: { aspect: AspectResult }) {
  const config = sentimentConfig[aspect.sentiment] ?? sentimentConfig.neutral;
  const confidence = Math.round(aspect.confidence * 100);

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium ${config.bgColor} ${config.color}`}
      title={`${getAspectLabel(aspect.aspect)}: ${config.label} (${confidence}%)`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${config.dotColor}`} />
      {getAspectLabel(aspect.aspect)}
    </span>
  );
}

export default function ReviewAnalysisStatus({
  status,
  result,
}: ReviewAnalysisStatusProps) {
  if (status === 'none') return null;

  if (status === 'pending') {
    return (
      <div className="mt-3 flex items-center gap-2 rounded-xl bg-blue-50 px-3 py-2">
        <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-500" />
        <span className="text-xs text-blue-700">
          Hệ thống đang phân tích đánh giá...
        </span>
      </div>
    );
  }

  if (status === 'failed') {
    return (
      <div className="mt-3 flex items-center gap-2 rounded-xl bg-red-50 px-3 py-2">
        <AlertTriangle className="h-3.5 w-3.5 text-red-400" />
        <span className="text-xs text-red-600">
          Không thể phân tích đánh giá. Vui lòng thử lại sau.
        </span>
      </div>
    );
  }

  if (status === 'completed' && result) {
    const overallConfig =
      sentimentConfig[result.overallSentiment] ?? sentimentConfig.neutral;
    const confidencePct = Math.round(result.overallConfidence * 100);

    // Group non-General aspects by sentiment
    const nonGeneralAspects = result.aspects.filter(
      (a) => a.aspect !== 'General',
    );
    const negativeAspects = nonGeneralAspects.filter(
      (a) => a.sentiment === 'negative',
    );
    const positiveAspects = nonGeneralAspects.filter(
      (a) => a.sentiment === 'positive',
    );
    const neutralAspects = nonGeneralAspects.filter(
      (a) => a.sentiment === 'neutral',
    );

    // Order groups: matching overall sentiment first
    const groups = [
      {
        sentiment: 'negative' as const,
        aspects: negativeAspects,
        label: 'Tiêu cực',
      },
      {
        sentiment: 'positive' as const,
        aspects: positiveAspects,
        label: 'Tích cực',
      },
      {
        sentiment: 'neutral' as const,
        aspects: neutralAspects,
        label: 'Trung lập',
      },
    ].filter((g) => g.aspects.length > 0);

    // Put overall-matching group first
    groups.sort((a, b) => {
      if (a.sentiment === result.overallSentiment) return -1;
      if (b.sentiment === result.overallSentiment) return 1;
      return 0;
    });

    return (
      <div className="mt-3 rounded-xl border border-border bg-surface-alt px-3 py-2.5">
        {/* Header: overall sentiment */}
        <div className="flex items-center gap-2">
          <Sparkles className="h-3.5 w-3.5 shrink-0 text-indigo-500" />
          <span className="text-xs text-text-secondary">
            Phân tích AI:{' '}
            <span className={`font-semibold ${overallConfig.color}`}>
              {overallConfig.label}
            </span>
            <span className="ml-1 text-text-muted">({confidencePct}%)</span>
          </span>
          <CheckCircle2 className="ml-auto h-3 w-3 text-emerald-400" />
        </div>

        {/* Grouped aspect badges by sentiment */}
        {groups.length > 0 && (
          <div className="mt-2 space-y-1.5">
            {groups.map((group) => {
              const groupConfig = sentimentConfig[group.sentiment];
              return (
                <div
                  key={group.sentiment}
                  className="flex flex-wrap items-center gap-1.5"
                >
                  <span
                    className={`text-[11px] font-medium ${groupConfig.color}`}
                  >
                    {group.label}:
                  </span>
                  {group.aspects.map((aspect) => (
                    <AspectBadge key={aspect.aspect} aspect={aspect} />
                  ))}
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  return null;
}
