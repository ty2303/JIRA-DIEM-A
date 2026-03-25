import express from "express";
import { User } from "../models/User.js";
import { db, paginate, sanitizeUser } from "../data/store.js";
import { fail, ok } from "../lib/apiResponse.js";
import { sendToUser } from "../lib/realtime.js";
import { requireAdmin, requireAuth } from "../middleware/auth.js";

export const usersRouter = express.Router();

/**
 * GET /api/users
 * Lấy danh sách users (chỉ admin).
 * Ưu tiên MongoDB, fallback in-memory.
 */
usersRouter.get("/", requireAdmin, async (req, res) => {
  const page = Number(req.query.page ?? 0);
  const size = Number(req.query.size ?? 10);

  try {
    const total = await User.countDocuments();
    const users = await User.find()
      .skip(page * size)
      .limit(size)
      .lean();

    const sanitized = users.map((user) => sanitizeUser(user));
    res.json(ok({
      content: sanitized,
      number: page,
      size,
      totalPages: Math.max(1, Math.ceil(total / size)),
      totalElements: total
    }));
  } catch {
    // Fallback: in-memory store
    const users = db.users.map((user) => sanitizeUser(user));
    res.json(ok(paginate(users, page, size)));
  }
});

/**
 * GET /api/users/me
 * Lấy thông tin user hiện tại.
 */
usersRouter.get("/me", requireAuth, async (req, res) => {
  try {
    const mongoUser = await User.findById(req.user.id);
    if (mongoUser) {
      return res.json(ok(sanitizeUser(mongoUser)));
    }
  } catch {
    // Fallback: in-memory store
  }

  // Fallback: tìm trong in-memory
  const user = db.users.find((item) => item.id === req.user.id);
  if (user) {
    return res.json(ok(sanitizeUser(user)));
  }

  return res.status(404).json(fail("Không tìm thấy người dùng", 404));
});

/**
 * PUT /api/users/me/password
 * Đổi mật khẩu (cần nhập mật khẩu hiện tại).
 */
usersRouter.put("/me/password", requireAuth, async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    return res.status(400).json(fail("Vui lòng nhập đầy đủ thông tin", 400));
  }

  if (newPassword.length < 6) {
    return res.status(400).json(fail("Mật khẩu mới phải có ít nhất 6 ký tự", 400));
  }

  try {
    const mongoUser = await User.findById(req.user.id);
    if (mongoUser) {
      // So sánh mật khẩu hiện tại bằng bcrypt
      const isMatch = await mongoUser.comparePassword(currentPassword);
      if (!isMatch) {
        return res.status(400).json(fail("Mật khẩu hiện tại không đúng", 400));
      }

      mongoUser.password = newPassword; // Sẽ tự hash qua pre-save hook
      await mongoUser.save();

      return res.json(ok(null, "Đổi mật khẩu thành công"));
    }
  } catch {
    // Fallback: in-memory store
  }

  // Fallback: in-memory
  const user = db.users.find((item) => item.id === req.user.id);
  if (!user) {
    return res.status(404).json(fail("Không tìm thấy người dùng", 404));
  }
  if (user.password !== currentPassword) {
    return res.status(400).json(fail("Mật khẩu hiện tại không đúng", 400));
  }
  user.password = newPassword;
  res.json(ok(null, "Đổi mật khẩu thành công"));
});

/**
 * PATCH /api/users/:id/role
 * Cập nhật vai trò user (chỉ admin).
 */
usersRouter.patch("/:id/role", requireAdmin, async (req, res) => {
  const newRole = req.query.role ?? req.body.role;

  if (!newRole || !["USER", "ADMIN"].includes(newRole)) {
    return res.status(400).json(fail("Vai trò không hợp lệ", 400));
  }

  try {
    const mongoUser = await User.findById(req.params.id);
    if (mongoUser) {
      mongoUser.role = newRole;
      await mongoUser.save();
      sendToUser(mongoUser._id.toString(), "/user/queue/role-change", {
        userId: mongoUser._id.toString(),
        newRole
      });
      return res.json(ok(sanitizeUser(mongoUser), "Cập nhật vai trò thành công"));
    }
  } catch {
    // Fallback: in-memory store
  }

  // Fallback: in-memory
  const user = db.users.find((item) => item.id === req.params.id);
  if (!user) {
    return res.status(404).json(fail("Không tìm thấy người dùng", 404));
  }
  user.role = newRole;
  sendToUser(user.id, "/user/queue/role-change", {
    userId: user.id,
    newRole
  });
  res.json(ok(sanitizeUser(user), "Cập nhật vai trò thành công"));
});
