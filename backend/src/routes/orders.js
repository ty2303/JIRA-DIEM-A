import crypto from "node:crypto";
import express from "express";
import { createOrder, db, paginate, restoreReservedStockForOrder } from "../data/store.js";
import { isDatabaseReady } from "../data/mongodb.js";
import { fail, ok } from "../lib/apiResponse.js";
import { calculateOrderPricingFromProducts } from "../lib/orderPricing.js";
import { serializeOrder } from "../lib/catalogSerializers.js";
import {
  MomoConfigError,
  MomoGatewayError,
  createMomoPayment,
  getMomoConfig,
  verifyMomoCallbackSignature,
} from "../lib/momo.js";
import { sendToUser } from "../lib/realtime.js";
import { requireAdmin, requireAuth } from "../middleware/auth.js";
import { Order } from "../models/Order.js";
import { Product } from "../models/Product.js";
import {
  applyMomoPaymentResult,
  cancelMomoPendingOrder,
  MOMO_PENDING_RESULT_CODES,
  restoreMongoStockSafely,
} from "../services/momoPaymentService.js";

export const ordersRouter = express.Router();

const VALID_ORDER_STATUSES = ["PENDING", "CONFIRMED", "SHIPPING", "DELIVERED", "CANCELLED"];
const VALID_TRANSITIONS = {
  PENDING: ["CONFIRMED", "CANCELLED"],
  CONFIRMED: ["SHIPPING", "CANCELLED"],
  SHIPPING: ["DELIVERED"],
  DELIVERED: [],
  CANCELLED: [],
};
const CANCELLABLE_STATUSES = ["PENDING", "CONFIRMED"];

function validateOrderPayload(payload, paymentMethod) {
  const { email, customerName, phone, address, city, district, ward, items } = payload;

  if (!email || !customerName || !phone || !address || !city || !district || !ward || !paymentMethod) {
    return "Vui lòng điền đầy đủ thông tin";
  }

  if (!Array.isArray(items) || items.length === 0) {
    return "Giỏ hàng trống";
  }

  for (const item of items) {
    if (!item.productId || !Number.isInteger(Number(item.quantity)) || Number(item.quantity) < 1) {
      return "Thông tin sản phẩm không hợp lệ";
    }
  }

  return null;
}

async function loadMongoProductsById(items) {
  const productIds = [...new Set(items.map((item) => String(item.productId).trim()))];
  const products = await Product.find({ _id: { $in: productIds } }).lean();
  return new Map(products.map((product) => [product._id, product]));
}

function buildTrustedOrderItems(items, productsById) {
  return items.map((item) => {
    const product = productsById.get(item.productId);

    if (!product) {
      throw {
        status: 404,
        message: `Sản phẩm "${item.productName ?? item.productId}" không tồn tại`,
      };
    }

    return {
      productId: product._id,
      productName: product.name,
      productImage: product.image ?? "",
      brand: product.brand ?? "",
      price: product.price,
      quantity: Number(item.quantity),
    };
  });
}

async function ensureProductsAvailable(items, productsById = null) {
  const resolvedProductsById = productsById ?? (await loadMongoProductsById(items));

  for (const item of items) {
    const product = resolvedProductsById.get(item.productId);
    if (!product) {
      throw {
        status: 404,
        message: `Sản phẩm "${item.productName ?? item.productId}" không tồn tại`,
      };
    }
    if (product.stock < item.quantity) {
      throw {
        status: 409,
        message: `Sản phẩm "${product.name}" không đủ hàng (còn ${product.stock})`,
      };
    }
  }

  return resolvedProductsById;
}

async function updateMongoStock(items, delta) {
  for (const item of items) {
    await Product.findByIdAndUpdate(item.productId, {
      $inc: { stock: delta * item.quantity },
      updatedAt: new Date(),
    });
  }
}

async function rollbackMongoStockRestore(items) {
  await updateMongoStock(items, -1);
}

async function reserveMongoStock(items) {
  const reservedItems = [];

  try {
    for (const item of items) {
      const reserved = await Product.findOneAndUpdate(
        {
          _id: item.productId,
          stock: { $gte: item.quantity },
        },
        {
          $inc: { stock: -item.quantity },
          updatedAt: new Date(),
        },
        { new: true },
      );

      if (!reserved) {
        const product = await Product.findById(item.productId).lean();
        throw {
          status: 409,
          message: `Sản phẩm "${item.productName}" không đủ hàng (còn ${product?.stock ?? 0})`,
        };
      }

      reservedItems.push(item);
    }
  } catch (error) {
    if (reservedItems.length > 0) {
      await updateMongoStock(reservedItems, 1);
    }

    throw error;
  }
}

