import crypto from "node:crypto";
import express from "express";
import { isDatabaseReady } from "../data/mongodb.js";
import { db, paginate, withCategory } from "../data/store.js";
import { fail, ok } from "../lib/apiResponse.js";
import { serializeProduct } from "../lib/catalogSerializers.js";
import { Category } from "../models/Category.js";
import { Product } from "../models/Product.js";
import { requireAdmin } from "../middleware/auth.js";

export const productsRouter = express.Router();

productsRouter.get("/", async (req, res) => {
  const page = Math.max(0, Number.parseInt(String(req.query.page ?? "0"), 10) || 0);
  const size = Math.max(1, Number.parseInt(String(req.query.size ?? "12"), 10) || 12);
  const search = String(req.query.search ?? "").trim();
  const categoryId = String(req.query.categoryId ?? "").trim();

  if (!isDatabaseReady()) {
    const normalizedSearch = search.toLowerCase();
    const items = db.products
      .map(withCategory)
      .filter((product) => {
        const matchesSearch =
          !normalizedSearch ||
          product.name.toLowerCase().includes(normalizedSearch) ||
          product.brand.toLowerCase().includes(normalizedSearch) ||
          String(product.specs ?? "")
            .toLowerCase()
            .includes(normalizedSearch);
        const matchesCategory = !categoryId || product.categoryId === categoryId;
        return matchesSearch && matchesCategory;
      })
      .sort((first, second) => {
        return new Date(second.updatedAt ?? 0).getTime() - new Date(first.updatedAt ?? 0).getTime();
      })
      .map(toSerializableProduct);

    return res.json(ok(paginate(items, page, size)));
  }

  const filter = {};

  if (search) {
    filter.$or = [
      { name: { $regex: search, $options: "i" } },
      { brand: { $regex: search, $options: "i" } },
      { specs: { $regex: search, $options: "i" } }
    ];
  }

  if (categoryId) {
    filter.categoryId = categoryId;
  }

  const [items, totalElements, categories] = await Promise.all([
    Product.find(filter)
      .sort({ updatedAt: -1, createdAt: -1 })
      .skip(page * size)
      .limit(size)
      .lean(),
    Product.countDocuments(filter),
    Category.find().lean()
  ]);

  const categoryMap = new Map(categories.map((category) => [category._id, category.name]));

  res.json(
    ok({
      content: items.map((product) =>
        serializeProduct(product, categoryMap.get(product.categoryId) ?? "")
      ),
      number: page,
      size,
      totalPages: Math.max(1, Math.ceil(totalElements / size)),
      totalElements
    })
  );
});

productsRouter.get("/:id", async (req, res) => {
  if (!isDatabaseReady()) {
    const product = db.products.find((item) => item.id === req.params.id);

    if (!product) {
      return res.status(404).json(fail("Khong tim thay san pham", 404));
    }

    return res.json(ok(toSerializableProduct(withCategory(product))));
  }

  const product = await Product.findById(req.params.id).lean();

  if (!product) {
    return res.status(404).json(fail("Khong tim thay san pham", 404));
  }

  const category = product.categoryId
    ? await Category.findById(product.categoryId).lean()
    : null;

  return res.json(ok(serializeProduct(product, category?.name ?? "")));
});

