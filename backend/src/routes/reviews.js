import crypto from "node:crypto";
import express from "express";
import { isDatabaseReady } from "../data/mongodb.js";
import { db } from "../data/store.js";
import { fail, ok } from "../lib/apiResponse.js";
import { serializeReview } from "../lib/catalogSerializers.js";
import {
	isUploadableReviewImageData,
	uploadReviewImage,
} from "../lib/reviewImageUpload.js";
import { requireAuth } from "../middleware/auth.js";
import { AnalysisLog } from "../models/AnalysisLog.js";
import { Product } from "../models/Product.js";
import { Review } from "../models/Review.js";
import { analyzeSentiment } from "../services/sentimentAnalysis.js";

export const reviewsRouter = express.Router();

/**
 * Fire-and-forget: run AI sentiment analysis and update the review in DB.
 * Does NOT block the HTTP response. Logs errors but never throws to caller.
 *
 * @param {string} reviewId - Review _id (or in-memory id)
 * @param {string} commentText - Review comment to analyze
 */
function triggerSentimentAnalysis(reviewId, commentText, productId) {
	analyzeAndUpdateReview(reviewId, commentText, productId).catch((error) => {
		console.error(
			`[SentimentAnalysis] Unhandled error for review ${reviewId}:`,
			error.message,
		);
	});
}

/**
 * Call the AI sentiment service, persist the result, and log the call.
 * On success: saves new result, clears previousAnalysis, logs success.
 * On failure: marks as failed, restores previousAnalysis if available, logs failure.
 *
 * @param {string} reviewId
 * @param {string} commentText
 * @param {string} [productId]
 */
async function analyzeAndUpdateReview(reviewId, commentText, productId) {
	const startTime = Date.now();

	try {
		const result = await analyzeSentiment(commentText);
		const durationMs = Date.now() - startTime;

		if (isDatabaseReady()) {
			await Review.findByIdAndUpdate(reviewId, {
				analysisStatus: "completed",
				analysisResult: result,
				previousAnalysis: null,
			});

			// Audit log: record successful AI call
			await AnalysisLog.create({
				_id: crypto.randomUUID(),
				reviewId,
				productId: productId || null,
				inputText: commentText,
				status: "success",
				result,
				error: { message: null, code: null },
				durationMs,
				modelVersion: result.modelVersion || null,
				promptVersion: result.promptVersion || null,
				apiUrl: process.env.AI_SENTIMENT_URL || null,
				attemptCount: 1,
				createdAt: new Date(),
			}).catch((logErr) => {
				console.error(
					`[AnalysisLog] Failed to log success for review ${reviewId}:`,
					logErr.message,
				);
			});
		} else {
			const memReview = db.reviews.find((r) => r.id === reviewId);
			if (memReview) {
				memReview.analysisStatus = "completed";
				memReview.analysisResult = result;
				memReview.previousAnalysis = null;
			}

			// In-memory audit log
			if (!db.analysisLogs) db.analysisLogs = [];
			db.analysisLogs.push({
				id: crypto.randomUUID(),
				reviewId,
				productId: productId || null,
				inputText: commentText,
				status: "success",
				result,
				error: null,
				durationMs,
				modelVersion: result.modelVersion || null,
				promptVersion: result.promptVersion || null,
				apiUrl: process.env.AI_SENTIMENT_URL || null,
				attemptCount: 1,
				createdAt: new Date().toISOString(),
			});
		}
	} catch (error) {
		const durationMs = Date.now() - startTime;
		console.error(
			`[SentimentAnalysis] Failed for review ${reviewId}: [${error.code ?? "UNKNOWN"}] ${error.message}`,
		);

		// Mark as failed; restore previousAnalysis so frontend can still show old data
		if (isDatabaseReady()) {
			const review = await Review.findById(reviewId).lean().catch(() => null);
			const updateFields = {
				analysisStatus: "failed",
			};
			// If there's a previousAnalysis, restore it as the current result
			if (review?.previousAnalysis) {
				updateFields.analysisResult = review.previousAnalysis;
				updateFields.previousAnalysis = null;
			}
			await Review.findByIdAndUpdate(reviewId, updateFields).catch((dbErr) => {
				console.error(
					`[SentimentAnalysis] DB update failed for review ${reviewId}:`,
					dbErr.message,
				);
			});

			// Audit log: record failed AI call
			await AnalysisLog.create({
				_id: crypto.randomUUID(),
				reviewId,
				productId: productId || null,
				inputText: commentText,
				status: "failed",
				result: null,
				error: {
					message: error.message || "Unknown error",
					code: error.code || "UNKNOWN",
				},
				durationMs,
				modelVersion: null,
				promptVersion: null,
				apiUrl: process.env.AI_SENTIMENT_URL || null,
				attemptCount: 1,
				createdAt: new Date(),
			}).catch((logErr) => {
				console.error(
					`[AnalysisLog] Failed to log failure for review ${reviewId}:`,
					logErr.message,
				);
			});
		} else {
			const memReview = db.reviews.find((r) => r.id === reviewId);
			if (memReview) {
				memReview.analysisStatus = "failed";
				// Restore previous analysis if available
				if (memReview.previousAnalysis) {
					memReview.analysisResult = memReview.previousAnalysis;
					memReview.previousAnalysis = null;
				}
			}

			// In-memory audit log
			if (!db.analysisLogs) db.analysisLogs = [];
			db.analysisLogs.push({
				id: crypto.randomUUID(),
				reviewId,
				productId: productId || null,
				inputText: commentText,
				status: "failed",
				result: null,
				error: {
					message: error.message || "Unknown error",
					code: error.code || "UNKNOWN",
				},
				durationMs,
				modelVersion: null,
				promptVersion: null,
				apiUrl: process.env.AI_SENTIMENT_URL || null,
				attemptCount: 1,
				createdAt: new Date().toISOString(),
			});
		}
	}
}

