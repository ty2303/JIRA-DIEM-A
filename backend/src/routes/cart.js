import express from "express";
import { isDatabaseReady } from "../data/mongodb.js";
import {
  addToCartItem,
  clearCart,
  getCart,
  removeCartItem,
  updateCartItem,
} from "../data/store.js";
import { fail, ok } from "../lib/apiResponse.js";
import { serializeProduct } from "../lib/catalogSerializers.js";
import { requireAuth } from "../middleware/auth.js";
import { Product } from "../models/Product.js";

export const cartRouter = express.Router();

cartRouter.use(requireAuth);

/**
 * Làm phong phú cart items với giá mới nhất từ MongoDB.
 * Nếu DB chưa sẵn sàng → giữ nguyên data từ store (fallback).
 */
async function enrichCartWithFreshPrices(cart) {
  if (!isDatabaseReady() || !cart.items.length) return cart;

  const productIds = cart.items.map((i) => i.productId);
  const products = await Product.find({ _id: { $in: productIds } }).lean();
  const productMap = new Map(products.map((p) => [p._id, p]));

  const enrichedItems = cart.items.map((item) => {
    const freshProduct = productMap.get(item.productId);
    if (!freshProduct) return item;
    return {
      ...item,
      product: serializeProduct(freshProduct, item.product?.categoryName ?? ""),
    };
  });

  const freshTotal = enrichedItems.reduce(
    (sum, item) => sum + (item.product?.price ?? 0) * item.quantity,
    0
  );

  return { ...cart, items: enrichedItems, total: freshTotal };
}

// GET /api/cart
cartRouter.get("/", async (req, res) => {
  const cart = getCart(req.user.id);
  const enriched = await enrichCartWithFreshPrices(cart);
  res.json(ok(enriched));
});

// POST /api/cart/items
cartRouter.post("/items", async (req, res) => {
  const { productId, quantity = 1 } = req.body;

  if (!productId) {
    return res.status(400).json(fail("productId là bắt buộc", 400));
  }

  const qty = Number(quantity);
  if (!Number.isInteger(qty) || qty <= 0 || qty > 99) {
    return res.status(400).json(fail("Số lượng không hợp lệ", 400));
  }

  const result = addToCartItem(req.user.id, productId, qty);

  if (result.error) {
    return res.status(result.status).json(fail(result.error, result.status));
  }

  const enriched = await enrichCartWithFreshPrices(result.cart);
  res.json(ok(enriched, "Thêm vào giỏ hàng thành công"));
});

// PATCH /api/cart/items/:productId
cartRouter.patch("/items/:productId", async (req, res) => {
  const { quantity } = req.body;

  const qty = Number(quantity);
  if (!Number.isInteger(qty) || qty <= 0 || qty > 99) {
    return res.status(400).json(fail("Số lượng không hợp lệ", 400));
  }

  const result = updateCartItem(req.user.id, req.params.productId, qty);

  if (result.error) {
    return res.status(result.status).json(fail(result.error, result.status));
  }

  const enriched = await enrichCartWithFreshPrices(result.cart);
  res.json(ok(enriched, "Cập nhật giỏ hàng thành công"));
});

// DELETE /api/cart/items/:productId
cartRouter.delete("/items/:productId", async (req, res) => {
  const result = removeCartItem(req.user.id, req.params.productId);
  const enriched = await enrichCartWithFreshPrices(result.cart);
  res.json(ok(enriched, "Xóa sản phẩm khỏi giỏ hàng"));
});

// DELETE /api/cart
cartRouter.delete("/", (req, res) => {
  const result = clearCart(req.user.id);
  res.json(ok(result.cart, "Xóa giỏ hàng thành công"));
});