productsRouter.post("/", requireAdmin, async (req, res) => {
  if (!isDatabaseReady()) {
    const created = {
      id: `prod-${crypto.randomUUID()}`,
      name: req.body.name,
      brand: req.body.brand,
      categoryId: req.body.categoryId,
      price: req.body.price,
      originalPrice: req.body.originalPrice,
      image: req.body.image,
      rating: req.body.rating ?? 0,
      badge: req.body.badge ?? "",
      specs: req.body.specs ?? "",
      stock: req.body.stock ?? 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    db.products.unshift(created);
    return res
      .status(201)
      .json(ok(toSerializableProduct(withCategory(created)), "Tao san pham thanh cong", 201));
  }

  const product = await Product.create({
    _id: `prod-${crypto.randomUUID()}`,
    name: req.body.name,
    brand: req.body.brand,
    categoryId: req.body.categoryId,
    price: req.body.price,
    originalPrice: req.body.originalPrice,
    image: req.body.image,
    rating: req.body.rating ?? 0,
    badge: req.body.badge ?? "",
    specs: req.body.specs ?? "",
    stock: req.body.stock ?? 0,
    createdAt: new Date(),
    updatedAt: new Date()
  });

  const category = product.categoryId
    ? await Category.findById(product.categoryId).lean()
    : null;

  res
    .status(201)
    .json(ok(serializeProduct(product.toObject(), category?.name ?? ""), "Tao san pham thanh cong", 201));
});

productsRouter.post("/batch", requireAdmin, async (req, res) => {
  const items = Array.isArray(req.body) ? req.body : [];

  if (items.length === 0) {
    return res.status(400).json(fail("Danh sach san pham khong hop le", 400));
  }

  if (!isDatabaseReady()) {
    const created = items.map((item) => ({
      id: `prod-${crypto.randomUUID()}`,
      name: item.name,
      brand: item.brand,
      categoryId: item.categoryId,
      price: item.price,
      originalPrice: item.originalPrice,
      image: item.image,
      rating: item.rating ?? 0,
      badge: item.badge ?? "",
      specs: item.specs ?? "",
      stock: item.stock ?? 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }));
    db.products.push(...created);
    return res
      .status(201)
      .json(ok(created.map((product) => toSerializableProduct(withCategory(product))), "Import san pham thanh cong", 201));
  }

  const created = await Product.insertMany(
    items.map((item) => ({
      _id: `prod-${crypto.randomUUID()}`,
      name: item.name,
      brand: item.brand,
      categoryId: item.categoryId,
      price: item.price,
      originalPrice: item.originalPrice,
      image: item.image,
      rating: item.rating ?? 0,
      badge: item.badge ?? "",
      specs: item.specs ?? "",
      stock: item.stock ?? 0,
      createdAt: new Date(),
      updatedAt: new Date()
    }))
  );

  const categories = await Category.find().lean();
  const categoryMap = new Map(categories.map((category) => [category._id, category.name]));

  res.status(201).json(
    ok(
      created.map((product) =>
        serializeProduct(product.toObject(), categoryMap.get(product.categoryId) ?? "")
      ),
      "Import san pham thanh cong",
      201
    )
  );
});

productsRouter.put("/:id", requireAdmin, async (req, res) => {
  if (!isDatabaseReady()) {
    const product = db.products.find((item) => item.id === req.params.id);

    if (!product) {
      return res.status(404).json(fail("Khong tim thay san pham", 404));
    }

    Object.assign(product, req.body, { updatedAt: new Date().toISOString() });
    return res.json(ok(toSerializableProduct(withCategory(product)), "Cap nhat san pham thanh cong"));
  }

  const product = await Product.findByIdAndUpdate(
    req.params.id,
    {
      ...req.body,
      updatedAt: new Date()
    },
    { new: true, runValidators: true }
  ).lean();

  if (!product) {
    return res.status(404).json(fail("Khong tim thay san pham", 404));
  }

  const category = product.categoryId
    ? await Category.findById(product.categoryId).lean()
    : null;

  return res.json(ok(serializeProduct(product, category?.name ?? ""), "Cap nhat san pham thanh cong"));
});

productsRouter.delete("/:id", requireAdmin, async (req, res) => {
  if (!isDatabaseReady()) {
    const index = db.products.findIndex((item) => item.id === req.params.id);
    if (index >= 0) {
      db.products.splice(index, 1);
    }
    return res.json(ok(null, "Xoa san pham thanh cong"));
  }

  await Product.findByIdAndDelete(req.params.id);
  res.json(ok(null, "Xoa san pham thanh cong"));
});

function toSerializableProduct(product) {
  return serializeProduct(
    {
      _id: product.id ?? product._id,
      ...product
    },
    product.categoryName ?? ""
  );
}
