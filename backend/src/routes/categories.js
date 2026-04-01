import express from "express";
import { isDatabaseReady } from "../data/mongodb.js";
import { db } from "../data/store.js";
import { fail, ok } from "../lib/apiResponse.js";
import { serializeCategory } from "../lib/catalogSerializers.js";
import { Category } from "../models/Category.js";
import { Product } from "../models/Product.js";
import { requireAdmin } from "../middleware/auth.js";

export const categoriesRouter = express.Router();

categoriesRouter.get("/", async (_req, res) => {
  if (!isDatabaseReady()) {
    return res.json(
      ok(
        db.categories
          .map((category) => ({
            _id: category.id,
            ...category
          }))
          .sort((first, second) => first.name.localeCompare(second.name))
          .map((category) =>
            serializeCategory(
              category,
              db.products.filter((product) => product.categoryId === category._id).length
            )
          )
      )
    );
  }

  const [categories, counts] = await Promise.all([
    Category.find().sort({ name: 1 }).lean(),
    Product.aggregate([{ $group: { _id: "$categoryId", productCount: { $sum: 1 } } }])
  ]);

  const countMap = new Map(counts.map((item) => [item._id, item.productCount]));

  res.json(ok(categories.map((category) => serializeCategory(category, countMap.get(category._id) ?? 0))));
});

categoriesRouter.post("/", requireAdmin, async (req, res) => {
  if (!isDatabaseReady()) {
    const category = {
      id: `cat-${Date.now()}`,
      name: req.body.name,
      slug: String(req.body.name || "")
        .trim()
        .toLowerCase()
        .replace(/\s+/g, "-"),
      description: req.body.description ?? "",
      icon: req.body.icon ?? "Smartphone",
      createdAt: new Date().toISOString()
    };
    db.categories.push(category);
    return res
      .status(201)
      .json(ok(serializeCategory({ _id: category.id, ...category }, 0), "Tao danh muc thanh cong", 201));
  }

  const category = await Category.create({
    _id: `cat-${Date.now()}`,
    name: req.body.name,
    slug: String(req.body.name || "")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "-"),
    description: req.body.description ?? "",
    icon: req.body.icon ?? "Smartphone",
    createdAt: new Date()
  });

  res.status(201).json(ok(serializeCategory(category.toObject(), 0), "Tao danh muc thanh cong", 201));
});

categoriesRouter.put("/:id", requireAdmin, async (req, res) => {
  const updates = { ...req.body };

  if (req.body.name && !req.body.slug) {
    updates.slug = String(req.body.name).trim().toLowerCase().replace(/\s+/g, "-");
  }

  if (!isDatabaseReady()) {
    const category = db.categories.find((item) => item.id === req.params.id);
    if (!category) {
      return res.status(404).json(fail("Khong tim thay danh muc", 404));
    }

    Object.assign(category, updates);
    const productCount = db.products.filter((product) => product.categoryId === req.params.id).length;
    return res.json(ok(serializeCategory({ _id: category.id, ...category }, productCount)));
  }

  const category = await Category.findByIdAndUpdate(req.params.id, updates, {
    new: true,
    runValidators: true
  }).lean();

  if (!category) {
    return res.status(404).json(fail("Khong tim thay danh muc", 404));
  }

  const productCount = await Product.countDocuments({ categoryId: req.params.id });

  res.json(ok(serializeCategory(category, productCount)));
});

categoriesRouter.delete("/:id", requireAdmin, async (req, res) => {
  const force = String(req.query.force ?? "false").toLowerCase() === "true";

  if (!isDatabaseReady()) {
    const index = db.categories.findIndex((item) => item.id === req.params.id);
    if (index < 0) {
      return res.status(404).json(fail("Khong tim thay danh muc", 404));
    }

    const hasProducts = db.products.some((product) => product.categoryId === req.params.id);
    if (hasProducts && !force) {
      return res.status(409).json(fail("Danh muc dang co san pham, dung force=true de xoa", 409));
    }

    if (hasProducts) {
      db.products.forEach((product) => {
        if (product.categoryId === req.params.id) {
          delete product.categoryId;
          product.updatedAt = new Date().toISOString();
        }
      });
    }

    db.categories.splice(index, 1);
    return res.json(ok(null, "Xoa danh muc thanh cong"));
  }

  const category = await Category.findById(req.params.id).lean();
  if (!category) {
    return res.status(404).json(fail("Khong tim thay danh muc", 404));
  }

  const productCount = await Product.countDocuments({ categoryId: req.params.id });
  if (productCount > 0 && !force) {
    return res.status(409).json(fail("Danh muc dang co san pham, dung force=true de xoa", 409));
  }

  if (productCount > 0) {
    await Product.updateMany(
      { categoryId: req.params.id },
      { $unset: { categoryId: "" }, $set: { updatedAt: new Date() } },
    );
  }

  await Category.findByIdAndDelete(req.params.id);
  res.json(ok(null, "Xoa danh muc thanh cong"));
});
