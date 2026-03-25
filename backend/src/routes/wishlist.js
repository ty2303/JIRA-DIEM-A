import express from "express";
import { isDatabaseReady } from "../data/mongodb.js";
import { db, withCategory } from "../data/store.js";
import { fail, ok } from "../lib/apiResponse.js";
import { serializeProduct } from "../lib/catalogSerializers.js";
import { Category } from "../models/Category.js";
import { Product } from "../models/Product.js";
import { Wishlist } from "../models/Wishlist.js";
import { requireAuth } from "../middleware/auth.js";

export const wishlistRouter = express.Router();

wishlistRouter.use(requireAuth);

wishlistRouter.get("/", async (req, res) => {
  if (!isDatabaseReady()) {
    const ids = db.wishlists[req.user.id] ?? [];
    const items = ids
      .map((id) => db.products.find((product) => product.id === id))
      .filter(Boolean)
      .map((product) => {
        const enriched = withCategory(product);
        return serializeProduct({ _id: product.id, ...enriched }, enriched.categoryName);
      });
    return res.json(ok(items));
  }

  const wishlist = await Wishlist.findOne({ userId: req.user.id }).lean();
  const items = await getWishlistProducts(wishlist?.productIds ?? []);
  res.json(ok(items));
});

wishlistRouter.post("/sync", async (req, res) => {
  const requestedIds = Array.isArray(req.body?.productIds)
    ? [...new Set(req.body.productIds.filter((id) => typeof id === "string"))]
    : [];

  if (requestedIds.length === 0) {
    if (!isDatabaseReady()) {
      const ids = db.wishlists[req.user.id] ?? [];
      const items = ids
        .map((id) => db.products.find((product) => product.id === id))
        .filter(Boolean)
        .map((product) => {
          const enriched = withCategory(product);
          return serializeProduct({ _id: product.id, ...enriched }, enriched.categoryName);
        });
      return res.json(ok(items));
    }

    const wishlist = await Wishlist.findOne({ userId: req.user.id }).lean();
    const items = await getWishlistProducts(wishlist?.productIds ?? []);
    return res.json(ok(items));
  }

  if (!isDatabaseReady()) {
    const validIds = requestedIds.filter((productId) =>
      db.products.some((product) => product.id === productId)
    );
    const nextIds = new Set([...(db.wishlists[req.user.id] ?? []), ...validIds]);
    db.wishlists[req.user.id] = [...nextIds];

    const items = db.wishlists[req.user.id]
      .map((id) => db.products.find((product) => product.id === id))
      .filter(Boolean)
      .map((product) => {
        const enriched = withCategory(product);
        return serializeProduct({ _id: product.id, ...enriched }, enriched.categoryName);
      });

    return res.json(ok(items));
  }

  const validProducts = await Product.find({ _id: { $in: requestedIds } }, { _id: 1 }).lean();
  const validIds = validProducts.map((product) => product._id);
  const wishlist = await Wishlist.findOne({ userId: req.user.id }).lean();
  const nextIds = [...new Set([...(wishlist?.productIds ?? []), ...validIds])];

  await Wishlist.findOneAndUpdate(
    { userId: req.user.id },
    {
      userId: req.user.id,
      productIds: nextIds,
      updatedAt: new Date()
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  const items = await getWishlistProducts(nextIds);
  return res.json(ok(items));
});

wishlistRouter.post("/:productId", async (req, res) => {
  const productId = req.params.productId;
  const productExists = isDatabaseReady()
    ? await Product.exists({ _id: productId })
    : db.products.some((product) => product.id === productId);

  if (!productExists) {
    return res.status(404).json(fail("San pham khong ton tai", 404));
  }

  if (!isDatabaseReady()) {
    const ids = new Set(db.wishlists[req.user.id] ?? []);
    if (ids.has(productId)) {
      ids.delete(productId);
    } else {
      ids.add(productId);
    }
    db.wishlists[req.user.id] = [...ids];
    const items = db.wishlists[req.user.id]
      .map((id) => db.products.find((product) => product.id === id))
      .filter(Boolean)
      .map((product) => {
        const enriched = withCategory(product);
        return serializeProduct({ _id: product.id, ...enriched }, enriched.categoryName);
      });
    return res.json(ok(items));
  }

  const wishlist = await Wishlist.findOne({ userId: req.user.id });
  const nextIds = new Set(wishlist?.productIds ?? []);

  if (nextIds.has(productId)) {
    nextIds.delete(productId);
  } else {
    nextIds.add(productId);
  }

  await Wishlist.findOneAndUpdate(
    { userId: req.user.id },
    {
      userId: req.user.id,
      productIds: [...nextIds],
      updatedAt: new Date()
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  const items = await getWishlistProducts([...nextIds]);
  res.json(ok(items));
});

wishlistRouter.delete("/", async (req, res) => {
  if (!isDatabaseReady()) {
    db.wishlists[req.user.id] = [];
    return res.json(ok(null, "Da xoa wishlist"));
  }

  await Wishlist.findOneAndUpdate(
    { userId: req.user.id },
    {
      userId: req.user.id,
      productIds: [],
      updatedAt: new Date()
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  res.json(ok(null, "Da xoa wishlist"));
});

async function getWishlistProducts(productIds) {
  if (productIds.length === 0) {
    return [];
  }

  const [products, categories] = await Promise.all([
    Product.find({ _id: { $in: productIds } }).lean(),
    Category.find().lean()
  ]);
  const categoryMap = new Map(categories.map((category) => [category._id, category.name]));
  const productMap = new Map(
    products.map((product) => [
      product._id,
      serializeProduct(product, categoryMap.get(product.categoryId) ?? "")
    ])
  );

  return productIds.map((id) => productMap.get(id)).filter(Boolean);
}