reviewsRouter.get("/", async (req, res) => {
	const productId = String(req.query.productId ?? "").trim();

	if (!isDatabaseReady()) {
		const items = (
			productId
				? db.reviews.filter((review) => review.productId === productId)
				: db.reviews
		)
			.slice()
			.sort((first, second) => {
				return (
					new Date(second.createdAt).getTime() -
					new Date(first.createdAt).getTime()
				);
			})
			.map((review) => serializeReview({ _id: review.id, ...review }));

		return res.json(ok(items));
	}

	const filter = productId ? { productId } : {};
	const items = await Review.find(filter).sort({ createdAt: -1 }).lean();
	res.json(ok(items.map(serializeReview)));
});

reviewsRouter.post("/", requireAuth, async (req, res) => {
	return createReview(req, res);
});

export async function createReview(req, res, options = {}) {
	const hasForcedProductId = Object.hasOwn(options, "productId");
	const productId = hasForcedProductId
		? String(options.productId ?? "").trim()
		: String(req.body?.productId ?? "").trim();
	const payload = normalizeReviewPayload({
		...req.body,
		productId,
	});

	if (!payload) {
		return res.status(400).json(fail("Danh gia khong hop le", 400));
	}

	if (!isDatabaseReady()) {
		const product = db.products.find((item) => item.id === payload.productId);
		if (!product) {
			return res.status(404).json(fail("Khong tim thay san pham", 404));
		}

		const existed = db.reviews.find(
			(review) =>
				review.productId === payload.productId && review.userId === req.user.id,
		);
		if (existed) {
			return res.status(409).json(fail("Ban da danh gia san pham nay", 409));
		}

		const reviewId = crypto.randomUUID();
		const review = {
			id: reviewId,
			productId: payload.productId,
			userId: req.user.id,
			username: req.user.username,
			rating: payload.rating,
			comment: payload.comment,
			images: payload.images,
			analysisStatus: "pending",
			analysisResult: null,
			createdAt: new Date().toISOString(),
			updatedAt: new Date().toISOString(),
		};
		db.reviews.unshift(review);
		syncMemoryProductRating(payload.productId);

		// Fire-and-forget: AI analysis runs in background
		triggerSentimentAnalysis(reviewId, payload.comment, payload.productId);

		return res
			.status(201)
			.json(
				ok(
					serializeReview({ _id: review.id, ...review }),
					"Them danh gia thanh cong",
					201,
				),
			);
	}

	const product = await Product.findById(payload.productId);
	if (!product) {
		return res.status(404).json(fail("Khong tim thay san pham", 404));
	}

	const existed = await Review.findOne({
		productId: payload.productId,
		userId: req.user.id,
	}).lean();
	if (existed) {
		return res.status(409).json(fail("Ban da danh gia san pham nay", 409));
	}

	const review = await Review.create({
		_id: crypto.randomUUID(),
		productId: payload.productId,
		userId: req.user.id,
		username: req.user.username,
		rating: payload.rating,
		comment: payload.comment,
		images: payload.images,
		analysisStatus: "pending",
		analysisResult: null,
		createdAt: new Date(),
		updatedAt: new Date(),
	});

	await syncProductRating(payload.productId);

	// Fire-and-forget: AI analysis runs in background
	triggerSentimentAnalysis(review._id, payload.comment, payload.productId);

	res
		.status(201)
		.json(
			ok(serializeReview(review.toObject()), "Them danh gia thanh cong", 201),
		);
}

