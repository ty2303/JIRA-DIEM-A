import express from "express";
import { User } from "../models/User.js";
import { db, paginate, sanitizeUser } from "../data/store.js";
import { fail, ok } from "../lib/apiResponse.js";
import { sendToUser } from "../lib/realtime.js";
import { requireAdmin, requireAuth } from "../middleware/auth.js";
import { getGoogleVerifier, normalizeGoogleIdentity } from "../routes/auth.js";

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
 * POST /api/users/me/google
 * Liên kết tài khoản Google với tài khoản hiện tại bằng Google ID token.
 */
usersRouter.post("/me/google", requireAuth, async (req, res) => {
  const { credential } = req.body;

  if (typeof credential !== "string" || credential.trim().length === 0) {
    return res.status(400).json(fail("Thiếu Google credential", 400));
  }

  const googleVerifier = getGoogleVerifier();
  if (!googleVerifier) {
    return res.status(503).json(fail("Google login chưa được cấu hình trên máy chủ (thiếu GOOGLE_CLIENT_ID)", 503));
  }

  let googleProfile;
  try {
    const ticket = await googleVerifier.client.verifyIdToken({
      idToken: credential.trim(),
      audience: googleVerifier.clientId,
    });
    googleProfile = normalizeGoogleIdentity(ticket.getPayload(), { requireVerifiedEmail: true });
  } catch {
    return res.status(401).json(fail("Google token không hợp lệ hoặc đã hết hạn", 401));
  }

  try {
    // Kiểm tra googleId đã được dùng bởi user khác chưa
    const conflictByGoogleId = await User.findOne({ googleId: googleProfile.googleId });
    if (conflictByGoogleId && conflictByGoogleId._id.toString() !== req.user.id) {
      return res.status(409).json(fail("Tài khoản Google này đã được liên kết với một tài khoản khác", 409));
    }

    const mongoUser = await User.findById(req.user.id);
    if (mongoUser) {
      if (mongoUser.googleId) {
        return res.status(409).json(fail("Tài khoản của bạn đã được liên kết với Google", 409));
      }

      mongoUser.googleId = googleProfile.googleId;
      mongoUser.authProvider = "google";
      if (!mongoUser.avatar && googleProfile.avatar) {
        mongoUser.avatar = googleProfile.avatar;
      }
      await mongoUser.save();

      return res.json(ok(sanitizeUser(mongoUser), "Liên kết tài khoản Google thành công"));
    }
  } catch (error) {
    if (error?.code === 11000) {
      return res.status(409).json(fail("Tài khoản Google này đã được liên kết với một tài khoản khác", 409));
    }
    console.error("Link Google error:", error);
    return res.status(503).json(fail("Không thể liên kết tài khoản Google lúc này", 503));
  }

  // Fallback: in-memory store
  const memUser = db.users.find((u) => u.id === req.user.id);
  if (!memUser) {
    return res.status(404).json(fail("Không tìm thấy người dùng", 404));
  }
  if (memUser.googleId) {
    return res.status(409).json(fail("Tài khoản của bạn đã được liên kết với Google", 409));
  }
  const conflictInMem = db.users.find((u) => u.googleId === googleProfile.googleId && u.id !== req.user.id);
  if (conflictInMem) {
    return res.status(409).json(fail("Tài khoản Google này đã được liên kết với một tài khoản khác", 409));
  }

  memUser.googleId = googleProfile.googleId;
  memUser.authProvider = "google";
  if (!memUser.avatar && googleProfile.avatar) {
    memUser.avatar = googleProfile.avatar;
  }
  return res.json(ok(sanitizeUser(memUser), "Liên kết tài khoản Google thành công"));
});

/**
 * DELETE /api/users/me/google
 * Hủy liên kết tài khoản Google khỏi tài khoản hiện tại.
 * Chỉ cho phép nếu user đã có mật khẩu (tránh khóa tài khoản).
 */
usersRouter.delete("/me/google", requireAuth, async (req, res) => {
  try {
    const mongoUser = await User.findById(req.user.id);
    if (mongoUser) {
      if (!mongoUser.googleId) {
        return res.status(400).json(fail("Tài khoản chưa được liên kết với Google", 400));
      }
      if (!mongoUser.hasPassword) {
        return res.status(400).json(
          fail("Không thể hủy liên kết Google vì đây là phương thức đăng nhập duy nhất. Vui lòng thiết lập mật khẩu trước.", 400),
        );
      }

      mongoUser.googleId = undefined;
      mongoUser.authProvider = "local";
      await mongoUser.save();

      return res.json(ok(sanitizeUser(mongoUser), "Hủy liên kết tài khoản Google thành công"));
    }
  } catch {
    // Fallback
  }

  // Fallback: in-memory store
  const memUser = db.users.find((u) => u.id === req.user.id);
  if (!memUser) {
    return res.status(404).json(fail("Không tìm thấy người dùng", 404));
  }
  if (!memUser.googleId) {
    return res.status(400).json(fail("Tài khoản chưa được liên kết với Google", 400));
  }
  if (!memUser.hasPassword) {
    return res.status(400).json(
      fail("Không thể hủy liên kết Google vì đây là phương thức đăng nhập duy nhất. Vui lòng thiết lập mật khẩu trước.", 400),
    );
  }

  memUser.googleId = undefined;
  memUser.authProvider = "local";
  return res.json(ok(sanitizeUser(memUser), "Hủy liên kết tài khoản Google thành công"));
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
