import { CheckCircle2, Loader2, Send } from "lucide-react";
import { motion } from "motion/react";
import { useCallback, useRef, useState } from "react";

import apiClient from "@/api/client";
import { ENDPOINTS } from "@/api/endpoints";
import type { ApiResponse } from "@/api/types";
import type { CreateReviewPayload, Review } from "@/types/review";

import ReviewImageUpload from "./ReviewImageUpload";
import ReviewStarRating from "./ReviewStarRating";

/* ---------- constants ---------- */
const COMMENT_MAX = 1000;
const SUCCESS_DISPLAY_MS = 3000;

/* ---------- helpers ---------- */
function fileToDataUrl(file: File) {
	return new Promise<string>((resolve, reject) => {
		const reader = new FileReader();
		reader.onload = () => resolve(String(reader.result));
		reader.onerror = () => reject(new Error("Không thể đọc tệp ảnh."));
		reader.readAsDataURL(file);
	});
}

/* ---------- validation ---------- */
interface FieldErrors {
	rating?: string;
	comment?: string;
	images?: string;
}

function validate(rating: number, comment: string): FieldErrors {
	const errors: FieldErrors = {};

	if (rating < 1 || rating > 5) {
		errors.rating = "Vui lòng chọn số sao từ 1 đến 5.";
	}

	const trimmed = comment.trim();
	if (!trimmed) {
		errors.comment = "Vui lòng nhập nội dung đánh giá.";
	} else if (trimmed.length < 10) {
		errors.comment = "Nội dung đánh giá cần ít nhất 10 ký tự.";
	}

	return errors;
}

/* ---------- form states ---------- */
type FormStatus = "idle" | "submitting" | "success" | "error";

/* ---------- props ---------- */
interface ProductReviewFormProps {
	productId: string;
	/** Existing review being edited (null = create mode) */
	editingReview: Review | null;
	onCancel?: () => void;
	onSubmitted: (review: Review) => void;
}

