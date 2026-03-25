import express from "express";
import { isDatabaseReady } from "../data/mongodb.js";
import { db } from "../data/store.js";
import { ok } from "../lib/apiResponse.js";
import { requireAdmin } from "../middleware/auth.js";
import { Category } from "../models/Category.js";
import { Product } from "../models/Product.js";
import { User } from "../models/User.js";

export const adminRouter = express.Router();

adminRouter.get("/dashboard-metrics", requireAdmin, async (_req, res) => {
  const orders = [...db.orders].sort(
    (first, second) =>
      new Date(second.createdAt).getTime() - new Date(first.createdAt).getTime(),
  );

  let totalUsers;
  let totalCustomerUsers;
  let totalProducts;
  let totalCategories;

  if (isDatabaseReady()) {
    [totalUsers, totalCustomerUsers, totalProducts, totalCategories] =
      await Promise.all([
        User.countDocuments(),
        User.countDocuments({ role: "USER" }),
        Product.countDocuments(),
        Category.countDocuments(),
      ]);
  } else {
    totalUsers = db.users.length;
    totalCustomerUsers = db.users.filter((user) => user.role === "USER").length;
    totalProducts = db.products.length;
    totalCategories = db.categories.length;
  }

  const totalRevenue = orders.reduce((sum, order) => sum + order.total, 0);
  const pendingOrders = orders.filter((order) => order.status === "PENDING").length;
  const cancelledOrders = orders.filter(
    (order) => order.status === "CANCELLED",
  ).length;
  const deliveredOrders = orders.filter(
    (order) => order.status === "DELIVERED",
  ).length;
  const cancellationRate = orders.length
    ? Number(((cancelledOrders / orders.length) * 100).toFixed(1))
    : 0;

  const revenueByDay = Array.from({ length: 7 }, (_, index) => {
    const date = new Date();
    date.setDate(date.getDate() - (6 - index));
    const key = date.toISOString().slice(0, 10);
    const revenue = orders
      .filter((order) => order.createdAt.slice(0, 10) === key)
      .reduce((sum, order) => sum + order.total, 0);

    return {
      label: date.toLocaleDateString("vi-VN", {
        day: "2-digit",
        month: "2-digit",
      }),
      revenue: Math.round(revenue),
    };
  });

  const revenueByMonth = Array.from({ length: 6 }, (_, index) => {
    const date = new Date();
    date.setMonth(date.getMonth() - (5 - index), 1);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    const revenue = orders
      .filter((order) => order.createdAt.slice(0, 7) === key)
      .reduce((sum, order) => sum + order.total, 0);

    return {
      label: date.toLocaleDateString("vi-VN", {
        month: "2-digit",
        year: "2-digit",
      }),
      revenue: Math.round(revenue),
    };
  });

  const topSellingProducts = Object.values(
    orders.reduce((accumulator, order) => {
      order.items.forEach((item) => {
        const existing = accumulator[item.productId] ?? {
          name: item.productName,
          sold: 0,
          revenue: 0,
        };
        existing.sold += item.quantity;
        existing.revenue += item.quantity * item.price;
        accumulator[item.productId] = existing;
      });
      return accumulator;
    }, {}),
  )
    .sort((first, second) => second.sold - first.sold)
    .slice(0, 5)
    .map((item) => ({
      ...item,
      shortName:
        item.name.length > 18
          ? `${item.name.slice(0, 18).trimEnd()}…`
          : item.name,
    }));

  const orderStatus = [
    { name: "Đã giao", value: deliveredOrders, color: "#22c55e" },
    { name: "Chờ xử lý", value: pendingOrders, color: "#f59e0b" },
    { name: "Đã hủy", value: cancelledOrders, color: "#ef4444" },
    {
      name: "Khác",
      value: Math.max(
        orders.length - deliveredOrders - pendingOrders - cancelledOrders,
        0,
      ),
      color: "#6366f1",
    },
  ].filter((item) => item.value > 0);

  const recentOrders = orders.slice(0, 5).map((order) => ({
    id: order.id,
    customerName: order.customerName,
    total: order.total,
    status: order.status,
  }));

  return res.json(
    ok({
      totals: {
        users: totalUsers,
        userUsers: totalCustomerUsers,
        products: totalProducts,
        categories: totalCategories,
        orders: orders.length,
        pendingOrders,
        revenue: totalRevenue,
      },
      rates: {
        cancellationRate,
      },
      charts: {
        revenueByDay,
        revenueByMonth,
        orderStatus,
        topSellingProducts,
      },
      recentOrders,
    }),
  );
});
