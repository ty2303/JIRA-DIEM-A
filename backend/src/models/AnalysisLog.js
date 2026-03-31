import mongoose from "mongoose";

/**
 * AI Analysis Call Audit Trail
 *
 * Logs every sentiment analysis API call with input, output, duration,
 * and error details. Used for monitoring, debugging, and auditing AI usage.
 */

const analysisLogSchema = new mongoose.Schema(
	{
		_id: {
			type: String,
			required: true,
		},
		reviewId: {
			type: String,
			required: true,
			index: true,
		},
		productId: {
			type: String,
			index: true,
		},
		inputText: {
			type: String,
			required: true,
		},
		status: {
			type: String,
			enum: ["success", "failed"],
			required: true,
		},
		result: {
			type: mongoose.Schema.Types.Mixed,
			default: null,
		},
		error: {
			message: { type: String, default: null },
			code: { type: String, default: null },
		},
		durationMs: {
			type: Number,
			default: null,
		},
		modelVersion: {
			type: String,
			default: null,
		},
		promptVersion: {
			type: String,
			default: null,
		},
		apiUrl: {
			type: String,
			default: null,
		},
		attemptCount: {
			type: Number,
			default: 1,
		},
		createdAt: {
			type: Date,
			default: Date.now,
			index: true,
		},
	},
	{
		versionKey: false,
	},
);

// Compound index for querying logs by review or product
analysisLogSchema.index({ reviewId: 1, createdAt: -1 });
analysisLogSchema.index({ productId: 1, createdAt: -1 });

export const AnalysisLog = mongoose.model("AnalysisLog", analysisLogSchema);