async function loadStoredOrder(orderId) {
  try {
    const mongoOrder = await Order.findById(orderId).lean();
    if (mongoOrder) {
      return mongoOrder;
    }
  } catch {
  }

  return db.orders.find((item) => item.id === orderId) ?? null;
}

function removeMemoryOrder(orderId) {
  db.orders = db.orders.filter((item) => item.id !== orderId);
}

function buildMomoRedirectUrl(orderId) {
  const backendUrl = process.env.BACKEND_URL?.trim() ?? "";
  if (backendUrl) {
    const url = new URL(`${backendUrl}/api/orders/momo/return`);
    url.searchParams.set("orderId", orderId);
    return url.toString();
  }
  const config = getMomoConfig();
  const redirectUrl = new URL(config.redirectUrl);
  redirectUrl.searchParams.set("orderId", orderId);
  redirectUrl.searchParams.set("paymentMethod", "MOMO");
  return redirectUrl.toString();
}

function parseMomoResultCode(value) {
  const resultCode = Number(value);
  return Number.isFinite(resultCode) ? resultCode : null;
}

/** GET / - Danh sách tất cả đơn hàng (admin) */
ordersRouter.get("/", requireAdmin, async (req, res) => {
  const page = Number(req.query.page ?? 0);
  const size = Number(req.query.size ?? 10);

  try {
    const total = await Order.countDocuments();
    const orders = await Order.find()
      .sort({ createdAt: -1 })
      .skip(page * size)
      .limit(size)
      .lean();

    return res.json(
      ok({
        content: orders.map(serializeOrder),
        number: page,
        size,
        totalPages: Math.max(1, Math.ceil(total / size)),
        totalElements: total,
      })
    );
  } catch {
    return res.json(ok(paginate(db.orders, page, size)));
  }
});

/** GET /my - Đơn hàng của người dùng hiện tại */
ordersRouter.get("/my", requireAuth, async (req, res) => {
  try {
    const orders = await Order.find({ userId: req.user.id })
      .sort({ createdAt: -1 })
      .lean();
    return res.json(ok(orders.map(serializeOrder)));
  } catch {
    const items = db.orders.filter((order) => order.userId === req.user.id);
    return res.json(ok(items));
  }
});

ordersRouter.get("/:id", requireAuth, async (req, res) => {
  try {
    const order = await Order.findById(req.params.id).lean();

    if (!order) {
      const memOrder = db.orders.find((item) => item.id === req.params.id);
      if (!memOrder) {
        return res.status(404).json(fail("Không tìm thấy đơn hàng", 404));
      }
      if (req.user.role !== "ADMIN" && memOrder.userId !== req.user.id) {
        return res.status(403).json(fail("Forbidden", 403));
      }
      return res.json(ok(memOrder));
    }

    if (req.user.role !== "ADMIN" && order.userId !== req.user.id) {
      return res.status(403).json(fail("Forbidden", 403));
    }

    return res.json(ok(serializeOrder(order)));
  } catch {
    if (isDatabaseReady()) {
      return res.status(500).json(fail("Không thể cập nhật trạng thái đơn hàng", 500));
    }

    const memOrder = db.orders.find((item) => item.id === req.params.id);
    if (!memOrder) {
      return res.status(404).json(fail("Không tìm thấy đơn hàng", 404));
    }
    if (req.user.role !== "ADMIN" && memOrder.userId !== req.user.id) {
      return res.status(403).json(fail("Forbidden", 403));
    }
    return res.json(ok(memOrder));
  }
});

