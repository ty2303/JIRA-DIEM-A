import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react";

import type {
	ReviewAnalysisStatus as AnalysisStatus,
	ReviewAnalysisResult,
} from "@/types/review";

interface ReviewAnalysisStatusProps {
	status: AnalysisStatus;
	result: ReviewAnalysisResult | null;
}

const sentimentLabels: Record<string, { label: string; color: string }> = {
	positive: { label: "Tích cực", color: "text-emerald-600" },
	negative: { label: "Tiêu cực", color: "text-red-600" },
	neutral: { label: "Trung lập", color: "text-amber-600" },
};

export default function ReviewAnalysisStatus({
	status,
	result,
}: ReviewAnalysisStatusProps) {
	if (status === "none") return null;

	if (status === "pending") {
		return (
			<div className="mt-3 flex items-center gap-2 rounded-xl bg-blue-50 px-3 py-2">
				<Loader2 className="h-3.5 w-3.5 animate-spin text-blue-500" />
				<span className="text-xs text-blue-700">
					Hệ thống đang phân tích đánh giá...
				</span>
			</div>
		);
	}

	if (status === "completed" && result) {
		const sentiment =
			sentimentLabels[result.sentiment] ?? sentimentLabels.neutral;
		const hasFlags = result.flags.length > 0;

		return (
			<div className="mt-3 rounded-xl border border-border bg-surface-alt px-3 py-2.5">
				<div className="flex items-center gap-2">
					{hasFlags ? (
						<AlertCircle className="h-3.5 w-3.5 shrink-0 text-amber-500" />
					) : (
						<CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-500" />
					)}
					<span className="text-xs text-text-secondary">
						Phân tích AI:{" "}
						<span className={`font-medium ${sentiment.color}`}>
							{sentiment.label}
						</span>
						{result.qualityScore != null && (
							<>
								{" "}
								&middot; Chất lượng: {Math.round(result.qualityScore * 100)}%
							</>
						)}
					</span>
				</div>

				{result.summary && (
					<p className="mt-1.5 text-xs leading-5 text-text-muted">
						{result.summary}
					</p>
				)}

				{hasFlags && (
					<div className="mt-2 flex flex-wrap gap-1">
						{result.flags.map((flag) => (
							<span
								key={flag}
								className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-700"
							>
								{flag}
							</span>
						))}
					</div>
				)}
			</div>
		);
	}

	return null;
}