export default function ProductReviewForm({
	productId,
	editingReview,
	onCancel,
	onSubmitted,
}: ProductReviewFormProps) {
	const isEditing = editingReview !== null;

	/* --- form state --- */
	const [rating, setRating] = useState(editingReview?.rating ?? 5);
	const [comment, setComment] = useState(editingReview?.comment ?? "");
	const [images, setImages] = useState<string[]>(editingReview?.images ?? []);
	const [uploading, setUploading] = useState(false);

	/* --- status & errors --- */
	const [status, setStatus] = useState<FormStatus>("idle");
	const [serverError, setServerError] = useState("");
	const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

	/* --- refs --- */
	const formRef = useRef<HTMLFormElement>(null);
	const successTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

	/* --- image handling (preserved on submit failure) --- */
	const handleImageAdd = useCallback(async (file: File) => {
		setUploading(true);
		try {
			const imageData = await fileToDataUrl(file);
			const response = await apiClient.post<ApiResponse<string>>(
				ENDPOINTS.REVIEWS.UPLOAD_IMAGE,
				{
					imageData,
					folder: "reviews",
				},
			);
			setImages((prev) => [...prev, response.data.data]);
		} catch (error: unknown) {
			const axiosError = error as {
				response?: { data?: { message?: string } };
			};
			throw new Error(
				axiosError.response?.data?.message ?? "Không thể upload ảnh đánh giá.",
			);
		} finally {
			setUploading(false);
		}
	}, []);

	const handleImageRemove = useCallback((index: number) => {
		setImages((prev) => prev.filter((_, i) => i !== index));
	}, []);

	/* --- submit --- */
	const handleSubmit = async (event: React.FormEvent) => {
		event.preventDefault();

		// Clear previous state
		setServerError("");
		setFieldErrors({});

		// Validate
		const errors = validate(rating, comment);
		if (Object.keys(errors).length > 0) {
			setFieldErrors(errors);
			return;
		}

		setStatus("submitting");

		try {
			const payload: CreateReviewPayload = {
				productId,
				rating,
				comment: comment.trim(),
				images: images.length > 0 ? images : undefined,
			};

			const response = isEditing
				? await apiClient.put<ApiResponse<Review>>(
						ENDPOINTS.REVIEWS.UPDATE(editingReview.id),
						payload,
					)
				: await apiClient.post<ApiResponse<Review>>(
						ENDPOINTS.REVIEWS.BASE,
						payload,
					);

			const savedReview = response.data.data;

			setStatus("success");

			// Auto-reset success banner after a few seconds
			clearTimeout(successTimerRef.current);
			successTimerRef.current = setTimeout(() => {
				setStatus("idle");
			}, SUCCESS_DISPLAY_MS);

			onSubmitted(savedReview);
		} catch (error: unknown) {
			const axiosError = error as {
				response?: { data?: { message?: string } };
			};
			setServerError(
				axiosError.response?.data?.message ??
					"Không thể gửi đánh giá, vui lòng thử lại sau.",
			);
			// NOTE: images are NOT cleared — user can retry without re-uploading
			setStatus("error");
		}
	};

	/* --- success state --- */
	if (status === "success") {
		return (
			<motion.div
				initial={{ opacity: 0, y: 10 }}
				animate={{ opacity: 1, y: 0 }}
				className="mb-8 flex items-center gap-3 rounded-[1.75rem] border border-emerald-200 bg-emerald-50/80 px-6 py-5"
			>
				<CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" />
				<p className="text-sm font-medium text-emerald-700">
					{isEditing
						? "Đánh giá đã được cập nhật thành công!"
						: "Cảm ơn bạn đã gửi đánh giá!"}
				</p>
			</motion.div>
		);
	}

	return (
		<motion.form
			ref={formRef}
			initial={{ opacity: 0, y: 10 }}
			animate={{ opacity: 1, y: 0 }}
			onSubmit={(event) => void handleSubmit(event)}
			className="mb-8 rounded-[1.75rem] border border-border bg-surface p-6"
			noValidate
		>
			{/* --- header --- */}
			<p className="font-medium text-text-primary">
				{isEditing
					? "Chỉnh sửa đánh giá của bạn"
					: "Đánh giá từ tài khoản của bạn"}
			</p>

			{/* --- star rating --- */}
			<div className="mt-4">
				<ReviewStarRating
					value={rating}
					onChange={(v) => {
						setRating(v);
						setFieldErrors((prev) => ({ ...prev, rating: undefined }));
					}}
					showLabel
					error={fieldErrors.rating}
				/>
			</div>

			{/* --- comment --- */}
			<div className="mt-4">
				<textarea
					value={comment}
					onChange={(event) => {
						setComment(event.target.value);
						setFieldErrors((prev) => ({ ...prev, comment: undefined }));
					}}
					placeholder="Chia sẻ trải nghiệm thực tế của bạn về sản phẩm này..."
					rows={4}
					maxLength={COMMENT_MAX}
					className={`w-full resize-none rounded-2xl border px-4 py-3 text-sm text-text-primary outline-none transition-colors placeholder:text-text-muted focus:ring-1 ${
						fieldErrors.comment
							? "border-red-400 bg-red-50/40 focus:border-red-500 focus:ring-red-400"
							: "border-border bg-surface-alt focus:border-brand focus:ring-brand"
					}`}
				/>
				<div className="mt-1 flex items-center justify-between">
					<span className="text-xs text-text-muted">
						{comment.length}/{COMMENT_MAX} ký tự
					</span>
					{fieldErrors.comment && (
						<span className="text-xs text-red-600">{fieldErrors.comment}</span>
					)}
				</div>
			</div>

			{/* --- image upload --- */}
			<div className="mt-4">
				<ReviewImageUpload
					images={images}
					onAdd={handleImageAdd}
					onRemove={handleImageRemove}
					uploading={uploading}
					disabled={status === "submitting"}
					error={fieldErrors.images}
					onValidationError={(msg) =>
						setFieldErrors((prev) => ({ ...prev, images: msg }))
					}
				/>
			</div>

			{/* --- server error --- */}
			{serverError && (
				<div className="mt-4 rounded-xl bg-red-50 px-3 py-2.5">
					<p className="text-sm text-red-600">{serverError}</p>
					<button
						type="button"
						onClick={() => {
							setServerError("");
							setStatus("idle");
						}}
						className="mt-1 text-xs font-medium text-red-700 underline hover:text-red-800"
					>
						Bỏ qua lỗi và thử lại
					</button>
				</div>
			)}

			{/* --- actions --- */}
			<div className="mt-5 flex justify-end gap-3">
				{isEditing && onCancel && (
					<button type="button" onClick={onCancel} className="btn-outline">
						Hủy sửa
					</button>
				)}
				<motion.button
					type="submit"
					disabled={status === "submitting" || uploading}
					whileHover={{ scale: 1.01 }}
					whileTap={{ scale: 0.99 }}
					className="btn-primary flex cursor-pointer items-center gap-2 disabled:opacity-60"
				>
					{status === "submitting" ? (
						<Loader2 className="h-4 w-4 animate-spin" />
					) : (
						<Send className="h-4 w-4" />
					)}
					{isEditing ? "Lưu đánh giá" : "Gửi đánh giá"}
				</motion.button>
			</div>
		</motion.form>
	);
}