/** POST / - Tạo đơn hàng mới */
ordersRouter.post("/", requireAuth, async (req, res) => {
  const {
    email,
    customerName,
    phone,
    address,
    city,
    district,
    ward,
    paymentMethod,
    items,
    note,
  } = req.body;

  if (!email || !customerName || !phone || !address || !city || !district || !ward || !paymentMethod) {
    return res.status(400).json(fail("Vui lòng điền đầy đủ thông tin", 400));
  }

  if (paymentMethod !== "COD") {
    return res.status(400).json(fail("Đơn hàng không phải COD phải khởi tạo qua luồng thanh toán tương ứng", 400));
  }

  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json(fail("Giỏ hàng trống", 400));
  }

  for (const item of items) {
    if (!item.productId || !Number.isInteger(Number(item.quantity)) || Number(item.quantity) < 1) {
      return res.status(400).json(fail("Thông tin sản phẩm không hợp lệ", 400));
    }
  }

  try {
    const productsById = await ensureProductsAvailable(items);
    const trustedItems = buildTrustedOrderItems(items, productsById);
    const pricing = calculateOrderPricingFromProducts(trustedItems, productsById, {
      discount: 0,
    });

    await reserveMongoStock(trustedItems);

    try {
      const order = await Order.create({
        userId: req.user.id,
        email,
        customerName,
        phone,
        address,
        city,
        district,
        ward,
        note: note ?? "",
        paymentMethod,
        items: trustedItems,
        ...pricing,
        paymentStatus: "UNPAID",
      });

      return res.status(201).json(ok(serializeOrder(order.toObject()), "Đặt hàng thành công", 201));
    } catch (mongoOrderError) {
      await updateMongoStock(trustedItems, 1);
      throw mongoOrderError;
    }
  } catch (error) {
    if (error?.status && error?.message) {
      return res.status(error.status).json(fail(error.message, error.status));
    }

    if (isDatabaseReady()) {
      return res.status(500).json(fail("Đặt hàng thất bại", 500));
    }

    try {
      const order = createOrder(req.body, req.user);
      return res.status(201).json(ok(order, "Đặt hàng thành công", 201));
    } catch (fallbackError) {
      return res
        .status(fallbackError.status ?? 500)
        .json(fail(fallbackError.message ?? "Đặt hàng thất bại", fallbackError.status ?? 500));
    }
  }
});

ordersRouter.post("/momo/init", requireAuth, async (req, res) => {
  const paymentMethod = req.body.paymentMethod ?? "MOMO";
  if (paymentMethod !== "MOMO") {
    return res.status(400).json(fail("API này chỉ hỗ trợ phương thức thanh toán MOMO", 400));
  }

  const validationError = validateOrderPayload(req.body, paymentMethod);
  if (validationError) {
    return res.status(400).json(fail(validationError, 400));
  }

  const {
    email,
    customerName,
    phone,
    address,
    city,
    district,
    ward,
    items,
    note,
  } = req.body;

  try {
    const productsById = await ensureProductsAvailable(items);
    const trustedItems = buildTrustedOrderItems(items, productsById);
    const pricing = calculateOrderPricingFromProducts(trustedItems, productsById, {
      discount: 0,
    });
    await reserveMongoStock(trustedItems);

    const orderId = crypto.randomUUID();
    let createdOrder;

    try {
      createdOrder = await Order.create({
        _id: orderId,
        userId: req.user.id,
        email,
        customerName,
        phone,
        address,
        city,
        district,
        ward,
        note: note ?? "",
        paymentMethod,
        items: trustedItems,
        ...pricing,
        paymentStatus: "PENDING",
        momoRequestId: null,
        momoTransactionId: null,
      });
    } catch (mongoOrderError) {
      await updateMongoStock(trustedItems, 1);
      throw mongoOrderError;
    }

    try {
        const payment = await createMomoPayment({
          amount: pricing.total,
          orderId,
          orderInfo: `Thanh toan don hang ${orderId}`,
          redirectUrl: buildMomoRedirectUrl(orderId),
        });

      const updatedOrder = await Order.findByIdAndUpdate(
        orderId,
        { momoRequestId: payment.requestId },
        { new: true, lean: true },
      );

      return res.status(201).json(
        ok(
          {
            order: serializeOrder(updatedOrder ?? createdOrder.toObject()),
            payment,
          },
          "Khởi tạo thanh toán MoMo thành công",
          201,
        ),
      );
    } catch (error) {
      await updateMongoStock(trustedItems, 1);
      await Order.findByIdAndDelete(orderId);
      throw error;
    }
  } catch (error) {
    if (error instanceof MomoConfigError || error instanceof MomoGatewayError) {
      return res.status(error.status).json(fail(error.message, error.status));
    }

    if (error?.status && error?.message) {
      return res.status(error.status).json(fail(error.message, error.status));
    }

    if (isDatabaseReady()) {
      return res.status(500).json(fail("Khởi tạo thanh toán MoMo thất bại", 500));
    }

    try {
      const order = createOrder({ ...req.body, paymentMethod }, req.user);

      try {
        const payment = await createMomoPayment({
          amount: order.total,
          orderId: order.id,
          orderInfo: `Thanh toan don hang ${order.id}`,
          redirectUrl: buildMomoRedirectUrl(order.id),
        });

        order.paymentStatus = "PENDING";
        order.momoRequestId = payment.requestId;

        return res.status(201).json(
          ok(
            {
              order,
              payment,
            },
            "Khởi tạo thanh toán MoMo thành công",
            201,
          ),
        );
      } catch (paymentError) {
        restoreReservedStockForOrder(order);
        removeMemoryOrder(order.id);
        throw paymentError;
      }
    } catch (fallbackError) {
      if (fallbackError instanceof MomoConfigError || fallbackError instanceof MomoGatewayError) {
        return res.status(fallbackError.status).json(fail(fallbackError.message, fallbackError.status));
      }

      return res
        .status(fallbackError.status ?? 500)
        .json(fail(fallbackError.message ?? "Khởi tạo thanh toán MoMo thất bại", fallbackError.status ?? 500));
    }
  }
});

