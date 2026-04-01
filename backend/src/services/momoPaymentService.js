import { db, restoreReservedStockForOrder } from "../data/store.js";
import { Order } from "../models/Order.js";
import { Product } from "../models/Product.js";

export const MOMO_PENDING_RESULT_CODES = new Set([1000, 7000, 7002]);
export const MOMO_FAILURE_REASON = "Thanh toán MoMo không thành công";

function classifyMomoResult(resultCode) {
  if (resultCode === 0) {
    return "success";
  }

  if (MOMO_PENDING_RESULT_CODES.has(resultCode)) {
    return "pending";
  }

  return "failure";
}

export async function restoreMongoStockSafely(order) {
  const restoredItems = [];

  try {
    for (const item of order.items) {
      const updatedProduct = await Product.findByIdAndUpdate(
        item.productId,
        {
          $inc: { stock: item.quantity },
          updatedAt: new Date(),
        },
        { new: true },
      );

      if (!updatedProduct) {
        throw new Error(`Không thể hoàn trả tồn kho cho sản phẩm ${item.productId}`);
      }

      restoredItems.push(item);
    }
  } catch (error) {
    for (const item of restoredItems) {
      await Product.findByIdAndUpdate(item.productId, {
        $inc: { stock: -item.quantity },
        updatedAt: new Date(),
      });
    }

    throw error;
  }
}

async function rollbackMongoStockRestore(order) {
  for (const item of order.items) {
    await Product.findByIdAndUpdate(item.productId, {
      $inc: { stock: -item.quantity },
      updatedAt: new Date(),
    });
  }
}

async function loadOrder(orderId) {
  let mongoOrder = null;

  try {
    mongoOrder = await Order.findById(orderId).lean();
  } catch {
    mongoOrder = null;
  }

  if (mongoOrder) {
    return { source: "mongo", order: mongoOrder };
  }

  const order = db.orders.find((item) => item.id === orderId) ?? null;
  return order ? { source: "memory", order } : null;
}

async function persistMongoOrder(orderId, updates) {
  const order = await Order.findByIdAndUpdate(orderId, updates, {
    new: true,
    lean: true,
  });

  return order;
}

function persistMemoryOrder(order, updates) {
  Object.assign(order, updates);
  return order;
}

function isTerminalOrder(order) {
  return order.paymentStatus === "PAID" || order.paymentStatus === "FAILED" || order.status === "CANCELLED";
}

export async function applyMomoPaymentResult({ orderId, resultCode, transId = null, requestId = null }) {
  const loaded = await loadOrder(orderId);

  if (!loaded || loaded.order.paymentMethod !== "MOMO") {
    return { handled: false, changed: false, order: null };
  }

  const { order, source } = loaded;
  const outcome = classifyMomoResult(resultCode);

  if (outcome === "pending") {
    return {
      handled: true,
      changed: false,
      order,
      paymentStatus: order.paymentStatus,
    };
  }

  if (isTerminalOrder(order) || order.paymentStatus !== "PENDING") {
    return {
      handled: true,
      changed: false,
      order,
      paymentStatus: order.paymentStatus,
    };
  }

  if (outcome === "success") {
    const paidAt = order.paidAt ?? new Date();
    const updates = {
      paymentMethod: "MOMO",
      paymentStatus: "PAID",
      paidAt,
      momoTransactionId: transId ?? order.momoTransactionId ?? null,
      momoRequestId: requestId ?? order.momoRequestId ?? null,
    };

    const updatedOrder = source === "mongo"
      ? await persistMongoOrder(orderId, updates)
      : persistMemoryOrder(order, {
          ...updates,
          paidAt: paidAt instanceof Date ? paidAt.toISOString() : paidAt,
        });

    return {
      handled: true,
      changed: true,
      order: updatedOrder,
      paymentStatus: "PAID",
    };
  }

  const updates = {
    status: "CANCELLED",
    paymentMethod: "MOMO",
    paymentStatus: "FAILED",
    paidAt: null,
    momoTransactionId: transId ?? order.momoTransactionId ?? null,
    momoRequestId: requestId ?? order.momoRequestId ?? null,
    cancelReason: order.cancelReason ?? MOMO_FAILURE_REASON,
  };

  if (source === "mongo") {
    await restoreMongoStockSafely(order);
    try {
      const updatedOrder = await persistMongoOrder(orderId, updates);

      if (!updatedOrder) {
        throw new Error("Không thể cập nhật trạng thái đơn MoMo sau khi hoàn trả tồn kho");
      }

      return {
        handled: true,
        changed: true,
        order: updatedOrder,
        paymentStatus: "FAILED",
      };
    } catch (error) {
      await rollbackMongoStockRestore(order);
      throw error;
    }
  } else {
    restoreReservedStockForOrder(order);
  }

  const updatedOrder = persistMemoryOrder(order, updates);

  return {
    handled: true,
    changed: true,
    order: updatedOrder,
    paymentStatus: "FAILED",
  };
}

export async function cancelMomoPendingOrder({ orderId, cancelReason, cancelledBy }) {
  const loaded = await loadOrder(orderId);

  if (!loaded || loaded.order.paymentMethod !== "MOMO") {
    return { handled: false, order: null };
  }

  const { order, source } = loaded;

  if (order.paymentStatus === "PAID") {
    return {
      handled: true,
      changed: false,
      reason: "paid",
      order,
    };
  }

  if (order.status === "CANCELLED" || order.paymentStatus === "FAILED") {
    return {
      handled: true,
      changed: false,
      reason: "already_terminal",
      order,
    };
  }

  if (order.paymentStatus !== "PENDING") {
    return {
      handled: true,
      changed: false,
      reason: "not_pending",
      order,
    };
  }

  const updates = {
    status: "CANCELLED",
    paymentStatus: "FAILED",
    paidAt: null,
    cancelReason,
    cancelledBy,
  };

  if (source === "mongo") {
    await restoreMongoStockSafely(order);
    try {
      const updatedOrder = await persistMongoOrder(orderId, updates);

      if (!updatedOrder) {
        throw new Error("Không thể cập nhật trạng thái hủy đơn MoMo sau khi hoàn trả tồn kho");
      }

      return {
        handled: true,
        changed: true,
        reason: "cancelled",
        order: updatedOrder,
      };
    } catch (error) {
      await rollbackMongoStockRestore(order);
      throw error;
    }
  } else {
    restoreReservedStockForOrder(order);
  }

  const updatedOrder = persistMemoryOrder(order, updates);

  return {
    handled: true,
    changed: true,
    reason: "cancelled",
    order: updatedOrder,
  };
}
