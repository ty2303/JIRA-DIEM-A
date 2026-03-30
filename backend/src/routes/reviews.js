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
import { Product } from "../models/Product.js";
import { Review } from "../models/Review.js";
import { requireAuth } from "../middleware/auth.js";

export const reviewsRouter = express.Router();

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
  const hasForcedProductId = Object.prototype.hasOwnProperty.call(
    options,
    "productId",
  );
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

    const review = {
      id: crypto.randomUUID(),
      productId: payload.productId,
      userId: req.user.id,
      username: req.user.username,
      rating: payload.rating,
      comment: payload.comment,
      images: payload.images,
      analysisStatus: "none",
      analysisResult: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    db.reviews.unshift(review);
    syncMemoryProductRating(payload.productId);
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
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  await syncProductRating(payload.productId);

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
      review.analysisStatus = "pending";
      review.analysisResult = null;
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
    review.analysisStatus = "pending";
    review.analysisResult = null;
  }

  await review.save();
  await syncProductRating(payload.productId);

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

  res.json(
    ok({ id: reviewId, productId }, "Xoa danh gia thanh cong"),
  );
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