/**
 * GET /momo/return — MoMo redirect callback (user quay lại từ MoMo).
 * KHÔNG phải nguồn xác nhận duy nhất — IPN mới là authoritative.
 * Return chỉ cập nhật optimistic để frontend hiển thị sớm hơn.
 */
ordersRouter.get("/momo/return", async (req, res) => {
  const frontendUrl = process.env.FRONTEND_URL?.split(",")[0]?.trim() ?? "";

  const {
    orderId: rawOrderId,
    resultCode: rawResultCode,
    message: momoMessage,
    requestId,
    transId: rawTransId,
  } = req.query;

  const orderId = String(rawOrderId ?? "").trim();
  const resultCode = parseMomoResultCode(rawResultCode);
  const transId = rawTransId == null ? null : String(rawTransId);

  console.log("[MoMo Return]", JSON.stringify({
    timestamp: new Date().toISOString(),
    orderId,
    resultCode,
    rawResultCode,
    message: momoMessage,
    requestId,
    transId,
    fullQuery: req.query,
  }));

  if (!orderId || resultCode == null) {
    console.warn("[MoMo Return] Missing orderId or resultCode");

    if (frontendUrl) {
      const url = new URL(`${frontendUrl}/checkout/success`);
      url.searchParams.set("error", "invalid_callback");
      return res.redirect(url.toString());
    }
    return res.status(400).json(fail("Thiếu thông tin kết quả thanh toán MoMo", 400));
  }

  let signatureValid = false;
  try {
    signatureValid = verifyMomoCallbackSignature(req.query);
  } catch (configError) {
    console.warn("[MoMo Return] Signature verification skipped:", configError.message);
  }

  if (!signatureValid) {
    console.warn("[MoMo Return] Invalid signature — still redirecting, IPN is authoritative");
  }

  let order = null;
  try {
    order = await Order.findById(orderId).lean();
  } catch {
    /* MongoDB unavailable — fallback below */
  }

  if (!order) {
    order = db.orders.find((item) => item.id === orderId) ?? null;
  }

  if (!order) {
    console.warn("[MoMo Return] Order not found:", orderId);

    if (frontendUrl) {
      const url = new URL(`${frontendUrl}/checkout/success`);
      url.searchParams.set("orderId", orderId);
      url.searchParams.set("resultCode", String(resultCode));
      url.searchParams.set("error", "order_not_found");
      return res.redirect(url.toString());
    }
    return res.status(404).json(fail("Không tìm thấy đơn hàng", 404));
  }

  if (frontendUrl) {
    const url = new URL(`${frontendUrl}/checkout/success`);
    url.searchParams.set("orderId", orderId);
    url.searchParams.set("resultCode", String(resultCode));
    url.searchParams.set("paymentMethod", "MOMO");
    if (momoMessage) url.searchParams.set("message", String(momoMessage));
    if (transId) url.searchParams.set("transId", transId);
    return res.redirect(url.toString());
  }

  return res.json(ok({
    orderId,
    resultCode,
    message: momoMessage ?? null,
    transId,
    paymentMethod: "MOMO",
    paymentStatus: resultCode === 0 || MOMO_PENDING_RESULT_CODES.has(resultCode) ? "PENDING" : "FAILED",
    redirectUrl: null,
  }, resultCode === 0 ? "Thanh toán thành công" : "Kết quả thanh toán MoMo"));
});

