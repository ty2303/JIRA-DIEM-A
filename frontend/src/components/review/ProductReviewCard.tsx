import { Pencil, Trash2 } from "lucide-react";
import { motion } from "motion/react";

import type { Review } from "@/types/review";

import ReviewAnalysisStatus from "./ReviewAnalysisStatus";
import ReviewStarRating from "./ReviewStarRating";

interface ProductReviewCardProps {
	review: Review;
	/** Whether the current user owns this review */
	isOwner: boolean;
	onEdit?: (review: Review) => void;
	onDelete?: (reviewId: string) => void | Promise<void>;
}

export default function ProductReviewCard({
	review,
	isOwner,
	onEdit,
	onDelete,
}: ProductReviewCardProps) {
	return (
		<motion.div
			initial={{ opacity: 0, y: 8 }}
			animate={{ opacity: 1, y: 0 }}
			className="rounded-[1.75rem] border border-border bg-surface p-5"
		>
			{/* header */}
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
							{new Date(review.createdAt).toLocaleDateString("vi-VN")}
							{review.updatedAt && (
								<span className="ml-1 text-text-muted">(đã sửa)</span>
							)}
						</p>
					</div>
				</div>

				<div className="flex items-center gap-2">
					<ReviewStarRating value={review.rating} readOnly size="h-3.5 w-3.5" />

					{isOwner && (
						<div className="flex items-center gap-1">
							{onEdit && (
								<button
									type="button"
									onClick={() => onEdit(review)}
									className="cursor-pointer rounded-lg p-1.5 text-text-muted transition-colors hover:bg-brand/10 hover:text-brand"
									aria-label="Chỉnh sửa đánh giá"
								>
									<Pencil className="h-4 w-4" />
								</button>
							)}
							{onDelete && (
								<button
									type="button"
								onClick={() => void onDelete(review.id)}
									className="cursor-pointer rounded-lg p-1.5 text-text-muted transition-colors hover:bg-red-50 hover:text-red-500"
									aria-label="Xóa đánh giá"
								>
									<Trash2 className="h-4 w-4" />
								</button>
							)}
						</div>
					)}
				</div>
			</div>

			{/* comment */}
			<p className="mt-3 text-sm leading-7 text-text-secondary">
				{review.comment}
			</p>

			{/* images */}
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

			{/* AI analysis status */}
			<ReviewAnalysisStatus
				status={review.analysisStatus}
				result={review.analysisResult}
			/>
		</motion.div>
	);
}
