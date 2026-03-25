import { User } from "../models/User.js";
import { verifyToken, getUserByToken, sanitizeUser } from "../data/store.js";
import { fail } from "../lib/apiResponse.js";

/**
 * Middleware: gắn user vào req nếu có Bearer token hợp lệ.
 * Ưu tiên tìm user từ MongoDB, fallback sang in-memory store.
 */
export async function attachUser(req, _res, next) {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith("Bearer ")
    ? authHeader.slice(7)
    : null;

  if (token) {
    const user = await resolveUserFromToken(token);
    if (user) {
      req.user = user;
      req.token = token;
      return next();
    }
  }

  next();
}

export async function resolveUserFromToken(token) {
  if (!token) {
    return null;
  }

  const userId = verifyToken(token);
  if (userId) {
    try {
      const mongoUser = await User.findById(userId);
      if (mongoUser) {
        return sanitizeUser(mongoUser);
      }
    } catch {
      // Nếu userId không phải ObjectId hợp lệ, fallback sang in-memory
    }
  }

  const memUser = getUserByToken(token);
  return memUser ? sanitizeUser(memUser) : null;
}

export function requireAuth(req, res, next) {
  if (!req.user) {
    return res.status(401).json(fail("Unauthorized", 401));
  }
  next();
}

export function requireAdmin(req, res, next) {
  if (!req.user) {
    return res.status(401).json(fail("Unauthorized", 401));
  }
  if (req.user.role !== "ADMIN") {
    return res.status(403).json(fail("Forbidden", 403));
  }
  next();
}
