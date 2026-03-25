import crypto from "node:crypto";
import mongoose from "mongoose";

const orderItemSchema = new mongoose.Schema(
  {
    productId: { type: String, required: true },
    productName: { type: String, required: true },
    productImage: { type: String, default: "" },
    brand: { type: String, default: "" },
    price: { type: Number, required: true, min: 0 },
    quantity: { type: Number, required: true, min: 1 },
  },
  { _id: false }
);

const orderSchema = new mongoose.Schema(
  {
    _id: { type: String, default: () => crypto.randomUUID() },
    userId: { type: String, required: true, index: true },
    email: { type: String, required: true, trim: true },
    customerName: { type: String, required: true, trim: true },
    phone: { type: String, required: true },
    address: { type: String, required: true },
    city: { type: String, required: true },
    district: { type: String, required: true },
    ward: { type: String, required: true },
    note: { type: String, default: "" },
    paymentMethod: {
      type: String,
      enum: ["COD"],
      required: true,
    },
    status: {
      type: String,
      enum: ["PENDING", "CONFIRMED", "SHIPPING", "DELIVERED", "CANCELLED"],
      default: "PENDING",
    },
    items: { type: [orderItemSchema], required: true },
    subtotal: { type: Number, required: true, min: 0 },
    shippingFee: { type: Number, required: true, min: 0 },
    discount: { type: Number, required: true, min: 0, default: 0 },
    total: { type: Number, required: true, min: 0 },
    paymentStatus: {
      type: String,
      enum: ["PAID", "UNPAID", "FAILED"],
      default: "UNPAID",
    },
    cancelReason: { type: String },
    cancelledBy: { type: String, enum: ["USER", "ADMIN"] },
    createdAt: { type: Date, default: Date.now },
  },
  { versionKey: false }
);

export const Order = mongoose.model("Order", orderSchema);
