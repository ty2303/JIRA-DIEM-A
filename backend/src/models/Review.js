import mongoose from "mongoose";

const aspectScoresSchema = new mongoose.Schema(
	{
		positive: { type: Number, min: 0, max: 1, default: 0 },
		negative: { type: Number, min: 0, max: 1, default: 0 },
		neutral: { type: Number, min: 0, max: 1, default: 0 },
	},
	{ _id: false },
);

const aspectResultSchema = new mongoose.Schema(
	{
		aspect: {
			type: String,
			required: true,
		},
		sentiment: {
			type: String,
			enum: ["positive", "negative", "neutral"],
			required: true,
		},
		confidence: {
			type: Number,
			min: 0,
			max: 1,
			required: true,
		},
		scores: {
			type: aspectScoresSchema,
			required: true,
		},
	},
	{ _id: false },
);

const analysisResultSchema = new mongoose.Schema(
	{
		aspects: {
			type: [aspectResultSchema],
			required: true,
		},
		overallSentiment: {
			type: String,
			enum: ["positive", "negative", "neutral"],
			required: true,
		},
		overallConfidence: {
			type: Number,
			min: 0,
			max: 1,
			required: true,
		},
		analyzedAt: {
			type: Date,
			required: true,
		},
	},
	{ _id: false },
);

const reviewSchema = new mongoose.Schema(
	{
		_id: {
			type: String,
			required: true,
		},
		productId: {
			type: String,
			ref: "Product",
			required: true,
			index: true,
		},
		userId: {
			type: String,
			required: true,
			index: true,
		},
		username: {
			type: String,
			required: true,
			trim: true,
		},
		rating: {
			type: Number,
			required: true,
			min: 1,
			max: 5,
		},
		comment: {
			type: String,
			required: true,
			trim: true,
			maxlength: 1000,
		},
		images: {
			type: [String],
			default: [],
			validate: {
				validator(value) {
					return Array.isArray(value) && value.length <= 5;
				},
				message: "Review chi duoc toi da 5 anh",
			},
		},
		createdAt: {
			type: Date,
			default: Date.now,
		},
		updatedAt: {
			type: Date,
			default: Date.now,
		},
		analysisStatus: {
			type: String,
			enum: ["none", "pending", "completed", "failed"],
			default: "none",
		},
		analysisResult: {
			type: analysisResultSchema,
			default: null,
		},
	},
	{
		versionKey: false,
	},
);

reviewSchema.index({ productId: 1, userId: 1 }, { unique: true });

export const Review = mongoose.model("Review", reviewSchema);