ordersRouter.post("/momo/ipn", express.json(), async (req, res) => {
  try {
    const orderId = String(req.body?.orderId ?? "").trim();
    const resultCode = parseMomoResultCode(req.body?.resultCode);
    const amount = Number(req.body?.amount);
    const transId = req.body?.transId == null ? null : String(req.body.transId);
    const requestId = req.body?.requestId == null ? null : String(req.body.requestId);

    if (!orderId || resultCode == null || !Number.isFinite(amount) || amount < 0) {
      return res.status(400).json(fail("Thiếu thông tin kết quả thanh toán MoMo", 400));
    }

    if (!verifyMomoCallbackSignature(req.body)) {
      return res.status(400).json(fail("Chữ ký MoMo không hợp lệ", 400));
    }

    const order = await loadStoredOrder(orderId);
    if (order && Number(order.total) !== amount) {
      return res.status(400).json(fail("Số tiền thanh toán MoMo không khớp với đơn hàng", 400));
    }

    await applyMomoPaymentResult({ orderId, resultCode, transId, requestId });
    return res.status(204).end();
  } catch (error) {
    if (error instanceof MomoConfigError) {
      return res.status(error.status).json(fail(error.message, error.status));
    }

    return res.status(500).json(fail("Không thể xử lý IPN MoMo", 500));
  }
});

/** PATCH /:id/status - Cập nhật trạng thái đơn hàng (admin) */
ordersRouter.patch("/:id/status", requireAdmin, async (req, res) => {
  const newStatus = req.query.status ?? req.body.status;

  if (!VALID_ORDER_STATUSES.includes(newStatus)) {
    return res.status(400).json(fail("Trang thai don hang khong hop le", 400));
  }

  try {
    const currentOrder = await Order.findById(req.params.id).lean();

    if (!currentOrder) {
      const memOrder = db.orders.find((item) => item.id === req.params.id);
      if (!memOrder) {
        return res.status(404).json(fail("Không tìm thấy đơn hàng", 404));
      }
      if (!VALID_TRANSITIONS[memOrder.status]?.includes(newStatus)) {
        return res.status(400).json(fail("Khong the cap nhat trang thai don hang theo luong nay", 400));
      }
      memOrder.status = newStatus;
      sendToUser(memOrder.userId, "/user/queue/order-status", {
        orderId: memOrder.id,
        newStatus: memOrder.status,
      });
      return res.json(ok(memOrder, "Cập nhật trạng thái thành công"));
    }

    if (!VALID_TRANSITIONS[currentOrder.status]?.includes(newStatus)) {
      return res.status(400).json(fail("Khong the cap nhat trang thai don hang theo luong nay", 400));
    }

    const order = await Order.findByIdAndUpdate(req.params.id, { status: newStatus }, { new: true }).lean();
    sendToUser(order.userId, "/user/queue/order-status", {
      orderId: order._id,
      newStatus: order.status,
    });
    return res.json(ok(serializeOrder(order), "Cập nhật trạng thái thành công"));
  } catch {
    if (isDatabaseReady()) {
      return res.status(500).json(fail("Không thể cập nhật trạng thái đơn hàng", 500));
    }

    const memOrder = db.orders.find((item) => item.id === req.params.id);
    if (!memOrder) {
      return res.status(404).json(fail("Không tìm thấy đơn hàng", 404));
    }
    if (!VALID_TRANSITIONS[memOrder.status]?.includes(newStatus)) {
      return res.status(400).json(fail("Khong the cap nhat trang thai don hang theo luong nay", 400));
    }
    memOrder.status = newStatus;
    sendToUser(memOrder.userId, "/user/queue/order-status", {
      orderId: memOrder.id,
      newStatus: memOrder.status,
    });
    return res.json(ok(memOrder, "Cập nhật trạng thái thành công"));
  }
});

