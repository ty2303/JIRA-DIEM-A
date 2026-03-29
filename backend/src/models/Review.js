import mongoose from "mongoose";

const analysisResultSchema = new mongoose.Schema(
  {
    sentiment: {
      type: String,
      enum: ["positive", "negative", "neutral"],
      required: true,
    },
    sentimentScore: {
      type: Number,
      min: 0,
      max: 1,
      required: true,
    },
    qualityScore: {
      type: Number,
      min: 0,
      max: 1,
      required: true,
    },
    flags: {
      type: [String],
      default: [],
    },
    summary: {
      type: String,
      trim: true,
      default: "",
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