reviewsRouter.put("/:id", requireAuth, async (req, res) => {
	const payload = normalizeReviewPayload(req.body);

	if (!payload) {
		return res.status(400).json(fail("Danh gia khong hop le", 400));
	}

	if (!isDatabaseReady()) {
		const review = db.reviews.find((item) => item.id === req.params.id);
		if (!review) {
			return res.status(404).json(fail("Khong tim thay danh gia", 404));
		}
		if (review.userId !== req.user.id) {
			return res.status(403).json(fail("Forbidden", 403));
		}
		if (review.productId !== payload.productId) {
			return res
				.status(400)
				.json(fail("Khong duoc thay doi san pham cua danh gia", 400));
		}

		const oldRating = review.rating;
		const oldComment = review.comment;
		const oldImagesKey = (review.images ?? []).join(",");

		review.rating = payload.rating;
		review.comment = payload.comment;
		review.images = payload.images;
		review.updatedAt = new Date().toISOString();

		const contentChanged =
			oldRating !== payload.rating ||
			oldComment !== payload.comment ||
			oldImagesKey !== payload.images.join(",");
		if (contentChanged) {
			// Preserve old analysis in previousAnalysis before re-analyzing
			review.previousAnalysis = review.analysisResult || null;
			review.analysisStatus = "pending";
			review.analysisResult = null;

			// Fire-and-forget: re-analyze on content change
			triggerSentimentAnalysis(review.id, payload.comment, payload.productId);
		}

		syncMemoryProductRating(payload.productId);

		return res.json(
			ok(
				serializeReview({ _id: review.id, ...review }),
				"Cap nhat danh gia thanh cong",
			),
		);
	}

	const review = await Review.findById(req.params.id);
	if (!review) {
		return res.status(404).json(fail("Khong tim thay danh gia", 404));
	}
	if (review.userId !== req.user.id) {
		return res.status(403).json(fail("Forbidden", 403));
	}
	if (review.productId !== payload.productId) {
		return res
			.status(400)
			.json(fail("Khong duoc thay doi san pham cua danh gia", 400));
	}

	const oldRating = review.rating;
	const oldComment = review.comment;
	const oldImagesKey = (review.images ?? []).join(",");

	review.rating = payload.rating;
	review.comment = payload.comment;
	review.images = payload.images;
	review.updatedAt = new Date();

	const contentChanged =
		oldRating !== payload.rating ||
		oldComment !== payload.comment ||
		oldImagesKey !== payload.images.join(",");
	if (contentChanged) {
		// Preserve old analysis in previousAnalysis before re-analyzing
		review.previousAnalysis = review.analysisResult || null;
		review.analysisStatus = "pending";
		review.analysisResult = null;
	}

	await review.save();
	await syncProductRating(payload.productId);

	// Fire-and-forget: re-analyze on content change
	if (contentChanged) {
		triggerSentimentAnalysis(review._id, payload.comment, payload.productId);
	}

	return res.json(
		ok(serializeReview(review.toObject()), "Cap nhat danh gia thanh cong"),
	);
});

reviewsRouter.delete("/:id", requireAuth, async (req, res) => {
	if (!isDatabaseReady()) {
		const index = db.reviews.findIndex((review) => review.id === req.params.id);
		if (index === -1) {
			return res.status(404).json(fail("Khong tim thay danh gia", 404));
		}

		const review = db.reviews[index];
		if (review.userId !== req.user.id && req.user.role !== "ADMIN") {
			return res.status(403).json(fail("Forbidden", 403));
		}

		db.reviews.splice(index, 1);
		syncMemoryProductRating(review.productId);
		return res.json(
			ok(
				{ id: review.id, productId: review.productId },
				"Xoa danh gia thanh cong",
			),
		);
	}

	const review = await Review.findById(req.params.id);

	if (!review) {
		return res.status(404).json(fail("Khong tim thay danh gia", 404));
	}

	if (review.userId !== req.user.id && req.user.role !== "ADMIN") {
		return res.status(403).json(fail("Forbidden", 403));
	}

	const productId = review.productId;
	const reviewId = review._id;
	await review.deleteOne();
	await syncProductRating(productId);

	res.json(ok({ id: reviewId, productId }, "Xoa danh gia thanh cong"));
});

