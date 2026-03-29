import crypto from "node:crypto";
import express from "express";
import { createOrder, db, paginate, restoreReservedStockForOrder } from "../data/store.js";
import { fail, ok } from "../lib/apiResponse.js";
import { calculateOrderPricing } from "../lib/orderPricing.js";
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
const MOMO_FAILURE_REASON = "Thanh toán MoMo không thành công";

function validateOrderPayload(payload, paymentMethod) {
  const { email, customerName, phone, address, city, district, ward, items } = payload;

  if (!email || !customerName || !phone || !address || !city || !district || !ward || !paymentMethod) {
    return "Vui lòng điền đầy đủ thông tin";
  }

  if (!Array.isArray(items) || items.length === 0) {
    return "Giỏ hàng trống";
  }

  for (const item of items) {
    if (!item.productId || !item.productName || item.price == null || !item.quantity || item.quantity < 1) {
      return "Thông tin sản phẩm không hợp lệ";
    }
  }

  return null;
}

async function ensureProductsAvailable(items) {
  for (const item of items) {
    const product = await Product.findById(item.productId);
    if (!product) {
      throw { status: 404, message: `Sản phẩm "${item.productName}" không tồn tại` };
    }
    if (product.stock < item.quantity) {
      throw {
        status: 409,
        message: `Sản phẩm "${product.name}" không đủ hàng (còn ${product.stock})`,
      };
    }
  }
}

async function updateMongoStock(items, delta) {
  for (const item of items) {
    await Product.findByIdAndUpdate(item.productId, {
      $inc: { stock: delta * item.quantity },
      updatedAt: new Date(),
    });
  }
}

function removeMemoryOrder(orderId) {
  db.orders = db.orders.filter((item) => item.id !== orderId);
}

function buildMomoRedirectUrl(orderId) {
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

async function syncMongoOrderPayment(orderId, resultCode, transId) {
  const order = await Order.findById(orderId).lean();
  if (!order || order.paymentMethod !== "MOMO") {
    return false;
  }

  if (order.paymentStatus === "PAID") {
    return true;
  }

  if (resultCode === 0) {
    await Order.findByIdAndUpdate(orderId, {
      paymentStatus: "PAID",
      momoTransactionId: transId ?? order.momoTransactionId ?? null,
    });
    return true;
  }

  if (order.paymentStatus !== "FAILED") {
    await Order.findByIdAndUpdate(orderId, {
      status: "CANCELLED",
      paymentStatus: "FAILED",
      momoTransactionId: transId ?? order.momoTransactionId ?? null,
      cancelReason: MOMO_FAILURE_REASON,
    });

    for (const item of order.items) {
      await Product.findByIdAndUpdate(item.productId, {
        $inc: { stock: item.quantity },
        updatedAt: new Date(),
      });
    }
  }

  return true;
}

function syncMemoryOrderPayment(orderId, resultCode, transId) {
  const order = db.orders.find((item) => item.id === orderId);
  if (!order || order.paymentMethod !== "MOMO") {
    return false;
  }

  if (order.paymentStatus === "PAID") {
    return true;
  }

  if (resultCode === 0) {
    order.paymentStatus = "PAID";
    order.momoTransactionId = transId ?? order.momoTransactionId ?? null;
    return true;
  }

  if (order.paymentStatus !== "FAILED") {
    order.status = "CANCELLED";
    order.paymentStatus = "FAILED";
    order.momoTransactionId = transId ?? order.momoTransactionId ?? null;
    order.cancelReason = MOMO_FAILURE_REASON;
    restoreReservedStockForOrder(order);
  }

  return true;
}

async function applyMomoPaymentResult(orderId, resultCode, transId) {
  try {
    const updatedMongo = await syncMongoOrderPayment(orderId, resultCode, transId);
    if (updatedMongo) {
      return true;
    }
  } catch {
    return syncMemoryOrderPayment(orderId, resultCode, transId);
  }

  return syncMemoryOrderPayment(orderId, resultCode, transId);
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
    discount,
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
    if (!item.productId || !item.productName || item.price == null || !item.quantity || item.quantity < 1) {
      return res.status(400).json(fail("Thông tin sản phẩm không hợp lệ", 400));
    }
  }

  try {
    for (const item of items) {
      const product = await Product.findById(item.productId);
      if (!product) {
        return res.status(404).json(fail(`Sản phẩm "${item.productName}" không tồn tại`, 404));
      }
      if (product.stock < item.quantity) {
        return res
          .status(409)
          .json(fail(`Sản phẩm "${product.name}" không đủ hàng (còn ${product.stock})`, 409));
      }
    }

    const pricing = calculateOrderPricing(items, { discount });

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
      items,
      ...pricing,
      paymentStatus: "UNPAID",
    });

    for (const item of items) {
      await Product.findByIdAndUpdate(item.productId, {
        $inc: { stock: -item.quantity },
        updatedAt: new Date(),
      });
    }

    return res.status(201).json(ok(serializeOrder(order.toObject()), "Đặt hàng thành công", 201));
  } catch {
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
    discount,
  } = req.body;

  const pricing = calculateOrderPricing(items, { discount });

  try {
    await ensureProductsAvailable(items);

    const orderId = crypto.randomUUID();
    const createdOrder = await Order.create({
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
      items,
      ...pricing,
      paymentStatus: "PENDING",
      momoRequestId: null,
      momoTransactionId: null,
    });

    await updateMongoStock(items, -1);

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
      await updateMongoStock(items, 1);
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

ordersRouter.post("/momo/ipn", express.json(), async (req, res) => {
  try {
    const orderId = String(req.body?.orderId ?? "").trim();
    const resultCode = parseMomoResultCode(req.body?.resultCode);
    const transId = req.body?.transId == null ? null : String(req.body.transId);

    if (!orderId || resultCode == null) {
      return res.status(400).json(fail("Thiếu thông tin kết quả thanh toán MoMo", 400));
    }

    if (!verifyMomoCallbackSignature(req.body)) {
      return res.status(400).json(fail("Chữ ký MoMo không hợp lệ", 400));
    }

    await applyMomoPaymentResult(orderId, resultCode, transId);
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

    const updated = await Order.findByIdAndUpdate(
      req.params.id,
      { status: "CANCELLED", cancelReason, cancelledBy, paymentStatus: "FAILED" },
      { new: true }
    ).lean();

    for (const item of order.items) {
      await Product.findByIdAndUpdate(item.productId, {
        $inc: { stock: item.quantity },
        updatedAt: new Date(),
      });
    }

    return res.json(ok(serializeOrder(updated), "Hủy đơn hàng thành công"));
  } catch {
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
    memOrder.status = "CANCELLED";
    memOrder.cancelReason = cancelReason;
    memOrder.cancelledBy = cancelledBy;
    memOrder.paymentStatus = "FAILED";
    restoreReservedStockForOrder(memOrder);
    return res.json(ok(memOrder, "Hủy đơn hàng thành công"));
  }
});