/** PATCH /:id/cancel - Hủy đơn hàng (user hủy đơn của mình, admin hủy bất kỳ) */
ordersRouter.patch("/:id/cancel", requireAuth, async (req, res) => {
  const cancelReason = String(req.query.reason ?? req.body.reason ?? "Khác");
  const cancelledBy = req.user.role === "ADMIN" ? "ADMIN" : "USER";

  try {
    const order = await Order.findById(req.params.id).lean();

    if (!order) {
      const memOrder = db.orders.find((item) => item.id === req.params.id);
      if (!memOrder) {
        return res.status(404).json(fail("Không tìm thấy đơn hàng", 404));
      }
      if (cancelledBy === "USER" && memOrder.userId !== req.user.id) {
        return res.status(403).json(fail("Forbidden", 403));
      }
      if (!CANCELLABLE_STATUSES.includes(memOrder.status)) {
        return res.status(400).json(fail("Khong the huy don hang o trang thai nay", 400));
      }

      if (memOrder.paymentMethod === "MOMO") {
        const momoCancelResult = await cancelMomoPendingOrder({
          orderId: memOrder.id,
          cancelReason,
          cancelledBy,
        });

        if (momoCancelResult.reason === "paid") {
          return res.status(400).json(fail("Không thể hủy đơn MoMo đã thanh toán", 400));
        }

        return res.json(ok(momoCancelResult.order, "Hủy đơn hàng thành công"));
      }

      memOrder.status = "CANCELLED";
      memOrder.cancelReason = cancelReason;
      memOrder.cancelledBy = cancelledBy;
      memOrder.paymentStatus = "FAILED";
      restoreReservedStockForOrder(memOrder);
      return res.json(ok(memOrder, "Hủy đơn hàng thành công"));
    }

    if (cancelledBy === "USER" && order.userId !== req.user.id) {
      return res.status(403).json(fail("Forbidden", 403));
    }

    if (!CANCELLABLE_STATUSES.includes(order.status)) {
      return res.status(400).json(fail("Khong the huy don hang o trang thai nay", 400));
    }

    if (order.paymentMethod === "MOMO") {
      const momoCancelResult = await cancelMomoPendingOrder({
        orderId: req.params.id,
        cancelReason,
        cancelledBy,
      });

      if (momoCancelResult.reason === "paid") {
        return res.status(400).json(fail("Không thể hủy đơn MoMo đã thanh toán", 400));
      }

      return res.json(ok(serializeOrder(momoCancelResult.order), "Hủy đơn hàng thành công"));
    }

    await restoreMongoStockSafely(order);

    let updated;

    try {
      updated = await Order.findByIdAndUpdate(
        req.params.id,
        { status: "CANCELLED", cancelReason, cancelledBy, paymentStatus: "FAILED" },
        { new: true }
      ).lean();

      if (!updated) {
        throw new Error("Không thể cập nhật trạng thái hủy đơn hàng");
      }
    } catch (error) {
      await rollbackMongoStockRestore(order.items);
      throw error;
    }

    return res.json(ok(serializeOrder(updated), "Hủy đơn hàng thành công"));
  } catch {
    if (isDatabaseReady()) {
      return res.status(500).json(fail("Không thể hủy đơn hàng", 500));
    }

    const memOrder = db.orders.find((item) => item.id === req.params.id);
    if (!memOrder) {
      return res.status(404).json(fail("Không tìm thấy đơn hàng", 404));
    }
    if (cancelledBy === "USER" && memOrder.userId !== req.user.id) {
      return res.status(403).json(fail("Forbidden", 403));
    }
    if (!CANCELLABLE_STATUSES.includes(memOrder.status)) {
      return res.status(400).json(fail("Khong the huy don hang o trang thai nay", 400));
    }

    if (memOrder.paymentMethod === "MOMO") {
      const momoCancelResult = await cancelMomoPendingOrder({
        orderId: memOrder.id,
        cancelReason,
        cancelledBy,
      });

      if (momoCancelResult.reason === "paid") {
        return res.status(400).json(fail("Không thể hủy đơn MoMo đã thanh toán", 400));
      }

      return res.json(ok(momoCancelResult.order, "Hủy đơn hàng thành công"));
    }

    memOrder.status = "CANCELLED";
    memOrder.cancelReason = cancelReason;
    memOrder.cancelledBy = cancelledBy;
    memOrder.paymentStatus = "FAILED";
    restoreReservedStockForOrder(memOrder);
    return res.json(ok(memOrder, "Hủy đơn hàng thành công"));
  }
});