reviewsRouter.post("/upload-image", requireAuth, async (req, res) => {
	const imageData = String(req.body?.imageData ?? "").trim();

	if (!imageData) {
		return res.status(400).json(fail("Anh review khong hop le", 400));
	}

	try {
		const imageUrl = await uploadReviewImage(imageData, "reviews");
		return res.json(ok(imageUrl, "Upload anh thanh cong"));
	} catch (error) {
		return res
			.status(400)
			.json(fail(error.message ?? "Upload anh that bai", 400));
	}
});

/**
 * GET /api/reviews/product/:productId/analysis-summary
 *
 * Returns aggregated sentiment analysis for a product's reviews.
 * Computes per-aspect averages and overall sentiment distribution.
 * Frontend uses this to show product-level sentiment insights.
 */
reviewsRouter.get(
	"/product/:productId/analysis-summary",
	async (req, res) => {
		const productId = String(req.params.productId ?? "").trim();

		if (!productId) {
			return res.status(400).json(fail("Thieu productId", 400));
		}

		try {
			if (!isDatabaseReady()) {
				// In-memory aggregation
				const allReviews = db.reviews.filter((r) => r.productId === productId);
				const analyzedReviews = allReviews.filter(
					(r) => r.analysisStatus === "completed" && r.analysisResult,
				);

				return res.json(
					ok(buildAnalysisSummary(analyzedReviews, productId, allReviews.length)),
				);
			}

			// MongoDB: get total count + analyzed reviews in parallel
			const [totalReviews, reviews] = await Promise.all([
				Review.countDocuments({ productId }),
				Review.find({
					productId,
					analysisStatus: "completed",
					analysisResult: { $ne: null },
				})
					.select("analysisResult")
					.lean(),
			]);

			return res.json(
				ok(buildAnalysisSummary(reviews, productId, totalReviews)),
			);
		} catch (error) {
			console.error(
				`[AnalysisSummary] Error for product ${productId}:`,
				error.message,
			);
			return res.status(500).json(fail("Loi khi lay tong hop phan tich", 500));
		}
	},
);
/**
 * GET /api/reviews/analysis-logs
 *
 * Returns AI analysis call audit trail.
 * Supports filtering by reviewId, productId, status.
 * Admin-only endpoint.
 */
reviewsRouter.get("/analysis-logs", requireAuth, async (req, res) => {
	const { reviewId, productId, status, limit: limitStr } = req.query;
	const limit = Math.min(Number(limitStr) || 50, 200);

	try {
		if (!isDatabaseReady()) {
			let logs = db.analysisLogs || [];

			if (reviewId) logs = logs.filter((l) => l.reviewId === reviewId);
			if (productId) logs = logs.filter((l) => l.productId === productId);
			if (status) logs = logs.filter((l) => l.status === status);

			const sorted = logs
				.slice()
				.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
				.slice(0, limit);

			return res.json(ok(sorted));
		}

		const filter = {};
		if (reviewId) filter.reviewId = String(reviewId);
		if (productId) filter.productId = String(productId);
		if (status) filter.status = String(status);

		const logs = await AnalysisLog.find(filter)
			.sort({ createdAt: -1 })
			.limit(limit)
			.lean();

		return res.json(
			ok(
				logs.map((log) => ({
					id: log._id,
					reviewId: log.reviewId,
					productId: log.productId,
					inputText: log.inputText,
					status: log.status,
					result: log.result,
					error: log.error,
					durationMs: log.durationMs,
					modelVersion: log.modelVersion,
					promptVersion: log.promptVersion,
					apiUrl: log.apiUrl,
					attemptCount: log.attemptCount,
					createdAt: log.createdAt,
				})),
			),
		);
	} catch (error) {
		console.error("[AnalysisLogs] Error:", error.message);
		return res.status(500).json(fail("Loi khi lay nhat ky phan tich", 500));
	}
});

async function syncProductRating(productId) {
	const stats = await Review.aggregate([
		{ $match: { productId } },
		{
			$group: {
				_id: "$productId",
				avgRating: { $avg: "$rating" },
			},
		},
	]);

	const nextRating = stats[0]?.avgRating
		? Number(stats[0].avgRating.toFixed(1))
		: 0;

	await Product.findByIdAndUpdate(productId, {
		rating: nextRating,
		updatedAt: new Date(),
	});
}

function syncMemoryProductRating(productId) {
	const product = db.products.find((item) => item.id === productId);
	if (!product) {
		return;
	}

	const relatedReviews = db.reviews.filter(
		(review) => review.productId === productId,
	);
	const nextRating =
		relatedReviews.length > 0
			? Number(
					(
						relatedReviews.reduce((sum, review) => sum + review.rating, 0) /
						relatedReviews.length
					).toFixed(1),
				)
			: 0;

	product.rating = nextRating;
	product.updatedAt = new Date().toISOString();
}

function normalizeReviewPayload(body) {
	const productId = String(body?.productId ?? "").trim();
	const comment = String(body?.comment ?? "").trim();
	const rating = Number(body?.rating);
	const images = Array.isArray(body?.images)
		? body.images
				.map((item) => String(item).trim())
				.filter(Boolean)
				.filter(isValidReviewImage)
		: [];
	const rawImageCount = Array.isArray(body?.images) ? body.images.length : 0;

	if (
		!productId ||
		!comment ||
		comment.length > 1000 ||
		rawImageCount !== images.length ||
		images.length > 5 ||
		!Number.isFinite(rating) ||
		rating < 1 ||
		rating > 5
	) {
		return null;
	}

	return {
		productId,
		comment,
		rating,
		images,
	};
}

function isValidReviewImage(value) {
	return isHttpUrl(value) || isUploadableReviewImageData(value);
}

function isHttpUrl(value) {
	try {
		const parsed = new URL(value);
		return parsed.protocol === "http:" || parsed.protocol === "https:";
	} catch {
		return false;
	}
}

/**
 * Build aggregated analysis summary from reviews with completed analysis.
 *
 * Returns per-aspect sentiment averages and overall sentiment distribution.
 *
 * @param {Array} reviews - Reviews with analysisResult (already filtered to completed)
 * @param {string} productId
 * @param {number} totalReviewCount - Total reviews for this product (including unanalyzed)
 * @returns {Object} Analysis summary
 */
function buildAnalysisSummary(reviews, productId, totalReviewCount) {
	const totalAnalyzed = reviews.length;

	if (totalAnalyzed === 0) {
		return {
			productId,
			totalReviews: totalReviewCount ?? 0,
			totalAnalyzed: 0,
			sentimentDistribution: { positive: 0, negative: 0, neutral: 0 },
			aspectSummary: [],
		};
	}

	// Count overall sentiment distribution
	const sentimentDist = { positive: 0, negative: 0, neutral: 0 };
	for (const review of reviews) {
		const sentiment = review.analysisResult?.overallSentiment;
		if (sentiment && sentimentDist[sentiment] !== undefined) {
			sentimentDist[sentiment]++;
		}
	}

	// Aggregate per-aspect data
	const aspectMap = new Map();
	for (const review of reviews) {
		const aspects = review.analysisResult?.aspects ?? [];
		for (const aspect of aspects) {
			if (!aspect.aspect) continue;

			if (!aspectMap.has(aspect.aspect)) {
				aspectMap.set(aspect.aspect, {
					aspect: aspect.aspect,
					mentionCount: 0,
					sentimentCounts: { positive: 0, negative: 0, neutral: 0 },
					avgConfidence: 0,
					totalConfidence: 0,
					avgScores: { positive: 0, negative: 0, neutral: 0 },
					totalScores: { positive: 0, negative: 0, neutral: 0 },
				});
			}

			const entry = aspectMap.get(aspect.aspect);
			entry.mentionCount++;
			entry.totalConfidence += aspect.confidence ?? 0;

			if (aspect.sentiment && entry.sentimentCounts[aspect.sentiment] !== undefined) {
				entry.sentimentCounts[aspect.sentiment]++;
			}

			if (aspect.scores) {
				entry.totalScores.positive += aspect.scores.positive ?? 0;
				entry.totalScores.negative += aspect.scores.negative ?? 0;
				entry.totalScores.neutral += aspect.scores.neutral ?? 0;
			}
		}
	}

	// Compute averages and sort by mention count
	const aspectSummary = Array.from(aspectMap.values())
		.map((entry) => ({
			aspect: entry.aspect,
			mentionCount: entry.mentionCount,
			sentimentCounts: entry.sentimentCounts,
			avgConfidence: Number(
				(entry.totalConfidence / entry.mentionCount).toFixed(3),
			),
			avgScores: {
				positive: Number(
					(entry.totalScores.positive / entry.mentionCount).toFixed(3),
				),
				negative: Number(
					(entry.totalScores.negative / entry.mentionCount).toFixed(3),
				),
				neutral: Number(
					(entry.totalScores.neutral / entry.mentionCount).toFixed(3),
				),
			},
		}))
		.sort((a, b) => b.mentionCount - a.mentionCount);

	return {
		productId,
		totalReviews: totalReviewCount ?? totalAnalyzed,
		totalAnalyzed,
		sentimentDistribution: sentimentDist,
		aspectSummary,
	};
}
